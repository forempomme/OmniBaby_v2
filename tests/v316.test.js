import { describe, it, expect } from 'vitest';
import { lifeDay, birthWeight, weightLoss, weightSummary, wetTarget, diaperDays, showFirstDays, FIRST_DAYS_MAX } from '../src/firstDays.js';
import { zScore, bandOf, linesCrossedDown, weightDrop } from '../src/growthAlert.js';
import { VITK_DOSES, vitKCase, thirdDoseDate, showVitK, vitKNotifId } from '../src/vitaminK.js';
import { durationText, summarizeEntries, absenceSummary, nightWindow, nightRecap, showNightRecapAt, ABSENCE_MIN_GAP, readLastSeen, writeLastSeen } from '../src/recap.js';
import { declarationDeadline, isHoliday, demarchesFor, demarcheStatus } from '../src/demarches.js';
import { milkFlows, stockAutonomy } from '../src/lait.js';
import { feedStats } from '../src/tools/Statistiques.jsx';
import { doseWarnings, prisesSince, lastWeight } from '../src/tools/Medicaments.jsx';
import { WEIGHT_LMS } from '../src/data/who-growth.js';

// Novembre 2026 : pas de changement d'heure dans les intervalles testés
const at = (d, h = 12, m = 0) => new Date(2026, 10, d, h, m);
const iso = (d) => d.toISOString();
const child = { id: 'c1', nom: 'Léa', sexe: 'fille', birthdate: '2026-11-02', alimentation: 'allaitement' };

describe('v3.16 · Premiers jours', () => {
  const mesures = [
    { id: 'a', childId: 'c1', type: 'poids', valeur: 3.4, date: '2026-11-02' },
    { id: 'b', childId: 'c1', type: 'poids', valeur: 3.1, date: '2026-11-05' },
    { id: 'c', childId: 'c1', type: 'poids', valeur: 3.45, date: '2026-11-14' },
  ];
  it('jour de vie : J1 = jour de la naissance', () => {
    expect(lifeDay('2026-11-02', at(2, 23))).toBe(1);
    expect(lifeDay('2026-11-02', at(6, 1))).toBe(5);
    expect(showFirstDays(child, at(10))).toBe(true);
    expect(showFirstDays(child, at(2 + FIRST_DAYS_MAX))).toBe(false);
  });
  it('poids de naissance et écart en %', () => {
    expect(birthWeight(mesures, child)).toEqual({ valeur: 3.4, date: '2026-11-02' });
    expect(weightLoss(3.4, 3.1)).toEqual({ pct: 8.8, level: 'ok' });
    expect(weightLoss(3.4, 3.08).level).toBe('watch');
    expect(weightLoss(3.4, 3.06).level).toBe('alert');
    const w = weightSummary(mesures.slice(0, 2), child, at(6));
    expect(w.last).toMatchObject({ valeur: 3.1, day: 4, pct: 8.8, level: 'ok' });
    expect(w.backOn).toBeNull();
  });
  it('retour au poids de naissance, ou retard après 3 semaines', () => {
    expect(weightSummary(mesures, child, at(15)).backOn).toEqual({ date: '2026-11-14', day: 13 });
    expect(weightSummary(mesures.slice(0, 2), child, at(24)).lateReturn).toBe(true);
    expect(weightSummary([], child, at(5)).birth).toBeNull();
  });
  it('couches : repère allaitement 1, 2… puis au moins 6 après J5', () => {
    expect([1, 2, 5, 6, 12].map(wetTarget)).toEqual([1, 2, 5, 6, 6]);
    const entries = [
      { childId: 'c1', type: 'couche', contenu: 'pipi', date: iso(at(4, 8)) },
      { childId: 'c1', type: 'couche', contenu: 'mixte', date: iso(at(4, 14)) },
      { childId: 'c1', type: 'couche', contenu: 'selles', date: iso(at(5, 9)) },
      { childId: 'c2', type: 'couche', contenu: 'pipi', date: iso(at(5, 9)) },
    ];
    const days = diaperDays(entries, child, at(5, 18), 3);
    expect(days.map((d) => d.day)).toEqual([4, 3, 2]);
    expect(days[0]).toMatchObject({ day: 4, today: true, wet: 0, stool: 1, target: 4 });
    expect(days[1]).toMatchObject({ day: 3, wet: 2, stool: 1, target: 3 });
  });
});

