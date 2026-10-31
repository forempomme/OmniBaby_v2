// ----------------------------------------------------------------------
// Changement de couloir sur la courbe de poids (v3.16).
// Couloirs = lignes des percentiles OMS 3/15/50/85/97 (celles du graphique).
// Alerte quand le poids descend de 2 lignes ou plus par rapport à la
// meilleure position des 6 derniers mois (pesées après 2 semaines de vie :
// la perte des premiers jours est normale). Signal à montrer au pédiatre,
// pas un diagnostic.
// ----------------------------------------------------------------------
import { getLMS, PERCENTILE_Z, WEIGHT_LMS } from './data/who-growth.js';
import { parseLocalDate } from './utils.jsx';

const LINES = [['P3', PERCENTILE_Z.p3], ['P15', PERCENTILE_Z.p15], ['P50', PERCENTILE_Z.p50], ['P85', PERCENTILE_Z.p85], ['P97', PERCENTILE_Z.p97]];
const MONTH_DAYS = 30.4375;

export function zScore(table, sexe, ageMonths, value) {
  const [L, M, S] = getLMS(table, sexe, ageMonths);
  if (Math.abs(L) < 1e-6) return Math.log(value / M) / S;
  return (Math.pow(value / M, L) - 1) / (L * S);
}

// Couloir lisible : « sous P3 », « P15–P50 », « au-dessus de P97 »
export function bandOf(z) {
  if (z < LINES[0][1]) return 'sous P3';
  for (let i = 0; i < LINES.length - 1; i++) if (z < LINES[i + 1][1]) return `${LINES[i][0]}–${LINES[i + 1][0]}`;
  return 'au-dessus de P97';
}

// Nombre de lignes de percentile franchies en descendant de zFrom à zTo
export function linesCrossedDown(zFrom, zTo) {
  return LINES.filter(([, z]) => z < zFrom && z >= zTo).length;
}

export function weightDrop(mesures, child, now = new Date()) {
  if (!child?.birthdate) return null;
  const b = parseLocalDate(child.birthdate);
  const sexe = child.sexe === 'garcon' ? 'garcon' : 'fille';
  const pts = (mesures || [])
    .filter((m) => m.type === 'poids' && m.childId === child.id && Number(m.valeur) > 0)
    .map((m) => {
      const d = parseLocalDate(m.date);
      const days = Math.round((d - b) / 86400000);
      return { date: m.date, d, days, z: zScore(WEIGHT_LMS, sexe, days / MONTH_DAYS, Number(m.valeur)) };
    })
    .filter((p) => p.days >= 14 && p.days / MONTH_DAYS <= 36 && p.d <= now)
    .sort((a, c) => a.d - c.d);
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  const prior = pts.slice(0, -1).filter((p) => last.d - p.d <= 183 * 86400000);
  if (!prior.length) return null;
  const best = prior.reduce((m, p) => (p.z > m.z ? p : m), prior[0]);
  const lines = linesCrossedDown(best.z, last.z);
  if (lines < 2) return null;
  return { lines, from: { date: best.date, band: bandOf(best.z) }, to: { date: last.date, band: bandOf(last.z) } };
}
