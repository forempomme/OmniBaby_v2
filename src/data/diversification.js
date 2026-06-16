// ------------------------------------------------------------------
// Étapes de diversification 0-3 ans
// Sources : PNNS4, HCSP 2020, OMS 2023, Santé publique France 2021
// ------------------------------------------------------------------

export const DIVERSIFICATION_STAGES = [
  {
    key: '0-6',
    label: '0-6 mois',
    icon: '🍼',
    steps: [
      { id: 'div_allaitement_exclusif', label: 'Allaitement exclusif ou lait infantile 1er âge', icon: '🍼' },
      { id: 'div_vitamineD_debut', label: 'Supplémentation en vitamine D débutée', icon: '💊' },
      { id: 'div_position_assise', label: 'Vérifier que bébé tient assis avec soutien (signe de maturité)', icon: '🪑' },
      { id: 'div_protection_solaire_0', label: 'Éviter toute exposition directe au soleil (peau très fragile)', icon: '☀️' },
      { id: 'div_brossage_gencives', label: 'Nettoyer les gencives avec une compresse humide après les tétées', icon: '🦷' },
    ],
  },
  {
    key: '6-9',
    label: '6-9 mois',
    icon: '🥣',
    steps: [
      { id: 'div_legumes', label: 'Légumes cuits mixés (carotte, courgette, haricot vert...)', icon: '🥕' },
      { id: 'div_fruits', label: 'Fruits cuits ou bien mûrs mixés', icon: '🍎' },
      { id: 'div_feculents', label: 'Féculents (riz, pâtes, pomme de terre) en purée', icon: '🍚' },
      { id: 'div_proteines', label: 'Viande, poisson ou œuf : 10g/jour (2 c. à café)', icon: '🍗' },
      { id: 'div_allergenes', label: 'Allergènes introduits progressivement, un par un', icon: '🥜' },
      { id: 'div_eau', label: "Eau proposée dans un gobelet à bec", icon: '💧' },
      { id: 'div_brossage_premiere_dent', label: 'Brossage dès les premières dents (brosse souple)', icon: '🦷' },
      { id: 'div_protection_solaire_6', label: 'Protection solaire : chapeau, ombre, crème indice 50+', icon: '☀️' },
    ],
  },
  {
    key: '9-12',
    label: '9-12 mois',
    icon: '🍽️',
    steps: [
      { id: 'div_morceaux', label: 'Morceaux mous introduits (méthode DME possible dès 6 mois)', icon: '🥄' },
      { id: 'div_repas_famille', label: 'Participation progressive aux repas familiaux', icon: '👨‍👩‍👧' },
      { id: 'div_produits_laitiers', label: 'Yaourt, fromage en complément du lait', icon: '🧀' },
      { id: 'div_brossage_routine', label: 'Brossage 2x/jour avec dentifrice fluoré 500 ppm', icon: '🦷' },
      { id: 'div_gobelet', label: 'Transition progressive du biberon vers le gobelet', icon: '🥤' },
    ],
  },
  {
    key: '12-24',
    label: '12-24 mois',
    icon: '🍝',
    steps: [
      { id: 'div_lait_croissance', label: 'Lait de croissance (500-750 ml/jour) — lait animal déconseillé avant 1 an (OMS)', icon: '🥛' },
      { id: 'div_proteines_20g', label: 'Viande/poisson/œuf : 20g/jour (par année d\'âge)', icon: '🍗' },
      { id: 'div_diversite', label: 'Diversification complète : légumineuses, noix, graines', icon: '🍲' },
      { id: 'div_autonomie', label: "Autonomie alimentaire encouragée (cuillère, doigts)", icon: '🍴' },
      { id: 'div_sel_sucre', label: 'Limiter sel et sucres ajoutés (sucres libres < 5% AET)', icon: '🧂' },
      { id: 'div_eau_800', label: 'Eau : 800 ml/jour recommandés (HCSP 2020)', icon: '💧' },
      { id: 'div_brossage_accompagne', label: 'Brossage accompagné matin et soir', icon: '🦷' },
      { id: 'div_protection_solaire_12', label: 'Protection solaire (crème renouvelée, vêtements anti-UV)', icon: '☀️' },
    ],
  },
  {
    key: '24-36',
    label: '24-36 mois',
    icon: '🍎',
    steps: [
      { id: 'div_lait_croissance_2', label: 'Lait de croissance jusqu\'à 3 ans, ou lait de vache entier', icon: '🥛' },
      { id: 'div_proteines_30g', label: 'Viande/poisson/œuf : 30g/jour (3e année)', icon: '🍗' },
      { id: 'div_repas_structures', label: '4 repas structurés/jour (petit-déjeuner, déjeuner, goûter, dîner)', icon: '🕐' },
      { id: 'div_glucides', label: 'Glucides complexes : 40-50% des apports énergétiques totaux', icon: '🍚' },
      { id: 'div_sucres_libres', label: 'Sucres libres < 5% des apports — éviter boissons sucrées', icon: '🧃' },
      { id: 'div_eau_1300', label: 'Eau : 1300 ml/jour recommandés (HCSP 2020)', icon: '💧' },
      { id: 'div_decouverte', label: 'Proposer les aliments refusés à nouveau, sans forcer (~10 fois)', icon: '🍇' },
      { id: 'div_premier_dentiste', label: 'Première visite chez le dentiste recommandée', icon: '🦷' },
      { id: 'div_protection_solaire_24', label: 'Apprentissage des bons réflexes de protection solaire', icon: '☀️' },
    ],
  },
];

// ------------------------------------------------------------------
// Catégories et statuts
// ------------------------------------------------------------------
export const ALIMENT_CATEGORIES = [
  { key: 'legume', label: 'Légumes', icon: '🥕' },
  { key: 'fruit', label: 'Fruits', icon: '🍎' },
  { key: 'feculent', label: 'Féculents', icon: '🍚' },
  { key: 'proteine', label: 'Protéines', icon: '🍗' },
  { key: 'laitier', label: 'Produits laitiers', icon: '🧀' },
  { key: 'allergene', label: 'Allergènes', icon: '🥜' },
  { key: 'autre', label: 'Autre', icon: '🍽️' },
];

export const ALIMENT_STATUTS = [
  { key: 'a_tester', label: 'À tester', icon: '⬜', color: 'var(--text-soft)', bg: 'var(--surface-2)', border: 'var(--border)' },
  { key: 'aime', label: 'Aimé', icon: '😋', color: 'var(--accent-sage)', bg: 'var(--accent-sage-soft)', border: 'var(--accent-sage)' },
  { key: 'neutre', label: 'Neutre', icon: '😐', color: 'var(--accent-sun)', bg: 'var(--accent-sun-soft)', border: 'var(--accent-sun)' },
  { key: 'refuse', label: 'Refusé', icon: '🙅', color: 'var(--danger)', bg: 'var(--danger-soft)', border: 'var(--danger)' },
  { key: 'allergie', label: 'Allergie', icon: '⚠️', color: 'var(--danger)', bg: 'var(--danger-soft)', border: 'var(--danger)' },
];
