// ----------------------------------------------------------------------
// Minuteur de tétée : état partagé (localStorage) + notification
// permanente « Tétée en cours » avec boutons Changer de côté / Terminer.
//
// L'état vit hors de React pour que les boutons de la notification
// fonctionnent même si l'écran Minuteur n'est pas ouvert.
// Grand chrono de la notification et « Changer de côté » sans ouvrir
// l'appli : code Android ajouté au plugin pendant le build
// (android-plugin/, scripts/patch-notif-chrono.mjs). Un changement de côté
// fait depuis la notification est repris par adoptNativeTimerState().
//
// state : { startedAt, currentSide: 'gauche'|'droit', currentSideStartedAt,
//           running, elapsedGauche (s), elapsedDroit (s), updatedAt (ms) }
// ----------------------------------------------------------------------
const STORAGE_KEY = 'omnibaby_minuteur_v1';
const TIMER_NOTIF_ID = 424242;
const ACTION_TYPE = 'OMNIBABY_TETEE';          // Changer de côté + Terminer (via l'appli)
const ACTION_TYPE_FIN = 'OMNIBABY_TETEE_FIN';  // Terminer seul : côté changé par Android

export function loadTimerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// Faut-il afficher la notification pour cet état ? (réglé par App :
// tétée lancée par l'autre parent + réglage « chronos partagés » coupé → non)
let showNotifFor = () => true;
export function setTimerNotifPolicy(fn) { showNotifFor = fn; }

// source : 'local' (ce téléphone) | 'remote' (autre parent) | 'native'
// (bouton de la notification) — liveTimer.js ne renvoie pas un état reçu
export function saveTimerState(state, source = 'local') {
  try {
    if (state === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent('omnibaby-timer', { detail: { active: state !== null, state, source } }));
  syncTimerNotif(state && showNotifFor(state) ? state : null);
}

// Marque l'état comme partagé avec l'autre parent (sans relancer les
// écouteurs ni la notification)
export function markTimerShared() {
  try {
    const st = loadTimerState();
    if (st && !st.shared) localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...st, shared: true }));
  } catch (e) { /* ignore */ }
}

// Ajoute le segment en cours au cumul du côté courant
function closeSegment(state, nowMs) {
  const out = { ...state };
  if (state.running) {
    const delta = Math.max(0, (nowMs - new Date(state.currentSideStartedAt).getTime()) / 1000);
    if (state.currentSide === 'gauche') out.elapsedGauche += delta;
    else out.elapsedDroit += delta;
  }
  return out;
}

// Démarre (ou bascule sur) un côté
export function startSide(state, side, now = new Date()) {
  const iso = now.toISOString();
  if (!state) {
    return { startedAt: iso, currentSide: side, currentSideStartedAt: iso, running: true, elapsedGauche: 0, elapsedDroit: 0, updatedAt: now.getTime() };
  }
  if (state.running && state.currentSide === side) return state;
  return { ...closeSegment(state, now.getTime()), currentSide: side, currentSideStartedAt: iso, running: true, updatedAt: now.getTime() };
}

export function switchSide(state, now = new Date()) {
  if (!state) return null;
  return startSide(state, state.currentSide === 'gauche' ? 'droit' : 'gauche', now);
}

export function pauseTimer(state, now = new Date()) {
  if (!state || !state.running) return state;
  return { ...closeSegment(state, now.getTime()), running: false, updatedAt: now.getTime() };
}

// Format échangé avec le code Android (ObTimer.java) : instants en ms
export function stateToNative(state) {
  return {
    side: state.currentSide === 'droit' ? 'droit' : 'gauche',
    running: !!state.running,
    startedAt: new Date(state.startedAt).getTime(),
    sideStart: new Date(state.currentSideStartedAt).getTime(),
    accG: state.elapsedGauche || 0,
    accD: state.elapsedDroit || 0,
    updatedAt: state.updatedAt || 0,
  };
}