describe('v3.16 · Changement de couloir (poids)', () => {
  const sexe = 'fille';
  const valueAt = (ageM, z) => { const [L, M, S] = WEIGHT_LMS.fille[ageM]; return M * Math.pow(1 + L * S * z, 1 / L); };
  it('score Z et couloirs', () => {
    expect(zScore(WEIGHT_LMS, sexe, 2, valueAt(2, 0))).toBeCloseTo(0, 5);
    expect(bandOf(0.5)).toBe('P50–P85');
    expect(bandOf(-2.2)).toBe('sous P3');
    expect(linesCrossedDown(0.5, -1.2)).toBe(2);
    expect(linesCrossedDown(0.5, -0.5)).toBe(1);
  });
  it('alerte à 2 lignes franchies vers le bas, pas avant 2 semaines', () => {
    const c = { id: 'c1', sexe, birthdate: '2026-06-01' };
    const m = (date, ageM, z) => ({ childId: 'c1', type: 'poids', date, valeur: Math.round(valueAt(ageM, z) * 100) / 100 });
    const ok = [m('2026-08-01', 2, 0.5), m('2026-10-01', 4, -0.4)];
    expect(weightDrop(ok, c, at(18))).toBeNull();
    const drop = [m('2026-08-01', 2, 0.5), m('2026-09-01', 3, 0.2), m('2026-11-01', 5, -1.3)];
    expect(weightDrop(drop, c, at(18))).toMatchObject({ lines: 2, from: { band: 'P50–P85' }, to: { band: 'P3–P15' } });
  });
});

describe('v3.16 · Vitamine K', () => {
  it('3 doses, la 3e à 1 mois à 9 h, allaitement seulement', () => {
    expect(VITK_DOSES.map((d) => d.key)).toEqual(['d1', 'd2', 'd3']);
    expect(vitKCase(child)).toBe('exclusif');
    expect(vitKCase({ ...child, alimentation: 'mixte' })).toBe('mixte');
    expect(vitKCase({ ...child, alimentation: 'artificiel' })).toBeNull();
    expect(thirdDoseDate(child).getTime()).toBe(new Date(2026, 11, 2, 9, 0).getTime());
    expect(vitKNotifId(child)).toBe('vitk_c1');
  });
  it('affichage : 2 mois, ou 3 mois tant que la 3e dose manque', () => {
    expect(showVitK(child, at(20))).toBe(true);
    const later = new Date(2027, 0, 20);
    expect(showVitK(child, later)).toBe(true);
    expect(showVitK({ ...child, vitK: { d3: '2026-12-02' } }, later)).toBe(false);
    expect(showVitK({ ...child, alimentation: 'artificiel' }, at(20))).toBe(false);
  });
});

