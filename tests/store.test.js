import { describe, it, expect } from 'vitest';
import { migrateStore, emptyStore, genId, formatAge, ageInMonths, ageInDays } from '../src/store.jsx';

// ----------------------------------------------------------------------
// genId
// ----------------------------------------------------------------------
describe('genId', () => {
  it('génère un ID unique', () => {
    const id1 = genId();
    const id2 = genId();
    expect(id1).not.toBe(id2);
  });

  it('retourne une string non vide', () => {
    const id = genId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('format UUID v4', () => {
    const id = genId();
    // UUID v4 : xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

// ----------------------------------------------------------------------
// migrateStore
// ----------------------------------------------------------------------
describe('migrateStore', () => {
  it('retourne un store vide si input null', () => {
    const store = migrateStore(null);
    expect(store.entries).toEqual([]);
    expect(store.children).toEqual([]);
  });

  it('conserve les données existantes', () => {
    const raw = { entries: [{ id: '1', type: 'biberon', date: '2024-01-01' }] };
    const store = migrateStore(raw);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].type).toBe('biberon');
  });

  it('migre le legacy child → children[]', () => {
    const raw = {
      child: { id: 42, nom: 'Léa', birthdate: '2024-01-01', sexe: 'fille' }
    };
    const store = migrateStore(raw);
    expect(store.children).toHaveLength(1);
    expect(store.children[0].nom).toBe('Léa');
    expect(store.activeChildId).toBe(42);
  });

  it('fusionne les settings sans écraser les valeurs utilisateur', () => {
    const raw = { settings: { dark: true, journalCompact: true } };
    const store = migrateStore(raw);
    expect(store.settings.dark).toBe(true);
    expect(store.settings.journalCompact).toBe(true);
    // Valeurs par défaut ajoutées
    expect(store.settings.notifs).toBeDefined();
  });

  it('migre sommeils → entries', () => {
    const raw = {
      sommeils: [{ id: 'sleep1', type: 'nuit', debut: '2024-01-01T22:00', fin: '2024-01-02T07:00', duree: 540 }],
      entries: [],
    };
    const store = migrateStore(raw);
    const sleepEntries = store.entries.filter(e => e.type === 'sommeil');
    expect(sleepEntries).toHaveLength(1);
    expect(sleepEntries[0].sousType).toBe('nuit');
    expect(store.sommeils).toHaveLength(0);
  });

  it('ne migre pas les sommeils déjà présents dans entries', () => {
    const raw = {
      sommeils: [{ id: 'sleep1', type: 'nuit', debut: '2024-01-01T22:00' }],
      entries: [{ id: 'sleep1', type: 'sommeil', date: '2024-01-01T22:00' }],
    };
    const store = migrateStore(raw);
    const sleepEntries = store.entries.filter(e => e.type === 'sommeil');
    expect(sleepEntries).toHaveLength(1); // pas de doublon
  });
});

// Date locale AAAA-MM-JJ (toISOString donne la date UTC : la veille entre minuit et 1-2 h)
const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ----------------------------------------------------------------------
// formatAge
// ----------------------------------------------------------------------
describe('formatAge', () => {
  it('affiche les jours pour < 1 mois', () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    expect(formatAge(localISO(d))).toBe('10 jours');
  });

  it('affiche les mois entre 1 et 24 mois', () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 8);
    const result = formatAge(localISO(d));
    expect(result).toMatch(/mois/);
  });

  it('retourne — pour une date invalide', () => {
    expect(formatAge(null)).toBe('—');
    expect(formatAge('')).toBe('—');
  });
});

// ----------------------------------------------------------------------
// ageInMonths / ageInDays
// ----------------------------------------------------------------------
describe('ageInMonths', () => {
  it('retourne null si pas de date', () => {
    expect(ageInMonths(null)).toBeNull();
    expect(ageInMonths('')).toBeNull();
  });

  // Date fixe : avant v3.15.1 le test dépendait du jour (le 31, « il y a
  // 6 mois » tombait sur le 1er du mois suivant → 5 mois)
  it('calcule correctement l\'âge en mois', () => {
    expect(ageInMonths('2026-04-15', new Date(2026, 9, 31))).toBe(6);
    expect(ageInMonths('2026-04-30', new Date(2026, 9, 29))).toBe(5);
    expect(ageInMonths('2026-04-30', new Date(2026, 9, 30))).toBe(6);
  });
});

describe('ageInDays', () => {
  it('retourne null si pas de date', () => {
    expect(ageInDays(null)).toBeNull();
  });

  it('retourne 0 pour aujourd\'hui', () => {
    const today = localISO(new Date());
    expect(ageInDays(today)).toBe(0);
  });

  it('retourne 7 pour il y a une semaine', () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    expect(ageInDays(localISO(d))).toBe(7);
  });
});
