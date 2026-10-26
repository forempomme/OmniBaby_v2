import React, { useState, useMemo } from 'react';
import { useStore, getActiveChild, genId } from '../store.jsx';
import { toISODateTime, toLocalDT, formatDateTimeFR, useToast, ConfirmInline, toTime, parseLocalDate } from '../utils.jsx';
import { Modal } from '../Modal.jsx';
import { scheduleNotif, cancelNotif, requestNotifPermission } from '../utils.jsx';
import { VISITES_OBLIGATOIRES } from '../data/who-growth.js';

import { Icon, UiIcon } from '../icons.jsx';
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
// Notification d'un rappel (même identifiant pour programmer et annuler).
// notifAt : instant de la notification s'il diffère de la date du rappel
// (visites médicales : 7 jours avant, pour prendre rendez-vous).
// ----------------------------------------------------------------------
export function rappelNotifAt(rappel) {
  return new Date(rappel.notifAt || rappel.date);
}

export function scheduleRappelNotif(rappel, enabled = true) {
  cancelNotif(rappel.id);
  if (!enabled || rappel.fait) return;
  const at = rappelNotifAt(rappel);
  if (isNaN(at.getTime()) || at.getTime() <= Date.now()) return;
  requestNotifPermission().then((granted) => {
    if (!granted) return;
    scheduleNotif({
      id: rappel.id,
      title: rappel.visiteKey ? 'OmniBaby — Visite à prévoir' : 'OmniBaby — Rappel',
      body: rappel.visiteKey ? `${rappel.titre} dans 7 jours : pense au rendez-vous` : rappel.titre,
      at: at.toISOString(),
    });
  });
}

