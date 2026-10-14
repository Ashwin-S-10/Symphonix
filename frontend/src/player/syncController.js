// Playback Synchronization Controller
// Authoritative Host timeline management, scheduled playback, heartbeat broadcasting,
// and participant drift correction.

import {
  createScheduledPlayMessage,
  createPauseMessage,
  createSeekMessage,
  createStateSnapshotMessage
} from '../networking/protocol';

export class SyncController {
  constructor({ audioEngine, webrtcManager, spaceId, isHost, onDriftCalculated, onTrackChange }) {
    this.audioEngine = audioEngine;
    this.webrtcManager = webrtcManager;
    this.spaceId = spaceId;
    this.isHost = isHost;
    this.onDriftCalculated = onDriftCalculated;
    this.onTrackChange = onTrackChange;

    this.sequence = 0;
    this.generationId = `gen-${Date.now()}`;
    this.lastProcessedSequence = -1;
    this.snapshotTimer = null;

    // Clock synchronization state (NTP Cristian's algorithm)
    this.clockOffset = 0; // Host_Time - Participant_Time
    this.rtt = 0;
    this.clockSamples = [];
    this.pingTimer = null;

    if (this.isHost) {
      this._startHeartbeat();
    }
  }

  setGeneration(trackId) {
    this.generationId = `gen-${trackId}-${Date.now()}`;
    this.sequence = 0;
  }

  // Convert participant local time to host time
  toHostTime(localTime = Date.now()) {
    return localTime + this.clockOffset;
  }

  // Convert host time to participant local time
  toLocalTime(hostTime) {
    return hostTime - this.clockOffset;
  }

