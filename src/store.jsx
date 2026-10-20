import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  auth, db,
  onAuthStateChanged, signOut,
  doc, collection, getDoc, setDoc, deleteDoc, onSnapshot,
  serverTimestamp,
} from './firebase.js';

const STORE_KEY = 'omnibaby_store_v3';
const SESSION_KEY = 'omnibaby_session_v3';

// ----------------------------------------------------------------------
// Tables synchronisées avec Firestore
// ----------------------------------------------------------------------
export const SYNC_TABLES = [
  'entries', 'mesures', 'vaccins', 'medicaments',  // sommeils fusionné dans entries v3.3.0
  'temperatures', 'aliments', 'journal', 'rappels',
];

// Réglages propres à chaque téléphone : jamais envoyés à l'autre parent,
// jamais écrasés par lui (thème, mode nuit, biométrie, notifications…).
const LOCAL_SETTING_KEYS = [
  'dark', 'darkHour', 'nightMode', 'nightHour', 'nightSnoozeUntil',
  'journalCompact', 'biometrie', 'swipeToDelete', 'confirmDelete',
  'notifs', 'lastExportDate',
];

export function sharedSettings(settings) {
  const out = {};
  for (const [k, v] of Object.entries(settings || {})) {
    if (!LOCAL_SETTING_KEYS.includes(k)) out[k] = v;
  }
  return out;
}

// ----------------------------------------------------------------------
// Store local vide
// ----------------------------------------------------------------------
export function emptyStore() {
  return {
    children: [],
    activeChildId: null,
    users: [],
    members: [], // membres Firebase de la famille (lecture seule, depuis Firestore)
    entries: [],
    mesures: [],
    vaccins: [],
    sommeils: [],
    medicaments: [],
    temperatures: [],
    aliments: [],
    journal: [],
    rappels: [],
    etapesDiv: {},
    nextId: 1,
    settings: {
      dark: null,
      journalCompact: false,
      biometrie: true,
      notifs: {
        biberon: true, couche: true, sommeil: true,
        vaccin: true, medoc: true, activite: false,
      },
      lastExportDate: null,
    },
    // Infos famille Firebase
    familyId: null,
    familyCode: null, // code à 6 chiffres pour rejoindre la famille
  };
}

// ----------------------------------------------------------------------
// Migration localStorage
// ----------------------------------------------------------------------
export function migrateStore(raw) {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;
  const store = { ...base, ...raw };

  // Ancien format mono-enfant
  if (!Array.isArray(store.children) || store.children.length === 0) {
    if (raw.child && typeof raw.child === 'object') {
      const legacyChild = {
        id: raw.child.id || Date.now(),
        nom: raw.child.nom || 'Bébé',
        emoji: raw.child.emoji || '👶',
        sexe: raw.child.sexe || 'fille',
        birthdate: raw.child.birthdate || '',
        alimentation: raw.child.alimentation || 'allaitement',
        typeLait: raw.child.typeLait || 'maternel',
        allergies: raw.child.allergies || '',
        groupeSanguin: raw.child.groupeSanguin || '',
        medecinNom: raw.child.medecinNom || '',
        medecinTel: raw.child.medecinTel || '',
        contactUrgenceNom: raw.child.contactUrgenceNom || '',
        contactUrgenceTel: raw.child.contactUrgenceTel || '',
        notesMedicales: raw.child.notesMedicales || '',
        lastVitDDate: raw.child.lastVitDDate || null,
      };
      store.children = [legacyChild];
      store.activeChildId = legacyChild.id;
    } else {
      store.children = [];
      store.activeChildId = null;
    }
  }

  if (store.activeChildId == null && store.children.length > 0) {
    store.activeChildId = store.children[0].id;
  }

  for (const key of SYNC_TABLES.concat(['users', 'children', 'members'])) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  if (typeof store.etapesDiv !== 'object' || store.etapesDiv === null) {
    store.etapesDiv = {};
  }

  // Migration sommeils → entries (v3.3.0)
  if (Array.isArray(store.sommeils) && store.sommeils.length > 0) {
    const existingIds = new Set((store.entries || []).map(e => String(e.id)));
    const toMigrate = store.sommeils.filter(s => !existingIds.has(String(s.id)));
    if (toMigrate.length > 0) {
      store.entries = (store.entries || []).concat(toMigrate.map(s => ({
        ...s,
        type: 'sommeil',
        sousType: s.type || 'sieste',
        date: s.debut,
        enCours: !s.fin,
      })));
    }
    store.sommeils = [];
  }

  store.settings = {
    ...base.settings,
    ...(store.settings || {}),
    notifs: {
      ...base.settings.notifs,
      ...((store.settings && store.settings.notifs) || {}),
    },
  };

  store.children = store.children.map((c) => ({
    id: c.id, nom: c.nom || 'Bébé', emoji: c.emoji || '👶',
    sexe: c.sexe || 'fille', birthdate: c.birthdate || '',
    alimentation: c.alimentation || 'allaitement',
    typeLait: c.typeLait || 'maternel',
    allergies: c.allergies || '',
    groupeSanguin: c.groupeSanguin || '',
    medecinNom: c.medecinNom || '',
    medecinTel: c.medecinTel || '',
    contactUrgenceNom: c.contactUrgenceNom || '',
    contactUrgenceTel: c.contactUrgenceTel || '',
    notesMedicales: c.notesMedicales || '',
    lastVitDDate: c.lastVitDDate || null,
  }));

  if (!store.nextId) {
    let max = 0;
    for (const t of SYNC_TABLES.concat(['children'])) {
      for (const item of store[t]) {
        if (item && typeof item.id === 'number' && item.id > max) max = item.id;
      }
    }
    store.nextId = max + 1;
  }

  return store;
}

