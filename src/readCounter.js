// ----------------------------------------------------------------------
// Compteur de lectures Firestore de CE téléphone, par jour (estimation).
// Firestore ne donne pas le vrai chiffre à l'app : on compte
//  - au premier résultat serveur d'une écoute : tous les documents reçus
//    (cas le plus cher : reprise après plus de 30 min hors connexion) ;
//  - ensuite : les documents ajoutés / modifiés / supprimés ;
//  - « Charger l'historique » : tous les documents lus.
// C'est donc une estimation haute. Quota gratuit : 50 000 lectures / jour
// pour toute la famille (tous les téléphones).
// ----------------------------------------------------------------------
const KEY = 'omnibaby_reads_v1';

function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && raw.day === todayKey() ? raw : { day: todayKey(), reads: 0 };
  } catch (e) {
    return { day: todayKey(), reads: 0 };
  }
}

export function countReads(n) {
  if (!(n > 0)) return;
  const s = load();
  s.reads += n;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  window.dispatchEvent(new CustomEvent('omnibaby-reads', { detail: s.reads }));
}

export function readsToday() {
  return load().reads;
}

// Lectures facturées pour un résultat d'écoute Firestore.
// tracker = { serverSeen } propre à chaque écoute.
export function readsForSnapshot(snap, tracker) {
  if (snap.metadata?.fromCache) { tracker.serverSeen = false; return 0; }
  if (!tracker.serverSeen) {
    tracker.serverSeen = true;
    return Math.max(1, snap.size ?? snap.docs?.length ?? 1); // une requête vide coûte 1 lecture
  }
  if (snap.metadata?.hasPendingWrites) return 0;
  return typeof snap.docChanges === 'function' ? snap.docChanges().length : 1;
}
