// ----------------------------------------------------------------------
// Jalons de développement 0-36 mois
// Source : OMS / Société Française de Pédiatrie / HAS
// Paramétrables : on peut activer/désactiver des catégories dans les réglages
// ----------------------------------------------------------------------

export const DEV_CATEGORIES = [
  { key: 'moteur',    label: 'Motricité',   icon: '🏃', color: '#7C9885' },
  { key: 'langage',   label: 'Langage',     icon: '💬', color: '#6E97A8' },
  { key: 'social',    label: 'Social',      icon: '😊', color: '#C96F4A' },
  { key: 'cognitif',  label: 'Cognitif',    icon: '🧠', color: '#9B7EBD' },
  { key: 'aliment',   label: 'Alimentation', icon: '🍼', color: '#E0A458' },
];

// ageMin/ageMax en mois (fenêtre normale d'acquisition)
export const DEV_JALONS = [
  // 0-3 mois
  { id:'sourire_1m',    cat:'social',   ageMin:4,  ageMax:8,  label:'Premier sourire social',           emoji:'😊' },
  { id:'tete_2m',       cat:'moteur',   ageMin:6,  ageMax:12, label:'Tient sa tête',                   emoji:'💪' },
  { id:'regard_2m',     cat:'cognitif', ageMin:4,  ageMax:8,  label:'Suit un objet du regard',         emoji:'👀' },
  { id:'son_2m',        cat:'langage',  ageMin:6,  ageMax:12, label:'Émet des sons (gazouillis)',      emoji:'🎵' },
  // 3-6 mois
  { id:'rit_3m',        cat:'social',   ageMin:10, ageMax:16, label:'Rit aux éclats',                  emoji:'😂' },
  { id:'mains_3m',      cat:'moteur',   ageMin:10, ageMax:16, label:'Attrape un objet volontairement', emoji:'🤲' },
  { id:'assis_soutenu', cat:'moteur',   ageMin:14, ageMax:20, label:'Tient assis avec soutien',        emoji:'🪑' },
  { id:'retournement',  cat:'moteur',   ageMin:14, ageMax:20, label:'Se retourne ventre/dos',          emoji:'🔄' },
  { id:'babillage',     cat:'langage',  ageMin:14, ageMax:22, label:'Babillage (ba, ma, da...)',       emoji:'🗣️' },
  // 6-12 mois
  { id:'assis_seul',    cat:'moteur',   ageMin:20, ageMax:28, label:'Tient assis seul',               emoji:'🧘' },
  { id:'quatre_pattes', cat:'moteur',   ageMin:22, ageMax:32, label:'Se déplace à quatre pattes',      emoji:'🐾' },
  { id:'pincement',     cat:'moteur',   ageMin:28, ageMax:36, label:'Pince pouce-index',               emoji:'🤌' },
  { id:'mama_papa',     cat:'langage',  ageMin:26, ageMax:36, label:'Dit "mama" ou "papa"',            emoji:'👄' },
  { id:'coucou',        cat:'social',   ageMin:26, ageMax:36, label:'Joue à coucou',                   emoji:'🙈' },
  { id:'debout_appui',  cat:'moteur',   ageMin:28, ageMax:36, label:'Se met debout avec appui',        emoji:'🧍' },
  { id:'diversif',      cat:'aliment',  ageMin:22, ageMax:28, label:'Accepte purées variées',          emoji:'🥕' },
  // 12-18 mois
  { id:'premiers_pas',  cat:'moteur',   ageMin:36, ageMax:48, label:'Premiers pas seul',               emoji:'👣' },
  { id:'mots_1',        cat:'langage',  ageMin:36, ageMax:48, label:'Premier mot significatif',        emoji:'💬' },
  { id:'pointage',      cat:'cognitif', ageMin:36, ageMax:48, label:'Pointe du doigt',                 emoji:'👆' },
  { id:'gobelet',       cat:'aliment',  ageMin:36, ageMax:48, label:'Boit seul au gobelet',            emoji:'🥤' },
  // 18-24 mois
  { id:'mots_20',       cat:'langage',  ageMin:48, ageMax:60, label:'Vocabulaire de 20+ mots',         emoji:'📚' },
  { id:'associe_2mots', cat:'langage',  ageMin:50, ageMax:66, label:'Associe 2 mots',                  emoji:'🔗' },
  { id:'course',        cat:'moteur',   ageMin:44, ageMax:56, label:'Court sans tomber',               emoji:'🏃' },
  { id:'cuillere',      cat:'aliment',  ageMin:44, ageMax:60, label:'Mange seul à la cuillère',        emoji:'🥄' },
  // 24-36 mois
  { id:'phrases',       cat:'langage',  ageMin:60, ageMax:80, label:'Fait des phrases (3+ mots)',      emoji:'💭' },
  { id:'saute_2pieds',  cat:'moteur',   ageMin:60, ageMax:72, label:'Saute à pieds joints',            emoji:'🦘' },
  { id:'potty',         cat:'social',   ageMin:60, ageMax:80, label:'Contrôle sphinctérien',           emoji:'🚽' },
  { id:'tricycle',      cat:'moteur',   ageMin:72, ageMax:88, label:'Pédale sur un tricycle',          emoji:'🚲' },
  { id:'proprio',       cat:'social',   ageMin:60, ageMax:80, label:'Utilise "je" / "moi"',            emoji:'🙋' },
];
