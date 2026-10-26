import React, { useState, useEffect, useMemo } from 'react';
import { useStore, getActiveChild, genId, authorFields } from '../store.jsx';
import { useToast, formatTimeFR, formatElapsed } from '../utils.jsx';
import { loadTimerState, saveTimerState, startSide, switchSide, pauseTimer, teteeFromTimer, suggestedSide, chronoText, timerMeta } from '../timer.js';
import { Icon } from '../icons.jsx';

// ----------------------------------------------------------------------
// Minuteur de tétée (v3.14) : anneau = part de chaque côté, gros chrono
// au centre, côtés en vis-à-vis. L'état est partagé avec la notification
// « Tétée en cours » et l'autre parent (voir timer.js, liveTimer.js).
// ----------------------------------------------------------------------
const RING_MIN = 20 * 60; // l'anneau se remplit sur 20 min, puis montre la répartition

// Arcs de l'anneau : longueurs (0..1) gauche puis droit
export function ringArcs(gauche, droit) {
  const total = gauche + droit;
  const scale = Math.max(total, RING_MIN);
  return { g: gauche / scale, d: droit / scale };
}

function Ring({ gauche, droit, label }) {
  const r = 88;
  const C = 2 * Math.PI * r;
  const { g, d } = ringArcs(gauche, droit);
  const gap = g > 0 && d > 0 ? 6 : 0;
  const lg = Math.max(0, g * C - gap);
  const ld = Math.max(0, d * C - gap);
  return (
    <svg viewBox="0 0 220 220" className="mm-ring" role="img" aria-label={`Durée totale ${label}`}>
      <circle cx="110" cy="110" r={r} className="mm-ring-bg" />
      {lg > 0 && <circle cx="110" cy="110" r={r} className="mm-ring-g" strokeDasharray={`${lg} ${C}`} transform="rotate(-90 110 110)" />}
      {ld > 0 && <circle cx="110" cy="110" r={r} className="mm-ring-d" strokeDasharray={`${ld} ${C}`} strokeDashoffset={-(g * C)} transform="rotate(-90 110 110)" />}
      <text x="110" y="108" textAnchor="middle" className="mm-ring-time">{label}</text>
      <text x="110" y="136" textAnchor="middle" className="mm-ring-sub">durée totale</text>
    </svg>
  );
}

