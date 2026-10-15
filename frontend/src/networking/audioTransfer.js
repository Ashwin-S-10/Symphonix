import { createAudioMetaMessage, createAudioTransferCompleteMessage, createReadyMessage } from './protocol';
import { performanceMetrics } from './performanceMetrics';

const CHUNK_SIZE = 16384; // Send in 16 KB pieces

export class AudioTransferService {
  constructor({ webrtcManager, onTransferProgress, onTransferComplete }) {
    this.webrtcManager = webrtcManager;
    this.onTransferProgress = onTransferProgress;
    this.onTransferComplete = onTransferComplete;

    // Keeps track of files currently downloading
    this.incomingTransfers = new Map();
  }

  // Host: sends a song file to a peer
  async sendTrack(remotePeerId, spaceId, track, generationId) {
    const transferChannel = this.webrtcManager.getTransferChannel(remotePeerId);
    if (!transferChannel || transferChannel.readyState !== 'open') {
      throw new Error(`Data channel to peer ${remotePeerId} is not open`);
    }

    // 1. Load the song data into memory
    const response = await fetch(track.audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to load audio for ${track.title}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const totalBytes = arrayBuffer.byteLength;
    const chunkCount = Math.ceil(totalBytes / CHUNK_SIZE);
    const transferKey = `${track.id}-${remotePeerId}-${Date.now()}`;
    const transferStartTime = performance.now();

    performanceMetrics.recordTransferStart(transferKey, track.id, remotePeerId, totalBytes, 'sender');

    // 2. Send file details (name, size, chunk count) so the peer can prepare
    const metaMsg = createAudioMetaMessage(
      spaceId,
      track.id,
      generationId,
      track.fileName,
      totalBytes,
      chunkCount,
      CHUNK_SIZE
    );
    this.webrtcManager.sendControlMessage(remotePeerId, metaMsg);

    // Brief pause so the receiver has time to set up
    await new Promise((r) => setTimeout(r, 50));

    // 3. Send chunks one by one, pausing if the channel gets full
    transferChannel.bufferedAmountLowThreshold = 65536; // Pause when queue hits 64 KB

    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunkData = arrayBuffer.slice(start, end);

      // Prefix each piece with its index so the receiver can order them properly
      const packet = new Uint8Array(4 + chunkData.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, i, false); // Chunk number
      packet.set(new Uint8Array(chunkData), 4);

      // Wait for the channel buffer to drain before sending more
      if (transferChannel.bufferedAmount > 65536) {
        await new Promise((resolve) => {
          const handler = () => {
            transferChannel.removeEventListener('bufferedamountlow', handler);
            resolve();
          };
          transferChannel.addEventListener('bufferedamountlow', handler);
        });
      }

      transferChannel.send(packet.buffer);
      performanceMetrics.recordChunkSent(remotePeerId, packet.byteLength);

      if (this.onTransferProgress) {
        const percent = Math.min(100, Math.round(((i + 1) / chunkCount) * 100));
        this.onTransferProgress({
          trackId: track.id,
          peerId: remotePeerId,
          percent,
          transferredBytes: end,
          totalBytes
        });
      }
    }

    // 4. Let the peer know all chunks have been sent
    const completeMsg = createAudioTransferCompleteMessage(track.id, generationId, totalBytes);
    this.webrtcManager.sendControlMessage(remotePeerId, completeMsg);

    const transferEndTime = performance.now();
    performanceMetrics.recordTransferComplete(
      transferKey,
      track.id,
      remotePeerId,
      totalBytes,
      'sender',
      transferStartTime,
      transferEndTime
    );

    return { totalBytes, chunkCount };
  }

  // Participant: set up storage for an incoming song
  handleAudioMeta(msg) {
    const startTime = performance.now();
    this.incomingTransfers.set(msg.trackId, {
      meta: msg,
      chunks: new Array(msg.chunkCount),
      receivedCount: 0,
      receivedBytes: 0,
      startTime
    });

    performanceMetrics.recordTransferStart(
      msg.trackId,
      msg.trackId,
      this.webrtcManager.peerId,
      msg.fileSize,
      'receiver'
    );
  }

  // Participant: store each chunk as it arrives
  handleTransferChunk(remotePeerId, arrayBuffer) {
    if (arrayBuffer.byteLength < 4) return;

    // Read the chunk index from the first 4 bytes
    const view = new DataView(arrayBuffer);
    const chunkIndex = view.getUint32(0, false);
    const chunkData = arrayBuffer.slice(4);

    // Put the chunk into the matching transfer slot
    for (const [trackId, transfer] of this.incomingTransfers.entries()) {
      if (chunkIndex < transfer.meta.chunkCount && !transfer.chunks[chunkIndex]) {
        transfer.chunks[chunkIndex] = chunkData;
        transfer.receivedCount++;
        transfer.receivedBytes += chunkData.byteLength;

        const percent = Math.round((transfer.receivedCount / transfer.meta.chunkCount) * 100);
        if (this.onTransferProgress) {
          this.onTransferProgress({
            trackId,
            peerId: remotePeerId,
            percent,
            transferredBytes: transfer.receivedBytes,
            totalBytes: transfer.meta.fileSize
          });
        }
        break;
      }
    }
  }

  // Participant: finish transfer and verify the file
  handleTransferComplete(remotePeerId, msg) {
    const transfer = this.incomingTransfers.get(msg.trackId);
    if (!transfer) return null;

    // Assemble all chunks into a playable audio file
    const validChunks = transfer.chunks.filter(Boolean);
    const blob = new Blob(validChunks, { type: 'audio/mpeg' });

    // Double check that the file size matches the original
    const isIntegrityVerified = blob.size === transfer.meta.fileSize;
    const objectUrl = URL.createObjectURL(blob);
    const completionTime = performance.now();

    // Save transfer speed and duration stats
    performanceMetrics.recordTransferComplete(
      msg.trackId,
      msg.trackId,
      remotePeerId,
      transfer.meta.fileSize,
      'receiver',
      transfer.startTime,
      completionTime
    );

    // Let the host know we are ready to play
    const readyMsg = createReadyMessage(
      transfer.meta.spaceId,
      this.webrtcManager.peerId,
      msg.trackId,
      msg.generationId
    );
    this.webrtcManager.sendControlMessage(remotePeerId, readyMsg);

    const result = {
      trackId: msg.trackId,
      generationId: msg.generationId,
      fileName: transfer.meta.fileName,
      totalBytes: blob.size,
      isVerified: isIntegrityVerified,
      objectUrl
    };

    if (this.onTransferComplete) {
      this.onTransferComplete(result);
    }

    return result;
  }
}
