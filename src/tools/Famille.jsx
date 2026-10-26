import React, { useState } from 'react';
import { useStore, genId } from '../store.jsx';
import { useToast, ConfirmInline } from '../utils.jsx';
import { Modal } from '../Modal.jsx';
import { avatarColor, AVATAR_COLOR_KEYS, initials, hashPin } from '../Auth.jsx';

import { Icon, UiIcon } from '../icons.jsx';
const ROLES = [
  { key: 'admin', label: 'Admin', icon: '👑', desc: 'Accès total : profils, utilisateurs, données, réinitialisation' },
  { key: 'editeur', label: 'Éditeur', icon: '✏️', desc: 'Peut ajouter et modifier les entrées' },
  { key: 'lecture', label: 'Lecture seule', icon: '👀', desc: 'Consultation uniquement' },
];

function userDefaults() {
  return { nom: '', pin: '', couleur: 'purple', role: 'editeur' };
}

function UserForm({ open, onClose, editing, isLastUser }) {
  const { update } = useStore();
  const showToast = useToast();
  const [form, setForm] = useState(userDefaults());
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open) {
      setForm(editing
        ? { nom: editing.nom, pin: '', couleur: editing.couleur || 'purple', role: editing.role || 'editeur' }
        : userDefaults());
      setError('');
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const handlePinChange = (value) => set('pin', value.replace(/\D/g, '').slice(0, 4));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { setError('Entre un prénom.'); return; }
    // En modification, PIN vide = inchangé
    if ((!editing || form.pin) && form.pin.length !== 4) { setError('Le code PIN doit comporter 4 chiffres.'); return; }
    if (editing && isLastUser && form.role !== 'admin') { setError('Le dernier utilisateur doit rester Admin.'); return; }

    const id = editing ? editing.id : genId();
    const pinHash = form.pin ? await hashPin(id, form.pin) : null;
    update((draft) => {
      const data = { nom: form.nom.trim(), couleur: form.couleur, role: form.role, initiales: initials(form.nom) };
      if (editing) {
        const idx = draft.users.findIndex((u) => u.id === editing.id);
        if (idx !== -1) {
          draft.users[idx] = { ...draft.users[idx], ...data };
          if (pinHash) { draft.users[idx].pinHash = pinHash; delete draft.users[idx].pin; }
        }
      } else {
        draft.users.push({ id, ...data, pinHash });
      }
      return draft;
    });
    showToast(editing ? 'Profil modifié' : 'Membre ajouté', '✅');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Modifier le profil' : 'Nouveau membre'} icon="👨‍👩‍👧">
      <div className="field">
        <label>Prénom</label>
        <input type="text" value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="Ex : Papa, Mamie..." autoFocus />
      </div>
      <div className="field">
        <label>{editing ? 'Nouveau code PIN (laisser vide pour le garder)' : 'Code PIN (4 chiffres)'}</label>
        <input type="password" inputMode="numeric" value={form.pin} onChange={(e) => handlePinChange(e.target.value)} placeholder="••••" maxLength={4} />
      </div>
      <div className="field">
        <label>Couleur de l'avatar</label>
        <div className="pill-group">
          {AVATAR_COLOR_KEYS.map((c) => (
            <button key={c} onClick={() => set('couleur', c)} style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(c), border: form.couleur === c ? '3px solid var(--text)' : '3px solid transparent' }} />
          ))}
        </div>
      </div>
      <div className="field">
        <label>Rôle</label>
        <div className="entry-list">
          {ROLES.map((r) => (
            <button key={r.key} className="swipe-content"
              style={{ width: '100%', cursor: 'pointer', border: form.role === r.key ? '1.5px solid var(--primary)' : '1px solid var(--border)' }}
              onClick={() => set('role', r.key)}
              disabled={editing && isLastUser && r.key !== 'admin'}>
              <div className="entry-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-deep)' }}><UiIcon value={r.icon} size={20} /></div>
              <div className="entry-body">
                <div className="entry-title" style={{ fontSize: '0.88rem' }}>{r.label}</div>
                <div className="entry-sub">{r.desc}</div>
              </div>
              {form.role === r.key && <div style={{ color: 'var(--primary)' }}><UiIcon value="✓" size={20} /></div>}
            </button>
          ))}
        </div>
        {editing && isLastUser && (
          <div className="muted" style={{ fontSize: '0.78rem', marginTop: 6 }}>
            Le dernier membre de la famille doit rester Admin.
          </div>
        )}
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>}
      <button className="btn btn-primary btn-block mt-8" onClick={handleSubmit}>
        {editing ? 'Enregistrer' : 'Ajouter'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Main Famille module
// ----------------------------------------------------------------------
export default function FamilleTool() {
  const { store, update, session } = useStore();
  const showToast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const currentUser = store.users.find((u) => u.id === session?.userId);
  const isAdmin = currentUser?.role === 'admin';

  const handleDelete = (id) => {
    update((draft) => { draft.users = draft.users.filter((u) => u.id !== id); return draft; });
    showToast('Membre supprimé', '🗑️');
  };

  return (
    <div>
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 4 }}>
        Profils qui peuvent ouvrir l'appli sur ce téléphone, et leurs droits.
      </div>

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom: 0 }}>Membres</div>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Icon name="plus" size={16} /> Ajouter</button>
        )}
      </div>

      <div className="entry-list mt-8">
        {store.users.map((u) => {
          const roleDef = ROLES.find((r) => r.key === u.role) || ROLES[1];
          const isLastUser = store.users.length === 1;
          return (
            <div key={u.id} className="swipe-content"
              style={{ cursor: isAdmin ? 'pointer' : 'default' }}
              onClick={() => isAdmin && (setEditing(u), setFormOpen(true))}>
              <div className="avatar-circle" style={{ background: avatarColor(u.couleur), width: 42, height: 42, fontSize: '0.95rem' }}>
                {u.initiales || initials(u.nom)}
              </div>
              <div className="entry-body">
                <div className="entry-title">
                  {u.nom}
                  {u.id === session?.userId && <span className="muted" style={{ fontWeight: 400 }}> · toi</span>}
                </div>
                <div className="entry-sub"><UiIcon value={roleDef.icon} size={13} className="inline-ic" /> {roleDef.label}</div>
              </div>
              {isAdmin && !isLastUser && (
                <div onClick={(e) => e.stopPropagation()}>
                  <ConfirmInline onConfirm={() => handleDelete(u.id)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isAdmin && (
        <div className="muted mt-16" style={{ fontSize: '0.8rem' }}>
          Seul un administrateur peut ajouter, modifier ou supprimer des membres.
        </div>
      )}

      <UserForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        editing={editing}
        isLastUser={editing ? store.users.length === 1 : false}
      />

      <div className="muted mt-16" style={{ fontSize: '0.8rem' }}>
        Ces profils protègent l'accès à ce téléphone (code PIN). Les comptes synchronisés et le code
        d'invitation de l'autre parent sont dans Réglages → Famille &amp; synchro.
      </div>
    </div>
  );
}
