import { describe, it, expect } from 'vitest';
import { changeReminderAt, reconcileChangeReminder, changeNotifText, feedEnd, isFeed, isNightTime, hasChangeSince, changeDelay, CHANGE_NOTIF_ID } from '../src/changeReminder.js';
import { sharedSettings } from '../src/store.jsx';

// Novembre : pas de changement d'heure
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);
const iso = (d) => d.toISOString();
const MIN = 60000;

describe('v3.15 · Rappel du change après un repas', () => {
  const tetee = { id: 't1', childId: 'c1', type: 'biberon', mode: 'sein', date: iso(at(3, 14, 10)), duree: 18, cote: 'deux' };
  const bib = { id: 'b1', childId: 'c1', type: 'biberon', mode: 'biberon', quantite: 120, date: iso(at(3, 14, 30)) };
  const settings = { notifs: { change: true } };

  it('fin du repas = début + durée (heure saisie si pas de durée)', () => {
    expect(feedEnd(tetee)).toBe(at(3, 14, 28).getTime());
    expect(feedEnd(bib)).toBe(at(3, 14, 30).getTime());
    expect(isFeed(tetee)).toBe(true);
    expect(isFeed({ type: 'couche', date: tetee.date })).toBe(false);
    expect(CHANGE_NOTIF_ID).toBe('change_reminder');
  });

  it('5 min après la fin par défaut, délai réglable 5/10/15/20', () => {
    const now = at(3, 14, 28).getTime();
    expect(changeReminderAt(tetee, [tetee], settings, now)).toBe(at(3, 14, 33).getTime());
    expect(changeReminderAt(tetee, [tetee], { ...settings, changeDelay: 15 }, now)).toBe(at(3, 14, 43).getTime());
    expect(changeDelay({ changeDelay: 7 })).toBe(5);
  });

  it('pas de rappel : désactivé, repas saisi après coup, change déjà noté', () => {
    const now = at(3, 14, 28).getTime();
    expect(changeReminderAt(tetee, [tetee], { notifs: { change: false } }, now)).toBeNull();
    expect(changeReminderAt(tetee, [tetee], settings, at(3, 15).getTime())).toBeNull();
    const changeEntreDeuxSeins = { id: 'c', childId: 'c1', type: 'couche', contenu: 'pipi', date: iso(at(3, 14, 20)) };
    expect(changeReminderAt(tetee, [tetee, changeEntreDeuxSeins], settings, now)).toBeNull();
    // Change d'un autre enfant : sans effet
    expect(changeReminderAt(tetee, [tetee, { ...changeEntreDeuxSeins, childId: 'c2' }], settings, now)).toBe(at(3, 14, 33).getTime());
    // Change avant le début du repas : sans effet
    expect(hasChangeSince([{ ...changeEntreDeuxSeins, date: iso(at(3, 14, 5)) }], 'c1', at(3, 14, 10).getTime())).toBe(false);
  });

  it('la nuit (22 h – 7 h) : rappel par défaut, sauf si « Aussi la nuit » est coupé', () => {
    const nuit = { ...tetee, date: iso(at(4, 2, 0)), duree: 20 };
    const now = at(4, 2, 20).getTime();
    expect(isNightTime(at(4, 2))).toBe(true);
    expect(isNightTime(at(4, 7))).toBe(false);
    expect(isNightTime(at(4, 22))).toBe(true);
    expect(changeReminderAt(nuit, [nuit], settings, now)).toBe(at(4, 2, 25).getTime());
    expect(changeReminderAt(nuit, [nuit], { ...settings, changeNight: false }, now)).toBeNull();
  });

  it('rappel en attente : annulé si change noté, repas supprimé ou nouvelle tétée', () => {
    const pending = { feedId: 't1', childId: 'c1', since: at(3, 14, 10).getTime(), end: at(3, 14, 28).getTime(), at: at(3, 14, 33).getTime() };
    const now = at(3, 14, 30).getTime();
    expect(reconcileChangeReminder(pending, [tetee], null, now)).toBe('keep');
    expect(reconcileChangeReminder(pending, [tetee, { id: 'x', childId: 'c1', type: 'couche', date: iso(at(3, 14, 29)) }], null, now)).toBe('cancel');
    expect(reconcileChangeReminder(pending, [], null, now)).toBe('cancel');
    expect(reconcileChangeReminder(pending, [tetee], { startedAt: iso(at(3, 14, 29)) }, now)).toBe('cancel');
    // Change noté après l'affichage : on retire la notification
    expect(reconcileChangeReminder(pending, [tetee, { id: 'x', childId: 'c1', type: 'couche', date: iso(at(3, 14, 50)) }], null, at(3, 14, 50).getTime())).toBe('cancel');
    // Vieux rappel affiché : oublié
    expect(reconcileChangeReminder(pending, [tetee], null, at(3, 22).getTime())).toBe('drop');
    expect(reconcileChangeReminder(null, [], null, now)).toBe('keep');
  });

  it('texte de la notification', () => {
    expect(changeNotifText(tetee, 'Léa')).toEqual({ title: 'Change pour Léa ?', body: 'Tétée finie à 14:28 · 18 min' });
    expect(changeNotifText(bib, '')).toEqual({ title: 'Change pour bébé ?', body: 'Biberon fini à 14:30 · 120 ml' });
  });
});

describe('v3.15 · Réglages propres au téléphone', () => {
  it('style du thème sombre et rappel du change ne sont pas partagés', () => {
    const out = sharedSettings({ darkStyle: 'relief', changeDelay: 10, changeNight: false, defaultBiberonMl: 150 });
    expect(out).toEqual({ defaultBiberonMl: 150 });
  });
});
