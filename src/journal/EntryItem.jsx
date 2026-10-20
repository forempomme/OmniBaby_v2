import React, { useRef, useState } from 'react';
import { useStore } from '../store.jsx';
import { formatTimeFR } from '../utils.jsx';
import { Icon } from '../icons.jsx';
import { ENTRY_TYPES, entryStart, entryTitle, entryDetail, entryAuthor } from './entryTypes.js';

// ----------------------------------------------------------------------
// Ligne du journal. Glisser à gauche = corbeille (option Réglages).
// ----------------------------------------------------------------------
export default function EntryItem({ entry, onEdit, onDelete, compact = false }) {
  const { store } = useStore();
  const def = ENTRY_TYPES[entry.type] || ENTRY_TYPES.autre;
  const [revealed, setRevealed] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const ACTION_WIDTH = 88;
  const TRIGGER = 44;

  const swipeEnabled = store.settings?.swipeToDelete !== false;

  const handleTouchStart = (e) => {
    if (!swipeEnabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e) => {
    if (!swipeEnabled || touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isDragging.current && Math.abs(dy) > Math.abs(dx) + 5) return;
    if (dx > 8) {
      if (revealed) { setRevealed(false); setOffsetX(0); }
      return;
    }
    if (dx < -5) {
      isDragging.current = true;
      setOffsetX(Math.max(-ACTION_WIDTH, dx));
    }
  };

  const handleTouchEnd = () => {
    if (!swipeEnabled) return;
    isDragging.current = false;
    touchStartX.current = null;
    if (offsetX < -TRIGGER) { setRevealed(true); setOffsetX(-ACTION_WIDTH); }
    else { setRevealed(false); setOffsetX(0); }
  };

  const handleContentTap = () => {
    if (revealed) { setRevealed(false); setOffsetX(0); return; }
    onEdit && onEdit();
  };

  const handleDeleteTap = (e) => {
    e.stopPropagation();
    if (store.settings?.confirmDelete === false) { onDelete(); return; }
    setConfirmDelete(true);
    setRevealed(false);
    setOffsetX(0);
  };

  const title = entryTitle(entry);
  const detail = entryDetail(entry);
  const author = entryAuthor(entry);
  const timeStr = formatTimeFR(entryStart(entry));

  if (confirmDelete) {
    return (
      <div className="entry-confirm">
        <span>Supprimer « {title} » ?</span>
        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}>Annuler</button>
        <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>Supprimer</button>
      </div>
    );
  }

  return (
    <div className="entry-row">
      {swipeEnabled && (
        <div className="entry-trash" style={{ width: ACTION_WIDTH, visibility: offsetX < 0 ? 'visible' : 'hidden' }}>
          <button onClick={handleDeleteTap} aria-label="Supprimer l'entrée">
            <Icon name="x" size={20} />
            <span>Supprimer</span>
          </button>
        </div>
      )}
      <div
        className={`entry-card ${compact ? 'compact' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleContentTap}
        style={{ transform: `translateX(${offsetX}px)`, transition: isDragging.current ? 'none' : 'transform 0.18s ease' }}
      >
        <span className="entry-icon" style={{ background: def.color, color: def.iconColor }}>
          <Icon name={def.svg} size={compact ? 16 : 20} />
        </span>
        <div className="entry-body">
          <div className="entry-title">
            {title}
            {entry.type === 'sommeil' && entry.enCours && <span className="entry-live">En cours</span>}
          </div>
          {!compact && detail && <div className="entry-sub">{detail}</div>}
          {!compact && author && <div className="entry-author">{author}</div>}
        </div>
        <div className="entry-time">{timeStr}</div>
      </div>
    </div>
  );
}
