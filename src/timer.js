// ----------------------------------------------------------------------
// Minuteur de tétée : état partagé (localStorage) + notification
// permanente « Tétée en cours » avec boutons Changer de côté / Terminer.
//
// L'état vit hors de React pour que les boutons de la notification
// fonctionnent même si l'écran Minuteur n'est pas ouvert.
// Limite du plugin @capacitor/local-notifications : pas de chrono qui
// défile dans la notification → on affiche les heures de début, mises à
// jour à chaque changement de côté.
//
// state : { startedAt, currentSide: 'gauche'|'droit', currentSideStartedAt,
//           running, elapsedGauche (s), elapsedDroit (s) }
// ----------------------------------------------------------------------
const STORAGE_KEY = 'omnibaby_minuteur_v1';
const TIMER_NOTIF_ID = 424242;
const ACTION_TYPE = 'OMNIBABY_TETEE';

export function loadTimerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveTimerState(state) {
  try {
    if (state === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent('omnibaby-timer', { detail: { active: state !== null } }));
  syncTimerNotif(state);
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
    return { startedAt: iso, currentSide: side, currentSideStartedAt: iso, running: true, elapsedGauche: 0, elapsedDroit: 0 };
  }
  if (state.running && state.currentSide === side) return state;
  return { ...closeSegment(state, now.getTime()), currentSide: side, currentSideStartedAt: iso, running: true };
}

export function switchSide(state, now = new Date()) {
  if (!state) return null;
  return startSide(state, state.currentSide === 'gauche' ? 'droit' : 'gauche', now);
}

export function pauseTimer(state, now = new Date()) {
  if (!state || !state.running) return state;
  return { ...closeSegment(state, now.getTime()), running: false };
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

// Texte de la notification
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

const TIMER_CHANNEL = 'omnibaby_tetee';

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

// Catégorie Android « Tétée en cours » : importance basse = visible dans
// le volet et la barre d'état, sans son (pas de bip la nuit).
let channelReady = null;
function ensureChannel(LN) {
  if (!channelReady) {
    channelReady = LN.createChannel({
      id: TIMER_CHANNEL,
      name: 'Tétée en cours',
      description: 'Chrono de tétée du Minuteur',
      importance: 2,
      visibility: 1,
      vibration: false,
    }).then(() => TIMER_CHANNEL).catch((e) => { reportNotifError('catégorie', e); return undefined; });
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
    extra: { kind: 'tetee' },
    smallIcon: 'ic_launcher',
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
      types: [{
        id: ACTION_TYPE,
        actions: [
          { id: 'switch', title: 'Changer de côté' },
          { id: 'finish', title: 'Terminer' },
        ],
      }],
    });
    const handle = await LN.addListener('localNotificationActionPerformed', (ev) => {
      if (ev?.notification?.extra?.kind !== 'tetee') return;
      onAction(ev.actionId === 'switch' || ev.actionId === 'finish' ? ev.actionId : 'open');
    });
    return () => handle.remove();
  } catch (e) {
    reportNotifError('boutons', e);
    return () => {};
  }
}
