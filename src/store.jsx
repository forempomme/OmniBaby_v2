import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const STORE_KEY = 'omnibaby_store_v1';
const SESSION_KEY = 'omnibaby_session_v1';

// ----------------------------------------------------------------------
// Default / empty store shape
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
      dark: null, // null = auto (21h-7h), true/false = manuel
      notifs: { biberon: true, couche: true, sommeil: true, vaccin: true, medoc: true, activite: false },
      lastExportDate: null,
    },
  };
}

// ----------------------------------------------------------------------
// Migration: handle older single-child format & missing fields
// ----------------------------------------------------------------------
export function migrateStore(raw) {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;

  const store = { ...base, ...raw };

  // Old single-child format -> children[]
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

  // Ensure all array tables exist
  for (const key of ['entries', 'mesures', 'vaccins', 'sommeils', 'medicaments', 'temperatures', 'aliments', 'journal', 'rappels', 'users', 'children']) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  if (typeof store.etapesDiv !== 'object' || store.etapesDiv === null) store.etapesDiv = {};

  // Ensure settings shape & merge new defaults without losing user prefs
  store.settings = {
    ...base.settings,
    ...(store.settings || {}),
    notifs: { ...base.settings.notifs, ...((store.settings && store.settings.notifs) || {}) },
  };

  // Ensure children have all expected fields (forward-compat)
  store.children = store.children.map((c) => ({
    id: c.id,
    nom: c.nom || 'Bébé',
    emoji: c.emoji || '👶',
    sexe: c.sexe || 'fille',
    birthdate: c.birthdate || '',
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

  // Compute nextId if missing (max of all existing ids + 1)
  if (!store.nextId) {
    let max = 0;
    const tables = ['entries', 'mesures', 'vaccins', 'sommeils', 'medicaments', 'temperatures', 'aliments', 'journal', 'rappels', 'children'];
    for (const t of tables) {
      for (const item of store[t]) {
        if (item && typeof item.id === 'number' && item.id > max) max = item.id;
      }
    }
    store.nextId = max + 1;
  }

  return store;
}

// ----------------------------------------------------------------------
// Persistence helpers
// ----------------------------------------------------------------------
export function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    return migrateStore(JSON.parse(raw));
  } catch (e) {
    console.error('Erreur de lecture du store', e);
    return emptyStore();
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Erreur de sauvegarde du store', e);
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function saveSession(session) {
  try {
    if (session === null) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch (e) {
    console.error('Erreur de sauvegarde de la session', e);
  }
}

// ----------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------
const StoreContext = createContext(null);

export function StoreProvider({ children: reactChildren }) {
  const [store, setStoreState] = useState(() => loadStore());
  const [session, setSessionState] = useState(() => loadSession());
  const storeRef = useRef(store);
  storeRef.current = store;

  // Persist on every change
  useEffect(() => {
    saveStore(store);
  }, [store]);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  // ---- Generic mutation helper ----
  const update = useCallback((fn) => {
    setStoreState((prev) => {
      const draft = JSON.parse(JSON.stringify(prev));
      const result = fn(draft);
      return result || draft;
    });
  }, []);

  const nextId = useCallback(() => {
    let id;
    setStoreState((prev) => {
      id = prev.nextId || 1;
      return { ...prev, nextId: id + 1 };
    });
    return id;
  }, []);

  // ---- Replace whole store (import) ----
  const replaceStore = useCallback((newStore) => {
    setStoreState(migrateStore(newStore));
  }, []);

  const resetStore = useCallback(() => {
    setStoreState(emptyStore());
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
  };

  return <StoreContext.Provider value={value}>{reactChildren}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans un StoreProvider');
  return ctx;
}

// ----------------------------------------------------------------------
// Generic id generator (timestamp + random, used for new records)
// ----------------------------------------------------------------------
export function genId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// ----------------------------------------------------------------------
// Active child helper
// ----------------------------------------------------------------------
export function getActiveChild(store) {
  if (!store.activeChildId) return null;
  return store.children.find((c) => c.id === store.activeChildId) || null;
}

// Returns entries belonging to active child OR without childId (legacy)
export function filterByActiveChild(list, activeChildId) {
  return list.filter((item) => item.childId == null || item.childId === activeChildId);
}

// ----------------------------------------------------------------------
// Age helper
// ----------------------------------------------------------------------
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
  const b = new Date(birthdate);
  const now = new Date();
  return Math.max(0, Math.floor((now - b) / (1000 * 60 * 60 * 24)));
}

export function formatAge(birthdate) {
  if (!birthdate) return '—';
  const days = ageInDays(birthdate);
  const months = ageInMonths(birthdate);
  if (days < 31) return `${days} jour${days > 1 ? 's' : ''}`;
  if (months < 24) {
    const remDays = days - Math.floor(months * 30.44);
    return `${months} mois`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years} an${years > 1 ? 's' : ''} ${remMonths} mois` : `${years} an${years > 1 ? 's' : ''}`;
}
