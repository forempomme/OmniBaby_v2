import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild } from '../store.jsx';
import { formatDateFR, ConfirmInline, useToast, pad2, scheduleNotif, cancelNotif, requestNotifPermission, nextOccurrence } from '../utils.jsx';
import { Modal } from '../Modal.jsx';

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function nowHM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Returns true if prochaineDose (HH:MM, today) is in the past
function isDoseDue(prochaineDose) {
  if (!prochaineDose) return false;
  return prochaineDose <= nowHM();
}

function addHoursToTime(timeHM, hours) {
  const [h, m] = timeHM.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Notification de la prochaine dose. L'heure est stockée en « HH:MM » :
// avant la v3.10, new Date("21:00") était invalide et rien n'était programmé.
function medocNotifId(id) {
  return `medoc_${id}`;
}

function scheduleDoseNotif(medoc, enabled) {
  cancelNotif(medocNotifId(medoc.id));
  if (!enabled) return;
  const at = nextOccurrence(medoc.prochaineDose);
  if (!at) return;
  requestNotifPermission().then((granted) => {
    if (!granted) return;
    scheduleNotif({
      id: medocNotifId(medoc.id),
      title: `Médicament — ${medoc.nom}`,
      body: `Heure de la prochaine dose${medoc.dose ? ' : ' + medoc.dose : ''}`,
      at: at.toISOString(),
    });
  });
}

const FREQUENCES = [
  { label: 'Toutes les 4h', value: 4 },
  { label: 'Toutes les 6h', value: 6 },
  { label: 'Toutes les 8h', value: 8 },
  { label: 'Toutes les 12h', value: 12 },
  { label: '1x / jour', value: 24 },
];

// ----------------------------------------------------------------------
// Medication form (create / edit)
// ----------------------------------------------------------------------
function medocDefaults() {
  return {
    nom: '',
    dose: '',
    frequenceHeures: 8,
    prochaineDose: nowHM(),
    notes: '',
  };
}

function MedocForm({ open, onClose, child, editing }) {
  const { store, update, nextId } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(medocDefaults());

  React.useEffect(() => {
    if (open) {
      setForm(editing ? { ...medocDefaults(), ...editing } : medocDefaults());
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.nom.trim()) {
      showToast('Entre le nom du médicament', '⚠️');
      return;
    }
    const id = editing ? editing.id : nextId();
    const saved = editing ? { ...editing, ...form, id } : { ...form, id, childId: child.id, lastDoseDate: null };
    update((draft) => {
      const idx = draft.medicaments.findIndex((m) => m.id === id);
      if (idx !== -1) draft.medicaments[idx] = { ...draft.medicaments[idx], ...form, id };
      else draft.medicaments.push(saved);
      return draft;
    });
    scheduleDoseNotif(saved, store.settings?.notifs?.medoc !== false);
    showToast(editing ? 'Traitement modifié' : 'Traitement ajouté', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le traitement' : 'Nouveau traitement'} icon="💊">
      <div className="field">
        <label>Nom du médicament</label>
        <input type="text" value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex : Doliprane" autoFocus />
      </div>
      <div className="field">
        <label>Dose</label>
        <input type="text" value={form.dose} onChange={(e) => set('dose', e.target.value)} placeholder="Ex : 5 ml ou 1 dose-poids" />
      </div>
      <div className="field">
        <label>Fréquence</label>
        <div className="pill-group">
          {FREQUENCES.map((f) => (
            <button key={f.value} className={`pill-choice ${form.frequenceHeures === f.value ? 'selected' : ''}`} onClick={() => set('frequenceHeures', f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Heure de la prochaine prise</label>
        <input type="time" value={form.prochaineDose} onChange={(e) => set('prochaineDose', e.target.value)} />
      </div>
      <div className="field">
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Avant/après repas, prescription..." />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer ✓' : 'Ajouter ✓'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Medication card
// ----------------------------------------------------------------------
function MedocCard({ medoc, onEdit, onDelete, canEdit }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const due = isDoseDue(medoc.prochaineDose);

  const handleDoseGiven = (e) => {
    e.stopPropagation();
    const newNext = addHoursToTime(nowHM(), medoc.frequenceHeures);
    update((draft) => {
      const idx = draft.medicaments.findIndex((m) => m.id === medoc.id);
      if (idx !== -1) {
        draft.medicaments[idx].lastDoseDate = new Date().toISOString();
        draft.medicaments[idx].prochaineDose = newNext;
      }
      return draft;
    });
    scheduleDoseNotif({ ...medoc, prochaineDose: newNext }, store.settings?.notifs?.medoc !== false);
    showToast(`Prochaine dose à ${newNext}`, '💊');
  };

  return (
    <div className="card appear" style={{ borderColor: due ? 'var(--danger)' : 'var(--border)', cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && onEdit()}>
      <div className="flex-between">
        <div className="flex-row">
          <div className="entry-icon" style={{ background: due ? 'var(--danger-soft)' : 'var(--primary-soft)', color: due ? 'var(--danger)' : 'var(--primary-deep)' }}>
            💊
          </div>
          <div>
            <div className="entry-title">{medoc.nom}</div>
            <div className="entry-sub">{medoc.dose ? `${medoc.dose} · ` : ''}{FREQUENCES.find((f) => f.value === medoc.frequenceHeures)?.label || `Toutes les ${medoc.frequenceHeures}h`}</div>
          </div>
        </div>
        {canEdit && (
          <div onClick={(e) => e.stopPropagation()}>
            <ConfirmInline onConfirm={onDelete} />
          </div>
        )}
      </div>

      <div className="flex-between mt-8">
        <div>
          {due ? (
            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}>⏰ Dose due ({medoc.prochaineDose})</span>
          ) : (
            <span className="muted" style={{ fontSize: '0.85rem' }}>Prochaine dose à {medoc.prochaineDose}</span>
          )}
          {medoc.lastDoseDate && (
            <div className="muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              Dernière dose : {formatDateFR(medoc.lastDoseDate)} à {new Date(medoc.lastDoseDate).toTimeString().slice(0, 5)}
            </div>
          )}
        </div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={handleDoseGiven}>✓ Dose donnée</button>
        )}
      </div>

      {medoc.notes && <div className="muted mt-8" style={{ fontSize: '0.8rem' }}>{medoc.notes}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Médicaments module
// ----------------------------------------------------------------------
export default function MedicamentsTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childMedocs = useMemo(
    () => filterByActiveChild(store.medicaments, store.activeChildId),
    [store.medicaments, store.activeChildId]
  );

  const sorted = useMemo(
    () => [...childMedocs].sort((a, b) => {
      const aDue = isDoseDue(a.prochaineDose) ? 0 : 1;
      const bDue = isDoseDue(b.prochaineDose) ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      return (a.prochaineDose || '').localeCompare(b.prochaineDose || '');
    }),
    [childMedocs]
  );

  const handleDelete = (id) => {
    update((draft) => {
      draft.medicaments = draft.medicaments.filter((m) => m.id !== id);
      return draft;
    });
    cancelNotif(medocNotifId(id));
    showToast('Traitement supprimé', '🗑️');
  };

  if (!activeChild) {
    return (
      <div className="empty-state">
        <div className="emoji">👶</div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre ses traitements.</div>
      </div>
    );
  }

  const dueCount = sorted.filter((m) => isDoseDue(m.prochaineDose)).length;

  return (
    <div>
      <div className="flex-between">
        <div className="muted" style={{ fontSize: '0.85rem' }}>
          {dueCount > 0
            ? `⏰ ${dueCount} dose${dueCount > 1 ? 's' : ''} due${dueCount > 1 ? 's' : ''}`
            : 'Traitements en cours pour ' + activeChild.nom}
        </div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Ajouter</button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">💊</div>
          <div className="title">Aucun traitement en cours</div>
          <div className="desc">Ajoute un médicament pour suivre les doses et recevoir une alerte quand la prochaine est due.</div>
        </div>
      ) : (
        <div className="mt-16">
          {sorted.map((m) => (
            <MedocCard
              key={m.id}
              medoc={m}
              canEdit={canEdit}
              onEdit={() => { setEditing(m); setFormOpen(true); }}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
      )}

      <MedocForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} child={activeChild} editing={editing} />
    </div>
  );
}
