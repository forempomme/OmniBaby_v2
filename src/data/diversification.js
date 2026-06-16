// ------------------------------------------------------------------
// Étapes de diversification alimentaire par tranche d'âge (0-3 ans)
// Basé sur les recommandations PNNS / Santé publique France / OMS.
// Inclut hygiène bucco-dentaire et protection solaire.
// Chaque étape a un id stable (utilisé comme clé dans etapesDiv).
// ------------------------------------------------------------------

export const DIVERSIFICATION_STAGES = [
  {
    key: '0-6',
    label: '0-6 mois',
    icon: '🍼',
    steps: [
      { id: 'div_allaitement_exclusif', label: 'Allaitement exclusif ou lait infantile 1er âge', icon: '🍼' },
      { id: 'div_vitamineD_debut', label: 'Supplémentation en vitamine D débutée', icon: '💊' },
      { id: 'div_position_assise', label: 'Vérifier que bébé tient assis avec soutien (signe de maturité pour la diversification)', icon: '🪑' },
      { id: 'div_protection_solaire_0', label: 'Éviter toute exposition directe au soleil (peau très fragile)', icon: '☀️' },
      { id: 'div_brossage_gencives', label: 'Nettoyer les gencives avec une compresse humide après les tétées', icon: '🦷' },
    ],
  },
  {
    key: '6-9',
    label: '6-9 mois',
    icon: '🥣',
    steps: [
      { id: 'div_legumes', label: 'Introduction des légumes cuits mixés (carotte, courgette, haricot vert...)', icon: '🥕' },
      { id: 'div_fruits', label: 'Introduction des fruits cuits ou bien mûrs mixés', icon: '🍎' },
      { id: 'div_feculents', label: 'Introduction des féculents (riz, pâtes, pomme de terre, en purée)', icon: '🍚' },
      { id: 'div_proteines', label: 'Introduction des protéines (viande, poisson, œuf) en petite quantité', icon: '🍗' },
      { id: 'div_allergenes', label: 'Introduction progressive des aliments allergènes (œuf, arachide, fruits à coque, poisson) un par un', icon: '🥜' },
      { id: 'div_eau', label: "Proposer de l'eau dans un gobelet ou une tasse à bec", icon: '💧' },
      { id: 'div_brossage_premiere_dent', label: "Premier brossage dès l'apparition des premières dents (brosse souple, sans dentifrice fluoré avant 6 mois sauf avis médical)", icon: '🦷' },
      { id: 'div_protection_solaire_6', label: 'Protection solaire systématique : chapeau, ombre, vêtements couvrants, crème indice 50+', icon: '☀️' },
    ],
  },
  {
    key: '9-12',
    label: '9-12 mois',
    icon: '🍽️',
    steps: [
      { id: 'div_morceaux', label: 'Introduction progressive de morceaux mous (méthode DME possible)', icon: '🥄' },
      { id: 'div_repas_famille', label: 'Participation progressive aux repas familiaux (textures adaptées)', icon: '👨‍👩‍👧' },
      { id: 'div_produits_laitiers', label: 'Produits laitiers (yaourt, fromage) en complément du lait', icon: '🧀' },
      { id: 'div_brossage_routine', label: 'Mise en place d\'une routine de brossage 2x/jour avec dentifrice fluoré adapté (500 ppm)', icon: '🦷' },
      { id: 'div_gobelet', label: 'Transition progressive du biberon vers le gobelet', icon: '🥤' },
    ],
  },
  {
    key: '12-24',
    label: '12-24 mois',
    icon: '🍝',
    steps: [
      { id: 'div_lait_croissance', label: 'Transition vers le lait de croissance', icon: '🥛' },
      { id: 'div_diversite', label: 'Diversification complète : viandes, poissons, légumineuses, variété de textures', icon: '🍲' },
      { id: 'div_autonomie', label: "Encourager l'autonomie alimentaire (cuillère, doigts)", icon: '🍴' },
      { id: 'div_sel_sucre', label: 'Limiter le sel et le sucre ajoutés', icon: '🧂' },
      { id: 'div_brossage_accompagne', label: 'Brossage des dents accompagné matin et soir', icon: '🦷' },
      { id: 'div_protection_solaire_12', label: 'Poursuivre la protection solaire (crème renouvelée régulièrement, vêtements anti-UV)', icon: '☀️' },
    ],
  },
  {
    key: '24-36',
    label: '24-36 mois',
    icon: '🍎',
    steps: [
      { id: 'div_lait_vache', label: "Lait de vache entier possible en complément d'une alimentation variée", icon: '🥛' },
      { id: 'div_repas_structures', label: '4 repas/jour structurés (petit-déjeuner, déjeuner, goûter, dîner)', icon: '🕐' },
      { id: 'div_decouverte', label: "Poursuivre la découverte d'aliments variés, y compris ceux non aimés au premier essai", icon: '🍇' },
      { id: 'div_premier_dentiste', label: 'Première visite chez le dentiste recommandée', icon: '🦷' },
      { id: 'div_protection_solaire_24', label: 'Apprentissage progressif des bons réflexes de protection solaire', icon: '☀️' },
    ],
  },
];

// ------------------------------------------------------------------
// Catégories et statuts pour la liste "aliments testés"
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
  { key: 'a_tester', label: 'À tester', icon: '⬜', color: 'var(--text-soft)' },
  { key: 'aime', label: 'Aimé', icon: '😋', color: 'var(--accent-sage)' },
  { key: 'neutre', label: 'Neutre', icon: '😐', color: 'var(--accent-sun)' },
  { key: 'refuse', label: 'Refusé', icon: '🙅', color: 'var(--danger)' },
  { key: 'allergie', label: 'Réaction / allergie', icon: '⚠️', color: 'var(--danger)' },
];
