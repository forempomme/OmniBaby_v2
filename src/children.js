// ----------------------------------------------------------------------
// Profils enfants : données rattachées, suppression complète, profil test,
// données orphelines (rattachées à un enfant qui n'existe plus).
// ----------------------------------------------------------------------
import { SYNC_TABLES, genId } from './store.jsx';
import { WEIGHT_LMS, HEIGHT_LMS, getLMS } from './data/who-growth.js';
import { toISODate } from './utils.jsx';

const TABLE_LABELS = {
  entries: ['entrée du journal', 'entrées du journal'],
  mesures: ['mesure', 'mesures'],
  vaccins: ['vaccin coché', 'vaccins cochés'],
  medicaments: ['médicament', 'médicaments'],
  temperatures: ['température', 'températures'],
  aliments: ['aliment', 'aliments'],
  journal: ['souvenir', 'souvenirs'],
  rappels: ['rappel', 'rappels'],
};

export function tableLabel(table, n) {
  const l = TABLE_LABELS[table] || [table, table];
  return `${n} ${n > 1 ? l[1] : l[0]}`;
}

// Nombre de données par table pour un enfant : { entries: 42, mesures: 3, … }
export function childDataCounts(store, childId) {
  const counts = {};
  for (const t of SYNC_TABLES) {
    const n = (store[t] || []).filter((i) => i.childId === childId).length;
    if (n) counts[t] = n;
  }
  return counts;
}

