// ----------------------------------------------------------------------
// Tétée en cours partagée entre les parents (v3.14).
//
// Un seul document Firestore : families/{id}/live/tetee = { state, updatedAt }.
//  - ce téléphone change le chrono (source 'local' ou 'native') → envoi ;
//  - l'autre parent le change → reçu ici et adopté (source 'remote') ;
//  - la tétée est terminée ou annulée → document supprimé → le chrono
//    s'arrête aussi chez l'autre parent (s'il l'avait déjà reçu : « shared »).
// Coût : 1 document écouté, quelques lectures par tétée.
// Règle Firestore requise : match /live/{id} (voir firestore.rules).
// ----------------------------------------------------------------------
import { db, doc, setDoc, deleteDoc, onSnapshot } from './firebase.js';
import { loadTimerState, saveTimerState, markTimerShared } from './timer.js';
import { countReads, readsForSnapshot } from './readCounter.js';

// État envoyé : sans les marqueurs propres à ce téléphone
export function sharedPayload(state) {
  if (!state) return null;
  const { shared, ...rest } = state;
  return rest;
}

// Décision à la réception du document (pure, testée)
//  remote : état reçu (ou null si le document n'existe pas)
//  local  : état de ce téléphone (ou null)
// → 'adopt' | 'clear' | 'push' | 'drop' | 'none'
export const LIVE_STALE_MS = 6 * 3600 * 1000; // tétée oubliée (téléphone éteint…) : ignorée

export function liveDecision(remote, local, nowMs = Date.now()) {
  if (remote && nowMs - new Date(remote.startedAt).getTime() > LIVE_STALE_MS) {
    return local && !local.shared ? 'push' : 'drop';
  }
  if (!remote) {
    if (!local) return 'none';
    return local.shared ? 'clear' : 'push';
  }
  if (!local) return 'adopt';
  const r = remote.updatedAt || 0;
  const l = local.updatedAt || 0;
  if (r > l) return 'adopt';
  if (l > r) return 'push';
  return 'none';
}

let live = null;

export function stopLiveTimer() {
  if (!live) return;
  live.unsub();
  window.removeEventListener('omnibaby-timer', live.onTimer);
  live = null;
}

export function startLiveTimer(familyId, { onError } = {}) {
  stopLiveTimer();
  if (!familyId) return;
  const ref = doc(db, 'families', familyId, 'live', 'tetee');
  const tracker = { serverSeen: false };
  let failed = false;
  const fail = (e) => {
    if (failed) return;
    failed = true;
    console.warn('[Tétée partagée]', e?.message || e);
    onError && onError(e);
  };

  const push = (state) => {
    const payload = sharedPayload(state);
    const p = payload
      ? setDoc(ref, { state: payload, updatedAt: payload.updatedAt || Date.now() })
      : deleteDoc(ref);
    p.then(() => { if (payload) markTimerShared(); }).catch(fail);
  };

  const onTimer = (e) => {
    const { source, state } = e.detail || {};
    if (source === 'remote') return; // reçu de l'autre parent : ne pas le renvoyer
    push(state ?? null);
  };
  window.addEventListener('omnibaby-timer', onTimer);

  const unsub = onSnapshot(ref, (snap) => {
    countReads(readsForSnapshot(snap, tracker));
    if (snap.metadata?.hasPendingWrites) return; // notre propre envoi
    const remote = snap.exists() ? snap.data()?.state || null : null;
    const local = loadTimerState();
    switch (liveDecision(remote, local)) {
      case 'adopt': saveTimerState({ ...remote, shared: true }, 'remote'); break;
      case 'clear': saveTimerState(null, 'remote'); break;
      case 'push': push(local); break;
      case 'drop': deleteDoc(ref).catch(fail); break;
      default: break;
    }
  }, fail);

  live = { unsub, onTimer };
}
