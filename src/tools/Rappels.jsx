import React, { useState, useMemo } from 'react';
import { useStore, getActiveChild } from '../store.js';
import { toISODateTime, formatDateTimeFR, useToast, ConfirmInline } from '../utils.js';
import { Modal } from '../Modal.jsx';
import { VISITES_OBLIGATOIRES } from '../data/who-growth.js';

const RECURRENCES = [
  { key: null, label: 'Aucune' },
  { key: 'quotidien', label: 'Quotidienne' },
  { key: 'hebdo', label: 'Hebdomadaire' },
  { key: 'mensuel', label: 'Mensuelle' },
];

// ----------------------------------------------------------------------
// Compute next occurrence date based on recurrence
// ----------------------------------------------------------------------
function nextOccurrence(dateStr, recurrence) {
  const d = new Date(dateStr);
  switch (recurrence) {
    case 'quotidien':
      d.setDate(d.getDate() + 1);
      break;
    case 'hebdo':
      d.setDate(d.getDate() + 7);
      break;
    case 'mensuel':
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      return null;
  }
  return d.toISOString();
}

// ----------------------------------------------------------------------
// Add / edit rappel form
// ----------------------------------------------------------------------
function rappelDefaults() {
  return {
    titre: '',
    date: toISODateTime(),
    recurrence: null,
  };
}

