import React from 'react';
import { Music, Disc, Sparkles, Headphones, Flame } from 'lucide-react';

const iconMap = {
  music: Music,
  sparkles: Sparkles,
  disc: Disc,
  headphones: Headphones,
  flame: Flame
};

export default function CollectionCard({ collection, isSelected, onClick }) {
  const Icon = iconMap[collection.icon] || Disc;

  return (
    <div
      className={`collection-card ${isSelected ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="collection-art">
        <Icon size={44} className="collection-art-icon" />
        <span className="collection-badge">{collection.count} tracks</span>
      </div>
      <div>
        <h4 className="collection-name">{collection.name}</h4>
        <p className="collection-desc">{collection.description}</p>
      </div>
    </div>
  );
}
