import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild } from '../store.js';
import { toISODateTime, formatDateFR, formatTimeFR, groupByDay, dayLabel, daysAgo, SwipeToDelete, useToast } from '../utils.js';
import { Modal } from '../Modal.jsx';

const FEVER_THRESHOLD = 38.5;
const NORMAL_MAX = 37.5;

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
function statusFor(valeur) {
  if (valeur >= FEVER_THRESHOLD) return { label: 'Fièvre', color: 'var(--danger)', bg: 'var(--danger-soft)' };
  if (valeur > NORMAL_MAX) return { label: 'Légère élévation', color: 'var(--accent-sun)', bg: 'var(--accent-sun-soft)' };
  return { label: 'Normale', color: 'var(--accent-sage)', bg: 'var(--accent-sage-soft)' };
}

// ----------------------------------------------------------------------
// Add temperature form
// ----------------------------------------------------------------------
function TemperatureForm({ open, onClose, child }) {
  const { update, nextId } = useStore();
  const showToast = useToast();
  const [date, setDate] = useState(toISODateTime());
  const [valeur, setValeur] = useState('');
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (open) {
      setDate(toISODateTime());
      setValeur('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = () => {
    const v = parseFloat(String(valeur).replace(',', '.'));
    if (!v || v < 30 || v > 45) {
      showToast('Entre une température valide (ex : 37.5)', '⚠️');
      return;
    }
    const id = nextId();
    update((draft) => {
      draft.temperatures.push({ id, childId: child.id, date, valeur: v, notes });

      if (v >= FEVER_THRESHOLD) {
        const rappelDate = new Date(new Date(date).getTime() + 60 * 60 * 1000);
        draft.rappels.push({
          id: nextId(),
          titre: `Reprendre la température — ${child.nom}`,
          date: rappelDate.toISOString(),
          recurrence: null,
          fait: false,
          auto: true,
          childId: child.id,
        });
      }
      return draft;
    });

    if (v >= FEVER_THRESHOLD) {
      showToast('Température enregistrée — rappel créé dans 1h', '🌡️');
    } else {
      showToast('Température enregistrée', '✅');
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle température" icon="🌡️">
      <div className="field">
        <label>Date et heure</label>
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Température (°C)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder="37.5"
          autoFocus
        />
      </div>
      <div className="field">
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Méthode de prise, symptômes associés..." />
      </div>
      {valeur && parseFloat(String(valeur).replace(',', '.')) >= FEVER_THRESHOLD && (
        <div className="card" style={{ background: 'var(--danger-soft)', border: 'none' }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.85rem' }}>⚠️ Fièvre ≥ 38.5°C</div>
          <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Un rappel "reprendre la température dans 1h" sera créé automatiquement.
          </div>
        </div>
      )}
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>Enregistrer ✓</button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Temperature chart (SVG, last 7 days)
// ----------------------------------------------------------------------
function TemperatureChart({ temperatures }) {
  const W = 320;
  const H = 160;
  const PAD_L = 32;
  const PAD_R = 10;
  const PAD_T = 14;
  const PAD_B = 24;

  const points = useMemo(() => {
    const cutoff = daysAgo(7);
    return temperatures
      .filter((t) => new Date(t.date) >= cutoff)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [temperatures]);

  if (points.length === 0) return null;

  const minDate = daysAgo(7).getTime();
  const maxDate = Date.now();
  const yMin = 35.5;
  const yMax = 40.5;

  const xScale = (date) => PAD_L + ((new Date(date).getTime() - minDate) / (maxDate - minDate)) * (W - PAD_L - PAD_R);
  const yScale = (val) => H - PAD_B - ((val - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B);

  const path = points.map((p) => `${xScale(p.date)},${yScale(p.valeur)}`).join(' ');
  const feverY = yScale(FEVER_THRESHOLD);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <line x1={PAD_L} y1={feverY} x2={W - PAD_R} y2={feverY} stroke="var(--danger)" strokeWidth="1" strokeDasharray="4,3" />
      <text x={W - PAD_R} y={feverY - 4} fontSize="8" fill="var(--danger)" textAnchor="end">38.5°C</text>

      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="var(--text-faint)" strokeWidth="1" />
      <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="var(--text-faint)" strokeWidth="1" />
      <text x={2} y={yScale(yMax)} fontSize="8" fill="var(--text-faint)">{yMax}</text>
      <text x={2} y={yScale(yMin) + 4} fontSize="8" fill="var(--text-faint)">{yMin}</text>

      <polyline points={path} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xScale(p.date)} cy={yScale(p.valeur)} r="3" fill={p.valeur >= FEVER_THRESHOLD ? 'var(--danger)' : 'var(--primary)'} />
      ))}
    </svg>
  );
}

// ----------------------------------------------------------------------
// Main Fièvre module
// ----------------------------------------------------------------------
export default function FievreTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [formOpen, setFormOpen] = useState(false);

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childTemps = useMemo(
    () => filterByActiveChild(store.temperatures, store.activeChildId).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [store.temperatures, store.activeChildId]
  );

  const grouped = useMemo(() => groupByDay(childTemps, 'date'), [childTemps]);

  const lastTemp = childTemps[0];

  const handleDelete = (id) => {
    update((draft) => {
      draft.temperatures = draft.temperatures.filter((t) => t.id !== id);
      return draft;
    });
    showToast('Mesure supprimée', '🗑️');
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre sa température.</div>
      </div>
    );
  }

  return (
    <div>
      {lastTemp && (
        <div className="card appear" style={{ textAlign: 'center', borderColor: statusFor(lastTemp.valeur).color }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.4rem', fontWeight: 600 }}>
            {lastTemp.valeur.toFixed(1)}°C
          </div>
          <div style={{ color: statusFor(lastTemp.valeur).color, fontWeight: 700, fontSize: '0.85rem', marginTop: 2 }}>
            {statusFor(lastTemp.valeur).label}
          </div>
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
            Dernière mesure · {formatDateFR(lastTemp.date)} à {formatTimeFR(lastTemp.date)}
          </div>
        </div>
      )}

      {childTemps.length > 0 && (
        <div className="card appear">
          <div className="section-title" style={{ marginBottom: 10 }}>📈 7 derniers jours</div>
          <TemperatureChart temperatures={childTemps} />
        </div>
      )}

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom: 0 }}>🗂️ Historique</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => setFormOpen(true)}>＋ Ajouter</button>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🌡️</div>
          <div className="title">Aucune mesure</div>
          <div className="desc">Ajoute une première température pour commencer le suivi. Une alerte se déclenche à partir de 38.5°C.</div>
        </div>
      ) : (
        grouped.map(([day, items]) => (
          <div key={day}>
            <div className="day-group-label">{dayLabel(day)}</div>
            <div className="entry-list">
              {items.map((t) => {
                const status = statusFor(t.valeur);
                return (
                  <SwipeToDelete key={t.id} onDelete={() => canEdit && handleDelete(t.id)} disabled={!canEdit}>
                    <div className="entry-icon" style={{ background: status.bg, color: status.color }}>🌡️</div>
                    <div className="entry-body">
                      <div className="entry-title">{t.valeur.toFixed(1)}°C <span style={{ color: status.color, fontWeight: 600, fontSize: '0.78rem' }}>· {status.label}</span></div>
                      {t.notes && <div className="entry-sub">{t.notes}</div>}
                    </div>
                    <div className="entry-time">{formatTimeFR(t.date)}</div>
                  </SwipeToDelete>
                );
              })}
            </div>
          </div>
        ))
      )}

      <TemperatureForm open={formOpen} onClose={() => setFormOpen(false)} child={activeChild} />
    </div>
  );
}
