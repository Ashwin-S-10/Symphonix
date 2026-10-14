import React, { useState } from 'react';
import {
  Copy,
  Check,
  Radio,
  Send,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Activity,
  LogOut,
  Users
} from 'lucide-react';

export default function PeerStatusPanel({
  activeSpace,
  connectionState,
  isDataChannelOpen,
  peers,
  transferProgress,
  transferResult,
  syncDriftMs,
  onSendTestPing,
  pingResult,
  onTriggerAudioTransfer,
  isTransferring,
  onLeaveSpace
}) {
  const [copied, setCopied] = useState(false);

  if (!activeSpace) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSpace.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    if (isDataChannelOpen) {
      return (
        <span style={{ color: 'var(--status-connected)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="status-dot connected"></span>
          <span>WebRTC P2P Open</span>
        </span>
      );
    }
    if (connectionState === 'connecting' || connectionState === 'new') {
      return (
        <span style={{ color: 'var(--status-buffering)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="status-dot buffering"></span>
          <span>Signaling & Handshake...</span>
        </span>
      );
    }
    return (
      <span style={{ color: 'var(--text-subdued)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="status-dot"></span>
        <span>{connectionState || 'Idle'}</span>
      </span>
    );
  };

  return (
    <div className="active-space-banner">
      <div className="space-banner-header">
        <div className="space-info-group">
          <div className="space-code-badge" onClick={handleCopy} title="Click to copy code">
            <Radio size={16} />
            <span>{activeSpace.code}</span>
            {copied ? <Check size={14} color="var(--accent-brand)" /> : <Copy size={14} />}
          </div>

          <span className={`space-role-pill ${activeSpace.isHost ? 'host' : 'participant'}`}>
            {activeSpace.isHost ? 'Host Authority' : 'Participant'}
          </span>

          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {getStatusBadge()}
          </div>
        </div>

        <button className="btn btn-danger btn-sm" onClick={onLeaveSpace}>
          <LogOut size={14} />
          <span>Leave Space</span>
        </button>
      </div>

      <div className="space-metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Peers Connected</span>
          <span className="metric-value">
            <Users size={14} />
            {peers.length > 0 ? `${peers.length} active` : 'Waiting for guest...'}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-label">Data Channel</span>
          <span className="metric-value">
            {isDataChannelOpen ? 'symphonix (Active)' : 'Negotiating SDP...'}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-label">Sync Timeline</span>
          <span className="metric-value">
            <Activity size={14} color="var(--accent-brand)" />
            {activeSpace.isHost
              ? 'Authoritative Clock'
              : Math.abs(syncDriftMs) < 15
              ? `Drift: ${syncDriftMs > 0 ? '+' : ''}${syncDriftMs} ms (Locked)`
              : `Drift: ${syncDriftMs > 0 ? '+' : ''}${syncDriftMs} ms (Syncing)`}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-label">P2P Audio Transfer</span>
          <span className="metric-value">
            {transferResult ? (
              <span style={{ color: 'var(--accent-brand)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={14} />
                Verified ({((transferResult.totalBytes || 0) / 1024 / 1024).toFixed(1)} MB)
              </span>
            ) : transferProgress ? (
              `${transferProgress.percent}% streaming`
            ) : (
              'Direct DataChannel'
            )}
          </span>
        </div>
      </div>

      {/* Transfer Progress Bar */}
      {transferProgress && transferProgress.percent < 100 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>Direct P2P Chunk Transfer: {transferProgress.percent}%</span>
            <span>
              {(transferProgress.transferredBytes / (1024 * 1024)).toFixed(2)} / {(transferProgress.totalBytes / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${transferProgress.percent}%`,
                height: '100%',
                background: 'var(--accent-brand)',
                transition: 'width 0.1s ease'
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Milestone 4 verification controls */}
      <div className="space-controls-row">
        <button
          className="btn btn-secondary btn-sm"
          onClick={onSendTestPing}
          disabled={!isDataChannelOpen}
          title="Milestone 4: Send test control message over direct WebRTC DataChannel"
        >
          <Send size={14} />
          <span>Send Test Ping</span>
        </button>

        {activeSpace.isHost && (
          <button
            className="btn btn-primary btn-sm"
            onClick={onTriggerAudioTransfer}
            disabled={!isDataChannelOpen || isTransferring}
            title="Milestone 4: Stream active MP3 directly to guest over DataChannel"
          >
            <DownloadCloud size={14} />
            <span>{isTransferring ? 'Streaming Audio P2P...' : 'Transfer Track P2P'}</span>
          </button>
        )}

        {pingResult && (
          <span style={{ fontSize: 12, color: 'var(--accent-brand)', fontWeight: 600 }}>
            {pingResult}
          </span>
        )}
      </div>
    </div>
  );
}
