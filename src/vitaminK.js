// ----------------------------------------------------------------------
// Vitamine K1 du nouveau-né (v3.16).
// Schéma oral pour un nouveau-né à terme allaité exclusivement : 3 doses de
// 2 mg — le 1er jour, entre le 4e et le 7e jour, et à 1 mois. La 3e dose
// peut être omise en lait infantile exclusif (Vidal, « Vitamine K1 Roche
// 2 mg/0,2 ml nourrissons : nouveau schéma posologique réduit à 3 doses »).
// Les 2 premières sont en général données à la maternité ; la 3e, à la
// maison, est celle qui s'oublie : rappel à 1 mois, 9 h.
// Suivi rangé dans la fiche de l'enfant : child.vitK = { d1, d2, d3 } (dates).
// ----------------------------------------------------------------------
import { parseLocalDate, scheduleNotif, cancelNotif, requestNotifPermission } from './utils.jsx';

export const VITK_DOSES = [
  { key: 'd1', label: '1re dose', when: '1er jour (maternité)' },
  { key: 'd2', label: '2e dose', when: 'entre le 4e et le 7e jour (maternité)' },
  { key: 'd3', label: '3e dose', when: 'à 1 mois' },
];

// 'exclusif' : 3e dose recommandée · 'mixte' : à voir avec le pédiatre ·
// null : lait infantile (3e dose facultative)
export function vitKCase(child) {
  if (child?.alimentation === 'allaitement') return 'exclusif';
  if (child?.alimentation === 'mixte') return 'mixte';
  return null;
}

export function thirdDoseDate(child) {
  if (!child?.birthdate) return null;
  const d = parseLocalDate(child.birthdate);
  d.setMonth(d.getMonth() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Bloc affiché jusqu'à 2 mois, ou tant que la 3e dose manque (3 mois max)
export function showVitK(child, now = new Date()) {
  if (!child?.birthdate || !vitKCase(child)) return false;
  const days = (now - parseLocalDate(child.birthdate)) / 86400000;
  if (days < 0) return false;
  if (days <= 61) return true;
  return !child.vitK?.d3 && days <= 92;
}

export function vitKNotifId(child) { return `vitk_${child.id}`; }

export function scheduleVitKNotif(child, enabled = true) {
  if (!child) return;
  cancelNotif(vitKNotifId(child));
  if (!enabled || vitKCase(child) !== 'exclusif' || child.vitK?.d3) return;
  const at = thirdDoseDate(child);
  if (!at || at.getTime() <= Date.now()) return;
  requestNotifPermission().then((granted) => {
    if (!granted) return;
    scheduleNotif({
      id: vitKNotifId(child),
      title: `Vitamine K — ${child.nom}`,
      body: '3e dose de vitamine K à 1 mois (allaitement)',
      at: at.toISOString(),
    });
  });
}
