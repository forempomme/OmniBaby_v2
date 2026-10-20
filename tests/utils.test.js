import { describe, it, expect } from 'vitest';
import {
  toISODate, toTime, toLocalDT, sortByDateDesc, formatElapsed, groupByDay, dayLabel, daysAgo, isToday,
} from '../src/utils.jsx';
import { entryTitle, entryDetail, entryAuthor, entrySearchText, formatMinutes } from '../src/journal/entryTypes.js';

describe('toTime / tri des dates', () => {
  it('compare correctement une date locale et une date ISO UTC', () => {
    // Même instant exprimé de deux façons : le tri par chaîne échouait
    const iso = new Date(2026, 9, 19, 14, 5).toISOString();
    const local = '2026-10-19T14:05';
    expect(toTime(iso)).toBe(toTime(local));
  });

  it('trie du plus récent au plus ancien, formats mélangés', () => {
    const a = { id: 'a', date: '2026-10-19T08:00' };
    const b = { id: 'b', date: new Date(2026, 9, 19, 9, 0).toISOString() };
    const c = { id: 'c', date: '2026-10-19T10:00' };
    expect(sortByDateDesc([a, b, c]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('renvoie 0 pour une date absente ou invalide', () => {
    expect(toTime(null)).toBe(0);
    expect(toTime('pas une date')).toBe(0);
  });
});

describe('toLocalDT', () => {
  it('convertit une date ISO en valeur datetime-local', () => {
    const d = new Date(2026, 0, 5, 7, 9);
    expect(toLocalDT(d.toISOString())).toBe('2026-01-05T07:09');
  });
  it('renvoie une chaîne vide si rien', () => {
    expect(toLocalDT('')).toBe('');
  });
});

describe('formatElapsed', () => {
  it('formate minutes, heures et jours', () => {
    expect(formatElapsed(20 * 1000)).toBe('< 1 min');
    expect(formatElapsed(38 * 60000)).toBe('38 min');
    expect(formatElapsed((2 * 60 + 15) * 60000)).toBe('2 h 15');
    expect(formatElapsed((27 * 60) * 60000)).toBe('1 j 3 h');
  });
});

describe('groupByDay', () => {
  it('groupe par jour local et trie du plus récent au plus ancien', () => {
    const items = [
      { date: '2024-01-03T10:00', val: 'a' },
      { date: '2024-01-03T18:00', val: 'b' },
      { date: '2024-01-01T09:00', val: 'c' },
    ];
    const groups = groupByDay(items, 'date');
    expect(groups.map((g) => g[0])).toEqual(['2024-01-03', '2024-01-01']);
    expect(groups[0][1]).toHaveLength(2);
  });
});

describe('dayLabel', () => {
  it("renvoie Aujourd'hui, Hier puis un jour relatif", () => {
    expect(dayLabel(toISODate())).toBe("Aujourd'hui");
    expect(dayLabel(toISODate(daysAgo(1)))).toBe('Hier');
    expect(dayLabel(toISODate(daysAgo(3)))).toMatch(/il y a 3 jours/);
  });
  it('isToday accepte une date ISO', () => {
    expect(isToday(new Date().toISOString())).toBe(true);
  });
});

describe('Journal : libellés des entrées', () => {
  it('biberon et tétée', () => {
    expect(entryTitle({ type: 'biberon', mode: 'biberon', quantite: 120 })).toBe('Biberon · 120 ml');
    expect(entryTitle({ type: 'biberon', mode: 'sein', cote: 'droit' })).toBe('Tétée · droit');
    expect(entryDetail({ type: 'biberon', mode: 'sein', duree: 15, vitamineD: true })).toBe('15 min · vitamine D');
  });
  it('change et sommeil', () => {
    expect(entryTitle({ type: 'couche', contenu: 'selles' })).toBe('Change · selles');
    expect(entryTitle({ type: 'sommeil', sousType: 'sieste', enCours: true })).toBe('Sieste · en cours');
    expect(entryTitle({ type: 'sommeil', sousType: 'nuit', duree: 570 })).toBe('Nuit · 9 h 30');
  });
  it('auteur et recherche', () => {
    expect(entryAuthor({ createdByName: 'Julien' })).toBe('par Julien');
    expect(entryAuthor({ createdByName: 'Julien', updatedByName: 'Marie' })).toBe('modifié par Marie');
    expect(entrySearchText({ type: 'couche', contenu: 'selles', createdByName: 'Marie' })).toContain('marie');
  });
  it('formatMinutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(75)).toBe('1 h 15');
  });
});
