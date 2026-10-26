import { describe, it, expect } from 'vitest';
import { potExpiry, potStatus, stockSummary, sortPots, expiryText, isActive } from '../src/lait.js';
import { liveDecision, sharedPayload, LIVE_STALE_MS } from '../src/liveTimer.js';
import { sleepKindAt, wakeFields, sleepNotifContent, SLEEP_NOTIF_ID } from '../src/sleepNotif.js';
import { ringArcs } from '../src/tools/Minuteur.jsx';

// Novembre : pas de changement d'heure entre les dates testées (48 h réelles)
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m);

describe('N4 · Stock de lait', () => {
  const frigo = { id: 'a', lieu: 'frigo', quantite: 120, date: at(24, 8, 10).toISOString() };
  const congel = { id: 'b', lieu: 'congel', quantite: 150, date: at(2, 9).toISOString(), depuis: at(2, 9).toISOString() };
  const deco = { id: 'c', lieu: 'decongele', quantite: 90, date: at(1, 9).toISOString(), depuis: at(25, 7).toISOString() };

  it('dates limites : frigo 48 h, congélateur 4 mois, décongelé 24 h', () => {
    expect(potExpiry(frigo).getTime()).toBe(at(26, 8, 10).getTime());
    expect(potExpiry(congel).getMonth()).toBe(2); // mars 2027
    expect(potExpiry(congel).getFullYear()).toBe(2027);
    expect(potExpiry(deco).getTime()).toBe(at(26, 7).getTime());
  });

  it('statut et texte : bientôt, périmé', () => {
    expect(potStatus(frigo, at(25, 22))).toBe('ok');
    expect(potStatus(frigo, at(26, 3))).toBe('soon');
    expect(potStatus(frigo, at(26, 9))).toBe('expired');
    expect(expiryText(frigo, at(25, 22))).toBe('avant demain 08:10');
    expect(expiryText(congel, at(25, 22))).toBe('avant le 02/03/2027');
  });

  it('totaux et ordre (périmés et utilisés exclus)', () => {
    const used = { id: 'd', lieu: 'utilise', quantite: 200, date: at(25, 6).toISOString() };
    const s = stockSummary([frigo, congel, deco, used], at(25, 22));
    expect(s).toEqual({ frigo: { ml: 210, n: 2 }, congel: { ml: 150, n: 1 } });
    expect(sortPots([congel, frigo, used, deco]).map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(isActive(used)).toBe(false);
  });
});

describe('N2 · Tétée partagée', () => {
  const now = at(25, 22).getTime();
  const st = (u, extra = {}) => ({ startedAt: new Date(now - 600000).toISOString(), updatedAt: u, ...extra });
  it('adopte la plus récente, renvoie la nôtre si plus récente', () => {
    expect(liveDecision(st(5), st(3), now)).toBe('adopt');
    expect(liveDecision(st(3), st(5), now)).toBe('push');
    expect(liveDecision(st(5), null, now)).toBe('adopt');
    expect(liveDecision(st(5), st(5), now)).toBe('none');
  });
  it('document supprimé : arrête la tétée reçue, envoie une tétée encore jamais partagée', () => {
    expect(liveDecision(null, st(5, { shared: true }), now)).toBe('clear');
    expect(liveDecision(null, st(5), now)).toBe('push');
    expect(liveDecision(null, null, now)).toBe('none');
  });
  it('tétée oubliée depuis plus de 6 h : ignorée', () => {
    const old = { startedAt: new Date(now - LIVE_STALE_MS - 1000).toISOString(), updatedAt: 9 };
    expect(liveDecision(old, null, now)).toBe('drop');
  });
  it('le marqueur « shared » reste sur le téléphone', () => {
    expect(sharedPayload({ a: 1, shared: true })).toEqual({ a: 1 });
  });
});

describe('N1 · Sommeil chronométré', () => {
  it('nuit entre 19 h et 7 h', () => {
    expect(sleepKindAt(at(25, 13))).toBe('sieste');
    expect(sleepKindAt(at(25, 19))).toBe('nuit');
    expect(sleepKindAt(at(25, 6, 59))).toBe('nuit');
    expect(sleepKindAt(at(25, 7))).toBe('sieste');
  });
  it('réveil noté par Android → entrée terminée', () => {
    const e = { debut: at(25, 13, 5).toISOString(), enCours: true };
    expect(wakeFields(e, at(25, 14, 17).getTime())).toEqual({ fin: at(25, 14, 17).toISOString(), duree: 72, enCours: false, humeurReveil: null });
  });
  it('contenu de la notification', () => {
    const c = sleepNotifContent({ id: 'x', debut: at(25, 13, 5).toISOString(), sousType: 'sieste' }, 'Léa');
    expect(c.title).toBe('Sieste en cours — Léa');
    expect(c.body).toBe('Endormi à 13:05');
    expect(JSON.parse(c.obSleep)).toMatchObject({ entryId: 'x', kind: 'sieste', child: 'Léa' });
    expect(SLEEP_NOTIF_ID).toBe(424243);
  });
});

describe('G2 · Anneau du Minuteur', () => {
  it('se remplit sur 20 min puis montre la répartition', () => {
    expect(ringArcs(300, 0)).toEqual({ g: 0.25, d: 0 });
    expect(ringArcs(1200, 600)).toEqual({ g: 1200 / 1800, d: 600 / 1800 });
  });
});
