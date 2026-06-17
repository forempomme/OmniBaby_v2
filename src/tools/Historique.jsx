import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild } from '../store.jsx';
import { formatTimeFR, groupByDay, dayLabel, SwipeToDelete, useToast } from '../utils.jsx';
import { ENTRY_TYPES } from '../Journal.jsx';
import { ALIMENT_STATUTS } from '../data/diversification.js';

// ----------------------------------------------------------------------
// Build unified history items from all data tables
// ----------------------------------------------------------------------
const SOURCE_DEFS = {
  entry: { icon: '📓' },
  sommeil: { icon: '🌙', color: 'var(--accent-sky-soft)', iconColor: 'var(--accent-sky)' },
  mesure: { icon: '📏', color: 'var(--accent-sage-soft)', iconColor: 'var(--accent-sage)' },
  temperature: { icon: '🌡️', color: 'var(--danger-soft)', iconColor: 'var(--danger)' },
  vaccin: { icon: '💉', color: 'var(--accent-sky-soft)', iconColor: 'var(--accent-sky)' },
  aliment: { icon: '🥦', color: 'var(--accent-sun-soft)', iconColor: 'var(--accent-sun)' },
};

const MESURE_LABELS = { poids: 'Poids', taille: 'Taille', perimetre: 'Périmètre crânien' };
const MESURE_UNITS = { poids: 'kg', taille: 'cm', perimetre: 'cm' };

function buildHistory(store) {
  const items = [];
  const activeChildId = store.activeChildId;

  for (const e of filterByActiveChild(store.entries, activeChildId)) {
    const def = ENTRY_TYPES[e.type] || ENTRY_TYPES.autre;
    let subtitle = '';
    if (e.type === 'biberon') {
      subtitle = e.mode === 'sein' ? `Tétée${e.cote ? ` · ${e.cote}` : ''}${e.duree ? ` · ${e.duree} min` : ''}` : `${e.quantite || 0} ml`;
    } else if (e.type === 'couche') {
      subtitle = { pipi: 'Pipi', selles: 'Selles', mixte: 'Mixte', seche: 'Sèche' }[e.contenu] || '';
    } else if (e.type === 'sommeil') {
      subtitle = e.duree ? `${e.duree} min` : '';
    } else if (e.type === 'autre') {
      subtitle = e.note || '';
    }
    items.push({
      source: 'entry',
      table: 'entries',
      id: e.id,
      icon: def.icon,
      iconColor: def.iconColor,
      bg: def.color,
      title: def.label,
      subtitle,
      date: e.date,
    });
  }

  for (const s of filterByActiveChild(store.sommeils, activeChildId)) {
    items.push({
      source: 'sommeil',
      table: 'sommeils',
      id: s.id,
      icon: '🌙',
      bg: SOURCE_DEFS.sommeil.color,
      iconColor: SOURCE_DEFS.sommeil.iconColor,
      title: s.type === 'nuit' ? 'Nuit' : 'Sieste',
      subtitle: s.duree ? `${Math.floor(s.duree / 60)}h${String(s.duree % 60).padStart(2, '0')}` : '',
      date: s.debut,
    });
  }

  for (const m of filterByActiveChild(store.mesures, activeChildId)) {
    items.push({
      source: 'mesure',
      table: 'mesures',
      id: m.id,
      icon: '📏',
      bg: SOURCE_DEFS.mesure.color,
      iconColor: SOURCE_DEFS.mesure.iconColor,
      title: MESURE_LABELS[m.type] || m.type,
      subtitle: `${m.valeur} ${MESURE_UNITS[m.type] || ''}`,
      date: m.date,
    });
  }

  for (const t of filterByActiveChild(store.temperatures, activeChildId)) {
    items.push({
      source: 'temperature',
      table: 'temperatures',
      id: t.id,
      icon: '🌡️',
      bg: SOURCE_DEFS.temperature.color,
      iconColor: SOURCE_DEFS.temperature.iconColor,
      title: `${t.valeur.toFixed(1)}°C`,
      subtitle: t.notes || '',
      date: t.date,
    });
  }

  for (const v of filterByActiveChild(store.vaccins, activeChildId)) {
    items.push({
      source: 'vaccin',
      table: 'vaccins',
      id: v.id,
      icon: '💉',
      bg: SOURCE_DEFS.vaccin.color,
      iconColor: SOURCE_DEFS.vaccin.iconColor,
      title: v.name,
      subtitle: 'Vaccin effectué',
      date: v.date,
    });
  }

  for (const a of filterByActiveChild(store.aliments, activeChildId)) {
    const statutDef = ALIMENT_STATUTS.find((s) => s.key === a.statut);
    items.push({
      source: 'aliment',
      table: 'aliments',
      id: a.id,
      icon: '🥦',
      bg: SOURCE_DEFS.aliment.color,
      iconColor: SOURCE_DEFS.aliment.iconColor,
      title: a.nom,
      subtitle: statutDef ? `${statutDef.icon} ${statutDef.label}` : '',
      date: a.date,
    });
  }

  return items.filter((i) => i.date);
}

