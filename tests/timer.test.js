import { describe, it, expect } from 'vitest';
import { startSide, switchSide, pauseTimer, teteeFromTimer, timerNotifContent, timerNotifExtra, chronoText, stateToNative, nativeToState, suggestedSide } from '../src/timer.js';

const t0 = new Date(2026, 9, 20, 3, 0, 0);
const plus = (min) => new Date(t0.getTime() + min * 60000);

describe('Minuteur : état partagé', () => {
  it('démarre, bascule et cumule les deux côtés', () => {
    let s = startSide(null, 'gauche', t0);
    expect(s.running).toBe(true);
    s = switchSide(s, plus(8));
    expect(s.currentSide).toBe('droit');
    expect(Math.round(s.elapsedGauche)).toBe(480);
    s = pauseTimer(s, plus(13));
    expect(s.running).toBe(false);
    expect(Math.round(s.elapsedDroit)).toBe(300);
    const e = teteeFromTimer(s, plus(30));
    expect(e).toMatchObject({ type: 'biberon', mode: 'sein', cote: 'deux', duree: 13 });
    expect(e.date).toBe(t0.toISOString());
  });

  it('même côté déjà en cours : état inchangé', () => {
    const s = startSide(null, 'droit', t0);
    expect(startSide(s, 'droit', plus(2))).toBe(s);
  });

  it('terminer sans pause compte le segment en cours (minimum 1 min)', () => {
    const s = startSide(null, 'droit', t0);
    expect(teteeFromTimer(s, plus(0.2))).toMatchObject({ cote: 'droit', duree: 1 });
    expect(teteeFromTimer(s, plus(12))).toMatchObject({ cote: 'droit', duree: 12 });
  });

  it('texte de la notification', () => {
    let s = startSide(null, 'gauche', t0);
    s = switchSide(s, plus(8));
    const c = timerNotifContent(s);
    expect(c.title).toBe('Tétée en cours — côté droit');
    expect(c.body).toBe('Droit depuis 03:08 · début de la tétée 03:00');
    expect(timerNotifContent(pauseTimer(s, plus(10))).body).toBe('Gauche 8 min · Droit 2 min · début 03:00');
    expect(timerNotifContent(null)).toBe(null);
  });
});

describe('Minuteur : grand chrono de la notification', () => {
  it('bases : total et côté avancent depuis le bon instant', () => {
    let s = startSide(null, 'gauche', t0);
    s = switchSide(s, plus(8)); // gauche 8 min, droit en cours depuis +8
    const e = timerNotifExtra(s, plus(10).getTime());
    expect(e.chronoRunning).toBe(true);
    // total = maintenant - totalBase = 10 min ; côté droit = 2 min
    expect((plus(10).getTime() - e.totalBase) / 60000).toBe(10);
    expect((plus(10).getTime() - e.sideBase) / 60000).toBe(2);
    expect(e.sideLabel).toBe('Droit');
    expect(e.otherText).toBe('Gauche 08:00');
    expect(e.statusText).toBe('Tétée en cours — côté droit');
  });

  it('en pause : chronos figés sur les valeurs cumulées', () => {
    let s = startSide(null, 'gauche', t0);
    s = pauseTimer(s, plus(5));
    const now = plus(30).getTime();
    const e = timerNotifExtra(s, now);
    expect(e.chronoRunning).toBe(false);
    expect((now - e.totalBase) / 60000).toBe(5);
    expect((now - e.sideBase) / 60000).toBe(5);
    expect(e.otherText).toBe('Droit 00:00');
    expect(e.sideMark).toBe('pause');
  });

  it('format des chronos Android', () => {
    expect(chronoText(250)).toBe('04:10');
    expect(chronoText(3725)).toBe('1:02:05');
  });
});

describe('Minuteur : échange avec le code Android', () => {
  it('aller-retour sans perte (format ObTimer.java)', () => {
    let s = startSide(null, 'gauche', t0);
    s = switchSide(s, plus(8));
    const n = stateToNative(s);
    expect(n).toMatchObject({ side: 'droit', running: true, accG: 480, accD: 0, startedAt: t0.getTime(), sideStart: plus(8).getTime() });
    expect(nativeToState(n)).toEqual(s);
  });

  it('changement de côté fait par Android = même résultat que dans l’appli', () => {
    // Reproduction de ObTimer.switchSide (Java) sur l'état échangé
    let s = startSide(null, 'gauche', t0);
    const n = stateToNative(s);
    const now = plus(8).getTime();
    n.accG += (now - n.sideStart) / 1000; n.side = 'droit'; n.sideStart = now; n.updatedAt = now;
    expect(nativeToState(n)).toEqual(switchSide(s, plus(8)));
  });

  it('notification : état transmis + bouton Terminer seul côté Android', () => {
    const e = timerNotifExtra(startSide(null, 'droit', t0), plus(1).getTime());
    expect(JSON.parse(e.obState).side).toBe('droit');
    expect(e.nativeActionTypeId).toBe('OMNIBABY_TETEE_FIN');
  });

  it('côté proposé = inverse de la dernière tétée', () => {
    expect(suggestedSide('gauche')).toBe('droit');
    expect(suggestedSide('droit')).toBe('gauche');
    expect(suggestedSide('deux')).toBe('gauche');
    expect(suggestedSide(undefined)).toBe('gauche');
  });
});
