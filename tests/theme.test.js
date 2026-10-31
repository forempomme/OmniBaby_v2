import { describe, it, expect } from 'vitest';
import { computeTheme, darkStyleOf, DARK_STYLES, parseColor, isDarkColor } from '../src/theme.js';

const at = (h, m = 0) => new Date(2026, 10, 18, h, m);

describe('Thème (v3.15.2)', () => {
  it('auto : sombre de l\'heure choisie à 7 h, nuit de 22 h à 7 h', () => {
    expect(computeTheme({ dark: null, nightMode: false }, at(15))).toBe('light');
    expect(computeTheme({ dark: null, nightMode: false, darkHour: 20 }, at(20, 30))).toBe('dark');
    expect(computeTheme({ dark: null }, at(23))).toBe('night');
    expect(computeTheme({ dark: false, nightMode: true }, at(12))).toBe('night');
    expect(computeTheme({ dark: true, nightMode: false }, at(12))).toBe('dark');
    expect(computeTheme({ dark: null, nightSnoozeUntil: at(23, 30).getTime() }, at(23))).toBe('dark');
  });

  it('style sombre : Ardoise par défaut, valeurs inconnues ignorées', () => {
    expect(DARK_STYLES[0]).toBe('ardoise');
    expect(darkStyleOf({})).toBe('ardoise');
    expect(darkStyleOf({ darkStyle: 'relief' })).toBe('relief');
    expect(darkStyleOf({ darkStyle: 'violet' })).toBe('ardoise');
  });

  it('barre d\'état : couleur lue dans le dégradé du bandeau', () => {
    expect(parseColor('linear-gradient(135deg, rgb(169, 83, 47) 0%, rgb(110, 61, 41) 100%)')).toEqual([169, 83, 47]);
    expect(parseColor('#F7F6F5')).toEqual([247, 246, 245]);
    expect(parseColor('none')).toBeNull();
    expect(isDarkColor([169, 83, 47])).toBe(true);
    expect(isDarkColor([247, 246, 245])).toBe(false);
  });
});
