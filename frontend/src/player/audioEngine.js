// Symphonix Audio Engine
// Wraps HTML5 Audio element with Web Audio API context for high-precision timing, volume, and playback control.

export class AudioEngine {
  constructor({ onTimeUpdate, onEnded, onStateChange }) {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.onTimeUpdate = onTimeUpdate;
    this.onEnded = onEnded;
    this.onStateChange = onStateChange;

    this.currentTrack = null;
    this.isPlaying = false;
    this._pendingSeek = null;

    this._setupListeners();
  }

  _setupListeners() {
    this.audio.addEventListener('loadedmetadata', () => {
      if (this._pendingSeek !== null) {
        this.seek(this._pendingSeek);
        this._pendingSeek = null;
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
      }
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.onStateChange) this.onStateChange('playing');
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange('paused');
    });

    this.audio.addEventListener('waiting', () => {
      if (this.onStateChange) this.onStateChange('buffering');
    });

    this.audio.addEventListener('canplay', () => {
      if (this.onStateChange) this.onStateChange(this.isPlaying ? 'playing' : 'ready');
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onEnded) this.onEnded();
    });

    this.audio.addEventListener('error', (err) => {
      console.warn('Audio playback error:', err);
      if (this.onStateChange) this.onStateChange('error');
    });
  }

  async loadTrack(track, customUrl = null) {
    if (!track) return;
    this.currentTrack = track;
    const url = customUrl || track.audioUrl;

    if (this.audio.src && (this.audio.src.endsWith(url) || this.audio.src === url)) {
      return;
    }

    this._pendingSeek = null;
    this.audio.src = url;
    this.audio.load();

    return new Promise((resolve) => {
      let resolved = false;
      const cleanup = () => {
        this.audio.removeEventListener('loadedmetadata', onReady);
        this.audio.removeEventListener('canplay', onReady);
        this.audio.removeEventListener('error', onError);
        clearTimeout(timer);
      };
      const onReady = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };
      const onError = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };
      const timer = setTimeout(onReady, 2000); // 2s safety timeout
      this.audio.addEventListener('loadedmetadata', onReady, { once: true });
      this.audio.addEventListener('canplay', onReady, { once: true });
      this.audio.addEventListener('error', onError, { once: true });
    });
  }

  async play() {
    try {
      await this.audio.play();
    } catch (err) {
      console.warn('Play was interrupted or blocked by browser autoplay policy:', err);
    }
  }

  pause() {
    this.audio.pause();
  }

  seek(seconds) {
    if (Number.isFinite(seconds)) {
      if (this.audio.readyState >= 1) {
        this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
        this._pendingSeek = null;
      } else {
        this._pendingSeek = seconds;
      }
    }
  }

  setVolume(volume) {
    this.audio.volume = Math.max(0, Math.min(volume, 1));
  }

  setPlaybackRate(rate) {
    this.audio.playbackRate = Math.max(0.5, Math.min(rate, 2.0));
  }

  getCurrentTime() {
    return this.audio.currentTime;
  }

  getDuration() {
    return this.audio.duration || (this.currentTrack ? this.currentTrack.duration : 0);
  }
}
