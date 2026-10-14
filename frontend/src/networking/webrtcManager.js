// WebRTC Peer Connection Manager for Symphonix
// Handles RTCPeerConnection lifecycle, SDP offer/answer negotiation, ICE candidate queuing, and Data Channels.

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

export class WebRTCManager {
  constructor({ peerId, isHost, signalingClient, onStateChange, onControlMessage, onTransferChunk }) {
    this.peerId = peerId;
    this.isHost = isHost;
    this.signalingClient = signalingClient;
    this.onStateChange = onStateChange;
    this.onControlMessage = onControlMessage;
    this.onTransferChunk = onTransferChunk;

    // peerId -> RTCPeerConnection
    this.peers = new Map();
    // peerId -> { control: RTCDataChannel, transfer: RTCDataChannel }
    this.channels = new Map();
    // peerId -> RTCIceCandidate[]
    this.candidateQueues = new Map();
  }

  // Called by Host when a new guest joins the space
  async connectToPeer(remotePeerId) {
    if (this.peers.has(remotePeerId)) return;

    const pc = this._createPeerConnection(remotePeerId);

    // Host creates the data channels
    const controlChannel = pc.createDataChannel('symphonix-control', { ordered: true });
    const transferChannel = pc.createDataChannel('symphonix-transfer', { ordered: true });
    transferChannel.binaryType = 'arraybuffer';

    this._setupDataChannelEvents(remotePeerId, 'control', controlChannel);
    this._setupDataChannelEvents(remotePeerId, 'transfer', transferChannel);

    this.channels.set(remotePeerId, { control: controlChannel, transfer: transferChannel });

    // Host initiates SDP offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.signalingClient.sendSignal(remotePeerId, 'offer', offer);
    } catch (err) {
      console.error(`Error creating SDP offer for ${remotePeerId}:`, err);
    }
  }

  // Called when signaling messages arrive (offer, answer, ice-candidate)
  async handleSignal(signal) {
    const { fromPeer, type, payload } = signal;

    if (type === 'offer') {
      await this._handleRemoteOffer(fromPeer, payload);
    } else if (type === 'answer') {
      await this._handleRemoteAnswer(fromPeer, payload);
    } else if (type === 'ice-candidate') {
      await this._handleRemoteCandidate(fromPeer, payload);
    }
  }

  async _handleRemoteOffer(remotePeerId, offer) {
    const pc = this._createPeerConnection(remotePeerId);

    // Guest listens for incoming data channels created by Host
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      if (channel.label === 'symphonix-transfer') {
        channel.binaryType = 'arraybuffer';
      }
      const existing = this.channels.get(remotePeerId) || {};
      const key = channel.label === 'symphonix-control' ? 'control' : 'transfer';
      existing[key] = channel;
      this.channels.set(remotePeerId, existing);
      this._setupDataChannelEvents(remotePeerId, key, channel);
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      // Flush any ICE candidates that arrived before the remote offer was set
      await this._flushCandidateQueue(remotePeerId);

      // Create and send SDP answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.signalingClient.sendSignal(remotePeerId, 'answer', answer);
    } catch (err) {
      console.error(`Error handling SDP offer from ${remotePeerId}:`, err);
    }
  }

  async _handleRemoteAnswer(remotePeerId, answer) {
    const pc = this.peers.get(remotePeerId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      // Flush queued candidates
      await this._flushCandidateQueue(remotePeerId);
    } catch (err) {
      console.error(`Error handling SDP answer from ${remotePeerId}:`, err);
    }
  }

  async _handleRemoteCandidate(remotePeerId, candidateInit) {
    if (!candidateInit) return;
    const candidate = new RTCIceCandidate(candidateInit);
    const pc = this.peers.get(remotePeerId);

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn(`Error adding ICE candidate from ${remotePeerId}:`, err);
      }
    } else {
      // Queue candidate until remote description is set
      if (!this.candidateQueues.has(remotePeerId)) {
        this.candidateQueues.set(remotePeerId, []);
      }
      this.candidateQueues.get(remotePeerId).push(candidate);
    }
  }

  async _flushCandidateQueue(remotePeerId) {
    const pc = this.peers.get(remotePeerId);
    if (!pc || !this.candidateQueues.has(remotePeerId)) return;

    const queue = this.candidateQueues.get(remotePeerId);
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn(`Error adding queued ICE candidate for ${remotePeerId}:`, err);
      }
    }
    this.candidateQueues.delete(remotePeerId);
  }

  _createPeerConnection(remotePeerId) {
    if (this.peers.has(remotePeerId)) {
      return this.peers.get(remotePeerId);
    }

    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
    this.peers.set(remotePeerId, pc);

    // ICE candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.sendSignal(remotePeerId, 'ice-candidate', event.candidate.toJSON());
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (this.onStateChange) {
        this.onStateChange(remotePeerId, pc.connectionState);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (this.onStateChange) {
          this.onStateChange(remotePeerId, pc.iceConnectionState);
        }
      }
    };

    return pc;
  }

  _setupDataChannelEvents(remotePeerId, channelType, channel) {
    channel.onopen = () => {
      if (this.onStateChange) {
        this.onStateChange(remotePeerId, 'connected', channelType);
      }
    };

    channel.onclose = () => {
      if (this.onStateChange) {
        this.onStateChange(remotePeerId, 'closed', channelType);
      }
    };

    channel.onerror = (err) => {
      console.warn(`DataChannel error on ${channelType} to ${remotePeerId}:`, err);
    };

    channel.onmessage = (event) => {
      if (channelType === 'control') {
        try {
          const msg = JSON.parse(event.data);
          if (this.onControlMessage) {
            this.onControlMessage(remotePeerId, msg);
          }
        } catch (e) {
          console.error('Invalid control message:', event.data);
        }
      } else if (channelType === 'transfer') {
        if (this.onTransferChunk) {
          this.onTransferChunk(remotePeerId, event.data);
        }
      }
    };
  }

  // Send control message to a specific peer
  sendControlMessage(remotePeerId, messageObj) {
    const peerChannels = this.channels.get(remotePeerId);
    if (peerChannels && peerChannels.control && peerChannels.control.readyState === 'open') {
      peerChannels.control.send(JSON.stringify(messageObj));
      return true;
    }
    return false;
  }

  // Broadcast control message to all connected peers
  broadcastControlMessage(messageObj) {
    const payload = JSON.stringify(messageObj);
    let sentCount = 0;
    for (const [peerId, peerChannels] of this.channels.entries()) {
      if (peerChannels.control && peerChannels.control.readyState === 'open') {
        try {
          peerChannels.control.send(payload);
          sentCount++;
        } catch (_) {}
      }
    }
    return sentCount;
  }

  // Get transfer channel for a peer
  getTransferChannel(remotePeerId) {
    const peerChannels = this.channels.get(remotePeerId);
    return peerChannels ? peerChannels.transfer : null;
  }

  // Check if any peer data channel is open
  isAnyChannelOpen() {
    for (const peerChannels of this.channels.values()) {
      if (peerChannels.control && peerChannels.control.readyState === 'open') {
        return true;
      }
    }
    return false;
  }

  // Close and cleanup
  closeAll() {
    for (const channels of this.channels.values()) {
      if (channels.control) channels.control.close();
      if (channels.transfer) channels.transfer.close();
    }
    this.channels.clear();

    for (const pc of this.peers.values()) {
      pc.close();
    }
    this.peers.clear();
    this.candidateQueues.clear();
  }
}
