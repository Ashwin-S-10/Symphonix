export class PerformanceMetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.isHost = false;
    this.spaceCode = null;
    this.localPeerId = null;

    // Connection time
    this.joinInitiatedTimestamp = null;
    this.peerDiscoveryTimestamps = new Map();
    this.connectionSetupTimes = new Map();

    // Signaling delay
    this.signalingDelays = [];
    this.signalingHttpLatencies = [];
    this.lastSignalingDelay = null;
    this.pollingIntervalMs = 400;

    // Song transfer stats
    this.activeTransfers = new Map();
    this.completedTransfers = [];

    // Playback start accuracy
    this.lastTargetStartTime = null;
    this.lastHostActualStartTime = null;
    this.playbackStartSkews = [];
    this.lastPlaybackStartSkew = null;

    // Playback drift over time
    this.driftSamples = [];
    this.lastDriftMs = 0;
    this.maxDriftMs = 0;

    this.connectedPeers = new Set();
    this.listeners = new Set();
  }

  setContext({ isHost, spaceCode, localPeerId }) {
    this.isHost = isHost;
    this.spaceCode = spaceCode;
    this.localPeerId = localPeerId;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.getMetricsSnapshot());
      } catch (err) {
        console.warn('Metrics listener error:', err);
      }
    }
  }

  // --- Connection Setup Time ---
  markJoinInitiated(peerId = 'local') {
    this.joinInitiatedTimestamp = performance.now();
  }

  markHostSpaceCreated(peerId) {
    this.joinInitiatedTimestamp = performance.now();
  }

  markPeerDiscovered(remotePeerId) {
    this.peerDiscoveryTimestamps.set(remotePeerId, performance.now());
  }

  markConnectionOpen(remotePeerId) {
    let setupTimeMs = null;
    const now = performance.now();

    if (this.peerDiscoveryTimestamps.has(remotePeerId)) {
      setupTimeMs = Math.round(now - this.peerDiscoveryTimestamps.get(remotePeerId));
    } else if (this.joinInitiatedTimestamp) {
      setupTimeMs = Math.round(now - this.joinInitiatedTimestamp);
    } else {
      setupTimeMs = 0;
    }

    this.connectionSetupTimes.set(remotePeerId, setupTimeMs);
    this.connectedPeers.add(remotePeerId);
    this._notifyListeners();
    return setupTimeMs;
  }

  markPeerDisconnected(remotePeerId) {
    this.connectedPeers.delete(remotePeerId);
    this._notifyListeners();
  }

  // --- Signaling Delay ---
  recordSignalingReceived(sig) {
    let delayMs = null;
    const now = Date.now();

    if (sig.payload && sig.payload._signalingSentAt) {
      delayMs = Math.max(0, now - sig.payload._signalingSentAt);
    } else if (sig.timestamp) {
      delayMs = Math.max(0, now - Math.round(sig.timestamp * 1000));
    }

    if (delayMs !== null) {
      this.signalingDelays.push(delayMs);
      this.lastSignalingDelay = delayMs;
      if (this.signalingDelays.length > 50) this.signalingDelays.shift();
      this._notifyListeners();
    }
  }

  recordSignalingHttpLatency(latencyMs) {
    if (typeof latencyMs === 'number' && latencyMs >= 0) {
      this.signalingHttpLatencies.push(Math.round(latencyMs));
      if (this.signalingHttpLatencies.length > 50) this.signalingHttpLatencies.shift();
    }
  }

  // --- Audio Transfer Speed & Duration ---
  recordTransferStart(transferKey, trackId, peerId, totalBytes, role = 'sender') {
    const startTime = performance.now();
    this.activeTransfers.set(transferKey, {
      transferKey,
      trackId,
      peerId,
      totalBytes,
      role,
      startTime,
      bytesTransferred: 0
    });
    this._notifyListeners();
  }

  recordChunkSent(peerId, bytes) {
    // Track chunk bytes sent
  }

  recordTransferComplete(transferKey, trackId, peerId, totalBytes, role, startTimeParam, endTimeParam) {
    const endTime = endTimeParam || performance.now();
    let startTime = startTimeParam;

    if (!startTime && this.activeTransfers.has(transferKey)) {
      startTime = this.activeTransfers.get(transferKey).startTime;
    }
    if (!startTime) {
      startTime = endTime - 1000;
    }

    const durationMs = Math.max(1, Math.round(endTime - startTime));
    const durationSec = durationMs / 1000;

    const throughputBps = (totalBytes * 8) / durationSec;
    const throughputMbps = (throughputBps / 1_000_000).toFixed(2);
    const transferRateMBs = (totalBytes / (1024 * 1024) / durationSec).toFixed(2);

    const record = {
      transferKey,
      trackId,
      peerId,
      totalBytes,
      role,
      durationMs,
      durationSec: Number(durationSec.toFixed(2)),
      throughputBps: Math.round(throughputBps),
      throughputMbps: Number(throughputMbps),
      transferRateMBs: Number(transferRateMBs),
      timestamp: Date.now()
    };

    this.completedTransfers.push(record);
    if (this.completedTransfers.length > 20) this.completedTransfers.shift();
    this.activeTransfers.delete(transferKey);

    this._notifyListeners();
    return record;
  }

  // --- Playback Start Timing Offset ---
  recordScheduledPlayHost(targetStartTime, leadTimeMs = 400) {
    this.lastTargetStartTime = targetStartTime;
  }

  recordActualPlayHost(targetStartTime, hostActualStartTime) {
    this.lastHostActualStartTime = hostActualStartTime;
    const hostSkew = Math.abs(hostActualStartTime - targetStartTime);
    this.playbackStartSkews.push(hostSkew);
    this.lastPlaybackStartSkew = hostSkew;
    if (this.playbackStartSkews.length > 30) this.playbackStartSkews.shift();
    this._notifyListeners();
  }

  recordScheduledPlayGuest(targetStartTime, localTargetTime) {
    this.lastTargetStartTime = targetStartTime;
  }

  recordActualPlayGuest(localTargetTime, guestActualStartTime, skewMs) {
    const skew = typeof skewMs === 'number' ? skewMs : Math.abs(guestActualStartTime - localTargetTime);
    this.playbackStartSkews.push(skew);
    this.lastPlaybackStartSkew = skew;
    if (this.playbackStartSkews.length > 30) this.playbackStartSkews.shift();
    this._notifyListeners();
  }

  recordPlayAck(remotePeerId, skewMs) {
    if (typeof skewMs === 'number') {
      this.playbackStartSkews.push(skewMs);
      this.lastPlaybackStartSkew = skewMs;
      if (this.playbackStartSkews.length > 30) this.playbackStartSkews.shift();
      this._notifyListeners();
    }
  }

  // --- Playback Drift Over Time ---
  recordPlaybackDrift(driftMs) {
    this.lastDriftMs = driftMs;
    this.maxDriftMs = Math.max(this.maxDriftMs, Math.abs(driftMs));
    this.driftSamples.push(driftMs);
    if (this.driftSamples.length > 60) this.driftSamples.shift();
    this._notifyListeners();
  }

  // --- Summary for the UI ---
  getMetricsSnapshot(targetPeerId = null) {
    // Connection timing
    const peerId = targetPeerId || Array.from(this.connectedPeers)[0] || 'remote-peer';
    const setupTimeMs = this.connectionSetupTimes.get(peerId);
    const connectionSetupStr = setupTimeMs !== undefined && setupTimeMs !== null
      ? `${setupTimeMs} ms (${(setupTimeMs / 1000).toFixed(2)} s)`
      : this.joinInitiatedTimestamp
        ? `${Math.round(performance.now() - this.joinInitiatedTimestamp)} ms (Handshake in progress)`
        : 'Awaiting connection';

    // Signaling latency
    let signalingDelayStr = 'Awaiting signaling';
    if (this.signalingDelays.length > 0) {
      const avg = Math.round(this.signalingDelays.reduce((a, b) => a + b, 0) / this.signalingDelays.length);
      const min = Math.min(...this.signalingDelays);
      const max = Math.max(...this.signalingDelays);
      signalingDelayStr = `${this.lastSignalingDelay ?? avg} ms (Avg: ${avg} ms, Min: ${min} ms, Max: ${max} ms)`;
    }

    // Transfer speed and duration
    const lastTransfer = this.completedTransfers[this.completedTransfers.length - 1];
    let throughputStr = 'Awaiting audio transfer';
    let transferCompletionStr = 'Awaiting audio transfer';

    if (lastTransfer) {
      throughputStr = `${lastTransfer.throughputMbps} Mbps (${lastTransfer.transferRateMBs} MB/s) [${(lastTransfer.totalBytes / (1024 * 1024)).toFixed(2)} MB file]`;
      transferCompletionStr = `${lastTransfer.durationMs} ms (${lastTransfer.durationSec} s)`;
    } else if (this.activeTransfers.size > 0) {
      const active = Array.from(this.activeTransfers.values())[0];
      const elapsed = Math.round((performance.now() - active.startTime) / 1000);
      throughputStr = `Transfer in progress... (${elapsed}s elapsed)`;
      transferCompletionStr = `In progress (${elapsed}s elapsed)`;
    }

    // Start timing offset
    let playbackSkewStr = 'Awaiting scheduled playback';
    if (this.playbackStartSkews.length > 0) {
      const lastSkew = this.lastPlaybackStartSkew ?? this.playbackStartSkews[this.playbackStartSkews.length - 1];
      const avgSkew = (this.playbackStartSkews.reduce((a, b) => a + b, 0) / this.playbackStartSkews.length).toFixed(1);
      const targetSyncNotice = lastSkew <= 15 ? 'Synchronized (Within target ±15ms)' : 'Synchronizing...';
      playbackSkewStr = `${lastSkew} ms (Avg: ${avgSkew} ms) - ${targetSyncNotice}`;
    }

    // Playback drift
    let driftStr = '0 ms (Playback idle)';
    if (this.driftSamples.length > 0) {
      const absDrifts = this.driftSamples.map((d) => Math.abs(d));
      const avgDrift = (absDrifts.reduce((a, b) => a + b, 0) / absDrifts.length).toFixed(1);
      const sign = this.lastDriftMs > 0 ? '+' : '';
      let status = 'Locked in deadband (<12ms)';
      if (Math.abs(this.lastDriftMs) > 180) status = 'Hard seek correction (>180ms)';
      else if (Math.abs(this.lastDriftMs) > 40) status = 'Smooth rate correction (4%)';
      else if (Math.abs(this.lastDriftMs) > 12) status = 'Gentle micro-rate adjustment (1.5%)';

      driftStr = `${sign}${this.lastDriftMs} ms (Avg: ${avgDrift} ms, Max: ${this.maxDriftMs} ms) - ${status}`;
    }

    return {
      peerId,
      isHost: this.isHost,
      connectionSetupTime: connectionSetupStr,
      signalingDelay: signalingDelayStr,
      audioTransferThroughput: throughputStr,
      transferCompletionTime: transferCompletionStr,
      playbackStartSkew: playbackSkewStr,
      playbackDrift: driftStr,
      raw: {
        setupTimeMs,
        lastSignalingDelay: this.lastSignalingDelay,
        lastTransfer,
        lastPlaybackStartSkew: this.lastPlaybackStartSkew,
        lastDriftMs: this.lastDriftMs,
        maxDriftMs: this.maxDriftMs
      }
    };
  }

  // Kept so any existing calls won't fail
  printReport() { }
}

export const performanceMetrics = new PerformanceMetricsCollector();

if (typeof window !== 'undefined') {
  window.__symphonixMetrics = performanceMetrics;
}
