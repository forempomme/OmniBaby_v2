import React, { useState } from 'react';
import { useStore, genId } from './store.jsx';
import { toISODate, useToast } from './utils.jsx';
import { Modal } from './Modal.jsx';

const EMOJIS = ['👶', '👧', '👦', '🧒', '👼'];

const ALIMENTATION_OPTIONS = [
  { key: 'allaitement', label: 'Sein' },
  { key: 'mixte', label: 'Mixte' },
  { key: 'lait_infantile', label: 'Biberon' },
];

const TYPE_LAIT_OPTIONS = [
  { key: '1er_age', label: '1er âge' },
  { key: '2e_age', label: '2e âge' },
  { key: 'croissance', label: 'Croissance' },
];

function childDefaults() {
  return {
    nom: '', emoji: '👶', sexe: 'fille', birthdate: toISODate(),
    alimentation: 'allaitement', typeLait: '1er_age',
    allergies: '', groupeSanguin: '', medecinNom: '', medecinTel: '',
    contactUrgenceNom: '', contactUrgenceTel: '', notesMedicales: '',
  };
}

// Formulaire profil enfant (création / modification) — utilisé par
// Réglages → Bébé et par l'état vide « Créer le profil de bébé ».
export default function ChildForm({ open, onClose, editing }) {
  const { update } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(childDefaults());
  const [tab, setTab] = useState('general');

  React.useEffect(() => {
    if (open) { setForm(editing ? { ...childDefaults(), ...editing } : childDefaults()); setTab('general'); }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.nom.trim()) { showToast('Entre un prénom', '⚠️'); return; }
    if (form.birthdate && form.birthdate > toISODate()) { showToast('Date de naissance dans le futur', '⚠️'); return; }
    update((draft) => {
      if (editing) {
        const idx = draft.children.findIndex((c) => c.id === editing.id);
        if (idx !== -1) draft.children[idx] = { ...draft.children[idx], ...form, nom: form.nom.trim(), id: editing.id };
      } else {
        const id = genId();
        draft.children.push({ ...childDefaults(), ...form, nom: form.nom.trim(), id, lastVitDDate: null });
        if (!draft.activeChildId || !draft.children.some((c) => c.id === draft.activeChildId)) draft.activeChildId = id;
      }
      return draft;
    });
    showToast(editing ? 'Profil modifié' : 'Profil créé', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le profil' : 'Profil de bébé'} icon="👶">
      <div className="chip-row">
        {['general', 'medical', 'urgence'].map((t) => (
          <button key={t} className={`chip ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'general' ? 'Général' : t === 'medical' ? 'Médical' : 'Urgence'}
          </button>
        ))}
      </div>

      {tab === 'general' && <>
        <div className="field"><label>Prénom</label>
          <input type="text" value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Léa" autoFocus /></div>
        <div className="field"><label>Date de naissance</label>
          <input type="date" value={form.birthdate} max={toISODate()} onChange={(e) => set('birthdate', e.target.value)} /></div>
        <div className="field"><label>Sexe (courbes OMS)</label>
          <div className="pill-group">
            <button className={`pill-choice ${form.sexe === 'fille' ? 'selected' : ''}`} onClick={() => set('sexe', 'fille')}>Fille</button>
            <button className={`pill-choice ${form.sexe === 'garcon' ? 'selected' : ''}`} onClick={() => set('sexe', 'garcon')}>Garçon</button>
          </div></div>
        <div className="field"><label>Alimentation</label>
          <div className="pill-group">{ALIMENTATION_OPTIONS.map((o) => (
            <button key={o.key} className={`pill-choice ${form.alimentation === o.key ? 'selected' : ''}`} onClick={() => set('alimentation', o.key)}>{o.label}</button>
          ))}</div></div>
        {form.alimentation !== 'allaitement' && (
          <div className="field"><label>Type de lait</label>
            <div className="pill-group">{TYPE_LAIT_OPTIONS.map((o) => (
              <button key={o.key} className={`pill-choice ${form.typeLait === o.key ? 'selected' : ''}`} onClick={() => set('typeLait', o.key)}>{o.label}</button>
            ))}</div></div>
        )}
        <div className="field"><label>Avatar</label>
          <div className="pill-group">{EMOJIS.map((e) => (
            <button key={e} className={`pill-choice ${form.emoji === e ? 'selected' : ''}`} onClick={() => set('emoji', e)} style={{ fontSize: '1.2rem' }}>{e}</button>
          ))}</div></div>
      </>}

      {tab === 'medical' && <>
        <div className="field"><label>Allergies</label>
          <textarea rows={2} value={form.allergies} onChange={(e) => set('allergies', e.target.value)} placeholder="Aucune connue" /></div>
        <div className="field"><label>Groupe sanguin</label>
          <input type="text" value={form.groupeSanguin} onChange={(e) => set('groupeSanguin', e.target.value)} placeholder="Ex : O+" /></div>
        <div className="field"><label>Médecin / pédiatre</label>
          <input type="text" value={form.medecinNom} onChange={(e) => set('medecinNom', e.target.value)} placeholder="Dr Martin" /></div>
        <div className="field"><label>Téléphone du médecin</label>
          <input type="tel" value={form.medecinTel} onChange={(e) => set('medecinTel', e.target.value)} placeholder="06 00 00 00 00" /></div>
        <div className="field"><label>Notes médicales</label>
          <textarea rows={3} value={form.notesMedicales} onChange={(e) => set('notesMedicales', e.target.value)} placeholder="Traitements en cours, particularités…" /></div>
      </>}

      {tab === 'urgence' && <>
        <div className="field"><label>Contact d'urgence — nom</label>
          <input type="text" value={form.contactUrgenceNom} onChange={(e) => set('contactUrgenceNom', e.target.value)} placeholder="Mamie Jeanne" /></div>
        <div className="field"><label>Contact d'urgence — téléphone</label>
          <input type="tel" value={form.contactUrgenceTel} onChange={(e) => set('contactUrgenceTel', e.target.value)} placeholder="06 00 00 00 00" /></div>
        <div className="muted" style={{ fontSize: '0.8rem' }}>Ces informations apparaissent dans la fiche de garde pour une baby-sitter.</div>
      </>}

      <button className="btn btn-primary btn-block mt-16" onClick={handleSubmit}>
        {editing ? 'Enregistrer' : 'Créer le profil'}
      </button>
    </Modal>
  );
}
