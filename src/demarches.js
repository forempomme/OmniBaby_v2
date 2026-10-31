// ----------------------------------------------------------------------
// Démarches autour de la naissance (v3.16), dates calculées depuis la
// date de naissance (ou la date prévue tant qu'elle est à venir).
// Sources :
//  - déclaration de naissance : 5 jours, jour de l'accouchement non compté,
//    reporté au 1er jour ouvrable si le dernier tombe un samedi, un
//    dimanche ou un jour férié, à la mairie du lieu de naissance (Code
//    civil art. 55 ; Previssima, « 5 jours pour déclarer la naissance »)
//  - congé de paternité et d'accueil de l'enfant : 25 jours, dont 4 juste
//    après la naissance ; 21 jours dans les 6 mois, en 1 ou 2 périodes d'au
//    moins 5 jours ; employeur prévenu au moins 1 mois avant
//  - congé supplémentaire de naissance (depuis le 1er juillet 2026) : 1 à 2
//    mois par parent, après le congé de maternité/paternité, dans les 9 mois
//    suivant la naissance (enfants nés à partir du 1er juin 2026 ; nés de
//    janvier à mai 2026 : du 1er juillet 2026 au 31 mars 2027) ; employeur
//    prévenu 1 mois avant (15 jours s'il suit directement le congé de
//    paternité) ; indemnisé 70 % du salaire net le 1er mois, 60 % le 2e,
//    dans la limite du plafond de la Sécurité sociale (Code du travail
//    numérique, actualité du 1er juillet 2026)
// Les règles changent : chaque ligne indique l'organisme à contacter.
// Suivi partagé entre les parents : settings.demarches = { date (naissance
// ou date prévue), done: { clé: date } } — utilisable avant la naissance.
// ----------------------------------------------------------------------
import { parseLocalDate, toISODate } from './utils.jsx';

// Jours fériés fixes (France métropolitaine) + lundi de Pâques, Ascension,
// lundi de Pentecôte
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
export function isHoliday(d) {
  const y = d.getFullYear();
  const md = `${d.getMonth() + 1}-${d.getDate()}`;
  if (['1-1', '5-1', '5-8', '7-14', '8-15', '11-1', '11-11', '12-25'].includes(md)) return true;
  const e = easter(y);
  return [1, 39, 50].some((n) => { const x = new Date(e); x.setDate(x.getDate() + n); return toISODate(x) === toISODate(d); });
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };

// Dernier jour pour déclarer la naissance
export function declarationDeadline(birth) {
  let d = addDays(birth, 5);
  while (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d)) d = addDays(d, 1);
  return d;
}

// dateIso : date de naissance (ou prévue) AAAA-MM-JJ ; done : { clé: date }
export function demarchesFor(dateIso, done = {}) {
  if (!dateIso) return [];
  const birth = parseLocalDate(dateIso);
  const items = [
    { key: 'declaration', title: 'Déclarer la naissance', where: 'Mairie du lieu de naissance (parfois directement à la maternité)',
      detail: '5 jours, sans compter le jour de l’accouchement. Fait en général par l’autre parent.', due: declarationDeadline(birth) },
    { key: 'paternite4', title: 'Congé de paternité : 4 jours obligatoires', where: 'Employeur',
      detail: 'Juste après la naissance (après les 3 jours de congé de naissance). Prévenir l’employeur de la date prévue au moins 1 mois avant.', due: addDays(birth, 7) },
    { key: 'paternite21', title: 'Congé de paternité : 21 jours restants', where: 'Employeur',
      detail: 'Dans les 6 mois, en une fois ou en 2 périodes d’au moins 5 jours. Prévenir l’employeur au moins 1 mois avant chaque période.', due: addMonths(birth, 6) },
  ];
  const june = new Date(2026, 5, 1);
  if (birth >= new Date(2026, 0, 1)) {
    items.push({ key: 'congeNaissance', title: 'Congé supplémentaire de naissance', where: 'Employeur · indemnités : CPAM ou MSA',
      detail: '1 ou 2 mois par parent (fractionnable en 2 fois 1 mois), après le congé de paternité. Indemnisé 70 % du salaire net le 1er mois, 60 % le 2e (plafonné). Prévenir l’employeur 1 mois avant (15 jours s’il suit directement le congé de paternité).',
      due: birth >= june ? addMonths(birth, 9) : new Date(2027, 2, 31) });
  }
  items.push(
    { key: 'secu', title: 'Rattacher bébé à la Sécurité sociale', where: 'CPAM (ameli) ou MSA', detail: 'Inscription sur la carte Vitale d’un parent ou des deux, avec l’acte de naissance.', due: null },
    { key: 'caf', title: 'Déclarer la naissance à la CAF', where: 'CAF ou MSA', detail: 'Avec l’acte de naissance, pour la mise à jour du dossier (prestations familiales).', due: null },
    { key: 'mutuelle', title: 'Ajouter bébé à la mutuelle', where: 'Mutuelle / complémentaire santé', detail: 'Délai variable selon le contrat : à faire rapidement.', due: null },
  );
  return items.map((it) => ({ ...it, done: done?.[it.key] || null }));
}

// 'done' | 'late' | 'soon' (≤ 7 jours) | 'todo'
export function demarcheStatus(item, now = new Date()) {
  if (item.done) return 'done';
  if (!item.due) return 'todo';
  const end = new Date(item.due); end.setHours(23, 59, 59, 999);
  if (end < now) return 'late';
  return (end - now) / 86400000 <= 7 ? 'soon' : 'todo';
}
