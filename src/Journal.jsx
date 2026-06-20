import React, { useState, useMemo } from 'react';
import { useStore, genId, filterByActiveChild, getActiveChild, ageInMonths } from './store.jsx';
import {
  toISODateTime,
  formatTimeFR,
  formatDateTimeFR,
  groupByDay,
  dayLabel,
  daysAgo,
  isToday,
  SwipeToDelete,
  useToast,
} from './utils.jsx';
import { Modal } from './Modal.jsx';

// ----------------------------------------------------------------------
// Entry type definitions
// ----------------------------------------------------------------------
export const ENTRY_TYPES = {
  biberon: { label: 'Biberon / Tétée', icon: '🍼', color: '#F0CDBC', iconColor: '#C96F4A' },
  couche: { label: 'Couche', icon: '🧷', color: '#DCE6DF', iconColor: '#7C9885' },
  sommeil: { label: 'Sommeil', icon: '🌙', color: '#DCE8EC', iconColor: '#6E97A8' },
  autre: { label: 'Autre', icon: '📝', color: '#F6E2C4', iconColor: '#E0A458' },
};

function EntryIcon({ type }) {
  const def = ENTRY_TYPES[type] || ENTRY_TYPES.autre;
  return (
    <div className="entry-icon" style={{ background: def.color, color: def.iconColor }}>
      {def.icon}
    </div>
  );
}

function entrySubtitle(entry) {
  switch (entry.type) {
    case 'biberon': {
      const parts = [];
      if (entry.mode === 'sein') {
        parts.push('Tétée');
        if (entry.cote) parts.push(`côté ${entry.cote}`);
        if (entry.duree) parts.push(`${entry.duree} min`);
      } else {
        parts.push('Biberon');
        if (entry.quantite) parts.push(`${entry.quantite} ml`);
      }
      if (entry.vitamineD) parts.push('💊 Vit. D');
      return parts.join(' · ');
    }
    case 'couche': {
      const labels = { pipi: 'Pipi', selles: 'Selles', mixte: 'Mixte', seche: 'Sèche' };
      return labels[entry.contenu] || entry.contenu || '';
    }
    case 'sommeil': {
      const parts = [];
      if (entry.duree) parts.push(`${entry.duree} min`);
      if (entry.humeur) parts.push(entry.humeur);
      return parts.join(' · ');
    }
    case 'autre':
      return entry.note || '';
    default:
      return '';
  }
}

