// ----------------------------------------------------------------------
// Sommeil chronométré (v3.14) : notification « Sieste/Nuit en cours » avec
// chrono en direct et bouton « Réveil ».
//
// Le sommeil en cours est une entrée du journal (type 'sommeil', enCours),
// donc synchronisée : la notification suit cette entrée (App.jsx).
// « Réveil » touché sur l'écran verrouillé est traité par Android
// (android-plugin/OmniBabyChronoReceiver.java), qui note l'heure dans
// omnibaby_wake.json (dossier de l'appli) ; l'appli la reprend ensuite
// (readNativeWakes) et termine l'entrée.
// ----------------------------------------------------------------------
import { notifPlugin, ensureTimerChannel, reportNotifFailure } from './timer.js';

export const SLEEP_NOTIF_ID = 424243;
const WAKE_FILE = 'omnibaby_wake.json';

// Nuit entre 19 h et 7 h, sieste sinon
export function sleepKindAt(date = new Date()) {
  const h = date.getHours();
  return h >= 19 || h < 7 ? 'nuit' : 'sieste';
}

const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Contenu de la notification (aussi utilisé sans le code Android)
export function sleepNotifContent(entry, childName) {
  const start = new Date(entry.debut || entry.date);
  const kind = entry.sousType === 'nuit' ? 'Nuit' : 'Sieste';
  return {
    title: `${kind} en cours${childName ? ` — ${childName}` : ''}`,
    body: `Endormi à ${hm(start)}`,
    obSleep: JSON.stringify({
      entryId: entry.id,
      startedAt: start.getTime(),
      kind: entry.sousType === 'nuit' ? 'nuit' : 'sieste',
      child: childName || '',
    }),
  };
}

// Entrée terminée à partir de l'heure de réveil (même règle que le formulaire)
export function wakeFields(entry, wakeAt) {
  const debut = new Date(entry.debut || entry.date);
  const fin = new Date(Math.max(wakeAt, debut.getTime() + 60000));
  return {
    fin: fin.toISOString(),
    duree: Math.max(1, Math.round((fin - debut) / 60000)),
    enCours: false,
    humeurReveil: null,
  };
}

let queue = Promise.resolve();
let shownFor = null; // id de l'entrée affichée (évite de reprogrammer à chaque rendu)

async function doSync(entry, childName) {
  const p = await notifPlugin();
  if (!p) return;
  const { LN } = p;
  if (!entry) {
    if (shownFor !== null) {
      shownFor = null;
      try { await LN.cancel({ notifications: [{ id: SLEEP_NOTIF_ID }] }); } catch (e) { /* rien */ }
    }
    return;
  }
  const key = `${entry.id}|${entry.debut || entry.date}|${entry.sousType}`;
  if (shownFor === key) return;
  try {
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LN.requestPermissions();
      if (req.display !== 'granted') return;
    }
    const channelId = await ensureTimerChannel(LN);
    const c = sleepNotifContent(entry, childName);
    await LN.schedule({
      notifications: [{
        id: SLEEP_NOTIF_ID,
        title: c.title,
        body: c.body,
        ongoing: true,
        autoCancel: false,
        actionTypeId: 'OMNIBABY_SOMMEIL',
        extra: { kind: 'sommeil', entryId: entry.id, obSleep: c.obSleep, nativeActionTypeId: 'OMNIBABY_NONE' },
        smallIcon: 'ic_stat_omnibaby',
        iconColor: '#C96F4A',
        ...(channelId ? { channelId } : {}),
      }],
    });
    shownFor = key;
  } catch (e) {
    reportNotifFailure('sommeil', e);
  }
}

// entry : sommeil en cours à afficher, ou null pour retirer la notification
export function syncSleepNotif(entry, childName) {
  queue = queue.then(() => doSync(entry, childName)).catch(() => {});
  return queue;
}

// Réveils notés par Android pendant que l'appli était fermée :
// [{ entryId, wakeAt }] ; le fichier est vidé après lecture.
export async function readNativeWakes() {
  if (!window.Capacitor?.isNativePlatform?.()) return [];
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    let raw;
    try {
      raw = (await Filesystem.readFile({ path: WAKE_FILE, directory: Directory.Data, encoding: Encoding.UTF8 })).data;
    } catch (e) {
      return []; // pas de fichier : aucun réveil en attente
    }
    await Filesystem.deleteFile({ path: WAKE_FILE, directory: Directory.Data }).catch(() => {});
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list.filter((w) => w && w.entryId != null && w.wakeAt > 0) : [];
  } catch (e) {
    console.warn('[Sommeil] réveils Android', e);
    return [];
  }
}
