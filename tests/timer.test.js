import { describe, it, expect } from 'vitest';
import { startSide, switchSide, pauseTimer, teteeFromTimer, timerNotifContent } from '../src/timer.js';

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