// Icône d'un rappel : créé à la main, visite médicale, ou fièvre
export function rappelKind(rappel) {
  if (rappel.kind) return rappel.kind;
  if (rappel.visiteKey) return 'visite';
  if (/^Reprendre la température/.test(rappel.titre || '')) return 'fievre';
  return 'manuel';
}
const KIND_ICONS = { manuel: 'target', visite: 'stetho', fievre: 'thermo' };

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
  const { store, update, nextId } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(rappelDefaults());

  React.useEffect(() => {
    if (open) {
      // toLocalDT : la date est stockée en UTC (avant : décalage d'1 h à chaque modification)
      setForm(editing ? { titre: editing.titre, date: toLocalDT(editing.date) || toISODateTime(), recurrence: editing.recurrence || null } : rappelDefaults());
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.titre.trim()) {
      showToast('Entre un titre', '⚠️');
      return;
    }
    const dateISO = new Date(form.date).toISOString();
    const rappelId = editing ? editing.id : nextId();
    let saved = null;
    update((draft) => {
      if (editing) {
        const idx = draft.rappels.findIndex((r) => r.id === editing.id);
        if (idx !== -1) {
          // Nouvelle date : l'avance « 7 jours avant » des visites ne vaut plus
          draft.rappels[idx] = { ...draft.rappels[idx], titre: form.titre.trim(), date: dateISO, recurrence: form.recurrence, notifAt: null };
          saved = draft.rappels[idx];
        }
      } else {
        saved = { id: rappelId, titre: form.titre.trim(), date: dateISO, recurrence: form.recurrence, fait: false };
        draft.rappels.push(saved);
      }
      return draft;
    });
    if (saved) scheduleRappelNotif(saved, store.settings?.notifs?.rappels !== false);

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
        {editing ? 'Enregistrer' : 'Ajouter'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Rappel item
// ----------------------------------------------------------------------
function RappelItem({ rappel, onEdit, onDelete, canEdit }) {
  const { store, update } = useStore();
  const overdue = !rappel.fait && new Date(rappel.date) < new Date();

  const toggleFait = (e) => {
    e.stopPropagation();
    let after = null;
    update((draft) => {
      const idx = draft.rappels.findIndex((r) => r.id === rappel.id);
      if (idx === -1) return draft;
      const r = draft.rappels[idx];
      if (!r.fait && r.recurrence) {
        // Rappel répété : passe à la date suivante encore à venir
        let next = nextOccurrence(r.date, r.recurrence);
        while (next && new Date(next) <= new Date()) next = nextOccurrence(next, r.recurrence);
        if (next) {
          r.date = next;
          after = { ...r };
          return draft;
        }
      }
      r.fait = !r.fait;
      after = { ...r };
      return draft;
    });
    // Notification reprogrammée (avant : une seule notification par rappel répété)
    if (after) scheduleRappelNotif(after, store.settings?.notifs?.rappels !== false);
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
        <UiIcon value={rappel.fait ? 'check' : KIND_ICONS[rappelKind(rappel)]} size={20} />
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

// Date de la visite à 9 h, heure locale (avant : minuit UTC = 1 h ou 2 h)
export function visiteDate(birthdate, visite) {
  const d = parseLocalDate(birthdate);
  if (visite.days) d.setDate(d.getDate() + visite.days);
  if (visite.months) d.setMonth(d.getMonth() + visite.months);
  d.setHours(9, 0, 0, 0);
  return d;
}

function MedicalVisitsBanner({ child, rappels }) {
  const { store, update } = useStore();
  const showToast = useToast();

  if (!child.birthdate) return null;

  const missing = VISITES_OBLIGATOIRES.filter((v) => {
    const key = visiteKeyFor(child.id, v.ageLabel);
    return !rappels.some((r) => r.visiteKey === key);
  });

  if (missing.length === 0) return null;

  const handleGenerate = () => {
    const created = [];
    update((draft) => {
      for (const v of VISITES_OBLIGATOIRES) {
        const key = visiteKeyFor(child.id, v.ageLabel);
        if (draft.rappels.some((r) => r.visiteKey === key)) continue;
        const date = visiteDate(child.birthdate, v);
        const notifAt = new Date(date);
        notifAt.setDate(notifAt.getDate() - 7);
        const r = {
          // Identifiant unique (avant : compteur propre à chaque téléphone,
          // deux téléphones pouvaient écrire le même document Firebase)
          id: genId(),
          titre: `Examen médical obligatoire — ${v.ageLabel} — ${child.nom}`,
          date: date.toISOString(),
          notifAt: notifAt.toISOString(),
          recurrence: null,
          fait: false,
          auto: true,
          kind: 'visite',
          visiteKey: key,
          childId: child.id,
        };
        draft.rappels.push(r);
        created.push(r);
      }
      return draft;
    });
    const on = store.settings?.notifs?.rappels !== false;
    created.forEach((r) => scheduleRappelNotif(r, on));
    showToast('Visites médicales générées', '🩺');
  };

  return (
    <div className="card appear" style={{ background: 'var(--accent-sky-soft)', border: 'none' }}>
      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}><UiIcon value="🩺" size={16} className="inline-ic" /> Visites médicales du carnet de santé</div>
      <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4, marginBottom: 10 }}>
        Génère les rappels des examens obligatoires (8 jours, 1, 2, 4, 9, 12, 24 mois) pour {child.nom}, avec une notification 7 jours avant chacun.
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
      .sort((a, b) => toTime(a.date) - toTime(b.date));
  }, [store.rappels, showDone]);

  const handleDelete = (id) => {
    update((draft) => {
      draft.rappels = draft.rappels.filter((r) => r.id !== id);
      cancelNotif(id);
      return draft;
    });
    showToast('Rappel supprimé', '🗑️');
  };

  return (
    <div>
      {activeChild && <MedicalVisitsBanner child={activeChild} rappels={store.rappels} />}

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom: 0 }}>Rappels</div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={16} /> Ajouter</button>
        )}
      </div>

      <div className="chip-row mt-8">
        <button className={`chip ${!showDone ? 'active' : ''}`} onClick={() => setShowDone(false)}>À faire</button>
        <button className={`chip ${showDone ? 'active' : ''}`} onClick={() => setShowDone(true)}>Tous</button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="emoji"><UiIcon value="🎯" size={40} /></div>
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