function RappelForm({ open, onClose, editing }) {
  const { update, nextId } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(rappelDefaults());

  React.useEffect(() => {
    if (open) {
      setForm(editing ? { titre: editing.titre, date: editing.date?.slice(0, 16) || toISODateTime(), recurrence: editing.recurrence || null } : rappelDefaults());
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.titre.trim()) {
      showToast('Entre un titre', '⚠️');
      return;
    }
    const dateISO = new Date(form.date).toISOString();
    update((draft) => {
      if (editing) {
        const idx = draft.rappels.findIndex((r) => r.id === editing.id);
        if (idx !== -1) {
          draft.rappels[idx] = { ...draft.rappels[idx], titre: form.titre.trim(), date: dateISO, recurrence: form.recurrence };
        }
      } else {
        draft.rappels.push({
          id: nextId(),
          titre: form.titre.trim(),
          date: dateISO,
          recurrence: form.recurrence,
          fait: false,
        });
      }
      return draft;
    });
    showToast(editing ? 'Rappel modifié' : 'Rappel ajouté', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le rappel' : 'Nouveau rappel'} icon="🎯">
      <div className="field">
        <label>Titre</label>
        <input type="text" value={form.titre} onChange={(e) => set('titre', e.target.value)} placeholder="Ex : RDV pédiatre, Acheter des couches..." autoFocus />
      </div>
      <div className="field">
        <label>Date et heure</label>
        <input type="datetime-local" value={form.date} onChange={(e) => set('date', e.target.value)} />
      </div>
      <div className="field">
        <label>Récurrence</label>
        <div className="pill-group">
          {RECURRENCES.map((r) => (
            <button key={r.label} className={`pill-choice ${form.recurrence === r.key ? 'selected' : ''}`} onClick={() => set('recurrence', r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer ✓' : 'Ajouter ✓'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Rappel item
// ----------------------------------------------------------------------
function RappelItem({ rappel, onEdit, onDelete, canEdit }) {
  const { update } = useStore();
  const overdue = !rappel.fait && new Date(rappel.date) < new Date();

  const toggleFait = (e) => {
    e.stopPropagation();
    update((draft) => {
      const idx = draft.rappels.findIndex((r) => r.id === rappel.id);
      if (idx === -1) return draft;
      const r = draft.rappels[idx];
      if (!r.fait && r.recurrence) {
        const next = nextOccurrence(r.date, r.recurrence);
        if (next) {
          r.date = next;
          return draft;
        }
      }
      r.fait = !r.fait;
      return draft;
    });
  };

  const recurrenceLabel = RECURRENCES.find((rc) => rc.key === rappel.recurrence)?.label;

  return (
    <div className="swipe-content" style={{ cursor: canEdit ? 'pointer' : 'default', opacity: rappel.fait ? 0.6 : 1 }} onClick={() => canEdit && !rappel.auto && onEdit()}>
      <button
        className="entry-icon"
        style={{
          background: rappel.fait ? 'var(--accent-sage-soft)' : overdue ? 'var(--danger-soft)' : 'var(--primary-soft)',
          color: rappel.fait ? 'var(--accent-sage)' : overdue ? 'var(--danger)' : 'var(--primary-deep)',
        }}
        onClick={canEdit ? toggleFait : undefined}
      >
        {rappel.fait ? '✅' : rappel.auto ? '💉' : '🎯'}
      </button>
      <div className="entry-body">
        <div className="entry-title" style={{ textDecoration: rappel.fait ? 'line-through' : 'none' }}>{rappel.titre}</div>
        <div className="entry-sub">
          {formatDateTimeFR(rappel.date)}
          {recurrenceLabel && recurrenceLabel !== 'Aucune' ? ` · ${recurrenceLabel}` : ''}
          {overdue && !rappel.fait ? ' · en retard' : ''}
        </div>
      </div>
      {canEdit && <ConfirmInline onConfirm={onDelete} />}
    </div>
  );
}

// ----------------------------------------------------------------------
// Generate medical visits for active child
// ----------------------------------------------------------------------
function visiteKeyFor(childId, ageLabel) {
  return `visite_${childId}_${ageLabel.replace(/\s+/g, '_')}`;
}

function visiteDate(birthdate, visite) {
  const d = new Date(birthdate);
  if (visite.days) d.setDate(d.getDate() + visite.days);
  if (visite.months) d.setMonth(d.getMonth() + visite.months);
  return d;
}

function MedicalVisitsBanner({ child, rappels }) {
  const { update } = useStore();
  const showToast = useToast();

  if (!child.birthdate) return null;

  const missing = VISITES_OBLIGATOIRES.filter((v) => {
    const key = visiteKeyFor(child.id, v.ageLabel);
    return !rappels.some((r) => r.visiteKey === key);
  });

  if (missing.length === 0) return null;

  const handleGenerate = () => {
    update((draft) => {
      for (const v of VISITES_OBLIGATOIRES) {
        const key = visiteKeyFor(child.id, v.ageLabel);
        if (draft.rappels.some((r) => r.visiteKey === key)) continue;
        const date = visiteDate(child.birthdate, v);
        draft.rappels.push({
          id: draft.nextId++,
          titre: `Examen médical obligatoire — ${v.ageLabel} — ${child.nom}`,
          date: date.toISOString(),
          recurrence: null,
          fait: false,
          auto: true,
          visiteKey: key,
          childId: child.id,
        });
      }
      return draft;
    });
    showToast('Visites médicales générées', '💉');
  };

  return (
    <div className="card appear" style={{ background: 'var(--accent-sky-soft)', border: 'none' }}>
      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>💉 Visites médicales du carnet de santé</div>
      <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4, marginBottom: 10 }}>
        Génère les rappels des examens obligatoires (8 jours, 1, 2, 4, 9, 12, 24 mois) pour {child.nom}.
      </div>
      <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>Générer les visites</button>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Rappels module
// ----------------------------------------------------------------------
export default function RappelsTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const sorted = useMemo(() => {
    return [...store.rappels]
      .filter((r) => showDone || !r.fait)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [store.rappels, showDone]);

  const handleDelete = (id) => {
    update((draft) => {
      draft.rappels = draft.rappels.filter((r) => r.id !== id);
      return draft;
    });
    showToast('Rappel supprimé', '🗑️');
  };

  return (
    <div>
      {activeChild && <MedicalVisitsBanner child={activeChild} rappels={store.rappels} />}

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom: 0 }}>🎯 Rappels</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Ajouter</button>
        )}
      </div>

      <div className="chip-row mt-8">
        <button className={`chip ${!showDone ? 'active' : ''}`} onClick={() => setShowDone(false)}>À faire</button>
        <button className={`chip ${showDone ? 'active' : ''}`} onClick={() => setShowDone(true)}>Tous</button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🎯</div>
          <div className="title">Rien à faire</div>
          <div className="desc">Aucun rappel pour le moment. Ajoute un RDV, une course, ou génère les visites médicales ci-dessus.</div>
        </div>
      ) : (
        <div className="entry-list">
          {sorted.map((r) => (
            <RappelItem
              key={r.id}
              rappel={r}
              canEdit={canEdit}
              onEdit={() => { setEditing(r); setFormOpen(true); }}
              onDelete={() => handleDelete(r.id)}
            />
          ))}
        </div>
      )}

      <RappelForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} editing={editing} />
    </div>
  );
}
