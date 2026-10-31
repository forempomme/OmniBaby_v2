// ----------------------------------------------------------------------
// Résumés du Journal (v3.16)
//  - « Pendant ton absence » : ce que l'autre parent a noté depuis la
//    dernière ouverture de l'appli sur ce téléphone ;
//  - « Bilan de la nuit » : de 19 h la veille à 9 h, affiché le matin.
// ----------------------------------------------------------------------
import { formatTimeFR, toISODate } from './utils.jsx';

const MIN = 60000;
export const ABSENCE_MIN_GAP = 30 * MIN; // en dessous : pas de résumé
const LAST_SEEN_KEY = 'omnibaby_last_seen_v1';

const t = (iso) => new Date(iso).getTime();
const start = (e) => t(e.debut || e.date);
const sleepEnd = (e) => (e.fin ? t(e.fin) : e.duree ? start(e) + e.duree * MIN : null);
const plural = (n, one, many = one + 's') => `${n} ${n > 1 ? many : one}`;

// « 1 h 10 », « 35 min »
export function durationText(min) {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`;
}

// Lignes de résumé (repas, changes, sommeil, tire-lait, notes)
export function summarizeEntries(list) {
  const lines = [];
  const seins = list.filter((e) => e.type === 'biberon' && e.mode === 'sein');
  const bibs = list.filter((e) => e.type === 'biberon' && e.mode !== 'sein');
  if (seins.length) {
    const min = seins.reduce((s, e) => s + (Number(e.duree) || 0), 0);
    lines.push({ kind: 'repas', text: `${plural(seins.length, 'tétée')}${min ? ` (${durationText(min)} au total)` : ''}` });
  }
  if (bibs.length) {
    const ml = bibs.reduce((s, e) => s + (Number(e.quantite) || 0), 0);
    lines.push({ kind: 'repas', text: `${plural(bibs.length, 'biberon')}${ml ? ` · ${ml} ml` : ''}` });
  }
  const ch = list.filter((e) => e.type === 'couche');
  if (ch.length) {
    const st = ch.filter((e) => e.contenu === 'selles' || e.contenu === 'mixte').length;
    lines.push({ kind: 'change', text: `${plural(ch.length, 'change')}${st ? ` dont ${st} avec selles` : ''}` });
  }
  const sl = list.filter((e) => e.type === 'sommeil');
  if (sl.length) {
    const done = sl.filter((e) => sleepEnd(e));
    const min = done.reduce((s, e) => s + (sleepEnd(e) - start(e)) / MIN, 0);
    const cur = sl.some((e) => e.enCours);
    lines.push({ kind: 'sommeil', text: `${plural(sl.length, 'sommeil')}${min ? ` · ${durationText(min)}` : ''}${cur ? ' · dort encore' : ''}` });
  }
  const tl = list.filter((e) => e.type === 'tirelait');
  if (tl.length) lines.push({ kind: 'tirelait', text: `${plural(tl.length, 'tire-lait')} · ${tl.reduce((s, e) => s + (Number(e.quantite) || 0), 0)} ml` });
  const notes = list.filter((e) => e.type === 'autre');
  if (notes.length) lines.push({ kind: 'note', text: plural(notes.length, 'note') });
  return lines;
}

// Entrées notées par quelqu'un d'autre depuis « since » (ms)
export function absenceSummary(entries, childId, since, myUid, now = Date.now()) {
  if (!since || now - since < ABSENCE_MIN_GAP || !myUid) return null;
  const list = (entries || []).filter((e) => e.childId === childId && e.createdBy && e.createdBy !== myUid
    && t(e.createdAt || e.date) > since && t(e.createdAt || e.date) <= now);
  if (!list.length) return null;
  const names = [...new Set(list.map((e) => e.createdByName).filter(Boolean))];
  return { since, count: list.length, names, lines: summarizeEntries(list) };
}

// Fenêtre de la nuit passée : veille 19 h → 9 h (ou maintenant)
export function nightWindow(now = new Date()) {
  const end = new Date(now); end.setHours(9, 0, 0, 0);
  const begin = new Date(end); begin.setDate(begin.getDate() - 1); begin.setHours(19, 0, 0, 0);
  return { begin: begin.getTime(), end: Math.min(end.getTime(), now.getTime()) };
}

export const showNightRecapAt = (now = new Date()) => now.getHours() >= 5 && now.getHours() < 12;

export function nightRecap(entries, childId, now = new Date()) {
  const { begin, end } = nightWindow(now);
  const mine = (entries || []).filter((e) => e.childId === childId);
  const sleeps = mine.filter((e) => e.type === 'sommeil' && start(e) >= begin && start(e) < end).sort((a, b) => start(a) - start(b));
  const inWin = (e) => t(e.date) >= begin && t(e.date) < end;
  const feeds = mine.filter((e) => e.type === 'biberon' && inWin(e));
  const changes = mine.filter((e) => e.type === 'couche' && inWin(e));
  if (!sleeps.length && !feeds.length) return null;
  const lastSleep = sleeps[sleeps.length - 1];
  const durations = sleeps.map((e) => ((sleepEnd(e) ?? (e.enCours ? now.getTime() : null)) - start(e)) / MIN).filter((m) => m > 0);
  let wakeups = 0;
  for (let i = 1; i < sleeps.length; i++) if (start(sleeps[i]) - (sleepEnd(sleeps[i - 1]) ?? start(sleeps[i])) >= 5 * MIN) wakeups++;
  const seins = feeds.filter((e) => e.mode === 'sein').length;
  const ml = feeds.filter((e) => e.mode !== 'sein').reduce((s, e) => s + (Number(e.quantite) || 0), 0);
  return {
    day: toISODate(now),
    bedtime: sleeps[0] ? formatTimeFR(sleeps[0].debut || sleeps[0].date) : null,
    wake: lastSleep ? (lastSleep.enCours ? null : formatTimeFR(sleepEnd(lastSleep))) : null,
    sleepingNow: !!lastSleep?.enCours,
    wakeups,
    longest: durations.length ? Math.max(...durations) : 0,
    total: durations.reduce((s, m) => s + m, 0),
    feeds: feeds.length, seins, bibs: feeds.length - seins, ml,
    changes: changes.length,
  };
}

// Dernier passage sur ce téléphone (ms) : relu à l'ouverture / au retour
export function readLastSeen() {
  try { return Number(localStorage.getItem(LAST_SEEN_KEY)) || null; } catch (e) { return null; }
}
export function writeLastSeen(ms = Date.now()) {
  try { localStorage.setItem(LAST_SEEN_KEY, String(ms)); } catch (e) { /* rien */ }
}
