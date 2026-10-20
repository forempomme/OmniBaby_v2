import React, { useState } from 'react';
import { useStore } from './store.jsx';
import { Icon } from './icons.jsx';
import ChildForm from './ChildForm.jsx';
import { AuthOverlay } from './Auth.jsx';

// ----------------------------------------------------------------------
// État vide « pas encore de bébé » : une action claire au lieu d'un
// renvoi vers Réglages. Utilisé par Journal, Santé et Dodo.
// ----------------------------------------------------------------------
export default function NoChildState() {
  const { store, session, firebaseUser, syncStatus } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const me = store.users.find((u) => u.id === session?.userId);
  const name = firebaseUser?.displayName || me?.nom || '';
  const canEdit = (me?.role || 'lecture') !== 'lecture';
  const waitingSync = !!store.familyId && syncStatus === 'syncing';

  return (
    <div className="no-child">
      <span className="no-child-badge"><Icon name="baby" size={50} strokeWidth={1.8} /></span>
      <h1 className="no-child-title">{name ? `Bienvenue, ${name}` : 'Bienvenue'}</h1>
      <p className="no-child-desc">
        {waitingSync
          ? 'Récupération des profils de la famille…'
          : 'Crée le profil de ton bébé pour suivre ses repas, son sommeil et sa santé.'}
      </p>
      {canEdit && (
        <button className="btn btn-primary btn-block no-child-cta" onClick={() => setFormOpen(true)}>
          <Icon name="plus" size={20} strokeWidth={2.5} /> Créer le profil de bébé
        </button>
      )}
      {!store.familyId && (
        <button className="btn btn-ghost" onClick={() => setJoinOpen(true)}>Rejoindre une famille existante</button>
      )}

      <ChildForm open={formOpen} onClose={() => setFormOpen(false)} editing={null} />

      {joinOpen && <AuthOverlay mode="join" onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
