import { describe, it, expect } from 'vitest';
import { doseAt, isDoseDue, doseFromTime, doseWhen } from '../src/tools/Medicaments.jsx';
import { rappelKind, visiteDate, rappelNotifAt } from '../src/tools/Rappels.jsx';
import { seededDuplicates } from '../src/tools/Alimentation.jsx';
import { ageInDays, ageInMonths } from '../src/store.jsx';
import { parseLocalDate } from '../src/utils.jsx';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m);

describe('B1 · Médicaments : prochaine dose datée', () => {
  it('dose donnée à 22 h toutes les 8 h : pas due avant 6 h le lendemain', () => {
    const medoc = { frequenceHeures: 8, prochaineDose: '06:00', prochaineDoseAt: at(26, 6).toISOString() };
    expect(isDoseDue(medoc, at(25, 22, 5))).toBe(false);   // avant : « Dose due » aussitôt
    expect(isDoseDue(medoc, at(26, 5, 59))).toBe(false);
    expect(isDoseDue(medoc, at(26, 6, 0))).toBe(true);
    expect(doseWhen(doseAt(medoc), at(25, 22, 5))).toBe('demain à 06:00');
  });

  it('dose de 23 h oubliée : toujours en retard après minuit', () => {
    const medoc = { frequenceHeures: 8, prochaineDoseAt: at(25, 23).toISOString() };
    expect(isDoseDue(medoc, at(26, 0, 30))).toBe(true);    // avant : plus signalée
    expect(doseWhen(doseAt(medoc), at(26, 0, 30))).toBe('hier à 23:00');
  });

  it('anciennes données sans date : dernière prise + fréquence', () => {
    const medoc = { frequenceHeures: 8, prochaineDose: '06:00', lastDoseDate: at(25, 22).toISOString() };
    expect(doseAt(medoc, at(25, 22, 5)).getTime()).toBe(at(26, 6).getTime());
    expect(isDoseDue(medoc, at(25, 22, 5))).toBe(false);
  });

  it('heure saisie : retard < 2 h = aujourd’hui, sinon prochaine occurrence', () => {
    expect(doseFromTime('21:00', at(25, 22)).getTime()).toBe(at(25, 21).getTime());
    expect(doseFromTime('06:00', at(25, 22)).getTime()).toBe(at(26, 6).getTime());
    expect(doseFromTime('23:30', at(25, 22)).getTime()).toBe(at(25, 23, 30).getTime());
  });
});

describe('B3/B7 · Rappels automatiques', () => {
  it('visite : 9 h heure locale, notification 7 jours avant', () => {
    const d = visiteDate('2026-06-16', { months: 4 });
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 16, 9]);
    const notifAt = new Date(d); notifAt.setDate(notifAt.getDate() - 7);
    expect(rappelNotifAt({ date: d.toISOString(), notifAt: notifAt.toISOString() }).getDate()).toBe(9);
  });
  it('icône selon la nature du rappel (anciens rappels compris)', () => {
    expect(rappelKind({ titre: 'Reprendre la température — Léa', auto: true })).toBe('fievre');
    expect(rappelKind({ titre: 'Examen', visiteKey: 'v' })).toBe('visite');
    expect(rappelKind({ titre: 'RDV pédiatre' })).toBe('manuel');
  });
});

describe('B5 · Aliments pré-remplis en double', () => {
  it('retire les copies jamais modifiées, garde celle modifiée', () => {
    const list = [
      { id: 1, childId: 'c', nom: 'Carotte', seeded: true, statut: 'a_tester', notes: '' },
      { id: 2, childId: 'c', nom: 'Carotte', seeded: true, statut: 'aime', notes: '' },
      { id: 3, childId: 'c', nom: 'Poire', seeded: true, statut: 'a_tester', notes: '' },
      { id: 4, childId: 'c', nom: 'Poire', seeded: true, statut: 'a_tester', notes: '' },
      { id: 5, childId: 'autre', nom: 'Poire', seeded: true, statut: 'a_tester', notes: '' },
      { id: 6, childId: 'c', nom: 'Poire', statut: 'a_tester', notes: '' }, // ajouté à la main
    ];
    expect(seededDuplicates(list, 'c').sort()).toEqual([1, 4]);
  });
});

describe('B6 · Dates en heure locale', () => {
  it('« YYYY-MM-DD » = minuit local', () => {
    const d = parseLocalDate('2026-10-19');
    expect([d.getDate(), d.getHours()]).toEqual([19, 0]);
  });
  it('âge en jours juste entre minuit et 2 h', () => {
    expect(ageInDays('2026-10-19', at(25, 0, 30))).toBe(6);
    expect(ageInDays('2026-10-19', at(25, 23, 59))).toBe(6);
    expect(ageInMonths('2026-06-25', at(25, 0, 30))).toBe(4);
    expect(ageInMonths('2026-06-26', at(25, 0, 30))).toBe(3);
  });
});
