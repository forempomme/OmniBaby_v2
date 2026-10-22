import { describe, it, expect } from 'vitest';
import {
  childDataCounts, totalCount, removeChild, removeChildData, findOrphans, removeOrphans,
  generateSampleData, birthdateForAge, tableLabel,
} from '../src/children.js';

const store = () => ({
  children: [{ id: 'lea', nom: 'Léa' }, { id: 'test', nom: 'Bébé test', isTest: true }],
  activeChildId: 'test',
  entries: [
    { id: 'e1', childId: 'lea', date: '2026-10-01T10:00' },
    { id: 'e2', childId: 'test', date: '2026-10-02T10:00' },
    { id: 'e3', childId: 'test', date: '2026-10-03T10:00' },
    { id: 'e4', childId: 'fantome', date: '2026-09-12T10:00' },
    { id: 'e5', childId: 'fantome', date: '2026-09-30T10:00' },
    { id: 'e6', date: '2025-01-01T10:00' }, // ancienne entrée sans enfant : jamais orpheline
  ],
  mesures: [{ id: 'm1', childId: 'test', date: '2026-10-01' }, { id: 'm2', childId: 'fantome', date: '2026-09-20' }],
  vaccins: [], medicaments: [], temperatures: [], aliments: [], journal: [],
  rappels: [{ id: 'r1', childId: 'test', date: '2026-11-01T10:00' }, { id: 'r2', date: '2026-11-01T10:00' }],
  settings: { dev_test: { a: 1 }, dev_lea: { b: 1 } },
});

describe('Données par enfant', () => {
  it('compte les données rattachées', () => {
    const c = childDataCounts(store(), 'test');
    expect(c).toEqual({ entries: 2, mesures: 1, rappels: 1 });
    expect(totalCount(c)).toBe(4);
    expect(tableLabel('entries', 2)).toBe('2 entrées du journal');
    expect(tableLabel('mesures', 1)).toBe('1 mesure');
  });

  it('suppression complète : profil + données + jalons, Léa intacte, enfant actif repassé sur Léa', () => {
    const d = store();
    const notif = removeChild(d, 'test');
    expect(d.children.map((c) => c.id)).toEqual(['lea']);
    expect(d.entries.map((e) => e.id)).toEqual(['e1', 'e4', 'e5', 'e6']);
    expect(d.mesures.map((e) => e.id)).toEqual(['m2']);
    expect(d.rappels.map((e) => e.id)).toEqual(['r2']);
    expect(d.settings.dev_test).toBe(undefined);
    expect(d.settings.dev_lea).toEqual({ b: 1 });
    expect(d.activeChildId).toBe('lea');
    expect(notif).toEqual(['r1']);
  });

  it('vider garde le profil', () => {
    const d = store();
    removeChildData(d, 'test');
    expect(d.children).toHaveLength(2);
    expect(childDataCounts(d, 'test')).toEqual({});
  });
});

describe('Données orphelines', () => {
  it('trouve uniquement les données d’un enfant inexistant', () => {
    const groups = findOrphans(store());
    expect(groups).toHaveLength(1);
    expect(groups[0].childId).toBe('fantome');
    expect(groups[0].counts).toEqual({ entries: 2, mesures: 1 });
    const d = store();
    removeOrphans(d, groups);
    expect(d.entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3', 'e6']);
    expect(d.mesures.map((e) => e.id)).toEqual(['m1']);
  });
});

describe('Profil test', () => {
  it('âge simulé', () => {
    const now = new Date(2026, 9, 21, 12);
    expect(birthdateForAge(4, now)).toBe('2026-06-21');
    expect(birthdateForAge(0, now)).toBe('2026-10-18');
  });

  it('données d’exemple : 7 jours, rattachées au profil test, dans le passé', () => {
    const now = new Date(2026, 9, 21, 22, 0);
    const child = { id: 'test', sexe: 'fille', alimentation: 'mixte', birthdate: '2026-06-21' };
    const { entries, mesures } = generateSampleData(child, 4, now);
    expect(entries.length).toBeGreaterThan(55);
    expect(entries.length).toBeLessThan(80);
    expect(entries.every((e) => e.childId === 'test' && e.sample === true)).toBe(true);
    expect(entries.every((e) => new Date(e.date) <= now)).toBe(true);
    expect(mesures).toHaveLength(6);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
});
