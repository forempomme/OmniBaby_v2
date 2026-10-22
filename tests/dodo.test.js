import { describe, it, expect } from 'vitest';
import { sleepToday, weeklySleep } from '../src/Dodo.jsx';

const now = new Date(2026, 9, 22, 15, 0);
const at = (daysBack, h, m = 0) => new Date(2026, 9, 22 - daysBack, h, m).toISOString();

const entries = [
  { type: 'sommeil', sousType: 'sieste', debut: at(0, 13, 5), date: at(0, 13, 5), enCours: true },
  { type: 'sommeil', sousType: 'sieste', debut: at(0, 9, 40), date: at(0, 9, 40), duree: 75 },
  { type: 'sommeil', sousType: 'nuit', debut: at(0, 0, 30), date: at(0, 0, 30), duree: 390 },
  { type: 'sommeil', sousType: 'nuit', debut: at(1, 20, 0), date: at(1, 20, 0), duree: 600 },
  { type: 'sommeil', sousType: 'sieste', debut: at(3, 14, 0), date: at(3, 14, 0), duree: 120 },
];

describe('Dodo', () => {
  it("total du jour : sommeils terminés commencés aujourd'hui", () => {
    expect(sleepToday(entries, now)).toEqual({ minutes: 465, nuits: 1, siestes: 1 });
  });
  it('7 jours : jour du début, moyenne hors aujourd’hui et jours vides', () => {
    const { days, avg } = weeklySleep(entries, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ today: true, minutes: 465 });
    expect(days[5].minutes).toBe(600);
    expect(days[3].minutes).toBe(120);
    expect(avg).toBe(360);
  });
});
