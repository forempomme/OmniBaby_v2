import React, { useState, useMemo } from 'react';
import { useStore, filterByActiveChild, getActiveChild } from '../store.jsx';
import { formatDateFR, ConfirmInline, useToast, pad2, formatTimeFR, scheduleNotif, cancelNotif, requestNotifPermission } from '../utils.jsx';
import { Modal } from '../Modal.jsx';

import { Icon, UiIcon } from '../icons.jsx';
// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function nowHM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}


// ----------------------------------------------------------------------
// Prochaine dose = instant complet (prochaineDoseAt, ISO). Jusqu'à la
// v3.13.1 seule l'heure « HH:MM » était gardée : une dose donnée à 22 h
// toutes les 8 h donnait « 06:00 », affichée aussitôt « Dose due »
// (06:00 < 22:00) → risque de redonner une dose.
// ----------------------------------------------------------------------
export function doseAt(medoc, now = new Date()) {
  if (medoc.prochaineDoseAt) {
    const d = new Date(medoc.prochaineDoseAt);
    if (!isNaN(d.getTime())) return d;
  }
  // Anciennes données : dernière prise + fréquence, sinon l'heure du jour
  if (medoc.lastDoseDate && medoc.frequenceHeures) {
    const d = new Date(new Date(medoc.lastDoseDate).getTime() + medoc.frequenceHeures * 3600000);
    if (!isNaN(d.getTime())) return d;
  }
  if (!medoc.prochaineDose) return null;
  const [h, m] = String(medoc.prochaineDose).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

export function isDoseDue(medoc, now = new Date()) {
  const d = doseAt(medoc, now);
  return !!d && d.getTime() <= now.getTime();
}

// Heure saisie « HH:MM » → instant : aujourd'hui si elle est passée depuis
// moins de 2 h (dose en retard), sinon la prochaine occurrence
export function doseFromTime(hhmm, now = new Date()) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() < now.getTime() - 2 * 3600000) d.setDate(d.getDate() + 1);
  return d;
}

// « à 06:00 », « demain à 06:00 », « le 27/10 à 06:00 »
export function doseWhen(at, now = new Date()) {
  if (!at) return '';
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(at) - day(now)) / 86400000);
  if (diff === 0) return `à ${formatTimeFR(at)}`;
  if (diff === 1) return `demain à ${formatTimeFR(at)}`;
  if (diff === -1) return `hier à ${formatTimeFR(at)}`;
  return `le ${pad2(at.getDate())}/${pad2(at.getMonth() + 1)} à ${formatTimeFR(at)}`;
}

function medocNotifId(id) {
  return `medoc_${id}`;
}

export function scheduleDoseNotif(medoc, enabled) {
  cancelNotif(medocNotifId(medoc.id));
  if (!enabled) return;
  const at = doseAt(medoc);
  if (!at || at.getTime() <= Date.now()) return;
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

// Instant retenu pour la prochaine prise saisie dans le formulaire
function formDoseAt(form, editing, now = new Date()) {
  if (editing && form.prochaineDose === editing.prochaineDose) return doseAt(editing, now);
  return doseFromTime(form.prochaineDose, now);
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
    const at = formDoseAt(form, editing);
    const fields = { ...form, prochaineDoseAt: at ? at.toISOString() : null };
    const saved = editing ? { ...editing, ...fields, id } : { ...fields, id, childId: child.id, lastDoseDate: null };
    update((draft) => {
      const idx = draft.medicaments.findIndex((m) => m.id === id);
      if (idx !== -1) draft.medicaments[idx] = { ...draft.medicaments[idx], ...fields, id };
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
        {formDoseAt(form, editing) && (
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>→ prochaine prise {doseWhen(formDoseAt(form, editing))}</div>
        )}
      </div>
      <div className="field">
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Avant/après repas, prescription..." />
      </div>
      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer' : 'Ajouter'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Medication card
// ----------------------------------------------------------------------
function MedocCard({ medoc, onEdit, onDelete, canEdit, now }) {
  const { store, update } = useStore();
  const showToast = useToast();
  const due = isDoseDue(medoc, now);
  const at = doseAt(medoc, now);

  const handleDoseGiven = (e) => {
    e.stopPropagation();
    const given = new Date();
    const next = new Date(given.getTime() + medoc.frequenceHeures * 3600000);
    const fields = { lastDoseDate: given.toISOString(), prochaineDose: formatTimeFR(next), prochaineDoseAt: next.toISOString() };
    update((draft) => {
      const idx = draft.medicaments.findIndex((m) => m.id === medoc.id);
      if (idx !== -1) Object.assign(draft.medicaments[idx], fields);
      return draft;
    });
    scheduleDoseNotif({ ...medoc, ...fields }, store.settings?.notifs?.medoc !== false);
    showToast(`Prochaine dose ${doseWhen(next, given)}`, '💊');
  };

  return (
    <div className="card appear" style={{ borderColor: due ? 'var(--danger)' : 'var(--border)', cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && onEdit()}>
      <div className="flex-between">
        <div className="flex-row">
          <div className="entry-icon" style={{ background: due ? 'var(--danger-soft)' : 'var(--primary-soft)', color: due ? 'var(--danger)' : 'var(--primary-deep)' }}><UiIcon value="💊" size={20} /></div>
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
            <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.85rem' }}><UiIcon value="⏰" size={16} className="inline-ic" /> Dose due ({doseWhen(at, now)})</span>
          ) : (
            <span className="muted fs-85">Prochaine dose {doseWhen(at, now)}</span>
          )}
          {medoc.lastDoseDate && (
            <div className="muted" style={{ fontSize: '0.75rem', marginTop: 2 }}>
              Dernière dose : {formatDateFR(medoc.lastDoseDate)} à {new Date(medoc.lastDoseDate).toTimeString().slice(0, 5)}
            </div>
          )}
        </div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={handleDoseGiven}><Icon name="check" size={16} /> Dose donnée</button>
        )}
      </div>

      {medoc.notes && <div className="muted mt-8 fs-80">{medoc.notes}</div>}
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
  // Horloge : « Dose due » apparaît à l'heure, sans rouvrir l'écran
  const [now, setNow] = useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const role = store.users.find((u) => u.id === session?.userId)?.role || 'lecture';
  const canEdit = role !== 'lecture';

  const childMedocs = useMemo(
    () => filterByActiveChild(store.medicaments, store.activeChildId),
    [store.medicaments, store.activeChildId]
  );

  const sorted = useMemo(
    () => [...childMedocs].sort((a, b) => (doseAt(a, now)?.getTime() ?? Infinity) - (doseAt(b, now)?.getTime() ?? Infinity)),
    [childMedocs, now]
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
        <div className="emoji"><UiIcon value="👶" size={40} /></div>
        <div className="title">Aucun profil enfant</div>
        <div className="desc">Ajoute un profil enfant dans Réglages pour suivre ses traitements.</div>
      </div>
    );
  }

  const dueCount = sorted.filter((m) => isDoseDue(m, now)).length;

  return (
    <div>
      <div className="flex-between">
        <div className="muted fs-85">
          {dueCount > 0
            ? <><Icon name="alert" size={14} /> {dueCount} dose{dueCount > 1 ? 's' : ''} due{dueCount > 1 ? 's' : ''}</>
            : 'Traitements en cours pour ' + activeChild.nom}
        </div>
        {canEdit && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={16} /> Ajouter</button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <div className="emoji"><UiIcon value="💊" size={40} /></div>
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
              now={now}
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