export function nativeToState(o) {
  return {
    startedAt: new Date(o.startedAt).toISOString(),
    currentSide: o.side === 'droit' ? 'droit' : 'gauche',
    currentSideStartedAt: new Date(o.sideStart).toISOString(),
    running: !!o.running,
    elapsedGauche: Number(o.accG) || 0,
    elapsedDroit: Number(o.accD) || 0,
    updatedAt: Number(o.updatedAt) || 0,
  };
}

// Côté proposé pour une nouvelle tétée : l'inverse du dernier utilisé
export function suggestedSide(lastCote) {
  return lastCote === 'gauche' ? 'droit' : 'gauche';
}

// Qui a lancé la tétée, pour quel enfant (partage avec l'autre parent)
export function timerMeta(child, user) {
  return {
    childId: child?.id ?? null,
    startedBy: user?.uid || null,
    startedByName: user?.displayName || user?.email?.split('@')[0] || null,
  };
}

// Lance le chrono (si aucun ne tourne) et demande l'ouverture du Minuteur.
// Utilisé par le Journal : même chrono que Outils → Minuteur.
export function startTeteeTimer(side, meta = {}) {
  if (!loadTimerState()) saveTimerState({ ...startSide(null, side === 'droit' ? 'droit' : 'gauche'), ...meta });
  window.dispatchEvent(new CustomEvent('omnibaby-open-minuteur'));
}

// Entrée « tétée » du journal à partir de l'état (sans id ni auteur)
export function teteeFromTimer(state, now = new Date()) {
  if (!state) return null;
  const s = closeSegment(state, now.getTime());
  const duree = Math.max(1, Math.round((s.elapsedGauche + s.elapsedDroit) / 60));
  let cote;
  if (s.elapsedGauche > 0 && s.elapsedDroit > 0) cote = 'deux';
  else if (s.elapsedDroit > s.elapsedGauche) cote = 'droit';
  else cote = 'gauche';
  // Heure de la tétée = début de la séance (pas l'heure de fin)
  return { type: 'biberon', mode: 'sein', date: new Date(s.startedAt || now).toISOString(), cote, duree };
}

const hm = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const mins = (s) => `${Math.max(0, Math.round(s / 60))} min`;

// Format des chronos Android (Chronometer) : MM:SS, puis H:MM:SS
export function chronoText(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

// Données du grand chrono (mise en page Android omnibaby_chrono*.xml,
// android-plugin/OmniBabyChrono.java). Les « bases » sont des instants :
// durée affichée = maintenant - base ; Android fait avancer le chrono seul.
export function timerNotifExtra(state, nowMs = Date.now()) {
  if (!state) return null;
  const droit = state.currentSide === 'droit';
  const sideStart = new Date(state.currentSideStartedAt).getTime();
  const accTotal = ((state.elapsedGauche || 0) + (state.elapsedDroit || 0)) * 1000;
  const accSide = (droit ? state.elapsedDroit : state.elapsedGauche) * 1000 || 0;
  const other = droit ? state.elapsedGauche : state.elapsedDroit;
  const ref = state.running ? sideStart : nowMs; // en pause : valeurs figées
  return {
    kind: 'tetee',
    // Lu par OmniBabyChrono.java (grand chrono + « Changer de côté » natif)
    obState: JSON.stringify(stateToNative(state)),
    nativeActionTypeId: ACTION_TYPE_FIN,
    chronoLayout: true,
    chronoRunning: !!state.running,
    totalBase: ref - accTotal,
    sideBase: ref - accSide,
    statusText: state.running ? `Tétée en cours — côté ${droit ? 'droit' : 'gauche'}` : 'Tétée en pause',
    sideLabel: droit ? 'Droit' : 'Gauche',
    sideMark: state.running ? '●' : 'pause',
    otherText: `${droit ? 'Gauche' : 'Droit'} ${chronoText(other || 0)}`,
  };
}

// Texte de la notification (aussi affiché si le grand chrono n'est pas installé)
export function timerNotifContent(state) {
  if (!state) return null;
  const droit = state.currentSide === 'droit';
  if (state.running) {
    return {
      title: `Tétée en cours — côté ${droit ? 'droit' : 'gauche'}`,
      body: `${droit ? 'Droit' : 'Gauche'} depuis ${hm(state.currentSideStartedAt)} · début de la tétée ${hm(state.startedAt)}`,
    };
  }
  return {
    title: 'Tétée en pause',
    body: `Gauche ${mins(state.elapsedGauche)} · Droit ${mins(state.elapsedDroit)} · début ${hm(state.startedAt)}`,
  };
}

// v2 : l'importance d'une catégorie Android ne peut plus changer après sa
// création → nouvel identifiant, l'ancienne (importance basse) est supprimée.
const TIMER_CHANNEL = 'omnibaby_tetee_v2';
const OLD_CHANNELS = ['omnibaby_tetee'];

// Erreur visible (toast dans App) : sans ça, un échec reste invisible
// sur le téléphone (console du développeur uniquement).
function reportNotifError(step, e) {
  const message = `${step} : ${e?.message || e?.errorMessage || String(e)}`;
  console.warn('[Minuteur]', message);
  try { window.dispatchEvent(new CustomEvent('omnibaby-notif-error', { detail: { message } })); } catch (x) { /* ignore */ }
}

// ATTENTION : le plugin Capacitor est un Proxy qui répond à TOUTES les
// propriétés, y compris « then ». Renvoyé tel quel par une fonction async,
// il est pris pour une promesse et l'await ne se termine jamais (bug des
// v3.10.0/3.10.1 : aucune notification, aucune erreur). On l'emballe donc
// dans un objet { LN }.
export async function notifPlugin() { return plugin(); }
export function ensureTimerChannel(LN) { return ensureChannel(LN); }
export function reportNotifFailure(step, e) { reportNotifError(step, e); }

async function plugin() {
  if (!window.Capacitor?.isNativePlatform?.()) return null; // navigateur : pas de notification
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return { LN: LocalNotifications };
  } catch (e) {
    reportNotifError('chargement du module', e);
    return null;
  }
}