export default function MinuteurTool({ onFinish }) {
  const { store, update, firebaseUser } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [state, setState] = useState(() => loadTimerState());
  const [now, setNow] = useState(Date.now());
  const [lastEntry, setLastEntry] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!state?.running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state?.running]);

  // Changements venus de la notification ou de l'autre parent
  useEffect(() => {
    const h = () => { setState(loadTimerState()); setNow(Date.now()); };
    window.addEventListener('omnibaby-timer', h);
    return () => window.removeEventListener('omnibaby-timer', h);
  }, []);

  const persist = (next) => { setState(next); saveTimerState(next); };

  // Dernière tétée de l'enfant : côté proposé + rappel en bas d'écran
  const lastFeed = useMemo(() => (store.entries || [])
    .filter((e) => e.childId === activeChild?.id && e.type === 'biberon' && e.mode === 'sein')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0], [store.entries, activeChild?.id]);
  const proposed = suggestedSide(lastFeed?.cote);

  const elapsed = (side) => {
    if (!state) return 0;
    let t = (side === 'gauche' ? state.elapsedGauche : state.elapsedDroit) || 0;
    if (state.running && state.currentSide === side) t += (now - new Date(state.currentSideStartedAt).getTime()) / 1000;
    return t;
  };
  const g = elapsed('gauche');
  const d = elapsed('droit');

  const start = (side) => {
    if (!state) { persist({ ...startSide(null, side), ...timerMeta(activeChild, firebaseUser) }); return; }
    const next = startSide(state, side);
    if (next !== state) persist(next);
  };

  const finish = () => {
    if (!state) return;
    const childId = state.childId || activeChild?.id;
    if (!childId) { showToast("Crée d'abord le profil de bébé", '⚠️'); return; }
    const entry = { id: genId(), childId, ...teteeFromTimer(state), ...authorFields(firebaseUser, 'created') };
    update((draft) => { draft.entries.push(entry); return draft; });
    setLastEntry(entry);
    persist(null);
    showToast(`Tétée enregistrée — ${entry.duree} min · ${entry.cote === 'deux' ? 'les deux côtés' : entry.cote}`, '✅');
  };

  const side = (key, label, letter) => {
    const on = state?.running && state.currentSide === key;
    const paused = state && !state.running && state.currentSide === key;
    const suggested = !state && key === proposed;
    return (
      <button className={`mm-side ${on ? 'on' : ''} ${suggested ? 'suggested' : ''} ${key}`} onClick={() => start(key)}
        aria-label={state ? `Côté ${label}` : `Démarrer côté ${label}`}>
        <span className="mm-letter">{letter}</span>
        <span className="mm-side-body">
          <b>{label}</b>
          <span className="mm-side-time">{on ? '● ' : ''}{chronoText(key === 'gauche' ? g : d)}</span>
          {paused && <span className="mm-side-tag">en pause</span>}
          {suggested && <span className="mm-side-tag">proposé</span>}
        </span>
      </button>
    );
  };

  const otherName = state?.startedByName && state.startedBy && state.startedBy !== firebaseUser?.uid ? state.startedByName : null;

  return (
    <div className="mm">
      {otherName && <div className="mm-by"><Icon name="users" size={15} /> Tétée lancée par {otherName}</div>}

      <Ring gauche={g} droit={d} label={chronoText(g + d)} />
      <div className="mm-legend">
        <span><i className="g" />Gauche {chronoText(g)}</span>
        <span><i className="d" />Droit {chronoText(d)}</span>
      </div>

      <div className="mm-sides">
        {side('gauche', 'Gauche', 'G')}
        {side('droit', 'Droit', 'D')}
      </div>

      {state ? (
        <>
          <div className="mm-actions">
            {state.running ? (
              <button className="btn btn-outline" onClick={() => persist(pauseTimer(state))}><Icon name="pause" size={16} /> Pause</button>
            ) : (
              <button className="btn btn-outline" onClick={() => start(state.currentSide)}><Icon name="play" size={16} /> Reprendre</button>
            )}
            <button className="btn btn-outline" onClick={() => persist(switchSide(state))}><Icon name="swap" size={16} /> Changer</button>
          </div>
          <button className="btn btn-primary btn-block mt-8" onClick={finish}><Icon name="check" size={16} /> Terminer et enregistrer</button>
          {confirmCancel ? (
            <div className="mm-confirm">
              <span>Annuler sans rien enregistrer ?</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmCancel(false)}>Non</button>
              <button className="btn btn-danger btn-sm" onClick={() => { setConfirmCancel(false); persist(null); }}>Oui, annuler</button>
            </div>
          ) : (
            <button className="mm-cancel" onClick={() => setConfirmCancel(true)}>Annuler cette tétée</button>
          )}
          <div className="mm-hint">
            Début {formatTimeFR(state.startedAt)}
            {lastFeed && <> · dernière tétée : {lastFeed.cote === 'deux' ? 'les deux côtés' : lastFeed.cote}, il y a {formatElapsed(now - new Date(lastFeed.date).getTime())}</>}
          </div>
        </>
      ) : (
        <>
          {lastEntry && (
            <div className="mm-saved">
              <span><Icon name="check" size={16} /> Tétée enregistrée · {lastEntry.duree} min · {lastEntry.cote === 'deux' ? 'les deux côtés' : lastEntry.cote}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { onFinish && onFinish({ ...lastEntry, edit: true }); setLastEntry(null); }}>
                <Icon name="edit" size={14} /> Modifier
              </button>
            </div>
          )}
          <div className="mm-hint">
            Touche un côté pour démarrer{lastFeed ? ` · dernière tétée : ${lastFeed.cote === 'deux' ? 'les deux côtés' : lastFeed.cote}, il y a ${formatElapsed(now - new Date(lastFeed.date).getTime())}` : ''}
          </div>
        </>
      )}
    </div>
  );
}