// ----------------------------------------------------------------------
// Entry form modal
// ----------------------------------------------------------------------
function EntryForm({ open, onClose, prefill, onSaved }) {
  const { store, update, nextId } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);

  const [type, setType] = useState(prefill?.type || 'biberon');
  const [datetime, setDatetime] = useState(prefill?.datetime || toISODateTime());
  // Biberon / tétée
  const [mode, setMode] = useState(prefill?.mode || 'biberon');
  const [quantite, setQuantite] = useState(prefill?.quantite || '');
  const [cote, setCote] = useState(prefill?.cote || 'gauche');
  const [duree, setDuree] = useState(prefill?.duree || '');
  const [vitamineD, setVitamineD] = useState(prefill?.vitamineD || false);
  // Couche
  const [contenu, setContenu] = useState('pipi');
  // Sommeil
  const [sommeilDuree, setSommeilDuree] = useState('');
  const [humeur, setHumeur] = useState('Calme');
  // Autre
  const [note, setNote] = useState('');

  // Reset form whenever opened with new prefill
  React.useEffect(() => {
    if (open) {
      setType(prefill?.type || 'biberon');
      setDatetime(prefill?.datetime || toISODateTime());
      setMode(prefill?.mode || 'biberon');
      setQuantite(prefill?.quantite || '');
      setCote(prefill?.cote || 'gauche');
      setDuree(prefill?.duree || '');
      setVitamineD(prefill?.vitamineD || false);
      setContenu('pipi');
      setSommeilDuree('');
      setHumeur('Calme');
      setNote('');
    }
  }, [open, prefill]);

  const lastVitDInfo = useMemo(() => {
    if (!activeChild) return null;
    const ageM = ageInMonths(activeChild.birthdate);
    if (ageM != null && ageM >= 24) return null;
    return true;
  }, [activeChild]);

  const handleSubmit = () => {
    const id = nextId();
    const base = {
      id,
      childId: activeChild?.id,
      type,
      date: datetime,
      createdBy: firebaseUser?.uid || null,
      createdByName: firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || null,
      createdAt: new Date().toISOString(),
    };

    let entry = { ...base };
    if (type === 'biberon') {
      entry = {
        ...entry,
        mode,
        quantite: mode === 'biberon' ? Number(quantite) || 0 : undefined,
        cote: mode === 'sein' ? cote : undefined,
        duree: duree ? Number(duree) : undefined,
        vitamineD,
      };
    } else if (type === 'couche') {
      entry = { ...entry, contenu };
    } else if (type === 'sommeil') {
      entry = { ...entry, duree: sommeilDuree ? Number(sommeilDuree) : undefined, humeur };
    } else if (type === 'autre') {
      entry = { ...entry, note };
    }

    update((draft) => {
      draft.entries.push(entry);
      if (type === 'biberon' && vitamineD && activeChild) {
        const c = draft.children.find((c) => c.id === activeChild.id);
        if (c) c.lastVitDDate = datetime.slice(0, 10);
      }
      return draft;
    });

    showToast('Entrée enregistrée', '✅');
    onSaved && onSaved(entry);
    onClose();
  };

  // dirty = true dès qu'une valeur a changé par rapport au prefill
  const isDirty = quantite !== '' || duree !== '' || contenu !== 'pipi' || note !== '';

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle entrée" icon="📓" dirty={isDirty}>
      <div className="field">
        <label>Type</label>
        <div className="pill-group">
          {Object.entries(ENTRY_TYPES).map(([key, def]) => (
            <button
              key={key}
              className={`pill-choice ${type === key ? 'selected' : ''}`}
              onClick={() => setType(key)}
            >
              {def.icon} {def.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Date et heure</label>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
      </div>

      {type === 'biberon' && (
        <>
          <div className="field">
            <label>Mode</label>
            <div className="pill-group">
              <button className={`pill-choice ${mode === 'biberon' ? 'selected' : ''}`} onClick={() => setMode('biberon')}>🍼 Biberon</button>
              <button className={`pill-choice ${mode === 'sein' ? 'selected' : ''}`} onClick={() => setMode('sein')}>🤱 Tétée</button>
            </div>
          </div>
          {mode === 'biberon' ? (
            <div className="field">
              <label>Quantité (ml)</label>
              <input type="number" inputMode="numeric" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="120" />
            </div>
          ) : (
            <div className="field-row">
              <div className="field">
                <label>Côté</label>
                <div className="pill-group">
                  <button className={`pill-choice ${cote === 'gauche' ? 'selected' : ''}`} onClick={() => setCote('gauche')}>Gauche</button>
                  <button className={`pill-choice ${cote === 'droit' ? 'selected' : ''}`} onClick={() => setCote('droit')}>Droit</button>
                  <button className={`pill-choice ${cote === 'deux' ? 'selected' : ''}`} onClick={() => setCote('deux')}>Les deux</button>
                </div>
              </div>
            </div>
          )}
          <div className="field">
            <label>Durée (minutes, optionnel)</label>
            <input type="number" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} placeholder="15" />
          </div>
          {lastVitDInfo && (
            <div className="field flex-row">
              <input type="checkbox" id="vitD" checked={vitamineD} onChange={(e) => setVitamineD(e.target.checked)} style={{ width: 20, height: 20 }} />
              <label htmlFor="vitD" style={{ margin: 0 }}>💊 Vitamine D donnée</label>
            </div>
          )}
        </>
      )}

      {type === 'couche' && (
        <div className="field">
          <label>Contenu</label>
          <div className="pill-group">
            <button className={`pill-choice ${contenu === 'pipi' ? 'selected' : ''}`} onClick={() => setContenu('pipi')}>💧 Pipi</button>
            <button className={`pill-choice ${contenu === 'selles' ? 'selected' : ''}`} onClick={() => setContenu('selles')}>💩 Selles</button>
            <button className={`pill-choice ${contenu === 'mixte' ? 'selected' : ''}`} onClick={() => setContenu('mixte')}>Mixte</button>
            <button className={`pill-choice ${contenu === 'seche' ? 'selected' : ''}`} onClick={() => setContenu('seche')}>Sèche</button>
          </div>
        </div>
      )}

      {type === 'sommeil' && (
        <>
          <div className="field">
            <label>Durée (minutes)</label>
            <input type="number" inputMode="numeric" value={sommeilDuree} onChange={(e) => setSommeilDuree(e.target.value)} placeholder="90" />
          </div>
          <div className="field">
            <label>Humeur au réveil</label>
            <div className="pill-group">
              {['Calme', 'Souriant', 'Grognon', 'Pleurs'].map((h) => (
                <button key={h} className={`pill-choice ${humeur === h ? 'selected' : ''}`} onClick={() => setHumeur(h)}>{h}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {type === 'autre' && (
        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Décris l'événement..." />
        </div>
      )}

      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        Enregistrer ✓
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Today's overview ("Aujourd'hui en un coup d'œil")
// ----------------------------------------------------------------------
function estimateNextBiberon(entries) {
  const biberons = entries.filter((e) => e.type === 'biberon').sort((a, b) => (a.date < b.date ? 1 : -1));
  if (biberons.length < 2) return null;
  const recent = biberons.slice(0, 5);
  let totalDiff = 0;
  let count = 0;
  for (let i = 0; i < recent.length - 1; i++) {
    const diff = new Date(recent[i].date) - new Date(recent[i + 1].date);
    if (diff > 0 && diff < 1000 * 60 * 60 * 8) {
      totalDiff += diff;
      count++;
    }
  }
  if (count === 0) return null;
  const avgInterval = totalDiff / count;
  const next = new Date(new Date(biberons[0].date).getTime() + avgInterval);
  return next;
}

function lastOfType(entries, type) {
  const filtered = entries.filter((e) => e.type === type).sort((a, b) => (a.date < b.date ? 1 : -1));
  return filtered[0] || null;
}

function buildShareSummary(entries, child) {
  const today = entries.filter((e) => isToday(e.date));
  const biberons = today.filter((e) => e.type === 'biberon');
  const couches = today.filter((e) => e.type === 'couche');
  const sommeils = today.filter((e) => e.type === 'sommeil');
  const totalLait = biberons.filter((b) => b.mode === 'biberon').reduce((sum, b) => sum + (b.quantite || 0), 0);
  const totalSommeil = sommeils.reduce((sum, s) => sum + (s.duree || 0), 0);

  let txt = `🍼 Résumé du jour${child ? ` — ${child.nom}` : ''}\n`;
  txt += `📓 Biberons/tétées : ${biberons.length}`;
  if (totalLait > 0) txt += ` (${totalLait} ml)`;
  txt += `\n🧷 Couches : ${couches.length}\n`;
  txt += `🌙 Sommeil : ${sommeils.length} période(s)`;
  if (totalSommeil > 0) txt += ` (${Math.floor(totalSommeil / 60)}h${String(totalSommeil % 60).padStart(2, '0')})`;
  txt += `\n\nEnvoyé depuis OmniBaby 🍼`;
  return txt;
}

function TodayOverview({ entries, child, filterType, setFilterType, onLongPress }) {
  const lastBiberon = lastOfType(entries, 'biberon');
  const lastCouche = lastOfType(entries, 'couche');
  const lastSommeil = lastOfType(entries, 'sommeil');
  const nextBiberon = estimateNextBiberon(entries);

  // Cumuls journée
  const todayBiberons = entries.filter((e) => e.type === 'biberon');
  const totalLait = todayBiberons.filter((b) => b.mode === 'biberon').reduce((s, b) => s + (b.quantite || 0), 0);
  const totalTetees = todayBiberons.filter((b) => b.mode === 'sein').reduce((s, b) => s + (b.duree || 0), 0);
  const totalCouches = entries.filter((e) => e.type === 'couche').length;
  const totalSommeilMin = entries.filter((e) => e.type === 'sommeil').reduce((s, e) => s + (e.duree || 0), 0);

  const biberonDetail = todayBiberons.length > 0
    ? totalLait > 0 ? `${todayBiberons.length}x · ${totalLait}ml`
    : totalTetees > 0 ? `${todayBiberons.length}x · ${totalTetees}min`
    : `${todayBiberons.length}x` : null;
  const coucheDetail = totalCouches > 0 ? `${totalCouches} changes` : null;
  const sommeilDetail = totalSommeilMin > 0
    ? `${Math.floor(totalSommeilMin / 60)}h${String(totalSommeilMin % 60).padStart(2,'0')}`
    : null;

  const stats = [
    { key: 'biberon', icon: '🍼', label: 'Biberon', value: lastBiberon ? formatTimeFR(lastBiberon.date) : '—', detail: biberonDetail },
    { key: 'couche', icon: '🧷', label: 'Change', value: lastCouche ? formatTimeFR(lastCouche.date) : '—', detail: coucheDetail },
    { key: 'sommeil', icon: '🌙', label: 'Sommeil', value: lastSommeil ? formatTimeFR(lastSommeil.date) : '—', detail: sommeilDetail },
  ];

  const handleShare = async () => {
    const text = buildShareSummary(entries, child);
    if (navigator.share) {
      try {
        await navigator.share({ text, title: 'Résumé du jour' });
      } catch (e) {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        alert('Résumé copié dans le presse-papier !');
      } catch (e) {
        alert(text);
      }
    }
  };

  return (
    <div className="card appear">
      <div className="flex-between">
        <div className="section-title" style={{ marginBottom: 0 }}>👀 Aujourd'hui en un coup d'œil</div>
        <button className="btn btn-ghost btn-sm" onClick={handleShare}>📤 Partager</button>
      </div>
      <div className="stamp-row mt-16">
        {stats.map((s) => (
          <button
            key={s.key}
            className={`stamp ${filterType === s.key ? 'filter-active' : ''}`}
            onClick={() => setFilterType(filterType === s.key ? 'tous' : s.key)}
          >
            <span className="stamp-icon">{s.icon}</span>
            <span className="stamp-value">{s.value}</span>
            <span className="stamp-label">{s.label}</span>
            {s.detail && <span className="stamp-detail">{s.detail}</span>}
          </button>
        ))}
      </div>
      {nextBiberon && (
        <div className="muted" style={{ fontSize: '0.82rem' }}>
          ⏳ Prochain biberon estimé vers <strong style={{ color: 'var(--text)' }}>{formatTimeFR(nextBiberon)}</strong>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Entry list item
// Swipe gauche = révèle bouton corbeille fixe à droite
// ----------------------------------------------------------------------
function EntryItem({ entry, onEdit, onDelete, compact = false }) {
  const def = ENTRY_TYPES[entry.type] || ENTRY_TYPES.autre;
  const [revealed, setRevealed] = React.useState(false);
  const [offsetX, setOffsetX] = React.useState(0);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const touchStartX = React.useRef(null);
  const touchStartY = React.useRef(null);
  const isDragging = React.useRef(false);
  const ACTION_WIDTH = 88;
  const TRIGGER = 44;

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!isDragging.current && Math.abs(dy) > Math.abs(dx) + 5) return;
    if (dx > 8) {
      if (revealed) { setRevealed(false); setOffsetX(0); }
      return;
    }
    if (dx < -5) {
      isDragging.current = true;
      e.preventDefault();
      setOffsetX(Math.max(-ACTION_WIDTH, dx));
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    touchStartX.current = null;
    if (offsetX < -TRIGGER) {
      setRevealed(true);
      setOffsetX(-ACTION_WIDTH);
    } else {
      setRevealed(false);
      setOffsetX(0);
    }
  };

  const handleContentTap = () => {
    if (revealed) { setRevealed(false); setOffsetX(0); return; }
    if (confirmDelete) { setConfirmDelete(false); return; }
    onEdit && onEdit();
  };

  const handleDeleteTap = (e) => {
    e.stopPropagation();
    setConfirmDelete(true);
    setRevealed(false);
    setOffsetX(0);
  };

  const handleConfirmDelete = (e) => {
    e.stopPropagation();
    onDelete();
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const subtitle = entrySubtitle(entry);
  const timeStr = entry.date
    ? new Date(entry.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Mode confirmation : remplace la ligne par un bandeau de confirmation
  if (confirmDelete) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: compact ? '7px 10px' : '11px 12px',
        background: 'var(--danger-soft)',
        border: '1.5px solid var(--danger)',
        borderRadius: 'var(--radius-md)',
        marginBottom: compact ? 4 : 8,
      }}>
        <span style={{ fontSize: '.82rem', color: 'var(--danger)', fontWeight: 600, flex: 1 }}>
          🗑️ Supprimer cette entrée ?
        </span>
        <button
          onPointerDown={handleCancelDelete}
          style={{
            padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
            background: 'var(--surface)', fontWeight: 600, fontSize: '.76rem',
            cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-soft)',
          }}
        >Annuler</button>
        <button
          onPointerDown={handleConfirmDelete}
          style={{
            padding: '5px 12px', borderRadius: 'var(--radius-pill)', border: 'none',
            background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: '.76rem',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >Confirmer</button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--radius-md)',
      marginBottom: compact ? 4 : 8,
      userSelect: 'none',
      // La hauteur est fixée par le contenu — pas d'overflow:hidden ici
      // pour ne pas déborder sur les lignes voisines
    }}>
      {/* Zone corbeille — même hauteur exacte que le contenu, clips via overflow hidden du parent */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: ACTION_WIDTH,
        background: 'var(--danger)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden', // contenu corbeille clipé à ses propres bornes
      }}>
        <button
          onPointerDown={handleDeleteTap}
          style={{
            width: '100%', height: '100%', background: 'none', border: 'none',
            color: '#fff', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
          }}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🗑️</span>
          <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.2px' }}>Supprimer</span>
        </button>
      </div>

      {/* Contenu glissant — clipé pour ne jamais dépasser le wrapper */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleContentTap}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.18s ease',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          padding: compact ? '7px 10px' : '11px 12px',
          gap: compact ? 8 : 12,
          position: 'relative', zIndex: 1,
          cursor: 'pointer',
          willChange: 'transform',
          // Clip visuel pour que la ligne ne déborde pas sur les voisines
          clipPath: revealed ? 'none' : 'none',
        }}
      >
        {compact ? (
          <>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: def.color, color: def.iconColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem',
            }}>{def.icon}</div>
            <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: '.78rem' }}>
              {def.label}
              {subtitle && <span style={{ color: 'var(--text-soft)', fontWeight: 400 }}> · {subtitle}</span>}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--text-faint)', flexShrink: 0 }}>
              {timeStr}
            </span>
          </>
        ) : (
          <>
            <EntryIcon type={entry.type} />
            <div className="entry-body" style={{ flex: 1, minWidth: 0 }}>
              <div className="entry-title">{def.label}</div>
              {subtitle && <div className="entry-sub">{subtitle}</div>}
              {(entry.createdByName || entry.updatedByName) && (
                <div className="entry-author">
                  <span>{entry.updatedByName ? '✏️' : '✍️'}</span>
                  <span>{entry.updatedByName || entry.createdByName}</span>
                </div>
              )}
            </div>
            <div className="entry-time">{timeStr}</div>
          </>
        )}
      </div>
    </div>
  );
}

