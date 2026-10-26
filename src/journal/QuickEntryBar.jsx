import React, { useEffect, useMemo, useState } from 'react';
import { useStore, getActiveChild, authorFields } from '../store.jsx';
import { useToast } from '../utils.jsx';
import { entryTitle } from './entryTypes.js';
import { loadTimerState, startTeteeTimer, suggestedSide, chronoText, timerMeta } from '../timer.js';
import { useLongPress } from './TodayOverview.jsx';

import { Icon } from '../icons.jsx';
// Bouton : tap = action rapide, appui long = formulaire pré-rempli
function QuickBtn({ a, flash, onLongPress, label }) {
  const handlers = useLongPress(() => onLongPress(a), a.run);
  return (
    <button className={`quick-btn ${flash ? 'done' : ''} ${a.live ? 'live' : ''}`} aria-label={label} {...handlers}>
      <span className="quick-label">{flash ? <Icon name="check" size={18} /> : a.label}</span>
      <span className="quick-sub">{a.sub}</span>
    </button>
  );
}

// Chrono de tétée en cours (Minuteur) : durée totale, rafraîchie chaque seconde
function useTeteeTimer() {
  const [state, setState] = useState(() => loadTimerState());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const h = () => setState(loadTimerState());
    window.addEventListener('omnibaby-timer', h);
    return () => window.removeEventListener('omnibaby-timer', h);
  }, []);
  useEffect(() => {
    if (!state?.running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state?.running]);
  if (!state) return null;
  let total = (state.elapsedGauche || 0) + (state.elapsedDroit || 0);
  if (state.running) total += (now - new Date(state.currentSideStartedAt).getTime()) / 1000;
  return { running: !!state.running, text: chronoText(total) };
}

// ----------------------------------------------------------------------
// Saisie rapide en 1 tap, heure = maintenant.
// Biberon : dernière quantité saisie (sinon réglage par défaut, sinon 120 ml)
// Tétée : lance le chrono du Minuteur, côté alterné par rapport à la
// dernière tétée ; pendant la tétée, le bouton affiche le chrono et
// rouvre le Minuteur
// ----------------------------------------------------------------------
export default function QuickEntryBar({ entries, onLongPress }) {
  const { store, update, nextId, firebaseUser } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [flash, setFlash] = useState(null);
  const timer = useTeteeTimer();

  const lastQty = useMemo(() => {
    const last = entries.find((e) => e.type === 'biberon' && e.mode !== 'sein' && Number(e.quantite) > 0);
    return Number(last?.quantite) || Number(store.settings?.defaultBiberonMl) || 120;
  }, [entries, store.settings?.defaultBiberonMl]);

  const nextSide = useMemo(() => {
    const last = entries.find((e) => e.type === 'biberon' && e.mode === 'sein');
    return suggestedSide(last?.cote);
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
    { key: 'biberon', label: 'Biberon', sub: `${lastQty} ml`, prefill: { type: 'biberon', mode: 'biberon', quantite: lastQty }, run: () => quickSave('biberon', 'biberon', { mode: 'biberon', quantite: lastQty }) },
    timer
      ? { key: 'tetee', label: 'Tétée', sub: `${timer.running ? '●' : 'pause'} ${timer.text}`, live: true, run: () => startTeteeTimer(nextSide, timerMeta(activeChild, firebaseUser)) }
      : { key: 'tetee', label: 'Tétée', sub: `▶ ${nextSide}`, prefill: { type: 'biberon', mode: 'sein', cote: nextSide }, run: () => startTeteeTimer(nextSide, timerMeta(activeChild, firebaseUser)) },
    { key: 'pipi', label: 'Pipi', sub: '1 tap', prefill: { type: 'couche', contenu: 'pipi' }, run: () => quickSave('pipi', 'couche', { contenu: 'pipi' }) },
    { key: 'selles', label: 'Selles', sub: '1 tap', prefill: { type: 'couche', contenu: 'selles' }, run: () => quickSave('selles', 'couche', { contenu: 'selles' }) },
  ];
  // Appui long : formulaire pré-rempli (autre côté, autre quantité, heure
  // passée, couleur des selles…) ; tétée en cours : ouvre le chrono
  const longPress = (a) => {
    if (!a.prefill) { a.run(); return; }
    if (onLongPress) onLongPress(a.prefill);
  };

  return (
    <div className="quick-grid">
      {actions.map((a) => (
        <QuickBtn key={a.key} a={a} flash={flash === a.key} onLongPress={longPress}
          label={a.key === 'tetee'
            ? (a.live ? 'Tétée en cours : ouvrir le chrono' : `Lancer le chrono de tétée côté ${nextSide}. Appui long : choisir.`)
            : `${a.label} en 1 tap. Appui long : formulaire.`} />
      ))}
    </div>
  );
}
