import React, { useState } from 'react';
import { X, Radio, ArrowRight, ShieldCheck, Headphones } from 'lucide-react';

export default function SpaceModal({ isOpen, onClose, onCreateSpace, onJoinSpace, isCreating }) {
  const [activeTab, setActiveTab] = useState('create');
  const [displayName, setDisplayName] = useState('');
  const [spaceCode, setSpaceCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onCreateSpace(displayName.trim() || 'Host');
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    if (!spaceCode.trim()) {
      setError('Please enter a 6-character room code (e.g. SPX-4829)');
      return;
    }
    try {
      await onJoinSpace(spaceCode.trim(), displayName.trim() || 'Guest');
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={20} color="var(--accent-brand)" />
            <h3 className="modal-title">Listening Space</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => { setActiveTab('create'); setError(''); }}
          >
            Create Space (Host)
          </button>
          <button
            className={`modal-tab ${activeTab === 'join' ? 'active' : ''}`}
            onClick={() => { setActiveTab('join'); setError(''); }}
          >
            Join Space (Participant)
          </button>
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: 13, background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {activeTab === 'create' ? (
          <form className="modal-form" onSubmit={handleCreate}>
            <div className="role-info-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                <ShieldCheck size={16} color="var(--accent-brand)" />
                <span>Host Authority</span>
              </div>
              You will create an authoritative listening room. When guests join, your browser establishes a direct WebRTC connection and streams audio bytes peer-to-peer.
            </div>

            <div className="input-group">
              <label className="input-label">Your Display Name</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. Ashwin (Host)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={isCreating}>
              <span>{isCreating ? 'Creating Space...' : 'Create Space'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form className="modal-form" onSubmit={handleJoin}>
            <div className="role-info-card" style={{ borderLeftColor: '#3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                <Headphones size={16} color="#3b82f6" />
                <span>Participant Role</span>
              </div>
              Enter the room code shared by your host. Your browser connects over WebRTC, buffers audio transferred directly from the host, and syncs playback.
            </div>

            <div className="input-group">
              <label className="input-label">Space Room Code</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. SPX-4829"
                value={spaceCode}
                onChange={(e) => setSpaceCode(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Your Display Name</label>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. Friend"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={isCreating}>
              <span>{isCreating ? 'Connecting...' : 'Join Space'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
