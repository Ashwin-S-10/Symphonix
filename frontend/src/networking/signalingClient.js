import { api } from '../services/api';

export class SignalingClient {
  constructor({ spaceCode, peerId, isHost, onPeerJoined, onSignalReceived, onPeerLeft }) {
    this.spaceCode = spaceCode;
    this.peerId = peerId;
    this.isHost = isHost;
    this.onPeerJoined = onPeerJoined;
    this.onSignalReceived = onSignalReceived;
    this.onPeerLeft = onPeerLeft;
    this.polling = false;
    this.pollTimer = null;
    this.pollInterval = 400; // ms
  }

  start() {
    if (this.polling) return;
    this.polling = true;
    this._poll();
  }

  stop() {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async sendSignal(toPeer, type, payload) {
    if (!this.spaceCode) return;
    try {
      await api.sendSignal(this.spaceCode, this.peerId, toPeer, type, payload);
    } catch (err) {
      console.error(`Signaling error sending ${type} to ${toPeer}:`, err);
    }
  }

  async _poll() {
    if (!this.polling || !this.spaceCode) return;

    try {
      const data = await api.pollSignals(this.spaceCode, this.peerId);
      if (data && data.signals && data.signals.length > 0) {
        for (const sig of data.signals) {
          if (sig.type === 'peer-joined') {
            if (this.onPeerJoined) this.onPeerJoined(sig);
          } else if (sig.type === 'peer-left') {
            if (this.onPeerLeft) this.onPeerLeft(sig);
          } else {
            if (this.onSignalReceived) this.onSignalReceived(sig);
          }
        }
      }
    } catch (err) {
      // Signaling poll failure / network glitch
    }

    if (this.polling) {
      this.pollTimer = setTimeout(() => this._poll(), this.pollInterval);
    }
  }
}