// Catégorie Android « Tétée en cours ».
// Importance « normale » (3) : seule celle-ci s'affiche dans la barre
// d'état et sur l'écran de verrouillage (sur Pixel, les notifications
// « silencieuses » d'importance basse en sont masquées par défaut).
// Pour ne pas biper la nuit : son silencieux fourni par l'appli
// (android-res/raw/omnibaby_silence.wav), sans vibration.
let channelReady = null;
function ensureChannel(LN) {
  if (!channelReady) {
    channelReady = (async () => {
      for (const id of OLD_CHANNELS) {
        try { await LN.deleteChannel({ id }); } catch (e) { /* déjà absente */ }
      }
      await LN.createChannel({
        id: TIMER_CHANNEL,
        name: 'Tétée en cours',
        description: 'Chrono de tétée du Minuteur (sans son)',
        importance: 3,
        visibility: 1,
        sound: 'omnibaby_silence.wav',
        vibration: false,
      });
      return TIMER_CHANNEL;
    })().catch((e) => { reportNotifError('catégorie', e); return undefined; });
  }
  return channelReady;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function isShown(LN) {
  try {
    const { notifications } = await LN.getDeliveredNotifications();
    return (notifications || []).some((n) => Number(n.id) === TIMER_NOTIF_ID);
  } catch (e) {
    return null; // inconnu
  }
}

async function doSync(state) {
  const p = await plugin();
  if (!p) return;
  const { LN } = p;
  if (!state) {
    try { await LN.cancel({ notifications: [{ id: TIMER_NOTIF_ID }] }); } catch (e) { /* rien à annuler */ }
    return;
  }
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LN.requestPermissions();
      if (req.display !== 'granted') { reportNotifError('autorisation', `notifications ${req.display}`); return; }
    }
  } catch (e) { reportNotifError('autorisation', e); return; }

  const channelId = await ensureChannel(LN);
  const base = {
    id: TIMER_NOTIF_ID,
    ...timerNotifContent(state),
    ongoing: true,
    autoCancel: false,
    actionTypeId: ACTION_TYPE,
    extra: timerNotifExtra(state),
    smallIcon: 'ic_stat_omnibaby', // android-res/drawable (pieds + cœur, blanc)
    iconColor: '#C96F4A',
    ...(channelId ? { channelId } : {}),
  };
  try {
    await LN.schedule({ notifications: [base] });
  } catch (e) { reportNotifError('affichage', e); }

  // Contrôle : la notification est-elle vraiment affichée ? Sinon, même
  // chemin que les Rappels (programmée 1 s plus tard), qui fonctionne.
  await wait(400);
  if ((await isShown(LN)) === false) {
    try {
      await LN.schedule({ notifications: [{ ...base, schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true } }] });
      await wait(2500);
      if ((await isShown(LN)) === false) reportNotifError('affichage', 'Android n’a pas affiché la notification');
    } catch (e) { reportNotifError('affichage (secours)', e); }
  }
}

