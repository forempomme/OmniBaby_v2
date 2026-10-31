// ----------------------------------------------------------------------
// Rappel « Change ? » après un repas (v3.15)
//
// Une tétée ou un biberon enregistré SUR CE TÉLÉPHONE programme une
// notification N minutes après la fin du repas (Réglages → Notifications).
// Pas de rappel si un change a déjà été noté depuis le début du repas
// (par n'importe quel parent) ; rappel annulé si un change est noté avant,
// si le repas est supprimé ou si une nouvelle tétée commence.
// Toucher la notification ouvre le formulaire Change (App.jsx).
// ----------------------------------------------------------------------
import { scheduleNotif, cancelNotif, requestNotifPermission, formatTimeFR } from './utils.jsx';

export const CHANGE_NOTIF_ID = 'change_reminder';
export const CHANGE_DELAYS = [5, 10, 15, 20];
const KEY = 'omnibaby_change_reminder_v1';
const MIN = 60000;

export const isFeed = (e) => !!e && e.type === 'biberon' && !e.enCours && !!e.date;

// Fin du repas : début + durée si elle est connue, sinon l'heure saisie
export function feedEnd(e) {
  const d = new Date(e.date).getTime();
  return d + (Number(e.duree) > 0 ? Number(e.duree) * MIN : 0);
}

export const isNightTime = (date) => { const h = date.getHours(); return h >= 22 || h < 7; };

export function changeDelay(settings) {
  return CHANGE_DELAYS.includes(settings?.changeDelay) ? settings.changeDelay : 5;
}

export function hasChangeSince(entries, childId, since) {
  return (entries || []).some((e) => e.type === 'couche' && e.childId === childId && new Date(e.date).getTime() >= since);
}

// Heure du rappel (ms) pour ce repas, ou null s'il n'en faut pas
export function changeReminderAt(feed, entries, settings, now = Date.now()) {
  if (settings?.notifs?.change === false || !isFeed(feed)) return null;
  const at = feedEnd(feed) + changeDelay(settings) * MIN;
  if (!(at > now)) return null; // repas saisi après coup : trop tard
  if (settings?.changeNight === false && isNightTime(new Date(at))) return null;
  if (hasChangeSince(entries, feed.childId, new Date(feed.date).getTime())) return null;
  return at;
}

// Que faire du rappel en attente ? 'keep' | 'cancel' (retirer la
// notification, même déjà affichée) | 'drop' (l'oublier simplement)
export function reconcileChangeReminder(pending, entries, timerState, now = Date.now()) {
  if (!pending) return 'keep';
  if (hasChangeSince(entries, pending.childId, pending.since)) return 'cancel';
  if (pending.at <= now) return now - pending.at > 6 * 3600000 ? 'drop' : 'keep';
  if (!(entries || []).some((e) => e.id === pending.feedId)) return 'cancel';
  const started = timerState?.startedAt ? new Date(timerState.startedAt).getTime() : 0;
  if (started > pending.end) return 'cancel';
  return 'keep';
}

export function changeNotifText(feed, childName) {
  const what = feed.mode === 'sein' ? 'Tétée finie' : 'Biberon fini';
  const detail = feed.mode === 'sein'
    ? (Number(feed.duree) > 0 ? ` · ${feed.duree} min` : '')
    : (Number(feed.quantite) > 0 ? ` · ${feed.quantite} ml` : '');
  return {
    title: `Change pour ${childName || 'bébé'} ?`,
    body: `${what} à ${formatTimeFR(feedEnd(feed))}${detail}`,
  };
}

export function loadPendingChange() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
}
function savePendingChange(p) {
  try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY); } catch (e) { /* rien */ }
}

export async function scheduleChangeReminder(feed, childName, at) {
  savePendingChange({ feedId: feed.id, childId: feed.childId, since: new Date(feed.date).getTime(), end: feedEnd(feed), at });
  await cancelNotif(CHANGE_NOTIF_ID);
  if (!(await requestNotifPermission())) return false;
  const t = changeNotifText(feed, childName);
  return scheduleNotif({ id: CHANGE_NOTIF_ID, ...t, at, extra: { kind: 'change', childId: feed.childId } });
}

export async function cancelChangeReminder() {
  savePendingChange(null);
  await cancelNotif(CHANGE_NOTIF_ID);
}

export function forgetChangeReminder() { savePendingChange(null); }
