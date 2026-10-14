import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Radio,
  Lock
} from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export default function Player({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  activeSpace,
  onPlay,
  onPause,
  onSeek,
  onNext,
  onPrevious,
  onVolumeChange
}) {
  const isParticipant = activeSpace && !activeSpace.isHost;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekChange = (e) => {
    if (isParticipant) return; // Participants follow host
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  const handleTogglePlay = () => {
    if (isParticipant) return; // Participant is locked to host
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  return (
    <footer className="persistent-player">
      {/* Left: Track Information */}
      <div className="player-track-info">
        <div className="player-thumb">
          <Music size={24} />
        </div>
        <div className="player-details">
          <div className="player-title">
            {currentTrack ? currentTrack.title : 'Select a track to play'}
          </div>
          <div className="player-artist">
            {currentTrack ? currentTrack.artist : 'Symphonix 20 Demo Corpus'}
          </div>
        </div>
      </div>

      {/* Center: Playback Controls & Timeline */}
      <div className="player-center-controls">
        <div className="player-buttons">
          <button
            className="player-btn"
            onClick={onPrevious}
            disabled={!currentTrack || isParticipant}
            title={isParticipant ? 'Host controls space track' : 'Previous Track'}
          >
            <SkipBack size={18} />
          </button>

          <button
            className="play-pause-btn"
            onClick={handleTogglePlay}
            disabled={!currentTrack || isParticipant}
            title={isParticipant ? 'Host controls playback state' : isPlaying ? 'Pause' : 'Play'}
          >
            {isParticipant ? (
              <Lock size={16} />
            ) : isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />
            )}
          </button>

          <button
            className="player-btn"
            onClick={onNext}
            disabled={!currentTrack || isParticipant}
            title={isParticipant ? 'Host controls space track' : 'Next Track'}
          >
            <SkipForward size={18} />
          </button>
        </div>

        <div className="timeline-row">
          <span className="time-label">{formatTime(currentTime)}</span>
          <div className="slider-container">
            <div className="slider-track">
              <div
                className="slider-progress"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime || 0}
              onChange={handleSeekChange}
              disabled={!currentTrack || isParticipant}
              className="slider-input"
            />
          </div>
          <span className="time-label">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Space status */}
      <div className="player-right-controls">
        {activeSpace && (
          <div style={{ fontSize: 11, color: 'var(--text-subdued)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Radio size={12} color="var(--accent-brand)" />
            <span>{activeSpace.isHost ? 'Broadcasting' : 'Synced to Host'}</span>
          </div>
        )}

        <div className="volume-container">
          <button
            className="player-btn"
            onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <div className="slider-container" style={{ width: 80 }}>
            <div className="slider-track">
              <div
                className="slider-progress"
                style={{ width: `${volume * 100}%` }}
              ></div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="slider-input"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