// Appels en file : un changement de côté rapide ne croise pas l'appel précédent
let queue = Promise.resolve();
export function syncTimerNotif(state) {
  queue = queue.then(() => doSync(state)).catch((e) => reportNotifError('notification', e));
  return queue;
}

// À appeler une fois (App) : onAction('switch' | 'finish' | 'open')
export async function initTimerNotifActions(onAction) {
  const p = await plugin();
  if (!p) return () => {};
  const { LN } = p;
  try {
    await LN.registerActionTypes({
      types: [
        {
          id: ACTION_TYPE,
          actions: [
            { id: 'switch', title: 'Changer de côté' },
            { id: 'finish', title: 'Terminer' },
          ],
        },
        // Avec le code Android : « Changer de côté » ajouté par Android lui-même
        { id: ACTION_TYPE_FIN, actions: [{ id: 'finish', title: 'Terminer' }] },
        // Sommeil en cours : « Réveil » (sans le code Android : ouvre l'appli)
        { id: 'OMNIBABY_SOMMEIL', actions: [{ id: 'wake', title: 'Réveil' }] },
        // Avec le code Android : « Réveil » ajouté par Android lui-même
        { id: 'OMNIBABY_NONE', actions: [] },
      ],
    });
    const handle = await LN.addListener('localNotificationActionPerformed', (ev) => {
      const extra = ev?.notification?.extra;
      if (extra?.kind === 'sommeil') { onAction(ev.actionId === 'wake' ? 'wake' : 'openSleep', extra); return; }
      if (extra?.kind !== 'tetee') return;
      onAction(ev.actionId === 'switch' || ev.actionId === 'finish' ? ev.actionId : 'open');
    });
    return () => handle.remove();
  } catch (e) {
    reportNotifError('boutons', e);
    return () => {};
  }
}

// Reprend un changement de côté fait depuis la notification (Android a
// rangé l'état à jour dans la notification). À appeler à l'ouverture de
// l'appli, au retour au premier plan et avant d'agir sur le minuteur.
export async function adoptNativeTimerState() {
  const p = await plugin();
  if (!p) return false;
  try {
    const local = loadTimerState();
    if (!local) return false;
    const { notifications } = await p.LN.getDeliveredNotifications();
    const n = (notifications || []).find((x) => Number(x.id) === TIMER_NOTIF_ID);
    const raw = n?.data?.omnibaby_state;
    if (!raw) return false;
    const nat = nativeToState(JSON.parse(raw));
    if (nat.updatedAt <= (local.updatedAt || 0)) return false;
    // Garder enfant / parent qui l'a lancée (absents de l'état Android)
    saveTimerState({ ...local, ...nat }, 'native');
    return true;
  } catch (e) {
    console.warn('[Minuteur] reprise état Android', e);
    return false;
  }
}

// Retour de l'appli au premier plan → callback (ex. adoptNativeTimerState)
export async function onAppResume(cb) {
  if (!window.Capacitor?.isNativePlatform?.()) return () => {};
  try {
    const mod = await import('@capacitor/app');
    const handle = await mod.App.addListener('resume', cb);
    return () => handle.remove();
  } catch (e) {
    return () => {};
  }
}
