import React from 'react';
import {
  Music,
  Disc,
  Sparkles,
  Headphones,
  Flame,
  Radio,
  Layers
} from 'lucide-react';
import { CURATED_COLLECTIONS } from '../services/catalogData';

const iconMap = {
  music: Music,
  sparkles: Sparkles,
  disc: Disc,
  headphones: Headphones,
  flame: Flame
};

export default function Sidebar({
  selectedCollection,
  onSelectCollection,
  activeSpace,
  onOpenSpaceModal
}) {
  return (
    <aside className="app-sidebar">
      <div className="brand-header">
        <div className="brand-icon">
          <Music size={18} />
        </div>
        <div>
          <div className="brand-title">Symphonix</div>
        </div>
        <span className="brand-tag">Phase 1</span>
      </div>

      <nav className="nav-section">
        <div className="nav-section-title">Collections</div>
        {CURATED_COLLECTIONS.map((col) => {
          const Icon = iconMap[col.icon] || Disc;
          const isActive = selectedCollection === col.id;

          return (
            <button
              key={col.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectCollection(col.id)}
            >
              <Icon size={16} className="nav-icon" />
              <span>{col.name}</span>
              <span className="nav-counter">{col.count}</span>
            </button>
          );
        })}
      </nav>

      <div className="nav-section" style={{ marginTop: 'auto' }}>
        <div className="nav-section-title">P2P Space</div>
        <button
          className={`nav-item ${activeSpace ? 'active' : ''}`}
          onClick={onOpenSpaceModal}
        >
          <Radio size={16} className="nav-icon" />
          <span>{activeSpace ? `Space ${activeSpace.code}` : 'Listening Space'}</span>
        </button>
      </div>
    </aside>
  );
}
