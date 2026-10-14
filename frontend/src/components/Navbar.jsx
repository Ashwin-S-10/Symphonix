import React from 'react';
import { Search, Radio, Users, Check, Copy } from 'lucide-react';

export default function Navbar({
  searchQuery,
  onSearchChange,
  activeSpace,
  onOpenSpaceModal,
  connectionStatus
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    if (activeSpace?.code) {
      navigator.clipboard.writeText(activeSpace.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="top-navbar">
      <div className="search-box">
        <Search size={16} className="text-subdued" />
        <input
          type="text"
          className="search-input"
          placeholder="Search all 20 demo songs..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="navbar-actions">
        {activeSpace ? (
          <div className="space-status-pill">
            <span className={`status-dot ${connectionStatus}`}></span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {activeSpace.code}
            </span>
            <span style={{ color: 'var(--text-subdued)' }}>•</span>
            <span>{activeSpace.isHost ? 'Host' : 'Guest'}</span>
            <button
              onClick={handleCopyCode}
              className="player-btn"
              title="Copy Space Code"
              style={{ marginLeft: 4 }}
            >
              {copied ? <Check size={14} color="var(--accent-brand)" /> : <Copy size={14} />}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={onOpenSpaceModal}>
            <Radio size={16} />
            <span>Create or Join Space</span>
          </button>
        )}
      </div>
    </header>
  );
}
