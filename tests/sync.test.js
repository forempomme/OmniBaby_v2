import { describe, it, expect } from 'vitest';
import { windowCutoff, inWindow, mergeWindow, mergeHistory, migrateStore } from '../src/store.jsx';
import { readsForSnapshot } from '../src/readCounter.js';

const now = new Date(2026, 9, 22, 12, 0);
const cutoff = windowCutoff(now); // 61 jours avant

describe('Synchro fenêtrée (60 jours)', () => {
  it('date limite et appartenance à la fenêtre', () => {
    expect(cutoff).toBe('2026-08-22');
    expect(inWindow({ date: '2026-08-22T00:10:00.000Z' }, cutoff)).toBe(true);
    expect(inWindow({ date: '2026-09-30T10:00' }, cutoff)).toBe(true); // date locale (températures)
    expect(inWindow({ date: '2026-08-21T23:59:00.000Z' }, cutoff)).toBe(false);
    expect(inWindow({}, cutoff)).toBe(false);
  });

  const old = { id: 'o1', date: '2026-05-01T08:00:00.000Z' };
  const recent = { id: 'r1', date: '2026-10-20T08:00:00.000Z' };
  const recentGone = { id: 'r2', date: '2026-10-21T08:00:00.000Z' };

  it("l'écoute remplace le récent et garde l'ancien de la même famille", () => {
    const out = mergeWindow([old, recent, recentGone], [recent], cutoff, true);
    expect(out.map((i) => i.id).sort()).toEqual(['o1', 'r1']); // r2 supprimé par l'autre parent
  });

  it("autre famille : l'ancien local est écarté", () => {
    expect(mergeWindow([old, recent], [recent], cutoff, false)).toEqual([recent]);
  });

  it('historique serveur : ajoute les anciens, retire les anciens supprimés', () => {
    const old2 = { id: 'o2', date: '2026-04-01T08:00:00.000Z' };
    const out = mergeHistory([old, recent], [old2, { ...recent, quantite: 1 }], cutoff, true);
    expect(out.map((i) => i.id).sort()).toEqual(['o2', 'r1']);
    expect(out.find((i) => i.id === 'r1').quantite).toBe(undefined); // le récent vient de l'écoute
  });

  it('historique depuis le cache (hors connexion) : rien n’est retiré', () => {
    const out = mergeHistory([old, recent], [], cutoff, false);
    expect(out.map((i) => i.id).sort()).toEqual(['o1', 'r1']);
  });

  it('migration : données existantes rattachées à la famille connectée', () => {
    expect(migrateStore({ familyId: 'f1', children: [] }).syncFamilyId).toBe('f1');
    expect(migrateStore({ children: [] }).syncFamilyId).toBe(null);
    expect(migrateStore({ familyId: 'f2', syncFamilyId: 'f1', children: [] }).syncFamilyId).toBe('f1');
  });
});

describe('Compteur de lectures (estimation haute)', () => {
  const snap = (size, changes, fromCache = false, pending = false) => ({
    size, metadata: { fromCache, hasPendingWrites: pending }, docChanges: () => new Array(changes),
  });
  it('cache gratuit, 1er résultat serveur = tout, puis les changements', () => {
    const t = { serverSeen: false };
    expect(readsForSnapshot(snap(500, 500, true), t)).toBe(0);
    expect(readsForSnapshot(snap(500, 0), t)).toBe(500);
    expect(readsForSnapshot(snap(501, 1), t)).toBe(1);
    expect(readsForSnapshot(snap(502, 1, false, true), t)).toBe(0); // écriture locale
    expect(readsForSnapshot(snap(0, 0), { serverSeen: false })).toBe(1); // requête vide
  });
  it('reconnexion : nouveau résultat complet compté', () => {
    const t = { serverSeen: true };
    readsForSnapshot(snap(10, 0, true), t);
    expect(readsForSnapshot(snap(10, 0), t)).toBe(10);
  });
});
