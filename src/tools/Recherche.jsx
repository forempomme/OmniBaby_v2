import React, { useState, useMemo } from 'react';
import { useFullHistory, HistoryNotice } from '../HistoryNotice.jsx';
import { useStore, filterByActiveChild, getActiveChild } from '../store.jsx';
import { formatDateFR, formatDateTimeFR, toTime } from '../utils.jsx';
import { ENTRY_TYPES } from '../Journal.jsx';
import { ALIMENT_STATUTS, ALIMENT_CATEGORIES } from '../data/diversification.js';

import { UiIcon } from '../icons.jsx';
// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
function normalize(str) {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matches(query, ...fields) {
  const q = normalize(query);
  return fields.some((f) => normalize(f).includes(q));
}

const SOURCE_DEFS = {
  journal: { label: 'Journal', icon: '📓' },
  sommeil: { label: 'Sommeil', icon: '🌙' },
  aliment: { label: 'Aliments', icon: '🥦' },
  vaccin: { label: 'Vaccins', icon: '💉' },
  temperature: { label: 'Températures', icon: '🌡️' },
  medicament: { label: 'Médicaments', icon: '💊' },
  rappel: { label: 'Rappels', icon: '🎯' },
  journalbord: { label: 'Journal de bord', icon: '📸' },
  mesure: { label: 'Mesures', icon: '📏' },
  lait: { label: 'Stock de lait', icon: 'fridge' },
};

const MESURE_LABELS = { poids: ['Poids', 'kg'], taille: ['Taille', 'cm'], perimetre: ['Périmètre crânien', 'cm'] };
const LAIT_LIEUX = { frigo: 'au frigo', congel: 'au congélateur', decongele: 'décongelé', utilise: 'utilisé', jete: 'jeté' };

// ----------------------------------------------------------------------
// Result item
// ----------------------------------------------------------------------
function highlight(text, query) {
  if (!text || !query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((p, i) =>
    i % 2 === 1
      ? <mark key={i} style={{ background:'var(--accent-sun-soft)', color:'var(--text)', borderRadius:2, padding:'0 2px' }}>{p}</mark>
      : p
  );
}

function ResultItem({ source, title, subtitle, time, query }) {
  const def = SOURCE_DEFS[source] || { label: source, icon: '📄' };
  const COLORS = {
    journal: 'var(--primary-soft)', sommeil: 'var(--accent-sky-soft)',
    aliment: 'var(--accent-sage-soft)', vaccin: 'var(--accent-sun-soft)',
    temperature: 'var(--danger-soft)', medicament: 'var(--primary-soft)',
    rappel: 'var(--accent-sky-soft)', journalbord: 'var(--accent-sage-soft)',
    mesure: 'var(--accent-sage-soft)', lait: 'var(--accent-sky-soft)',
  };
  const ICON_COLORS = {
    journal: 'var(--primary-deep)', sommeil: 'var(--accent-sky)',
    aliment: 'var(--accent-sage)', vaccin: 'var(--accent-sun)',
    temperature: 'var(--danger)', medicament: 'var(--primary-deep)',
    rappel: 'var(--accent-sky)', journalbord: 'var(--accent-sage)',
    mesure: 'var(--accent-sage)', lait: 'var(--accent-sky)',
  };
  return (
    <div className="swipe-content" style={{ cursor: 'default' }}>
      <div className="entry-icon" style={{ background: COLORS[source] || 'var(--primary-soft)', color: ICON_COLORS[source] || 'var(--primary-deep)' }}>
        <UiIcon value={def.icon} size={20} />
      </div>
      <div className="entry-body">
        <div className="entry-title">{highlight(title, query)}</div>
        <div className="entry-sub">
          <span style={{ fontWeight:600 }}>{def.label}</span>
          {subtitle ? <span> · {highlight(subtitle, query)}</span> : null}
        </div>
      </div>
      {time && <div className="entry-time" style={{ fontSize:'.65rem' }}>{time}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Recherche module
// ----------------------------------------------------------------------
export default function RechercheTool() {
  const { store } = useStore();
  useFullHistory(true);
  const activeChild = getActiveChild(store);
  const [query, setQuery] = useState('');
  const [activeSources, setActiveSources] = useState(Object.keys(SOURCE_DEFS));

  const toggleSource = (key) => {
    setActiveSources((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const out = [];

    if (activeSources.includes('journal')) {
      for (const e of filterByActiveChild(store.entries, store.activeChildId)) {
        const def = ENTRY_TYPES[e.type];
        const text = e.note || '';
        if (matches(query, def?.label, text, e.type)) {
          out.push({
            source: 'journal',
            title: def?.label || e.type,
            subtitle: text || undefined,
            time: formatDateTimeFR(e.date),
            date: e.date,
          });
        }
      }
    }

    if (activeSources.includes('aliment')) {
      for (const a of filterByActiveChild(store.aliments, store.activeChildId)) {
        if (matches(query, a.nom, a.notes)) {
          const catDef = ALIMENT_CATEGORIES.find((c) => c.key === a.categorie);
          const statutDef = ALIMENT_STATUTS.find((s) => s.key === a.statut);
          out.push({
            source: 'aliment',
            title: a.nom,
            subtitle: [catDef?.label, statutDef?.label].filter(Boolean).join(' · '),
            time: a.date ? formatDateFR(a.date) : undefined,
            date: a.date,
          });
        }
      }
    }

    if (activeSources.includes('vaccin')) {
      for (const v of filterByActiveChild(store.vaccins, store.activeChildId)) {
        if (matches(query, v.name)) {
          out.push({
            source: 'vaccin',
            title: v.name,
            subtitle: v.status === 'done' ? 'Fait' : undefined,
            time: v.date ? formatDateFR(v.date) : undefined,
            date: v.date,
          });
        }
      }
    }

    if (activeSources.includes('medicament')) {
      for (const m of filterByActiveChild(store.medicaments, store.activeChildId)) {
        if (matches(query, m.nom, m.dose, m.notes)) {
          out.push({
            source: 'medicament',
            title: m.nom,
            subtitle: [m.dose, m.notes].filter(Boolean).join(' · '),
            time: m.prochaineDose ? `Prochaine : ${m.prochaineDose}` : undefined,
          });
        }
      }
    }

    if (activeSources.includes('rappel')) {
      for (const r of store.rappels) {
        if (matches(query, r.titre)) {
          out.push({
            source: 'rappel',
            title: r.titre,
            subtitle: r.fait ? 'Fait' : undefined,
            time: formatDateTimeFR(r.date),
            date: r.date,
          });
        }
      }
    }

    if (activeSources.includes('sommeil')) {
      for (const e of filterByActiveChild(store.entries || [], store.activeChildId).filter(e => e.type === 'sommeil')) {
        const label = e.sousType === 'nuit' ? 'Nuit' : 'Sieste';
        if (matches(query, label, e.note, e.qualite, e.humeurReveil)) {
          out.push({
            source: 'sommeil',
            title: label,
            subtitle: [
              e.duree ? `${Math.floor(e.duree/60)}h${String(e.duree%60).padStart(2,'0')}` : null,
              e.qualite,
              e.note,
            ].filter(Boolean).join(' · '),
            time: e.date ? formatDateTimeFR(e.date) : undefined,
            date: e.date,
          });
        }
      }
    }

    if (activeSources.includes('temperature')) {
      for (const t of filterByActiveChild(store.temperatures || [], store.activeChildId)) {
        if (matches(query, String(t.valeur), t.notes)) {
          out.push({
            source: 'temperature',
            title: `${t.valeur}°C`,
            subtitle: t.notes || undefined,
            time: t.date ? formatDateTimeFR(t.date) : undefined,
            date: t.date,
          });
        }
      }
    }

    if (activeSources.includes('mesure')) {
      for (const m of filterByActiveChild(store.mesures || [], store.activeChildId)) {
        const [label, unit] = MESURE_LABELS[m.type] || [m.type, ''];
        if (matches(query, label, String(m.valeur), m.notes)) {
          out.push({ source: 'mesure', title: `${label} : ${String(m.valeur).replace('.', ',')} ${unit}`, subtitle: m.notes || undefined, time: m.date ? formatDateFR(m.date) : undefined, date: m.date });
        }
      }
    }

    if (activeSources.includes('lait')) {
      for (const p of filterByActiveChild(store.lait || [], store.activeChildId)) {
        const lieu = LAIT_LIEUX[p.lieu] || p.lieu;
        if (matches(query, 'lait', 'tire-lait', lieu, String(p.quantite))) {
          out.push({ source: 'lait', title: `${p.quantite} ml ${lieu}`, subtitle: 'Tire-lait', time: formatDateTimeFR(p.date), date: p.date });
        }
      }
    }

    if (activeSources.includes('journalbord')) {
      for (const j of filterByActiveChild(store.journal, store.activeChildId)) {
        if (matches(query, j.titre, j.note, j.tag)) {
          out.push({
            source: 'journalbord',
            title: j.titre || '(sans titre)',
            subtitle: j.tag,
            time: j.date ? formatDateFR(j.date) : undefined,
            date: j.date,
          });
        }
      }
    }

    return out.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return toTime(b.date) - toTime(a.date);
    });
  }, [query, activeSources, store]);

  return (
    <div>
      <div className="field">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un aliment, un vaccin, un rappel..."
          autoFocus
        />
      </div>
      <HistoryNotice />

      <div className="chip-row">
        {Object.entries(SOURCE_DEFS).map(([key, def]) => (
          <button key={key} className={`chip ${activeSources.includes(key) ? 'active' : ''}`} onClick={() => toggleSource(key)}>
            <UiIcon value={def.icon} size={14} className="inline-ic" /> {def.label}
          </button>
        ))}
      </div>

      {!query.trim() ? (
        <div className="empty-state">
          <div className="emoji"><UiIcon value="🔍" size={40} /></div>
          <div className="title">Recherche globale</div>
          <div className="desc">Tape un mot-clé pour chercher dans le journal, les aliments, vaccins, médicaments, rappels et le journal de bord{activeChild ? ` de ${activeChild.nom}` : ''}.</div>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <div className="emoji"><UiIcon value="🤷" size={40} /></div>
          <div className="title">Aucun résultat</div>
          <div className="desc">Aucune correspondance pour "{query}". Essaie un autre mot-clé ou active d'autres catégories.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize:'.72rem', color:'var(--text-faint)', marginBottom:8, fontWeight:600 }}>
            {results.length} résultat{results.length > 1 ? 's' : ''} pour "{query}"
          </div>
          <div className="entry-list">
            {results.map((r, i) => (
            <ResultItem key={i} {...r} query={query} />
          ))}
          </div>
        </>
      )}
    </div>
  );
}
