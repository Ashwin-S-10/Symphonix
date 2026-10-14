import React from 'react';
import { Play, Pause, Music } from 'lucide-react';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SongRow({
  song,
  index,
  isPlaying,
  isCurrent,
  onPlay,
  onPause
}) {
  const handleToggle = (e) => {
    e.stopPropagation();
    if (isCurrent && isPlaying) {
      onPause();
    } else {
      onPlay(song);
    }
  };

  return (
    <div
      className={`song-row ${isCurrent ? 'playing' : ''}`}
      onClick={() => onPlay(song)}
    >
      <div className="song-num">
        {isCurrent && isPlaying ? (
          <button className="player-btn song-play-icon" onClick={handleToggle} style={{ display: 'flex' }}>
            <Pause size={14} color="var(--accent-brand)" />
          </button>
        ) : (
          <>
            <span className="song-num-text">{index + 1}</span>
            <button className="player-btn song-play-icon" onClick={handleToggle}>
              <Play size={14} />
            </button>
          </>
        )}
      </div>

      <div className="song-title-col">
        <div className="song-thumb">
          <Music size={18} />
        </div>
        <div className="song-meta">
          <div className="song-title">{song.title}</div>
          <div className="song-artist">{song.artist}</div>
        </div>
      </div>

      <div className="song-collection-col">
        {song.collection}
      </div>

      <div className="song-size-col">
        {formatFileSize(song.fileSize)}
      </div>

      <div className="song-duration-col">
        {formatDuration(song.duration)}
      </div>
    </div>
  );
}