describe('v3.16 · Pendant ton absence / bilan de la nuit', () => {
  const since = at(10, 3, 0).getTime();
  const now = at(10, 8, 20).getTime();
  const by2 = { createdBy: 'u2', createdByName: 'Marie' };
  const entries = [
    { childId: 'c1', type: 'biberon', mode: 'sein', duree: 18, date: iso(at(10, 4)), createdAt: iso(at(10, 4, 20)), ...by2 },
    { childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 120, date: iso(at(10, 7)), createdAt: iso(at(10, 7)), ...by2 },
    { childId: 'c1', type: 'couche', contenu: 'mixte', date: iso(at(10, 7, 5)), createdAt: iso(at(10, 7, 5)), ...by2 },
    { childId: 'c1', type: 'couche', contenu: 'pipi', date: iso(at(10, 6)), createdAt: iso(at(10, 6)), createdBy: 'u1', createdByName: 'Julien' },
    { childId: 'c1', type: 'couche', contenu: 'pipi', date: iso(at(10, 2)), createdAt: iso(at(10, 2)), ...by2 },
  ];
  it('résumé des notes de l\'autre parent', () => {
    const s = absenceSummary(entries, 'c1', since, 'u1', now);
    expect(s.count).toBe(3);
    expect(s.names).toEqual(['Marie']);
    expect(s.lines.map((l) => l.text)).toEqual(['1 tétée (18 min au total)', '1 biberon · 120 ml', '1 change dont 1 avec selles']);
    expect(absenceSummary(entries, 'c1', now - ABSENCE_MIN_GAP + 60000, 'u1', now)).toBeNull();
    expect(absenceSummary(entries, 'c1', since, 'u2', now)).toMatchObject({ count: 1, names: ['Julien'] });
  });
  it('durées lisibles', () => {
    expect(durationText(35)).toBe('35 min');
    expect(durationText(60)).toBe('1 h');
    expect(durationText(130)).toBe('2 h 10');
    expect(summarizeEntries([{ type: 'sommeil', debut: iso(at(1, 1)), date: iso(at(1, 1)), fin: iso(at(1, 2, 10)) }])[0].text).toBe('1 sommeil · 1 h 10');
  });
  it('nuit : coucher, réveils, plus long sommeil, repas', () => {
    const night = [
      { childId: 'c1', type: 'sommeil', sousType: 'nuit', debut: iso(at(9, 21, 30)), date: iso(at(9, 21, 30)), fin: iso(at(10, 1, 10)) },
      { childId: 'c1', type: 'biberon', mode: 'sein', date: iso(at(10, 1, 15)) },
      { childId: 'c1', type: 'sommeil', sousType: 'nuit', debut: iso(at(10, 1, 40)), date: iso(at(10, 1, 40)), fin: iso(at(10, 5)) },
      { childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 90, date: iso(at(10, 5, 10)) },
      { childId: 'c1', type: 'couche', contenu: 'pipi', date: iso(at(10, 5, 5)) },
      { childId: 'c1', type: 'sommeil', sousType: 'nuit', debut: iso(at(10, 5, 30)), date: iso(at(10, 5, 30)), fin: iso(at(10, 7, 10)) },
    ];
    const r = nightRecap(night, 'c1', at(10, 8));
    expect(r).toMatchObject({ bedtime: '21:30', wake: '07:10', wakeups: 2, feeds: 2, seins: 1, bibs: 1, ml: 90, changes: 1, sleepingNow: false });
    expect(Math.round(r.longest)).toBe(220);
    expect(Math.round(r.total)).toBe(220 + 200 + 100);
    expect(nightWindow(at(10, 8)).begin).toBe(at(9, 19).getTime());
    expect(showNightRecapAt(at(10, 8))).toBe(true);
    expect(showNightRecapAt(at(10, 14))).toBe(false);
    expect(nightRecap([], 'c1', at(10, 8))).toBeNull();
  });
  it('dernier passage mémorisé', () => {
    writeLastSeen(123456);
    expect(readLastSeen()).toBe(123456);
  });
});

describe('v3.16 · Démarches', () => {
  it('déclaration : 5 jours sans le jour J, reportée au 1er jour ouvrable', () => {
    // Né le mardi 3 novembre 2026 → dimanche 8 → lundi 9
    expect(declarationDeadline(new Date(2026, 10, 3)).getDate()).toBe(9);
    // Né le jeudi 5 novembre → mardi 10
    expect(declarationDeadline(new Date(2026, 10, 5)).getDate()).toBe(10);
    // Né le vendredi 6 novembre → mercredi 11 (férié) → jeudi 12
    expect(declarationDeadline(new Date(2026, 10, 6)).getDate()).toBe(12);
    expect(isHoliday(new Date(2026, 3, 6))).toBe(true); // lundi de Pâques 2026
  });
  it('liste, dates limites et statut', () => {
    const items = demarchesFor('2026-11-05', { secu: '2026-11-10' });
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(by.paternite21.due.getTime()).toBe(new Date(2027, 4, 5).getTime());
    expect(by.congeNaissance.due.getTime()).toBe(new Date(2027, 7, 5).getTime());
    expect(by.secu.done).toBe('2026-11-10');
    expect(demarcheStatus(by.secu)).toBe('done');
    expect(demarcheStatus(by.declaration, new Date(2026, 10, 8))).toBe('soon');
    expect(demarcheStatus(by.declaration, new Date(2026, 10, 12))).toBe('late');
    expect(demarcheStatus(by.caf)).toBe('todo');
    expect(demarchesFor('2025-12-01').some((i) => i.key === 'congeNaissance')).toBe(false);
    expect(demarchesFor('2026-03-01').find((i) => i.key === 'congeNaissance').due.getTime()).toBe(new Date(2027, 2, 31).getTime());
    expect(demarchesFor('')).toEqual([]);
  });
});

