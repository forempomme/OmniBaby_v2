import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild, ageInMonths } from './store.jsx';
import {
  toISODate,
  toISODateTime,
  formatTimeFR,
  formatDateFR,
  groupByDay,
  dayLabel,
  daysAgo,
  isToday,
  SwipeToDelete,
  useToast,
} from './utils.jsx';
import { Modal } from './Modal.jsx';

// ----------------------------------------------------------------------
// Sleep recommendations by age (OMS / repères pédiatriques usuels)
// Total sleep per 24h, in hours [min, max]
// ----------------------------------------------------------------------
const SLEEP_RECOS = [
  { maxMonths: 3, label: '0-3 mois', total: [14, 17], naps: '4-5 siestes' },
  { maxMonths: 6, label: '4-6 mois', total: [12, 15], naps: '3-4 siestes' },
  { maxMonths: 12, label: '7-12 mois', total: [12, 15], naps: '2-3 siestes' },
  { maxMonths: 24, label: '1-2 ans', total: [11, 14], naps: '1-2 siestes' },
  { maxMonths: 36, label: '2-3 ans', total: [10, 13], naps: '1 sieste' },
  { maxMonths: Infinity, label: '3 ans et +', total: [10, 13], naps: 'sieste optionnelle' },
];

function getRecoForAge(ageM) {
  if (ageM == null) return SLEEP_RECOS[0];
  return SLEEP_RECOS.find((r) => ageM <= r.maxMonths) || SLEEP_RECOS[SLEEP_RECOS.length - 1];
}

const QUALITES = [
  { key: 'excellent', label: 'Excellent', icon: '😴' },
  { key: 'bon', label: 'Bon', icon: '🙂' },
  { key: 'agite', label: 'Agité', icon: '😣' },
  { key: 'difficile', label: 'Difficile', icon: '😢' },
];

const HUMEURS = ['Calme', 'Souriant', 'Grognon', 'Pleurs'];

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function diffMinutes(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  let diff = (e - s) / 60000;
  if (diff <= 0) diff += 24 * 60; // l'utilisateur a probablement oublié de changer le jour de fin
  return Math.round(diff);
}

