// ----------------------------------------------------------------------
// Premiers jours (v3.16) : poids par rapport au poids de naissance et
// couches par jour, de la naissance à J21.
//
// Repères (indicatifs, ne remplacent pas la sage-femme ou le pédiatre) :
//  - perte de poids habituelle : 3 à 9 % du poids de naissance les premiers
//    jours ; retour au poids de naissance en 2 à 3 semaines (Manuel MSD,
//    « Soins du nouveau-né à terme en bonne santé »). Au-delà de 10 % : à
//    signaler.
//  - bébé allaité : 1 couche mouillée le 1er jour, 1 de plus chaque jour,
//    puis au moins 6 par jour après le 5e jour ; 3 à 10 selles par jour les
//    4 à 6 premières semaines (Naître et grandir, « Bébé boit-il assez ? »).
// ----------------------------------------------------------------------
import { parseLocalDate, toISODate } from './utils.jsx';

export const FIRST_DAYS_MAX = 21;
const DAY = 86400000;

// Jour de vie : J1 = jour de la naissance
export function lifeDay(birthdate, date) {
  const b = parseLocalDate(birthdate);
  const d = new Date(date);
  const day0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  const dayD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((dayD - day0) / DAY) + 1;
}

// Poids de naissance : pesée datée du jour de naissance (ou du lendemain)
export function birthWeight(mesures, child) {
  if (!child?.birthdate) return null;
  const w = (mesures || [])
    .filter((m) => m.type === 'poids' && m.childId === child.id && Number(m.valeur) > 0)
    .filter((m) => lifeDay(child.birthdate, parseLocalDate(m.date)) <= 2)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  return w ? { valeur: Number(w.valeur), date: w.date } : null;
}

// Perte en % du poids de naissance (positive = perte)
export function weightLoss(birthKg, kg) {
  if (!(birthKg > 0) || !(kg > 0)) return null;
  const pct = Math.round(((birthKg - kg) / birthKg) * 1000) / 10;
  const level = pct >= 10 ? 'alert' : pct > 9 ? 'watch' : 'ok';
  return { pct, level };
}

// Synthèse poids : dernière pesée, perte max, retour au poids de naissance
export function weightSummary(mesures, child, now = new Date()) {
  const birth = birthWeight(mesures, child);
  if (!birth) return { birth: null };
  const ws = (mesures || [])
    .filter((m) => m.type === 'poids' && m.childId === child.id && Number(m.valeur) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const after = ws.slice(ws.findIndex((m) => m.date === birth.date && Number(m.valeur) === birth.valeur) + 1);
  const last = after[after.length - 1] || null;
  const back = after.find((m) => Number(m.valeur) >= birth.valeur) || null;
  const minW = after.reduce((min, m) => (!min || Number(m.valeur) < Number(min.valeur) ? m : min), null);
  const age = lifeDay(child.birthdate, now);
  return {
    birth,
    last: last && { valeur: Number(last.valeur), date: last.date, day: lifeDay(child.birthdate, parseLocalDate(last.date)), ...weightLoss(birth.valeur, Number(last.valeur)) },
    maxLoss: minW ? weightLoss(birth.valeur, Number(minW.valeur)) : null,
    backOn: back ? { date: back.date, day: lifeDay(child.birthdate, parseLocalDate(back.date)) } : null,
    lateReturn: !back && age > FIRST_DAYS_MAX,
  };
}

// Repère de couches mouillées (bébé allaité) pour le jour de vie n
export const wetTarget = (day) => (day >= 6 ? 6 : Math.max(1, day));

// Couches par jour de vie, du plus récent au plus ancien (jours complets
// + aujourd'hui en cours)
export function diaperDays(entries, child, now = new Date(), maxDays = 6) {
  if (!child?.birthdate) return [];
  const today = lifeDay(child.birthdate, now);
  const out = [];
  for (let day = today; day >= Math.max(1, today - maxDays + 1); day--) {
    const date = parseLocalDate(child.birthdate);
    date.setDate(date.getDate() + day - 1);
    const iso = toISODate(date);
    const list = (entries || []).filter((e) => e.childId === child.id && e.type === 'couche' && toISODate(new Date(e.date)) === iso);
    out.push({
      day, date: iso, today: day === today,
      wet: list.filter((e) => e.contenu === 'pipi' || e.contenu === 'mixte').length,
      stool: list.filter((e) => e.contenu === 'selles' || e.contenu === 'mixte').length,
      target: wetTarget(day),
    });
  }
  return out;
}

export function showFirstDays(child, now = new Date()) {
  if (!child?.birthdate) return false;
  const d = lifeDay(child.birthdate, now);
  return d >= 1 && d <= FIRST_DAYS_MAX;
}