describe('v3.16 · Lait tiré et autonomie', () => {
  const entries = [];
  for (let d = 12; d <= 18; d++) {
    entries.push({ childId: 'c1', type: 'tirelait', quantite: 150, date: iso(at(d, 9)) });
    entries.push({ childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 100, laitMaternel: true, date: iso(at(d, 11)) });
    entries.push({ childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 120, date: iso(at(d, 15)) });
  }
  it('production et consommation par jour (7 jours)', () => {
    expect(milkFlows(entries, 'c1', at(18, 20))).toEqual({ days: 7, pumpedPerDay: 150, drunkPerDay: 100 });
  });
  it('autonomie = stock / consommation de lait maternel', () => {
    const pots = [{ lieu: 'frigo', quantite: 120, date: iso(at(18, 9)) }, { lieu: 'congel', quantite: 230, date: iso(at(10, 9)), depuis: iso(at(10, 9)) }];
    expect(stockAutonomy(pots, entries, 'c1', at(18, 20))).toEqual({ stock: 350, days: 3.5 });
    expect(stockAutonomy(pots, [], 'c1', at(18, 20)).days).toBeNull();
  });
});

describe('v3.16 · Statistiques des tétées', () => {
  it('par jour, durée moyenne, intervalle médian, côtés', () => {
    const e = [
      { type: 'biberon', mode: 'sein', cote: 'gauche', duree: 10, date: iso(at(18, 1)) },
      { type: 'biberon', mode: 'sein', cote: 'droit', duree: 20, date: iso(at(18, 4)) },
      { type: 'biberon', mode: 'biberon', quantite: 90, date: iso(at(18, 6)) },
      { type: 'biberon', mode: 'sein', cote: 'deux', date: iso(at(18, 9)) },
    ];
    const s = feedStats(e, 7, at(18, 20));
    expect(s.count).toBe(3);
    expect(s.avgDuree).toBe(15);
    expect(s.medianGap).toBe(180);
    expect(s.sides).toEqual({ gauche: 1, droit: 1, deux: 1 });
  });
});

describe('v3.16 · Médicaments : pipette en kg et garde-fous', () => {
  const now = at(18, 20);
  it('prises sur 24 h et avertissements de la notice', () => {
    const m = { pipetteKg: true, frequenceHeures: 6, lastDoseDate: iso(at(18, 17)), prises: [iso(at(17, 22)), iso(at(18, 5)), iso(at(18, 11)), iso(at(18, 17))] };
    expect(prisesSince(m, 24 * 3600000, now)).toHaveLength(4);
    const w = doseWarnings(m, now);
    expect(w.map((x) => x.level)).toEqual(['stop', 'stop']);
    expect(doseWarnings({ ...m, prises: [], lastDoseDate: iso(at(18, 15)) }, now).map((x) => x.level)).toEqual(['warn']);
    expect(doseWarnings({ ...m, prises: [], lastDoseDate: iso(at(18, 13)) }, now)).toEqual([]);
  });
  it('autre médicament : prévient si la dose est en avance', () => {
    const m = { frequenceHeures: 8, prochaineDoseAt: iso(at(18, 22)) };
    expect(doseWarnings(m, now)[0].text).toContain('22:00');
    expect(doseWarnings({ ...m, prochaineDoseAt: iso(at(18, 20, 10)) }, now)).toEqual([]);
  });
  it('dernière pesée de l\'enfant', () => {
    const mes = [{ childId: 'c1', type: 'poids', valeur: 5.1, date: '2026-10-01' }, { childId: 'c1', type: 'poids', valeur: 6.2, date: '2026-11-13' }, { childId: 'c2', type: 'poids', valeur: 9, date: '2026-11-15' }];
    expect(lastWeight(mes, 'c1').valeur).toBe(6.2);
    expect(lastWeight([], 'c1')).toBeNull();
  });
});
