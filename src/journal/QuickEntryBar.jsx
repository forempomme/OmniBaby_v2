import React, { useMemo, useState } from 'react';
import { useStore, getActiveChild, authorFields } from '../store.jsx';
import { useToast } from '../utils.jsx';
import { entryTitle } from './entryTypes.js';

// ----------------------------------------------------------------------
// Saisie rapide en 1 tap, heure = maintenant.
// Biberon : dernière quantité saisie (sinon réglage par défaut, sinon 120 ml)
// Tétée : côté alterné automatiquement par rapport à la dernière tétée
// ----------------------------------------------------------------------
export default function QuickEntryBar({ entries }) {
  const { store, update, nextId, firebaseUser } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [flash, setFlash] = useState(null);

  const lastQty = useMemo(() => {
    const last = entries.find((e) => e.type === 'biberon' && e.mode !== 'sein' && Number(e.quantite) > 0);
    return Number(last?.quantite) || Number(store.settings?.defaultBiberonMl) || 120;
  }, [entries, store.settings?.defaultBiberonMl]);

  const nextSide = useMemo(() => {
    const last = entries.find((e) => e.type === 'biberon' && e.mode === 'sein');
    return last?.cote === 'gauche' ? 'droit' : 'gauche';
  }, [entries]);

  const quickSave = (key, type, extra) => {
    if (!activeChild) return;
    const entry = {
      id: nextId(),
      childId: activeChild.id,
      type,
      date: new Date().toISOString(),
      ...authorFields(firebaseUser, 'created'),
      ...extra,
    };
    update((draft) => { draft.entries.push(entry); return draft; });
    // 5 s pour annuler un tap par erreur (supprimé partout, synchro comprise)
    showToast(`${entryTitle(entry)} enregistré`, '✅', {
      duration: 5000,
      action: {
        label: 'Annuler',
        onClick: () => {
          update((draft) => { draft.entries = draft.entries.filter((e) => e.id !== entry.id); return draft; });
          showToast('Saisie annulée', '↩️');
        },
      },
    });
    setFlash(key);
    setTimeout(() => setFlash(null), 700);
  };

  const actions = [
    { key: 'biberon', label: 'Biberon', sub: `${lastQty} ml`, run: () => quickSave('biberon', 'biberon', { mode: 'biberon', quantite: lastQty }) },
    { key: 'tetee', label: 'Tétée', sub: nextSide, run: () => quickSave('tetee', 'biberon', { mode: 'sein', cote: nextSide }) },
    { key: 'pipi', label: 'Pipi', sub: '1 tap', run: () => quickSave('pipi', 'couche', { contenu: 'pipi' }) },
    { key: 'selles', label: 'Selles', sub: '1 tap', run: () => quickSave('selles', 'couche', { contenu: 'selles' }) },
  ];

  return (
    <div className="quick-grid">
      {actions.map((a) => (
        <button key={a.key} className={`quick-btn ${flash === a.key ? 'done' : ''}`} onClick={a.run}>
          <span className="quick-label">{flash === a.key ? '✓' : a.label}</span>
          <span className="quick-sub">{a.sub}</span>
        </button>
      ))}
    </div>
  );
}