// ----------------------------------------------------------------------
// Persistance locale
// ----------------------------------------------------------------------
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    return migrateStore(JSON.parse(raw));
  } catch (e) {
    return emptyStore();
  }
}
function saveStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveSession(s) {
  try {
    if (s === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch (e) {}
}

// ----------------------------------------------------------------------
// Helpers Firestore
// ----------------------------------------------------------------------
function familyRef(familyId) {
  return doc(db, 'families', familyId);
}
function familyDocRef(familyId, colName, docId) {
  return doc(db, 'families', familyId, colName, String(docId));
}
export function familyCodeRef(code) {
  return doc(db, 'familyCodes', String(code));
}

// Code famille à 6 chiffres
export function generateFamilyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function emitSyncError(table, e) {
  console.error(`[Firebase] ${table}:`, e);
  window.dispatchEvent(new CustomEvent('firebase-sync-error', { detail: { table, error: e?.message || String(e) } }));
}

// Firestore refuse les valeurs undefined : on les retire
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out;
}

async function pushItem(familyId, table, item) {
  if (!familyId || !item?.id) return;
  try {
    await setDoc(familyDocRef(familyId, table, item.id), { ...clean(item), _updatedAt: serverTimestamp() });
  } catch (e) { emitSyncError(table, e); }
}

async function deleteItem(familyId, table, id) {
  if (!familyId || !id) return;
  try {
    await deleteDoc(familyDocRef(familyId, table, id));
  } catch (e) { emitSyncError(table, e); }
}

// Métadonnées famille partagées (enfants, réglages partagés, étapes diversification)
async function pushFamilyMeta(familyId, store) {
  if (!familyId) return;
  try {
    await setDoc(familyRef(familyId), {
      children: store.children,
      activeChildId: store.activeChildId,
      settings: sharedSettings(store.settings),
      etapesDiv: store.etapesDiv,
      _updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) { emitSyncError('famille', e); }
}

// Pousse vers Firestore la différence entre deux états du store
function pushDiff(prev, next, { deletions = true } = {}) {
  const familyId = next.familyId;
  if (!familyId || !auth.currentUser) return;
  for (const table of SYNC_TABLES) {
    const prevById = new Map((prev[table] || []).map((i) => [i.id, i]));
    const nextIds = new Set();
    for (const item of next[table] || []) {
      nextIds.add(item.id);
      const before = prevById.get(item.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) pushItem(familyId, table, item);
    }
    if (deletions) {
      for (const id of prevById.keys()) if (!nextIds.has(id)) deleteItem(familyId, table, id);
    }
  }
  const metaChanged =
    JSON.stringify(prev.children) !== JSON.stringify(next.children) ||
    JSON.stringify(sharedSettings(prev.settings)) !== JSON.stringify(sharedSettings(next.settings)) ||
    JSON.stringify(prev.etapesDiv) !== JSON.stringify(next.etapesDiv);
  if (metaChanged) pushFamilyMeta(familyId, next);
}

// ----------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------
const StoreContext = createContext(null);

export function StoreProvider({ children: reactChildren }) {
  const [store, setStoreState] = useState(() => loadStore());
  const [session, setSessionState] = useState(() => loadSession());
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('offline'); // 'offline'|'syncing'|'synced'|'error'
  // storeRef = source de vérité synchrone : deux update() successifs dans le
  // même événement voient chacun l'état produit par le précédent.
  const storeRef = useRef(store);
  const unsubscribers = useRef([]);
  const codeChecked = useRef(false);

  const commit = useCallback((producer) => {
    const next = producer(storeRef.current);
    if (next === storeRef.current) return;
    storeRef.current = next;
    setStoreState(next);
  }, []);

  // ── Persistance locale ────────────────────────────────────────────
  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => { saveSession(session); }, [session]);

  // ── Auth Firebase ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) startSync(user);
      else { stopSync(); setSyncStatus('offline'); }
    });
    return () => { unsub(); stopSync(); };
  }, []);

  // Garantit que le code d'invitation de la famille est rejoignable
  // (familles créées avant la v3.8.0 : pas encore de document familyCodes)
  async function ensureFamilyCode(familyId, code) {
    if (codeChecked.current || !code) return;
    codeChecked.current = true;
    try {
      const snap = await getDoc(familyCodeRef(code));
      if (!snap.exists()) await setDoc(familyCodeRef(code), { familyId });
    } catch (e) { console.warn('[Firebase] familyCodes:', e?.message); }
  }

  function startSync(user) {
    const familyId = storeRef.current.familyId;
    if (!familyId) { setSyncStatus('offline'); return; }

    setSyncStatus('syncing');
    stopSync();

    // Présence : « vu il y a X min » dans Réglages → Famille
    setDoc(doc(db, 'families', familyId, 'members', user.uid), { lastSeenAt: serverTimestamp() }, { merge: true })
      .catch(() => {});

    // 1. Métadonnées famille
    const unsubMeta = onSnapshot(familyRef(familyId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      commit((prev) => {
        const children = data.children || prev.children;
        const activeOk = children.some((c) => c.id === prev.activeChildId);
        return {
          ...prev,
          children,
          activeChildId: activeOk ? prev.activeChildId : (data.activeChildId || children[0]?.id || null),
          // Les réglages locaux de ce téléphone ne sont jamais écrasés
          settings: { ...prev.settings, ...sharedSettings(data.settings) },
          etapesDiv: data.etapesDiv || prev.etapesDiv,
          familyCode: data.familyCode || prev.familyCode,
        };
      });
      ensureFamilyCode(familyId, data.familyCode);
      setSyncStatus('synced');
    }, (e) => { console.error('[Firebase] meta listener:', e); setSyncStatus('error'); });
    unsubscribers.current.push(unsubMeta);

    // 2. Membres (affichage uniquement)
    const unsubMembers = onSnapshot(collection(db, 'families', familyId, 'members'), (snap) => {
      const members = snap.docs.map((d) => {
        const m = d.data();
        return {
          uid: d.id,
          displayName: m.displayName || '',
          email: m.email || '',
          role: m.role || 'editeur',
          lastSeenAt: m.lastSeenAt?.toMillis ? m.lastSeenAt.toMillis() : null,
        };
      });
      commit((prev) => ({ ...prev, members }));
    }, (e) => console.warn('[Firebase] members listener:', e?.message));
    unsubscribers.current.push(unsubMembers);

    // 3. Tables de données
    for (const table of SYNC_TABLES) {
      const unsub = onSnapshot(
        collection(db, 'families', familyId, table),
        (snap) => {
          const items = snap.docs.map((d) => {
            const { _updatedAt, ...rest } = d.data();
            return rest;
          });
          commit((prev) => ({ ...prev, [table]: items }));
          setSyncStatus('synced');
        },
        (e) => { console.error(`[Firebase] ${table} listener:`, e); setSyncStatus('error'); }
      );
      unsubscribers.current.push(unsub);
    }
  }

  function stopSync() {
    unsubscribers.current.forEach((u) => u());
    unsubscribers.current = [];
  }

  // ── Relancer la sync si familyId change ───────────────────────────
  useEffect(() => {
    codeChecked.current = false;
    if (auth.currentUser && store.familyId) startSync(auth.currentUser);
  }, [store.familyId]);

  // ── Mutation ──────────────────────────────────────────────────────
  // Calcule l'état suivant à partir de storeRef (pas dans un updater React,
  // qui peut être rejoué en StrictMode → doubles écritures Firestore), puis
  // pousse uniquement les différences.
  const update = useCallback((fn) => {
    const prev = storeRef.current;
    const draft = JSON.parse(JSON.stringify(prev));
    const next = fn(draft) || draft;
    storeRef.current = next;
    setStoreState(next);
    pushDiff(prev, next);
  }, []);

  const nextId = useCallback(() => genId(), []);

  // Import JSON : remplace les données locales ; si une famille est
  // connectée, ajoute/modifie dans le cloud sans rien y supprimer.
  const replaceStore = useCallback((newStore) => {
    const prev = storeRef.current;
    const migrated = migrateStore(newStore);
    const next = {
      ...migrated,
      familyId: prev.familyId,
      familyCode: prev.familyCode,
      members: prev.members,
      users: migrated.users.length ? migrated.users : prev.users,
    };
    storeRef.current = next;
    setStoreState(next);
    pushDiff(prev, next, { deletions: false });
  }, []);

  const resetStore = useCallback(() => {
    stopSync();
    const next = emptyStore();
    storeRef.current = next;
    setStoreState(next);
    setSessionState(null);
  }, []);

  const logout = useCallback(async () => {
    stopSync();
    await signOut(auth);
    setFirebaseUser(null);
    setSyncStatus('offline');
    setSessionState(null);
  }, []);

  const value = {
    store,
    update,
    nextId,
    replaceStore,
    resetStore,
    session,
    setSession: setSessionState,
    firebaseUser,
    syncStatus,
    logout,
  };

  return (
    <StoreContext.Provider value={value}>{reactChildren}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans un StoreProvider');
  return ctx;
}