// Main Journal tab
// ----------------------------------------------------------------------
const PERIOD_OPTIONS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'yesterday', label: 'Hier' },
  { key: '7days', label: '7 jours' },
  { key: 'all', label: 'Tout' },
];



// ----------------------------------------------------------------------
// Saisie rapide — biberon en 2 taps (heure auto + dernière quantité)
// ----------------------------------------------------------------------
function QuickEntryBar({ entries, onSaved, firebaseUser }) {
  const { store, update, nextId } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [saving, setSaving] = React.useState(null);

  // Dernière quantité utilisée
  const lastQty = React.useMemo(() => {
    const last = entries.filter((e) => e.type === 'biberon' && e.mode === 'biberon' && e.quantite)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return last?.quantite || 120;
  }, [entries]);

  const quickSave = (type, extra = {}) => {
    if (!activeChild) return;
    setSaving(type);
    const entry = {
      id: nextId(),
      childId: activeChild.id,
      type,
      date: new Date().toISOString(),
      createdBy: firebaseUser?.uid || null,
      createdByName: firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || null,
      createdAt: new Date().toISOString(),
      ...extra,
    };
    update((draft) => { draft.entries.push(entry); return draft; });
    showToast('Enregistré', '✅');
    onSaved && onSaved(entry);
    setTimeout(() => setSaving(null), 600);
  };

  const actions = [
    {
      key: 'biberon',
      icon: '🍼',
      label: `Biberon · ${lastQty}ml`,
      sub: 'maintenant',
      onPress: () => quickSave('biberon', { mode: 'biberon', quantite: lastQty }),
    },
    {
      key: 'couche_pipi',
      icon: '💧',
      label: 'Pipi',
      sub: 'maintenant',
      onPress: () => quickSave('couche', { contenu: 'pipi' }),
    },
    {
      key: 'couche_selles',
      icon: '💩',
      label: 'Selles',
      sub: 'maintenant',
      onPress: () => quickSave('couche', { contenu: 'selles' }),
    },
  ];

  return (
    <div style={{
      display: 'flex', gap: 7, marginBottom: 12, overflowX: 'auto', paddingBottom: 2,
    }}>
      {actions.map((a) => (
        <button
          key={a.key}
          onClick={a.onPress}
          style={{
            flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '8px 12px', borderRadius: 'var(--radius-lg)',
            background: saving === a.key ? 'var(--accent-sage-soft)' : 'var(--surface)',
            border: `1.5px solid ${saving === a.key ? 'var(--accent-sage)' : 'var(--border)'}`,
            cursor: 'pointer', transition: 'all .15s', minWidth: 72,
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>{saving === a.key ? '✅' : a.icon}</span>
          <span style={{ fontSize: '.68rem', fontWeight: 700, color: 'var(--text)' }}>{a.label}</span>
          <span style={{ fontSize: '.6rem', color: 'var(--text-faint)' }}>{a.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Résumé hebdomadaire (moyennes 7 jours pour le pédiatre)
// ----------------------------------------------------------------------
function WeekSummary({ entries }) {
  const stats = React.useMemo(() => {
    if (!entries.length) return null;
    const days = {};
    entries.forEach((e) => {
      const d = e.date.slice(0, 10);
      if (!days[d]) days[d] = { biberons: 0, ml: 0, couches: 0 };
      if (e.type === 'biberon') { days[d].biberons++; days[d].ml += (e.quantite || 0); }
      if (e.type === 'couche') days[d].couches++;
    });
    const ds = Object.values(days);
    if (!ds.length) return null;
    const n = ds.length;
    return {
      avgBib: (ds.reduce((s, d) => s + d.biberons, 0) / n).toFixed(1),
      avgMl: Math.round(ds.reduce((s, d) => s + d.ml, 0) / n),
      avgCouche: (ds.reduce((s, d) => s + d.couches, 0) / n).toFixed(1),
      days: n,
    };
  }, [entries]);

  if (!stats) return null;

  return (
    <div className="card appear" style={{ background: 'var(--surface-2)', marginBottom: 12 }}>
      <div className="section-title" style={{ marginBottom: 8 }}>
        📊 Moyennes sur {stats.days} jour{stats.days > 1 ? 's' : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[
          { icon: '🍼', val: stats.avgBib, label: 'biberons/j' },
          { icon: '💧', val: stats.avgMl > 0 ? `${stats.avgMl}ml` : '—', label: 'lait moyen/j' },
          { icon: '🧷', val: stats.avgCouche, label: 'changes/j' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: '1.1rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '.9rem', marginTop: 2 }}>
              {s.val}
            </div>
            <div style={{ fontSize: '.62rem', color: 'var(--text-soft)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '.7rem', color: 'var(--text-faint)', marginTop: 6 }}>
        Résumé utile pour le pédiatre · Données Journal uniquement
      </div>
    </div>
  );
}


export default function JournalTab({ openEntryForm, setOpenEntryForm, formPrefill, onTimerFinished }) {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [period, setPeriod] = useState('today');
  const [filterType, setFilterType] = useState('tous');
  const [editingEntry, setEditingEntry] = useState(null);

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';
  const compact = !!store.settings?.journalCompact;

  const childEntries = useMemo(
    () => filterByActiveChild(store.entries, store.activeChildId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [store.entries, store.activeChildId]
  );

  const todayEntries = useMemo(() => childEntries.filter((e) => isToday(e.date)), [childEntries]);

  const periodFiltered = useMemo(() => {
    if (period === 'today') return childEntries.filter((e) => isToday(e.date));
    if (period === 'yesterday') {
      const y = daysAgo(1);
      return childEntries.filter((e) => {
        const d = new Date(e.date);
        return d.toDateString() === y.toDateString();
      });
    }
    if (period === '7days') {
      const cutoff = daysAgo(7);
      return childEntries.filter((e) => new Date(e.date) >= cutoff);
    }
    return childEntries;
  }, [childEntries, period]);

  const typeFiltered = useMemo(() => {
    if (filterType === 'tous') return periodFiltered;
    return periodFiltered.filter((e) => e.type === filterType);
  }, [periodFiltered, filterType]);

  const grouped = useMemo(() => groupByDay(typeFiltered, 'date'), [typeFiltered]);

  const handleDelete = (id) => {
    update((draft) => {
      draft.entries = draft.entries.filter((e) => e.id !== id);
      return draft;
    });
    showToast('Entrée supprimée', '🗑️');
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour commencer à utiliser le journal.</div>
      </div>
    );
  }

  return (
    <div>
      <TodayOverview
          entries={todayEntries}
          child={activeChild}
          filterType={filterType}
          setFilterType={setFilterType}
          onLongPress={(type) => {
            if (type === 'biberon') { setOpenEntryForm(true); }
            else if (type === 'couche') { setOpenEntryForm(true); }
            else if (type === 'sommeil') { setOpenEntryForm(true); }
          }}
        />

      <div className="chip-row mt-16">
        {PERIOD_OPTIONS.map((p) => (
          <button key={p.key} className={`chip ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      {period === 'today' && <QuickEntryBar entries={todayEntries} onSaved={() => {}} firebaseUser={firebaseUser} />}
      {period === '7days' && <WeekSummary entries={periodFiltered} />}

      {filterType !== 'tous' && (
        <div className="chip-row" style={{ marginTop: -6 }}>
          <button className="chip active" onClick={() => setFilterType('tous')}>
            {ENTRY_TYPES[filterType]?.icon} {ENTRY_TYPES[filterType]?.label} ✕
          </button>
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📓</div>
          <div className="title">Rien à afficher</div>
          <div className="desc">Aucune entrée pour cette période. Touche le bouton + pour ajouter un biberon, une couche ou un événement.</div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">{dayLabel(day)}</div>
            <div className="entry-list">
              {items.map((entry) => (
                <EntryItem
                  key={entry.id}
                  entry={entry}
                  compact={compact}
                  onEdit={() => canEdit && setEditingEntry(entry)}
                  onDelete={() => canEdit && handleDelete(entry.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <EntryForm
        open={openEntryForm}
        onClose={() => setOpenEntryForm(false)}
        prefill={formPrefill}
        onSaved={onTimerFinished}
      />

      {editingEntry && (
        <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Edit existing entry (simplified — reuses the same field set via state)
// ----------------------------------------------------------------------
function EditEntryModal({ entry, onClose }) {
  const { update } = useStore();
  const showToast = useToast();
  const def = ENTRY_TYPES[entry.type] || ENTRY_TYPES.autre;

  const [datetime, setDatetime] = useState(entry.date?.slice(0, 16) || toISODateTime());
  const [quantite, setQuantite] = useState(entry.quantite ?? '');
  const [duree, setDuree] = useState(entry.duree ?? '');
  const [cote, setCote] = useState(entry.cote || 'gauche');
  const [mode, setMode] = useState(entry.mode || 'biberon');
  const [contenu, setContenu] = useState(entry.contenu || 'pipi');
  const [humeur, setHumeur] = useState(entry.humeur || 'Calme');
  const [note, setNote] = useState(entry.note || '');
  const [vitamineD, setVitamineD] = useState(entry.vitamineD || false);

  const handleSave = () => {
    update((draft) => {
      const idx = draft.entries.findIndex((e) => e.id === entry.id);
      if (idx === -1) return draft;
      const updated = {
        ...draft.entries[idx],
        date: datetime,
        updatedBy: firebaseUser?.uid || null,
        updatedByName: firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || null,
        updatedAt: new Date().toISOString(),
      };
      if (entry.type === 'biberon') {
        updated.mode = mode;
        if (mode === 'biberon') updated.quantite = Number(quantite) || 0;
        else updated.cote = cote;
        updated.duree = duree ? Number(duree) : undefined;
        updated.vitamineD = vitamineD;
      } else if (entry.type === 'couche') {
        updated.contenu = contenu;
      } else if (entry.type === 'sommeil') {
        updated.duree = duree ? Number(duree) : undefined;
        updated.humeur = humeur;
      } else if (entry.type === 'autre') {
        updated.note = note;
      }
      draft.entries[idx] = updated;
      return draft;
    });
    showToast('Entrée modifiée', '✅');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Modifier — ${def.label}`} icon={def.icon}>
      <div className="field">
        <label>Date et heure</label>
        <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
      </div>

      {entry.type === 'biberon' && (
        <>
          <div className="field">
            <label>Mode</label>
            <div className="pill-group">
              <button className={`pill-choice ${mode === 'biberon' ? 'selected' : ''}`} onClick={() => setMode('biberon')}>🍼 Biberon</button>
              <button className={`pill-choice ${mode === 'sein' ? 'selected' : ''}`} onClick={() => setMode('sein')}>🤱 Tétée</button>
            </div>
          </div>
          {mode === 'biberon' ? (
            <div className="field">
              <label>Quantité (ml)</label>
              <input type="number" inputMode="numeric" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
          ) : (
            <div className="field">
              <label>Côté</label>
              <div className="pill-group">
                <button className={`pill-choice ${cote === 'gauche' ? 'selected' : ''}`} onClick={() => setCote('gauche')}>Gauche</button>
                <button className={`pill-choice ${cote === 'droit' ? 'selected' : ''}`} onClick={() => setCote('droit')}>Droit</button>
                <button className={`pill-choice ${cote === 'deux' ? 'selected' : ''}`} onClick={() => setCote('deux')}>Les deux</button>
              </div>
            </div>
          )}
          <div className="field">
            <label>Durée (minutes)</label>
            <input type="number" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} />
          </div>
          <div className="field flex-row">
            <input type="checkbox" id="vitDedit" checked={vitamineD} onChange={(e) => setVitamineD(e.target.checked)} style={{ width: 20, height: 20 }} />
            <label htmlFor="vitDedit" style={{ margin: 0 }}>💊 Vitamine D donnée</label>
          </div>
        </>
      )}

      {entry.type === 'couche' && (
        <div className="field">
          <label>Contenu</label>
          <div className="pill-group">
            <button className={`pill-choice ${contenu === 'pipi' ? 'selected' : ''}`} onClick={() => setContenu('pipi')}>💧 Pipi</button>
            <button className={`pill-choice ${contenu === 'selles' ? 'selected' : ''}`} onClick={() => setContenu('selles')}>💩 Selles</button>
            <button className={`pill-choice ${contenu === 'mixte' ? 'selected' : ''}`} onClick={() => setContenu('mixte')}>Mixte</button>
            <button className={`pill-choice ${contenu === 'seche' ? 'selected' : ''}`} onClick={() => setContenu('seche')}>Sèche</button>
          </div>
        </div>
      )}

      {entry.type === 'sommeil' && (
        <>
          <div className="field">
            <label>Durée (minutes)</label>
            <input type="number" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} />
          </div>
          <div className="field">
            <label>Humeur au réveil</label>
            <div className="pill-group">
              {['Calme', 'Souriant', 'Grognon', 'Pleurs'].map((h) => (
                <button key={h} className={`pill-choice ${humeur === h ? 'selected' : ''}`} onClick={() => setHumeur(h)}>{h}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {entry.type === 'autre' && (
        <div className="field">
          <label>Note</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      <button className="btn btn-primary btn-block mt-16" onClick={handleSave}>Enregistrer ✓</button>
    </Modal>
  );
}
