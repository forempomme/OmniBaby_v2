import React, { useEffect, useState } from 'react';
import { useStore } from '../store.jsx';
import { loadTimerState, chronoText } from '../timer.js';
import { Icon } from '../icons.jsx';

// ----------------------------------------------------------------------
// Bandeau « Tétée en cours · lancée par Marie » (v3.14) : visible sur le
// téléphone de l'autre parent ; « Voir » ouvre le même chrono.
// ----------------------------------------------------------------------
export default function LiveBanner() {
  const { firebaseUser } = useStore();
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

  if (!state || !state.startedBy || state.startedBy === firebaseUser?.uid) return null;
  const side = (s) => {
    let t = (s === 'gauche' ? state.elapsedGauche : state.elapsedDroit) || 0;
    if (state.running && state.currentSide === s) t += (now - new Date(state.currentSideStartedAt).getTime()) / 1000;
    return t;
  };
  const total = side('gauche') + side('droit');
  const cur = state.currentSide === 'droit' ? 'droit' : 'gauche';
  return (
    <div className="live-banner">
      <span className="live-banner-icon"><Icon name="bottle" size={18} /></span>
      <span className="live-banner-body">
        <b>Tétée {state.running ? 'en cours' : 'en pause'} · <span className="mono">{chronoText(total)}</span></b>
        <span>lancée par {state.startedByName || "l'autre parent"} · côté {cur} {state.running ? '●' : ''} {chronoText(side(cur))}</span>
      </span>
      <button className="btn btn-primary btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('omnibaby-open-minuteur'))}>Voir</button>
    </div>
  );
}