// ----------------------------------------------------------------------
// ID UUID v4 — évite les collisions en multi-utilisateurs simultanés
// ----------------------------------------------------------------------
export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Auteur d'une saisie (affiché « par Julien »)
export function authorFields(firebaseUser, prefix = 'created') {
  return {
    [`${prefix}By`]: firebaseUser?.uid || null,
    [`${prefix}ByName`]: firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || null,
    [`${prefix}At`]: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------
// Helpers exportés
// ----------------------------------------------------------------------
export function getActiveChild(store) {
  if (!store.activeChildId) return null;
  return store.children.find((c) => c.id === store.activeChildId) || null;
}

export function filterByActiveChild(list, activeChildId) {
  return (list || []).filter((i) => i.childId == null || i.childId === activeChildId);
}

export function ageInMonths(birthdate) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  return Math.max(0, months);
}

export function ageInDays(birthdate) {
  if (!birthdate) return null;
  return Math.max(0, Math.floor((new Date() - new Date(birthdate)) / (1000 * 60 * 60 * 24)));
}

export function formatAge(birthdate) {
  if (!birthdate) return '—';
  const days = ageInDays(birthdate);
  const months = ageInMonths(birthdate);
  if (days < 31) return `${days} jour${days > 1 ? 's' : ''}`;
  if (months < 24) return `${months} mois`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0
    ? `${years} an${years > 1 ? 's' : ''} ${rem} mois`
    : `${years} an${years > 1 ? 's' : ''}`;
}
