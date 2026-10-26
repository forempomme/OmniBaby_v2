// ----------------------------------------------------------------------
// Tire-lait et stock de lait maternel (v3.14).
//
// Durées de conservation (Direction générale de la santé, dépliant « Le
// lait maternel » ; AP-HP Necker, « Hospitalisation du nourrisson allaité ») :
//   réfrigérateur (+4 °C) : 48 h après le recueil
//   congélateur (−18 °C) : 4 mois
//   lait décongelé : 24 h au réfrigérateur, jamais recongelé
// Indications générales : l'appli ne remplace pas l'avis d'un soignant.
//
// Pot (table Firestore « lait ») :
//   { id, childId, date (recueil), quantite (ml), cote, lieu, depuis, sessionId }
//   lieu : 'frigo' | 'congel' | 'decongele' | 'utilise' | 'jete'
//   depuis : instant d'entrée dans le lieu actuel (congélation, décongélation…)
// ----------------------------------------------------------------------
export const FRIGO_H = 48;
export const CONGEL_MOIS = 4;
export const DECONGELE_H = 24;
export const SOON_H = 6; // « à utiliser bientôt » / notification

export const LIEUX = {
  frigo: { label: 'Frigo', icon: 'fridge' },
  congel: { label: 'Congélateur', icon: 'snow' },
  decongele: { label: 'Décongelé', icon: 'fridge' },
};

export function isActive(pot) {
  return pot && (pot.lieu === 'frigo' || pot.lieu === 'congel' || pot.lieu === 'decongele');
}

// Date limite d'utilisation du pot
export function potExpiry(pot) {
  if (pot.lieu === 'frigo') return new Date(new Date(pot.date).getTime() + FRIGO_H * 3600000);
  if (pot.lieu === 'decongele') return new Date(new Date(pot.depuis || pot.date).getTime() + DECONGELE_H * 3600000);
  if (pot.lieu === 'congel') {
    const d = new Date(pot.depuis || pot.date);
    d.setMonth(d.getMonth() + CONGEL_MOIS);
    return d;
  }
  return null;
}

// 'expired' | 'soon' | 'ok'
export function potStatus(pot, now = new Date()) {
  const exp = potExpiry(pot);
  if (!exp) return 'ok';
  const left = exp.getTime() - now.getTime();
  if (left <= 0) return 'expired';
  if (left <= SOON_H * 3600000) return 'soon';
  return 'ok';
}

// Totaux par lieu (pots encore utilisables)
export function stockSummary(pots, now = new Date()) {
  const out = { frigo: { ml: 0, n: 0 }, congel: { ml: 0, n: 0 } };
  for (const p of pots || []) {
    if (!isActive(p) || potStatus(p, now) === 'expired') continue;
    const k = p.lieu === 'congel' ? 'congel' : 'frigo'; // décongelé : au frigo
    out[k].ml += Number(p.quantite) || 0;
    out[k].n += 1;
  }
  return out;
}

// Pots utilisables d'abord, le plus proche de sa date limite en premier
export function sortPots(pots) {
  return (pots || []).filter(isActive).sort((a, b) => potExpiry(a) - potExpiry(b));
}

// Changements de lieu (champs à fusionner dans le pot)
export function moveTo(lieu, now = new Date()) {
  return { lieu, depuis: now.toISOString() };
}

// Entrée « biberon » du journal quand on utilise un pot
export function biberonFromPot(pot, now = new Date()) {
  return { type: 'biberon', mode: 'biberon', quantite: Number(pot.quantite) || 0, laitMaternel: true, date: now.toISOString(), potId: pot.id };
}

const pad = (n) => String(n).padStart(2, '0');
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dm = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

// « avant demain 08:10 », « avant le 02/02/2027 », « périmé depuis 10:10 »
export function expiryText(pot, now = new Date()) {
  const exp = potExpiry(pot);
  if (!exp) return '';
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(exp) - day(now)) / 86400000);
  if (exp <= now) return diff === 0 ? `périmé depuis ${hm(exp)}` : `périmé depuis le ${dm(exp)}`;
  if (pot.lieu === 'congel') return `avant le ${dm(exp)}/${exp.getFullYear()}`;
  if (diff === 0) return `avant ${hm(exp)}`;
  if (diff === 1) return `avant demain ${hm(exp)}`;
  return `avant le ${dm(exp)} ${hm(exp)}`;
}

// « tiré aujourd'hui 22:10 », « tiré le 24/10 à 08:10 »
export function pumpedText(pot, now = new Date()) {
  const d = new Date(pot.date);
  const same = d.toDateString() === now.toDateString();
  return same ? `tiré aujourd'hui ${hm(d)}` : `tiré le ${dm(d)} à ${hm(d)}`;
}
