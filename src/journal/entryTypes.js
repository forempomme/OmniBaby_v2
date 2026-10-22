import { formatTimeFR, toTime } from '../utils.jsx';

// ----------------------------------------------------------------------
// Types d'entrée du journal
// icon : emoji (outils Historique / Recherche) — svg : icône du journal
// Couleurs en variables CSS → correctes en thème clair, sombre et nuit.
// ----------------------------------------------------------------------
export const ENTRY_TYPES = {
  biberon: { label: 'Biberon / Tétée', short: 'Repas', icon: '🍼', svg: 'bottle', color: 'var(--primary-soft)', iconColor: 'var(--primary)' },
  couche: { label: 'Couche', short: 'Change', icon: '🧷', svg: 'droplet', color: 'var(--accent-sage-soft)', iconColor: 'var(--accent-sage)' },
  sommeil: { label: 'Sommeil', short: 'Sommeil', icon: '🌙', svg: 'moon', color: 'var(--accent-sky-soft)', iconColor: 'var(--accent-sky)' },
  autre: { label: 'Autre', short: 'Note', icon: '📝', svg: 'note', color: 'var(--accent-sun-soft)', iconColor: 'var(--accent-sun)' },
};

const COUCHE_LABELS = { pipi: 'pipi', selles: 'selles', mixte: 'pipi + selles', seche: 'sèche' };
const COTE_LABELS = { gauche: 'gauche', droit: 'droit', deux: 'les deux côtés' };

export function formatMinutes(min) {
  if (min == null || min === '') return '';
  const m = Math.round(Number(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${h} h`;
}

// Date de référence d'une entrée (début pour le sommeil)
export function entryStart(e) {
  return e.debut || e.date;
}

export function entryTime(e) {
  return toTime(entryStart(e));
}

// Ligne principale : « Biberon · 120 ml », « Change · selles », « Sieste · en cours »
export function entryTitle(e) {
  switch (e.type) {
    case 'biberon':
      if (e.mode === 'sein') return `Tétée${e.cote ? ' · ' + (COTE_LABELS[e.cote] || e.cote) : ''}`;
      return `Biberon${e.quantite ? ` · ${e.quantite} ml` : ''}`;
    case 'couche':
      return `Change${e.contenu ? ' · ' + (COUCHE_LABELS[e.contenu] || e.contenu) : ''}`;
    case 'sommeil': {
      const kind = e.sousType === 'nuit' ? 'Nuit' : 'Sieste';
      if (e.enCours) return `${kind} · en cours`;
      return `${kind}${e.duree ? ' · ' + formatMinutes(e.duree) : ''}`;
    }
    default:
      return 'Note';
  }
}

// Ligne secondaire : détails utiles, sans répéter le titre
export function entryDetail(e) {
  const parts = [];
  switch (e.type) {
    case 'biberon':
      if (e.mode === 'sein' && e.duree) parts.push(formatMinutes(e.duree));
      if (e.mode !== 'sein' && e.duree) parts.push(`en ${formatMinutes(e.duree)}`);
      if (e.vitamineD) parts.push('vitamine D');
      break;
    case 'sommeil':
      if (e.enCours) parts.push(`Depuis ${formatTimeFR(entryStart(e))}`);
      else if (e.fin) parts.push(`${formatTimeFR(entryStart(e))} → ${formatTimeFR(e.fin)}`);
      if (e.humeurReveil || e.humeur) parts.push(`réveil ${String(e.humeurReveil || e.humeur).toLowerCase()}`);
      if (e.note) parts.push(e.note);
      break;
    case 'autre':
      if (e.note) parts.push(e.note);
      break;
    default:
      break;
  }
  return parts.join(' · ');
}

export function entryAuthor(e) {
  if (e.sample) return 'exemple généré';
  if (e.updatedByName && e.updatedByName !== e.createdByName) return `modifié par ${e.updatedByName}`;
  if (e.createdByName) return `par ${e.createdByName}`;
  return '';
}

// Texte utilisé par la recherche du journal
export function entrySearchText(e) {
  return [
    ENTRY_TYPES[e.type]?.label, entryTitle(e), entryDetail(e),
    e.note, e.contenu, e.humeur, e.humeurReveil, e.createdByName, e.updatedByName,
    e.quantite != null ? String(e.quantite) : '',
  ].filter(Boolean).join(' ').toLowerCase();
}