export function totalCount(counts) {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

// Retire du brouillon toutes les données d'un enfant (le diff du store les
// supprime ensuite dans Firestore). Renvoie les ids des rappels et
// médicaments retirés, pour annuler leurs notifications.
export function removeChildData(draft, childId) {
  const notifIds = [];
  for (const t of SYNC_TABLES) {
    const removed = (draft[t] || []).filter((i) => i.childId === childId);
    if (!removed.length) continue;
    if (t === 'rappels' || t === 'medicaments') removed.forEach((i) => notifIds.push(i.id));
    draft[t] = draft[t].filter((i) => i.childId !== childId);
  }
  if (draft.settings) delete draft.settings[`dev_${childId}`];
  return notifIds;
}

// Supprime l'enfant ET tout ce qui lui est rattaché
export function removeChild(draft, childId) {
  const notifIds = removeChildData(draft, childId);
  draft.children = draft.children.filter((c) => c.id !== childId);
  if (draft.activeChildId === childId) {
    const real = draft.children.find((c) => !c.isTest);
    draft.activeChildId = (real || draft.children[0])?.id || null;
  }
  return notifIds;
}

// ----------------------------------------------------------------------
// Données orphelines : childId renseigné mais enfant inexistant.
// Les très anciennes données sans childId ne sont PAS orphelines : l'appli
// les affiche avec l'enfant actif.
// ----------------------------------------------------------------------
export function findOrphans(store) {
  const ids = new Set((store.children || []).map((c) => c.id));
  const groups = new Map();
  for (const t of SYNC_TABLES) {
    for (const item of store[t] || []) {
      if (item.childId == null || ids.has(item.childId)) continue;
      if (!groups.has(item.childId)) groups.set(item.childId, { childId: item.childId, counts: {}, items: [], first: null, last: null });
      const g = groups.get(item.childId);
      g.counts[t] = (g.counts[t] || 0) + 1;
      g.items.push({ table: t, id: item.id });
      const d = item.debut || item.date;
      const time = d ? new Date(d).getTime() : NaN;
      if (!isNaN(time)) {
        if (g.first == null || time < g.first) g.first = time;
        if (g.last == null || time > g.last) g.last = time;
      }
    }
  }
  return [...groups.values()].sort((a, b) => (b.last || 0) - (a.last || 0));
}

export function removeOrphans(draft, groups) {
  const byTable = {};
  for (const g of groups) {
    for (const it of g.items) {
      if (!byTable[it.table]) byTable[it.table] = new Set();
      byTable[it.table].add(it.id);
    }
  }
  for (const [t, set] of Object.entries(byTable)) draft[t] = (draft[t] || []).filter((i) => !set.has(i.id));
}

// ----------------------------------------------------------------------
// Profil test
// ----------------------------------------------------------------------
export function birthdateForAge(months, now = new Date()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  if (months === 0) d.setDate(d.getDate() - 3); // « naissance » = 3 jours
  return toISODate(d);
}

// Générateur déterministe (mêmes données à chaque création)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 7 jours de données fictives cohérentes avec l'âge, marquées sample: true
export function generateSampleData(child, months, now = new Date()) {
  const r = rng(42 + months);
  const base = { childId: child.id, sample: true, createdByName: null, createdBy: null };
  const entries = [];
  const mesures = [];
  const ml = months < 1 ? 70 : months < 3 ? 120 : months < 6 ? 150 : months < 12 ? 200 : 220;
  const feedHours = months < 3 ? [2, 6, 10, 14, 18, 22] : months < 12 ? [7, 11, 15, 19] : [8, 12, 16, 19];
  const breast = child.alimentation === 'allaitement';
  const mixed = child.alimentation === 'mixte';

  const at = (dayOffset, hour, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  for (let day = 6; day >= 0; day--) {
    feedHours.forEach((h, k) => {
      const when = at(day, h, Math.floor(r() * 40));
      if (when > now) return;
      const sein = breast || (mixed && k % 2 === 0);
      entries.push(sein
        ? { ...base, id: genId(), type: 'biberon', mode: 'sein', cote: k % 2 ? 'droit' : 'gauche', duree: 10 + Math.floor(r() * 10), date: when.toISOString() }
        : { ...base, id: genId(), type: 'biberon', mode: 'biberon', quantite: ml + 10 * Math.floor(r() * 3 - 1), date: when.toISOString() });
    });
    [9, 13, 17, 21].forEach((h, k) => {
      const when = at(day, h, 10 + Math.floor(r() * 30));
      if (when > now) return;
      entries.push({ ...base, id: genId(), type: 'couche', contenu: k === 1 ? 'selles' : 'pipi', date: when.toISOString() });
    });
    // Nuit (de la veille 20 h au matin) et une sieste
    const nuitDebut = at(day + 1, 20, 30);
    const nuitDuree = months < 3 ? 360 : 600;
    const nuitFin = new Date(nuitDebut.getTime() + nuitDuree * 60000);
    if (nuitFin <= now) {
      entries.push({ ...base, id: genId(), type: 'sommeil', sousType: 'nuit', date: nuitDebut.toISOString(), debut: nuitDebut.toISOString(), fin: nuitFin.toISOString(), duree: nuitDuree, enCours: false, qualite: 'bon' });
    }
    const siesteDebut = at(day, 13, 15);
    const siesteDuree = 60 + Math.floor(r() * 4) * 15;
    const siesteFin = new Date(siesteDebut.getTime() + siesteDuree * 60000);
    if (siesteFin <= now) {
      entries.push({ ...base, id: genId(), type: 'sommeil', sousType: 'sieste', date: siesteDebut.toISOString(), debut: siesteDebut.toISOString(), fin: siesteFin.toISOString(), duree: siesteDuree, enCours: false, qualite: 'bon' });
    }
  }

  // Pesées et tailles sur la médiane OMS (P50), à la naissance, mi-parcours, aujourd'hui
  const sexe = child.sexe === 'garcon' ? 'garcon' : 'fille';
  const points = months === 0 ? [0] : [0, Math.round(months / 2), months];
  points.forEach((m) => {
    const d = new Date(child.birthdate + 'T12:00:00');
    d.setMonth(d.getMonth() + m);
    if (d > now) d.setTime(now.getTime());
    const date = toISODate(d);
    mesures.push({ ...base, id: genId(), type: 'poids', valeur: Math.round(getLMS(WEIGHT_LMS, sexe, m)[1] * 100) / 100, date });
    mesures.push({ ...base, id: genId(), type: 'taille', valeur: Math.round(getLMS(HEIGHT_LMS, sexe, m)[1] * 10) / 10, date });
  });

  return { entries, mesures };
}