// ----------------------------------------------------------------------
// Add / edit sleep entry form
// ----------------------------------------------------------------------
function SommeilForm({ open, onClose, child, editing }) {
  const { update, nextId } = useStore();
  const showToast = useToast();

  const [type, setType] = useState('sieste');
  const [debut, setDebut] = useState(toISODateTime());
  const [fin, setFin] = useState('');
  const [qualite, setQualite] = useState('bon');
  const [humeurReveil, setHumeurReveil] = useState('Calme');

  React.useEffect(() => {
    if (open) {
      if (editing) {
        setType(editing.type || 'sieste');
        setDebut(editing.debut?.slice(0, 16) || toISODateTime());
        setFin(editing.fin?.slice(0, 16) || '');
        setQualite(editing.qualite || 'bon');
        setHumeurReveil(editing.humeurReveil || 'Calme');
      } else {
        const now = new Date();
        setType('sieste');
        setDebut(toISODateTime(now));
        setFin('');
        setQualite('bon');
        setHumeurReveil('Calme');
      }
    }
  }, [open, editing]);

  const handleSubmit = () => {
    if (!debut) {
      showToast('Indique une heure de début', '⚠️');
      return;
    }
    const duree = fin ? diffMinutes(debut, fin) : null;
    const entry = {
      id: editing ? editing.id : nextId(),
      childId: child.id,
      type,
      debut,
      fin: fin || null,
      duree,
      qualite,
      humeurReveil,
    };

    update((draft) => {
      if (editing) {
        const idx = draft.sommeils.findIndex((s) => s.id === editing.id);
        if (idx !== -1) draft.sommeils[idx] = entry;
      } else {
        draft.sommeils.push(entry);
      }
      return draft;
    });

    showToast(editing ? 'Sommeil modifié' : 'Sommeil enregistré', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le sommeil' : 'Nouveau sommeil'} icon="🌙">
      <div className="field">
        <label>Type</label>
        <div className="pill-group">
          <button className={`pill-choice ${type === 'nuit' ? 'selected' : ''}`} onClick={() => setType('nuit')}>🌃 Nuit</button>
          <button className={`pill-choice ${type === 'sieste' ? 'selected' : ''}`} onClick={() => setType('sieste')}>☀️ Sieste</button>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Début</label>
          <input type="datetime-local" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div className="field">
          <label>Fin (optionnel)</label>
          <input type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </div>

      {fin && (
        <div className="muted" style={{ fontSize: '0.82rem', marginBottom: 10 }}>
          Durée : {formatDuration(diffMinutes(debut, fin))}
        </div>
      )}

      <div className="field">
        <label>Qualité</label>
        <div className="pill-group">
          {QUALITES.map((q) => (
            <button key={q.key} className={`pill-choice ${qualite === q.key ? 'selected' : ''}`} onClick={() => setQualite(q.key)}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Humeur au réveil</label>
        <div className="pill-group">
          {HUMEURS.map((h) => (
            <button key={h} className={`pill-choice ${humeurReveil === h ? 'selected' : ''}`} onClick={() => setHumeurReveil(h)}>{h}</button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>Enregistrer ✓</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Today summary card with recommendation comparison
// ----------------------------------------------------------------------
function TodaySummaryCard({ sommeils, child }) {
  const ageM = ageInMonths(child.birthdate);
  const reco = getRecoForAge(ageM);

  const todaySleeps = sommeils.filter((s) => isToday(s.debut));
  const totalMinutes = todaySleeps.reduce((sum, s) => sum + (s.duree || 0), 0);
  const nuits = todaySleeps.filter((s) => s.type === 'nuit').length;
  const siestes = todaySleeps.filter((s) => s.type === 'sieste').length;

  const totalHours = totalMinutes / 60;
  const [recoMin, recoMax] = reco.total;
  let statusColor = 'var(--text-soft)';
  let statusLabel = '—';
  if (totalMinutes > 0) {
    if (totalHours < recoMin) {
      statusColor = 'var(--accent-sun)';
      statusLabel = 'En dessous des repères';
    } else if (totalHours > recoMax) {
      statusColor = 'var(--accent-sky)';
      statusLabel = 'Au-dessus des repères';
    } else {
      statusColor = 'var(--accent-sage)';
      statusLabel = 'Dans les repères';
    }
  }

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom: 6 }}>🌙 Aujourd'hui</div>
      <div className="stamp-row">
        <div className="stamp" style={{ cursor: 'default' }}>
          <span className="stamp-icon">⏱️</span>
          <span className="stamp-value">{formatDuration(totalMinutes)}</span>
          <span className="stamp-label">Total</span>
        </div>
        <div className="stamp" style={{ cursor: 'default' }}>
          <span className="stamp-icon">🌃</span>
          <span className="stamp-value">{nuits}</span>
          <span className="stamp-label">Nuit(s)</span>
        </div>
        <div className="stamp" style={{ cursor: 'default' }}>
          <span className="stamp-icon">☀️</span>
          <span className="stamp-value">{siestes}</span>
          <span className="stamp-label">Sieste(s)</span>
        </div>
      </div>
      <div className="flex-between mt-8" style={{ fontSize: '0.82rem' }}>
        <span className="muted">
          Repère {reco.label} : {recoMin}-{recoMax} h/jour, {reco.naps}
        </span>
        {totalMinutes > 0 && <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Weekly bar chart (total sleep per day, last 7 days)
// ----------------------------------------------------------------------
function WeeklyChart({ sommeils }) {
  const days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const iso = toISODate(d);
      const total = sommeils
        .filter((s) => toISODate(new Date(s.debut)) === iso)
        .reduce((sum, s) => sum + (s.duree || 0), 0);
      result.push({ iso, label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 1).toUpperCase(), hours: total / 60 });
    }
    return result;
  }, [sommeils]);

  const maxHours = Math.max(16, ...days.map((d) => d.hours));

  return (
    <div className="card appear">
      <div className="section-title" style={{ marginBottom: 10 }}>📊 7 derniers jours</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
        {days.map((d) => (
          <div key={d.iso} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%',
                maxWidth: 28,
                background: d.hours > 0 ? 'var(--accent-sky)' : 'var(--border)',
                borderRadius: 6,
                height: `${Math.max(4, (d.hours / maxHours) * 80)}px`,
              }}
              title={`${d.hours.toFixed(1)} h`}
            />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)', fontWeight: 600 }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Sleep entry list item
// ----------------------------------------------------------------------
function SommeilItem({ entry, onEdit, onDelete }) {
  const qualDef = QUALITES.find((q) => q.key === entry.qualite) || QUALITES[1];
  const typeIcon = entry.type === 'nuit' ? '🌃' : '☀️';
  const typeLabel = entry.type === 'nuit' ? 'Nuit' : 'Sieste';

  return (
    <SwipeToDelete onDelete={onDelete}>
      <div onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }}>
        <div className="entry-icon" style={{ background: 'var(--accent-sky-soft)', color: 'var(--accent-sky)' }}>
          {typeIcon}
        </div>
        <div className="entry-body">
          <div className="entry-title">{typeLabel}{entry.duree ? ` · ${formatDuration(entry.duree)}` : ''}</div>
          <div className="entry-sub">
            {qualDef.icon} {qualDef.label}
            {entry.humeurReveil ? ` · Réveil : ${entry.humeurReveil}` : ''}
          </div>
        </div>
        <div className="entry-time">
          {formatTimeFR(entry.debut)}
          {entry.fin && <><br />→ {formatTimeFR(entry.fin)}</>}
        </div>
      </div>
    </SwipeToDelete>
  );
}

// ----------------------------------------------------------------------
// Main Dodo tab
// ----------------------------------------------------------------------
export default function DodoTab({ openFormExternal, setOpenFormExternal }) {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [formOpen, setFormOpen] = useState(false);

  // FAB externe depuis App.jsx
  React.useEffect(() => {
    if (openFormExternal) {
      setEditing(null);
      setFormOpen(true);
      setOpenFormExternal && setOpenFormExternal(false);
    }
  }, [openFormExternal]);
  const [editing, setEditing] = useState(null);
  const [period, setPeriod] = useState('today');

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childSommeils = useMemo(
    () => filterByActiveChild(store.sommeils, store.activeChildId).sort((a, b) => (a.debut < b.debut ? 1 : -1)),
    [store.sommeils, store.activeChildId]
  );

  const periodFiltered = useMemo(() => {
    if (period === 'today') return childSommeils.filter((s) => isToday(s.debut));
    if (period === '7days') {
      const cutoff = daysAgo(7);
      return childSommeils.filter((s) => new Date(s.debut) >= cutoff);
    }
    return childSommeils;
  }, [childSommeils, period]);

  const grouped = useMemo(() => groupByDay(periodFiltered, 'debut'), [periodFiltered]);

  const handleDelete = (id) => {
    update((draft) => {
      draft.sommeils = draft.sommeils.filter((s) => s.id !== id);
      return draft;
    });
    showToast('Sommeil supprimé', '🗑️');
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre son sommeil.</div>
      </div>
    );
  }

  return (
    <div>
      <TodaySummaryCard sommeils={childSommeils} child={activeChild} />
      <WeeklyChart sommeils={childSommeils} />

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom: 0 }}>🗂️ Historique</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            ＋ Ajouter
          </button>
        )}
      </div>

      <div className="chip-row mt-8">
        <button className={`chip ${period === 'today' ? 'active' : ''}`} onClick={() => setPeriod('today')}>Aujourd'hui</button>
        <button className={`chip ${period === '7days' ? 'active' : ''}`} onClick={() => setPeriod('7days')}>7 jours</button>
        <button className={`chip ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>Tout</button>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🌙</div>
          <div className="title">Rien à afficher</div>
          <div className="desc">Aucune période de sommeil enregistrée. Touche "Ajouter" pour commencer le suivi.</div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">{dayLabel(day)}</div>
            <div className="entry-list">
              {items.map((s) => (
                <SommeilItem
                  key={s.id}
                  entry={s}
                  onEdit={() => canEdit && (setEditing(s), setFormOpen(true))}
                  onDelete={() => canEdit && handleDelete(s.id)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <SommeilForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        child={activeChild}
        editing={editing}
      />
    </div>
  );
}
