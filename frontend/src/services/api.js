import { DEMO_TRACKS } from './catalogData';

const API_BASE = '/api';

export const api = {
  // Fetch song catalog
  async getSongs(collection = 'all', query = '') {
    try {
      const params = new URLSearchParams();
      if (collection && collection !== 'all') params.append('collection', collection);
      if (query) params.append('q', query);

      const res = await fetch(`${API_BASE}/songs/?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data.results || data;
      }
    } catch (err) {
      console.warn('Backend API unavailable, using local demo catalog:', err.message);
    }

    // Fallback to local catalog
    let list = [...DEMO_TRACKS];
    if (collection && collection !== 'all') {
      list = list.filter(t => t.collection.toLowerCase() === collection.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
    }
    return list;
  },

  // Create listening space
  async createSpace(hostPeerId, displayName = 'Host', spaceName = '') {
    const res = await fetch(`${API_BASE}/spaces/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostPeerId, displayName, name: spaceName })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create space');
    }
    return await res.json();
  },

  // Join space
  async joinSpace(code, peerId, displayName = 'Participant') {
    const cleanCode = code.toUpperCase().trim();
    const res = await fetch(`${API_BASE}/spaces/${cleanCode}/join/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId, displayName })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to join space ${cleanCode}`);
    }
    return await res.json();
  },

  // Fetch space status
  async getSpaceStatus(code, peerId = '') {
    const cleanCode = code.toUpperCase().trim();
    const res = await fetch(`${API_BASE}/spaces/${cleanCode}/status/?peerId=${peerId}`);
    if (!res.ok) throw new Error('Space status unavailable');
    return await res.json();
  },

  // Send signaling message
  async sendSignal(code, fromPeer, toPeer, type, payload) {
    const cleanCode = code.toUpperCase().trim();
    const res = await fetch(`${API_BASE}/spaces/${cleanCode}/signals/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromPeer, toPeer, type, payload })
    });
    if (!res.ok) throw new Error('Failed to send signaling message');
    return await res.json();
  },

  // Poll signaling messages
  async pollSignals(code, peerId) {
    const cleanCode = code.toUpperCase().trim();
    const res = await fetch(`${API_BASE}/spaces/${cleanCode}/signals/poll/?peerId=${peerId}`);
    if (!res.ok) return { signals: [] };
    return await res.json();
  },

  // Leave space
  async leaveSpace(code, peerId) {
    try {
      const cleanCode = code.toUpperCase().trim();
      await fetch(`${API_BASE}/spaces/${cleanCode}/leave/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId })
      });
    } catch (_) {}
  }
};
