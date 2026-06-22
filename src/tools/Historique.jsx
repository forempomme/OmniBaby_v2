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

  // Sommeils désormais dans store.entries (type === 'sommeil') — inclus automatiquement
  

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

  return items.filter((i) => i.date).sort((a, b) => (a.date < b.date ? 1 : -1));
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

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const allItems = useMemo(() => buildHistory(store), [store]);

  const filtered = useMemo(() => {
    if (filter === 'tous') return allItems;
    return allItems.filter((i) => i.source === filter);
  }, [allItems, filter]);

  const grouped = useMemo(() => groupByDay(filtered, 'date'), [filtered]);

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

  return (
    <div>
      <div className="chip-row">
        {FILTERS.map((f) => (
          <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.icon} {f.label}
          </button>
        ))}
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
            <div className="day-group-label">{dayLabel(day)}</div>
            <div className="entry-list">
              {items.map((item, idx) => (
                <SwipeToDelete key={`${item.table}-${item.id}-${idx}`} onDelete={() => canEdit && handleDelete(item)} disabled={!canEdit}>
                  <div className="entry-icon" style={{ background: item.bg || 'var(--primary-soft)', color: item.iconColor || 'var(--primary-deep)' }}>
                    {item.icon}
                  </div>
                  <div className="entry-body">
                    <div className="entry-title">{item.title}</div>
                    {item.subtitle && <div className="entry-sub">{item.subtitle}</div>}
                    {item.author && (
                      <div style={{ fontSize: '.62rem', color: 'var(--text-faint)', marginTop: 2 }}>
                        {item.authorAction === 'modifié' ? '✏️' : '✍️'} {item.author}
                      </div>
                    )}
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
