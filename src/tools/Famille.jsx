import React, { useState } from 'react';
import { useStore, genId } from '../store.jsx';
import { useToast, ConfirmInline } from '../utils.jsx';
import { Modal } from '../Modal.jsx';
import { avatarColor, AVATAR_COLOR_KEYS } from '../Auth.jsx';
import { db, doc, updateDoc } from '../firebase.js';

const ROLES = [
  { key: 'admin', label: 'Admin', icon: '👑', desc: 'Accès total : profils, utilisateurs, données, réinitialisation' },
  { key: 'editeur', label: 'Éditeur', icon: '✏️', desc: 'Peut ajouter et modifier les entrées' },
  { key: 'lecture', label: 'Lecture seule', icon: '👀', desc: 'Consultation uniquement' },
];

function initials(nom) {
  return (nom || '?').trim().slice(0, 2).toUpperCase();
}

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
        ? { nom: editing.nom, pin: editing.pin, couleur: editing.couleur || 'purple', role: editing.role || 'editeur' }
        : userDefaults());
      setError('');
    }
  }, [open, editing]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const handlePinChange = (value) => set('pin', value.replace(/\D/g, '').slice(0, 4));

  const handleSubmit = () => {
    if (!form.nom.trim()) { setError('Entre un prénom.'); return; }
    if (form.pin.length !== 4) { setError('Le code PIN doit comporter 4 chiffres.'); return; }
    if (editing && isLastUser && form.role !== 'admin') { setError('Le dernier utilisateur doit rester Admin.'); return; }

    update((draft) => {
      if (editing) {
        const idx = draft.users.findIndex((u) => u.id === editing.id);
        if (idx !== -1) {
          draft.users[idx] = { ...draft.users[idx], nom: form.nom.trim(), pin: form.pin, couleur: form.couleur, role: form.role, initiales: initials(form.nom) };
        }
      } else {
        draft.users.push({ id: genId(), nom: form.nom.trim(), pin: form.pin, couleur: form.couleur, role: form.role, initiales: initials(form.nom) });
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
        <label>Code PIN (4 chiffres)</label>
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
              <div className="entry-icon" style={{ background: 'var(--primary-soft)', color: 'var(--primary-deep)' }}>{r.icon}</div>
              <div className="entry-body">
                <div className="entry-title" style={{ fontSize: '0.88rem' }}>{r.label}</div>
                <div className="entry-sub">{r.desc}</div>
              </div>
              {form.role === r.key && <div style={{ color: 'var(--primary)' }}>✓</div>}
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
        {editing ? 'Enregistrer ✓' : 'Ajouter ✓'}
      </button>
    </Modal>
  );
}

// ----------------------------------------------------------------------
// Main Famille module
// ----------------------------------------------------------------------
export default function FamilleTool() {
  const { store, update, session, firebaseUser } = useStore();
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
        Gère les membres de la famille ayant accès à l'application, et leur rôle.
      </div>

      <div className="flex-between mt-16">
        <div className="section-title" style={{ marginBottom: 0 }}>👨‍👩‍👧 Membres</div>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}>＋ Ajouter</button>
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
                <div className="entry-sub">{roleDef.icon} {roleDef.label}</div>
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

      {/* Section membres Firebase */}
      {store.familyId && (
        <div className="card appear" style={{ marginTop: 8 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>☁️ Famille synchronisée</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text-soft)', marginBottom: 4 }}>Code d'invitation</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700,
              letterSpacing: 6, color: 'var(--primary-deep)', textAlign: 'center',
              background: 'var(--primary-soft)', padding: '8px', borderRadius: 'var(--radius-md)' }}>
              {store.familyCode || '------'}
            </div>
          </div>
          {firebaseUser && (
            <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--primary-soft)',
                  color: 'var(--primary-deep)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: '.85rem' }}>
                  {(firebaseUser.displayName || firebaseUser.email || '?').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '.85rem' }}>
                    {firebaseUser.displayName || firebaseUser.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-soft)' }}>
                    {firebaseUser.email} · {isAdmin ? 'Administrateur' : 'Éditeur'}
                  </div>
                </div>
                <span style={{ fontSize: '.65rem',
                  background: isAdmin ? 'var(--primary)' : 'var(--sage-soft)',
                  color: isAdmin ? '#fff' : 'var(--sage)',
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                  {isAdmin ? '👑 Admin' : '✏️ Éditeur'}
                </span>
              </div>
            </div>
          )}
          <div className="muted" style={{ fontSize: '.72rem', marginTop: 10 }}>
            Pour inviter le 2e parent : partage le code ci-dessus. Il devra installer OmniBaby et choisir "Rejoindre une famille".
          </div>
        </div>
      )}
    </div>
  );
}
