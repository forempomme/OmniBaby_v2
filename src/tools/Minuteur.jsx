import React, { useState, useEffect, useRef } from 'react';
import { useStore, getActiveChild, genId, authorFields } from '../store.jsx';
import { useToast } from '../utils.jsx';
import { loadTimerState, saveTimerState, startSide, pauseTimer, teteeFromTimer } from '../timer.js';

// L'état du minuteur est partagé avec la notification « Tétée en cours »
// (voir timer.js) : il survit à la fermeture de l'app.

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function MinuteurTool({ onFinish }) {
  const [state, setState] = useState(() => loadTimerState());
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef(null);

  // Tick every second while a side is running
  useEffect(() => {
    if (state?.running) {
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state?.running]);

  const persist = (newState) => {
    setState(newState);
    saveTimerState(newState);
  };

  // Changement venu de la notification (Changer de côté / Terminer)
  useEffect(() => {
    const h = () => { setState(loadTimerState()); setNow(Date.now()); };
    window.addEventListener('omnibaby-timer', h);
    return () => window.removeEventListener('omnibaby-timer', h);
  }, []);

  // Compute live elapsed for each side
  const liveElapsed = (side) => {
    if (!state) return 0;
    let total = side === 'gauche' ? state.elapsedGauche : state.elapsedDroit;
    if (state.running && state.currentSide === side) {
      total += (now - new Date(state.currentSideStartedAt).getTime()) / 1000;
    }
    return total;
  };

  const start = (side) => { const next = startSide(state, side); if (next !== state) persist(next); };
  const pause = () => persist(pauseTimer(state));

  const reset = () => {
    persist(null);
  };

  const { store, update, firebaseUser } = useStore();
  const showToast = useToast();
  const activeChild = getActiveChild(store);
  const [lastEntry, setLastEntry] = React.useState(null);

  const handleFinish = () => {
    if (!state) return;
    if (!activeChild) { showToast("Crée d'abord le profil de bébé", '⚠️'); return; }
    const entry = {
      id: genId(),
      childId: activeChild.id,
      ...teteeFromTimer(state),
      ...authorFields(firebaseUser, 'created'),
    };
    update((draft) => { draft.entries.push(entry); return draft; });
    setLastEntry(entry);
    reset();
    showToast(`Tétée enregistrée — ${entry.duree} min · ${entry.cote === 'deux' ? 'les deux côtés' : entry.cote}`, '✅');
  };

  const hasSession = !!state;
  const gaucheElapsed = liveElapsed('gauche');
  const droitElapsed = liveElapsed('droit');
  const totalElapsed = gaucheElapsed + droitElapsed;

  return (
    <div>
      <div className="muted" style={{ fontSize: '0.85rem', marginBottom: 16 }}>
        Lance le chrono du côté utilisé, bascule en cours de tétée si besoin, puis termine pour
        enregistrer directement dans le journal. Sur le téléphone, une notification « Tétée en cours »
        permet de changer de côté ou de terminer sans rouvrir l'app.
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.4rem', fontWeight: 600, letterSpacing: 1 }}>
          {formatHMS(totalElapsed)}
        </div>
        <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>Durée totale</div>
      </div>

      <div className="field-row mt-16">
        <button
          className="card appear"
          style={{
            flex: 1,
            textAlign: 'center',
            cursor: 'pointer',
            border: state?.running && state?.currentSide === 'gauche' ? '2px solid var(--primary)' : '1px solid var(--border)',
            margin: 0,
          }}
          onClick={() => start('gauche')}
        >
          <div style={{ fontSize: '1.6rem' }}>👈</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>Gauche</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', marginTop: 4 }}>{formatHMS(gaucheElapsed)}</div>
          {state?.running && state?.currentSide === 'gauche' && (
            <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, marginTop: 4 }}>● En cours</div>
          )}
        </button>

        <button
          className="card appear"
          style={{
            flex: 1,
            textAlign: 'center',
            cursor: 'pointer',
            border: state?.running && state?.currentSide === 'droit' ? '2px solid var(--primary)' : '1px solid var(--border)',
            margin: 0,
          }}
          onClick={() => start('droit')}
        >
          <div style={{ fontSize: '1.6rem' }}>👉</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>Droit</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', marginTop: 4 }}>{formatHMS(droitElapsed)}</div>
          {state?.running && state?.currentSide === 'droit' && (
            <div style={{ color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 700, marginTop: 4 }}>● En cours</div>
          )}
        </button>
      </div>

      <div className="flex-row mt-16" style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
        {state?.running ? (
          <button className="btn btn-secondary" onClick={pause}>⏸️ Pause</button>
        ) : (
          hasSession && <span className="muted" style={{ fontSize: '0.85rem' }}>⏸️ En pause</span>
        )}
        {hasSession && (
          <button className="btn btn-danger" onClick={reset}>✕ Annuler</button>
        )}
      </div>

      {hasSession && (
        <button className="btn btn-primary btn-block mt-16" onClick={handleFinish}>
          ✓ Terminer et enregistrer
        </button>
      )}

      {!hasSession && (
        <>
          {/* Résumé dernière tétée */}
          {lastEntry && (
            <div style={{
              background: 'var(--accent-sage-soft)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--accent-sage)', padding: '12px 14px', marginBottom: 12,
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:'.85rem', color:'var(--accent-sage)' }}>
                    ✅ Dernière tétée enregistrée
                  </div>
                  <div style={{ fontSize:'.78rem', color:'var(--text-soft)', marginTop:3 }}>
                    {lastEntry.duree} min · Côté {lastEntry.cote}
                  </div>
                </div>
                <button
                  onClick={() => { onFinish && onFinish({ ...lastEntry, edit: true }); setLastEntry(null); }}
                  style={{
                    padding:'5px 12px', borderRadius:'var(--radius-pill)',
                    background:'var(--accent-sage)', color:'#fff',
                    border:'none', fontWeight:700, fontSize:'.75rem',
                    cursor:'pointer', fontFamily:'inherit',
                  }}
                >
                  ✏️ Modifier
                </button>
              </div>
            </div>
          )}
          <div className="empty-state">
            <div className="emoji">🤱</div>
            <div className="title">Prêt à démarrer</div>
            <div className="desc">Touche "Gauche" ou "Droit" pour lancer le chrono de la tétée.</div>
          </div>
        </>
      )}
    </div>
  );
}