  // PARTICIPANT: Starts continuous background NTP clock estimation
  startClockSync() {
    if (this.isHost) return;

    // Fast burst of 5 pings on initial connection to rapidly lock offset
    this._sendPing();
    let burstCount = 0;
    const burst = setInterval(() => {
      burstCount++;
      if (burstCount < 5) {
        this._sendPing();
      } else {
        clearInterval(burst);
      }
    }, 200);

    // Continuous ping every 3 seconds to track crystal drift
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this._sendPing();
    }, 3000);
  }

  _sendPing() {
    if (this.isHost) return;
    const pingMsg = createPingMessage(this.webrtcManager.peerId);
    this.webrtcManager.broadcastControlMessage(pingMsg);
  }

  // PARTICIPANT: Handles PONG to calculate network RTT and clock offset
  handlePong(msg) {
    if (this.isHost) return;
    const t3 = Date.now();
    const t0 = msg.pingTimestamp;
    const t2 = msg.timestamp;

    const rtt = Math.max(1, t3 - t0);
    const oneWay = rtt / 2;
    // Host time at reception was approximately t2 + oneWay
    const estimatedHostTime = t2 + oneWay;
    const sampleOffset = estimatedHostTime - t3;

    this.clockSamples.push({ offset: sampleOffset, rtt });
    if (this.clockSamples.length > 7) this.clockSamples.shift();

    // Select the sample with minimum RTT for highest accuracy (least queueing jitter)
    const best = [...this.clockSamples].sort((a, b) => a.rtt - b.rtt)[0];
    this.clockOffset = best.offset;
    this.rtt = best.rtt;
  }

  // Ensure participant's loaded track matches the host's authoritative trackId
  async _ensureTrack(trackId, trackMeta) {
    if (!trackId || trackId === 'unknown') return;
    if (this.audioEngine.currentTrack?.id === trackId) return;

    if (this.onTrackChange) {
      await this.onTrackChange(trackId, trackMeta);
    }
  }

  // HOST: Initiates scheduled playback across the space
  hostPlay(positionSeconds = null) {
    if (!this.isHost) return;

    this.sequence++;
    const pos = positionSeconds !== null ? positionSeconds : this.audioEngine.getCurrentTime();
    const leadTimeMs = 400; // 400ms lead time allows network transmission and audio buffering
    const targetStartTime = Date.now() + leadTimeMs;

    const track = this.audioEngine.currentTrack;
    const trackId = track ? track.id : 'unknown';

    // Broadcast SCHEDULED_PLAY to participants with complete track metadata
    const msg = createScheduledPlayMessage(
      this.spaceId,
      trackId,
      this.generationId,
      this.sequence,
      pos,
      targetStartTime,
      track
    );
    this.webrtcManager.broadcastControlMessage(msg);

    // Pre-seek on host as well so decoder buffer is primed at target position
    this.audioEngine.seek(pos);

    // Host schedules play locally at targetStartTime
    const delay = Math.max(0, targetStartTime - Date.now());
    setTimeout(() => {
      this.audioEngine.play();
    }, delay);
  }

  // HOST: Pauses playback across the space
  hostPause() {
    if (!this.isHost) return;

    this.sequence++;
    const pos = this.audioEngine.getCurrentTime();
    const track = this.audioEngine.currentTrack;
    const trackId = track ? track.id : 'unknown';

    const msg = createPauseMessage(
      this.spaceId,
      trackId,
      this.generationId,
      this.sequence,
      pos,
      track
    );
    this.webrtcManager.broadcastControlMessage(msg);
    this.audioEngine.pause();
  }

  // HOST: Seeks to a position across the space
  hostSeek(seconds) {
    if (!this.isHost) return;

    this.sequence++;
    const isPlaying = this.audioEngine.isPlaying;
    const leadTimeMs = 350;
    const targetStartTime = Date.now() + leadTimeMs;
    const track = this.audioEngine.currentTrack;
    const trackId = track ? track.id : 'unknown';

    const msg = createSeekMessage(
      this.spaceId,
      trackId,
      this.generationId,
      this.sequence,
      seconds,
      targetStartTime,
      isPlaying,
      track
    );
    this.webrtcManager.broadcastControlMessage(msg);

    this.audioEngine.seek(seconds);
  }

  // HOST: Sends an immediate state snapshot to a newly connected peer
  sendImmediateSnapshot(remotePeerId = null) {
    if (!this.isHost) return;

    const track = this.audioEngine.currentTrack;
    if (!track) return;

    this.sequence++;
    const snapshot = createStateSnapshotMessage(
      this.spaceId,
      track.id,
      this.generationId,
      this.sequence,
      this.audioEngine.isPlaying,
      this.audioEngine.getCurrentTime(),
      track
    );
    if (remotePeerId) {
      this.webrtcManager.sendControlMessage(remotePeerId, snapshot);
    } else {
      this.webrtcManager.broadcastControlMessage(snapshot);
    }
  }

  // HOST: Heartbeat broadcasts state snapshots every 1000ms
  _startHeartbeat() {
    this.snapshotTimer = setInterval(() => {
      if (!this.isHost) return;

      const track = this.audioEngine.currentTrack;
      if (!track) return;

      this.sequence++;
      const snapshot = createStateSnapshotMessage(
        this.spaceId,
        track.id,
        this.generationId,
        this.sequence,
        this.audioEngine.isPlaying,
        this.audioEngine.getCurrentTime(),
        track
      );
      this.webrtcManager.broadcastControlMessage(snapshot);
    }, 1000);
  }

  // PARTICIPANT: Handles SCHEDULED_PLAY from Host
  async handleScheduledPlay(msg) {
    if (this.isHost) return;
    if (msg.sequence <= this.lastProcessedSequence) return;
    this.lastProcessedSequence = msg.sequence;

    // Ensure the correct track is loaded before scheduling play
    if (msg.trackId && this.audioEngine.currentTrack?.id !== msg.trackId) {
      await this._ensureTrack(msg.trackId, msg.track);
    }

    // Convert host targetStartTime to local device time via estimated clockOffset
    const localTargetTime = this.toLocalTime(msg.targetStartTime);
    const now = Date.now();
    const delay = Math.max(0, localTargetTime - now);

    // Pre-seek immediately so audio decoder buffer is primed at target position
    this.audioEngine.seek(msg.positionSeconds);

    setTimeout(() => {
      this.audioEngine.play();
    }, delay);
  }

  // PARTICIPANT: Handles PAUSE from Host
  async handlePause(msg) {
    if (this.isHost) return;
    if (msg.sequence <= this.lastProcessedSequence) return;
    this.lastProcessedSequence = msg.sequence;

    if (msg.trackId && this.audioEngine.currentTrack?.id !== msg.trackId) {
      await this._ensureTrack(msg.trackId, msg.track);
    }

    this.audioEngine.pause();
    this.audioEngine.seek(msg.positionSeconds);
  }

  // PARTICIPANT: Handles SEEK from Host
  async handleSeek(msg) {
    if (this.isHost) return;
    if (msg.sequence <= this.lastProcessedSequence) return;
    this.lastProcessedSequence = msg.sequence;

    if (msg.trackId && this.audioEngine.currentTrack?.id !== msg.trackId) {
      await this._ensureTrack(msg.trackId, msg.track);
    }

    this.audioEngine.seek(msg.positionSeconds);
    if (msg.isPlaying) {
      const localTargetTime = this.toLocalTime(msg.targetStartTime);
      const now = Date.now();
      const delay = Math.max(0, localTargetTime - now);
      setTimeout(() => {
        this.audioEngine.play();
      }, delay);
    } else {
      this.audioEngine.pause();
    }
  }

  // PARTICIPANT: Handles periodic STATE_SNAPSHOT and corrects drift
  async handleStateSnapshot(msg) {
    if (this.isHost) return;

    // Check if the track has changed
    if (msg.trackId && this.audioEngine.currentTrack?.id !== msg.trackId) {
      await this._ensureTrack(msg.trackId, msg.track);
    }

    // Ignore older generation or obsolete sequence
    if (msg.generationId !== this.generationId) {
      this.generationId = msg.generationId;
    }

    // Convert local time to host time coordinates for exact elapsed calculation
    const currentHostTime = this.toHostTime();
    const elapsedSinceSnapshot = Math.max(0, (currentHostTime - msg.timestamp) / 1000);
    const expectedPosition = msg.isPlaying
      ? msg.positionSeconds + elapsedSinceSnapshot
      : msg.positionSeconds;

    const actualPosition = this.audioEngine.getCurrentTime();
    const driftSeconds = actualPosition - expectedPosition;
    const driftMs = Math.round(driftSeconds * 1000);

    if (this.onDriftCalculated) {
      this.onDriftCalculated(driftMs);
    }

    // Align playing state
    if (msg.isPlaying && !this.audioEngine.isPlaying) {
      this.audioEngine.seek(expectedPosition);
      this.audioEngine.play();
      return;
    }
    if (!msg.isPlaying && this.audioEngine.isPlaying) {
      this.audioEngine.pause();
      this.audioEngine.seek(msg.positionSeconds);
      return;
    }

    // Optimized multi-tier drift correction
    const absDrift = Math.abs(driftMs);
    if (absDrift < 12) {
      // Within target deadband (<12ms) - locked in sync!
      this.audioEngine.setPlaybackRate(1.0);
    } else if (absDrift <= 40) {
      // Gentle micro-correction (1.5% rate adjustment, imperceptible to human ear)
      this.audioEngine.setPlaybackRate(driftMs < 0 ? 1.015 : 0.985);
    } else if (absDrift <= 180) {
      // Active smooth correction (4% rate adjustment)
      this.audioEngine.setPlaybackRate(driftMs < 0 ? 1.04 : 0.96);
    } else {
      // Hard drift (>180ms): hard-seek directly to expected position
      this.audioEngine.seek(expectedPosition);
      this.audioEngine.setPlaybackRate(1.0);
    }
  }

  cleanup() {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
