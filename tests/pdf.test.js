import { describe, it, expect } from 'vitest';
import { computeWeek, computeGrowth, pdfSafe } from '../src/pdf.js';

const child = { id: 'c1', nom: 'Léa', sexe: 'fille', birthdate: '2026-06-16' };
const now = new Date(2026, 9, 19, 20, 0);
const at = (daysBack, h) => new Date(2026, 9, 19 - daysBack, h, 0).toISOString();

describe('PDF : tableau 7 jours', () => {
  it('compte, additionne et moyenne sur 7 jours', () => {
    const store = {
      entries: [
        { childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 120, date: at(0, 9) },
        { childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 150, date: at(2, 9) },
        { childId: 'c1', type: 'biberon', mode: 'sein', duree: 20, date: at(1, 9) },
        { childId: 'c1', type: 'couche', contenu: 'pipi', date: at(0, 10) },
        { childId: 'c1', type: 'sommeil', debut: at(3, 13), date: at(3, 13), duree: 90, enCours: false },
        { childId: 'c1', type: 'sommeil', debut: at(0, 19), date: at(0, 19), enCours: true },
        { childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 999, date: at(10, 9) }, // hors période
        { childId: 'autre', type: 'biberon', mode: 'biberon', quantite: 999, date: at(0, 9) }, // autre enfant
      ],
      temperatures: [{ childId: 'c1', valeur: 37.8, date: at(1, 8) }],
    };
    const { rows } = computeWeek(store, child, now);
    const byLabel = Object.fromEntries(rows.map((r) => [r[0], r]));
    expect(byLabel['Biberons et tétées'][1]).toBe('3');
    expect(byLabel['Lait au biberon'][1]).toBe('270 ml');
    expect(byLabel['Changes'][1]).toBe('1');
    expect(byLabel['Sommeil (nuits + siestes saisies)'][1]).toBe('1 h 30');
    expect(byLabel['Températures relevées'][2]).toBe('max 37,8 °C');
  });

  it('aucune ligne sans données', () => {
    expect(computeWeek({ entries: [] }, child, now).rows).toEqual([]);
  });
});

describe('PDF : croissance', () => {
  it('dernière mesure, évolution et percentile OMS', () => {
    const store = {
      mesures: [
        { childId: 'c1', type: 'poids', valeur: 3.2, date: '2026-06-16' },
        { childId: 'c1', type: 'poids', valeur: 6.4, date: '2026-10-16' },
      ],
    };
    const [poids] = computeGrowth(store, child);
    expect(poids.value).toBe('6,40 kg');
    expect(poids.evolution).toBe('+3,20 kg');
    expect(poids.pct).toBeGreaterThan(40);
    expect(poids.pct).toBeLessThan(80);
  });
});

describe('PDF : texte', () => {
  it('retire les emoji, garde les accents', () => {
    expect(pdfSafe('🥜 arachide — é°')).toBe(' arachide — é°');
  });
});
