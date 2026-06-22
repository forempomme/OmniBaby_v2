import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  auth, db,
  onAuthStateChanged, signOut,
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, writeBatch,
} from './firebase.js';

const STORE_KEY = 'omnibaby_store_v3';
const SESSION_KEY = 'omnibaby_session_v3';

// ----------------------------------------------------------------------
// Tables synchronisées avec Firestore
// ----------------------------------------------------------------------
const SYNC_TABLES = [
  'entries', 'mesures', 'vaccins', 'sommeils', 'medicaments',
  'temperatures', 'aliments', 'journal', 'rappels',
];

// ----------------------------------------------------------------------
// Store local vide
// ----------------------------------------------------------------------
export function emptyStore() {
  return {
    children: [],
    activeChildId: null,
    users: [],
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

  for (const key of SYNC_TABLES.concat(['users', 'children'])) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  if (typeof store.etapesDiv !== 'object' || store.etapesDiv === null) {
    store.etapesDiv = {};
  }

  // Migration sommeils → entries (v3.3.0)
  // Copier store.sommeils dans store.entries si pas encore fait
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
      console.log(`[Migration] ${toMigrate.length} sommeils migrés vers entries`);
    }
    store.sommeils = []; // Vider après migration
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
// Persistence locale
// ----------------------------------------------------------------------
export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    return migrateStore(JSON.parse(raw));
  } catch (e) {
    return emptyStore();
  }
}
export function saveStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
}
export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function saveSession(s) {
  try {
    if (s === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch (e) {}
}

// ----------------------------------------------------------------------
// Helpers Firestore
// ----------------------------------------------------------------------
export function familyRef(familyId) {
  return doc(db, 'families', familyId);
}
export function familyColRef(familyId, colName) {
  return collection(db, 'families', familyId, colName);
}
export function familyDocRef(familyId, colName, docId) {
  return doc(db, 'families', familyId, colName, String(docId));
}

// Générer un code famille à 6 chiffres
export function generateFamilyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// genId → voir définition UUID plus bas

// ----------------------------------------------------------------------
// Push une entrée vers Firestore (upsert)
// ----------------------------------------------------------------------
async function pushItem(familyId, table, item) {
  if (!familyId || !item?.id) return;
  try {
    await setDoc(
      familyDocRef(familyId, table, item.id),
      { ...item, _updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (e) {
    console.error(`[Firebase] pushItem ${table}:`, e);
    // Émettre un événement custom pour que l'UI puisse afficher une erreur
    window.dispatchEvent(new CustomEvent('firebase-sync-error', { detail: { table, error: e.message } }));
  }
}

// Supprimer une entrée dans Firestore
async function deleteItem(familyId, table, id) {
  if (!familyId || !id) return;
  try {
    await deleteDoc(familyDocRef(familyId, table, id));
  } catch (e) {
    console.error(`[Firebase] deleteItem ${table}:`, e);
  }
}

// Push le profil famille (children, settings, etapesDiv)
async function pushFamilyMeta(familyId, store) {
  if (!familyId) return;
  try {
    await setDoc(familyRef(familyId), {
      children: store.children,
      activeChildId: store.activeChildId,
      settings: store.settings,
      etapesDiv: store.etapesDiv,
      _updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.error('[Firebase] pushFamilyMeta:', e);
  }
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
  const storeRef = useRef(store);
  storeRef.current = store;
  const unsubscribers = useRef([]);

  // ── Persistance locale ────────────────────────────────────────────
  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => { saveSession(session); }, [session]);

  // ── Auth Firebase ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        startSync(user);
      } else {
        stopSync();
        setSyncStatus('offline');
      }
    });
    return () => unsub();
  }, []);

  // ── Listeners temps réel ──────────────────────────────────────────
  function startSync(user) {
    const familyId = storeRef.current.familyId;
    if (!familyId) { setSyncStatus('offline'); return; }

    setSyncStatus('syncing');
    stopSync();

    // 1. Listener sur les métadonnées famille (children, settings, etapesDiv)
    const unsubMeta = onSnapshot(familyRef(familyId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setStoreState((prev) => ({
        ...prev,
        children: data.children || prev.children,
        activeChildId: data.activeChildId || prev.activeChildId,
        settings: { ...prev.settings, ...(data.settings || {}) },
        etapesDiv: data.etapesDiv || prev.etapesDiv,
      }));
      setSyncStatus('synced');
    }, (e) => { console.error('[Firebase] meta listener:', e); setSyncStatus('error'); });

    unsubscribers.current.push(unsubMeta);

    // 2. Listeners sur chaque table de données
    for (const table of SYNC_TABLES) {
      const unsub = onSnapshot(
        collection(db, 'families', familyId, table),
        (snap) => {
          const items = snap.docs.map((d) => {
            const { _updatedAt, ...rest } = d.data();
            return rest;
          });
          setStoreState((prev) => ({ ...prev, [table]: items }));
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
    if (firebaseUser && store.familyId) {
      startSync(firebaseUser);
    }
  }, [store.familyId]);

  // ── Mutation helper ───────────────────────────────────────────────
  // Détecte automatiquement les ajouts/modifs/suppressions et push vers Firestore
  const update = useCallback((fn) => {
    setStoreState((prev) => {
      const draft = JSON.parse(JSON.stringify(prev));
      const result = fn(draft);
      const next = result || draft;
      const familyId = next.familyId;

      // Diff par table pour push uniquement ce qui a changé
      if (familyId) {
        for (const table of SYNC_TABLES) {
          const prevIds = new Set((prev[table] || []).map((i) => i.id));
          const nextIds = new Set((next[table] || []).map((i) => i.id));

          // Ajouts et modifications
          for (const item of next[table] || []) {
            const prevItem = (prev[table] || []).find((i) => i.id === item.id);
            if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) {
              pushItem(familyId, table, item);
            }
          }
          // Suppressions
          for (const id of prevIds) {
            if (!nextIds.has(id)) {
              deleteItem(familyId, table, id);
            }
          }
        }
        // Métadonnées (children, settings, etapesDiv, activeChildId)
        const metaChanged =
          JSON.stringify(prev.children) !== JSON.stringify(next.children) ||
          JSON.stringify(prev.settings) !== JSON.stringify(next.settings) ||
          JSON.stringify(prev.etapesDiv) !== JSON.stringify(next.etapesDiv) ||
          prev.activeChildId !== next.activeChildId;
        if (metaChanged) pushFamilyMeta(familyId, next);
      }

      return next;
    });
  }, []);

  const nextId = useCallback(() => {
    // Utilise UUID pour éviter les collisions multi-utilisateurs
    return genId();
  }, []);

  const replaceStore = useCallback((newStore) => {
    setStoreState(migrateStore(newStore));
  }, []);

  const resetStore = useCallback(() => {
    setStoreState(emptyStore());
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
    setStore: setStoreState,
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
  // Fallback pour anciens navigateurs
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ----------------------------------------------------------------------
// Helpers exportés
// ----------------------------------------------------------------------
export function getActiveChild(store) {
  if (!store.activeChildId) return null;
  return store.children.find((c) => c.id === store.activeChildId) || null;
}

export function filterByActiveChild(list, activeChildId) {
  return list.filter((i) => i.childId == null || i.childId === activeChildId);
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
