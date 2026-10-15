import { api } from '../services/api';
import { performanceMetrics } from './performanceMetrics';

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
    this.pollInterval = 400; // Check for new messages every 400ms
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
      // Attach a timestamp so the receiver can measure delivery time
      const enrichedPayload =
        payload && typeof payload === 'object'
          ? { ...payload, _signalingSentAt: Date.now() }
          : { data: payload, _signalingSentAt: Date.now() };

      const t0 = performance.now();
      await api.sendSignal(this.spaceCode, this.peerId, toPeer, type, enrichedPayload);
      const httpLatency = performance.now() - t0;
      performanceMetrics.recordSignalingHttpLatency(httpLatency);
    } catch (err) {
      console.error(`Signaling error sending ${type} to ${toPeer}:`, err);
    }
  }

  async _poll() {
    if (!this.polling || !this.spaceCode) return;

    try {
      const t0 = performance.now();
      const data = await api.pollSignals(this.spaceCode, this.peerId);
      const httpLatency = performance.now() - t0;
      performanceMetrics.recordSignalingHttpLatency(httpLatency);

      if (data && data.signals && data.signals.length > 0) {
        for (const sig of data.signals) {
          // Measure how long the message took to arrive
          performanceMetrics.recordSignalingReceived(sig);

          if (sig.type === 'peer-joined') {
            performanceMetrics.markPeerDiscovered(sig.fromPeer);
            if (this.onPeerJoined) this.onPeerJoined(sig);
          } else if (sig.type === 'peer-left') {
            performanceMetrics.markPeerDisconnected(sig.fromPeer);
            if (this.onPeerLeft) this.onPeerLeft(sig);
          } else {
            if (this.onSignalReceived) this.onSignalReceived(sig);
          }
        }
      }
    } catch (err) {
      // Ignore temporary network drops while polling
    }

    if (this.polling) {
      this.pollTimer = setTimeout(() => this._poll(), this.pollInterval);
    }
  }
}
