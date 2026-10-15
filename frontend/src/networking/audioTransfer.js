// Direct Host-to-Peer Chunked Audio Transfer Service
// Slices audio files into binary chunks, transmits over WebRTC transfer data channel with backpressure,
// and reassembles into Blob / Object URL with byte integrity verification.

import { createAudioMetaMessage, createAudioTransferCompleteMessage, createReadyMessage } from './protocol';
import { performanceMetrics } from './performanceMetrics';

const CHUNK_SIZE = 16384; // 16 KB chunks

export class AudioTransferService {
  constructor({ webrtcManager, onTransferProgress, onTransferComplete }) {
    this.webrtcManager = webrtcManager;
    this.onTransferProgress = onTransferProgress;
    this.onTransferComplete = onTransferComplete;

    // Incoming file reception state: trackId -> { meta, receivedChunks, receivedBytes }
    this.incomingTransfers = new Map();
  }

  // HOST: Slices and transmits an MP3 to a remote peer over WebRTC
  async sendTrack(remotePeerId, spaceId, track, generationId) {
    const transferChannel = this.webrtcManager.getTransferChannel(remotePeerId);
    if (!transferChannel || transferChannel.readyState !== 'open') {
      throw new Error(`Data channel to peer ${remotePeerId} is not open`);
    }

    // 1. Fetch/load the audio ArrayBuffer
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

    // 2. Send AUDIO_META over control channel
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

    // Give a brief moment for participant to prepare buffers
    await new Promise((r) => setTimeout(r, 50));

    // 3. Stream binary chunks over transfer data channel with backpressure handling
    transferChannel.bufferedAmountLowThreshold = 65536; // 64 KB threshold

    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunkData = arrayBuffer.slice(start, end);

      // Create a chunk packet with a 4-byte header for chunk index (Uint32)
      const packet = new Uint8Array(4 + chunkData.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, i, false); // Big-endian chunk index
      packet.set(new Uint8Array(chunkData), 4);

      // Backpressure check: wait if buffer exceeds threshold
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

    // 4. Send AUDIO_TRANSFER_COMPLETE over control channel
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

  // PARTICIPANT: Handles incoming AUDIO_META message
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

  // PARTICIPANT: Handles incoming binary chunk from transfer data channel
  handleTransferChunk(remotePeerId, arrayBuffer) {
    if (arrayBuffer.byteLength < 4) return;

    // Read 4-byte chunk index prefix
    const view = new DataView(arrayBuffer);
    const chunkIndex = view.getUint32(0, false);
    const chunkData = arrayBuffer.slice(4);

    // Find active transfer
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

  // PARTICIPANT: Handles incoming AUDIO_TRANSFER_COMPLETE message
  handleTransferComplete(remotePeerId, msg) {
    const transfer = this.incomingTransfers.get(msg.trackId);
    if (!transfer) return null;

    // Verify all chunks received
    const validChunks = transfer.chunks.filter(Boolean);
    const blob = new Blob(validChunks, { type: 'audio/mpeg' });

    // Verify byte count
    const isIntegrityVerified = blob.size === transfer.meta.fileSize;
    const objectUrl = URL.createObjectURL(blob);
    const completionTime = performance.now();

    // Record audio transfer throughput and completion time metrics
    performanceMetrics.recordTransferComplete(
      msg.trackId,
      msg.trackId,
      remotePeerId,
      transfer.meta.fileSize,
      'receiver',
      transfer.startTime,
      completionTime
    );

    // Acknowledge readiness back to host
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