function sortItems(items, sortBy) {
  if (sortBy === 'type') {
    return [...items].sort((a, b) => {
      const sc = a.source.localeCompare(b.source);
      if (sc !== 0) return sc;
      return a.date < b.date ? 1 : -1;
    });
  }
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ----------------------------------------------------------------------
// Main Historique module
// ----------------------------------------------------------------------
const FILTERS = [
  { key: 'tous', label: 'Tout', icon: '🗂️' },
  { key: 'entry', label: 'Journal', icon: '📓' },
  { key: 'sommeil', label: 'Sommeil', icon: '🌙' },
  { key: 'mesure', label: 'Mesures', icon: '📏' },
  { key: 'temperature', label: 'Température', icon: '🌡️' },
  { key: 'vaccin', label: 'Vaccins', icon: '💉' },
  { key: 'aliment', label: 'Aliments', icon: '🥦' },
];

export default function HistoriqueTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [filter, setFilter] = useState('tous');
  const [sortBy, setSortBy] = useState('date'); // 'date' | 'type'

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const allItems = useMemo(() => buildHistory(store), [store]);
  const sortedItems = useMemo(() => sortItems(allItems, sortBy), [allItems, sortBy]);

  const filtered = useMemo(() => {
    if (filter === 'tous') return sortedItems;
    return sortedItems.filter((i) => i.source === filter);
  }, [allItems, filter]);

  const grouped = useMemo(() => {
    if (sortBy === 'type') {
      // Grouper par source au lieu de par date
      const groups = {};
      const ORDER = ['entry','sommeil','mesure','temperature','vaccin','aliment'];
      filtered.forEach((item) => {
        const key = item.source;
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      return ORDER.filter((k) => groups[k]).map((k) => [k, groups[k]]);
    }
    return groupByDay(filtered, 'date');
  }, [filtered, sortBy]);

  const handleDelete = (item) => {
    update((draft) => {
      draft[item.table] = draft[item.table].filter((x) => x.id !== item.id);
      return draft;
    });
    showToast('Entrée supprimée', '🗑️');
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour voir son historique.</div>
      </div>
    );
  }

  const SOURCE_LABELS = {
    entry: '📓 Journal', sommeil: '🌙 Sommeil', mesure: '📏 Mesures',
    temperature: '🌡️ Températures', vaccin: '💉 Vaccins', aliment: '🥦 Aliments',
  };

  return (
    <div>
      <div className="chip-row">
        {FILTERS.map((f) => (
          <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.icon} {f.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: '.7rem', color: 'var(--text-soft)', alignSelf: 'center' }}>Tri :</span>
        <button className={`chip ${sortBy === 'date' ? 'active' : ''}`} onClick={() => setSortBy('date')}>
          📅 Par date
        </button>
        <button className={`chip ${sortBy === 'type' ? 'active' : ''}`} onClick={() => setSortBy('type')}>
          🏷️ Par type
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🗂️</div>
          <div className="title">Aucune donnée</div>
          <div className="desc">L'historique complet de {activeChild.nom} apparaîtra ici au fil des ajouts.</div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">{sortBy === 'type' ? (SOURCE_LABELS[day] || day) : dayLabel(day)}</div>
            <div className="entry-list">
              {items.map((item, idx) => (
                <SwipeToDelete key={`${item.table}-${item.id}-${idx}`} onDelete={() => canEdit && handleDelete(item)} disabled={!canEdit}>
                  <div className="entry-icon" style={{ background: item.bg || 'var(--primary-soft)', color: item.iconColor || 'var(--primary-deep)' }}>
                    {item.icon}
                  </div>
                  <div className="entry-body">
                    <div className="entry-title">{item.title}</div>
                    {item.subtitle && <div className="entry-sub">{item.subtitle}</div>}
                  </div>
                  <div className="entry-time">{formatTimeFR(item.date)}</div>
                </SwipeToDelete>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
