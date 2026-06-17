# OmniBaby — Application Android de suivi bébé

Application Android 100% hors-ligne pour suivre l'alimentation, le sommeil, la santé et le développement de votre bébé. Multi-enfants, multi-utilisateurs, sans compte, sans serveur.

---

## Fonctionnalités

### 📓 Journal
- Saisie rapide : biberon (sein ou biberon, quantité, durée, côté), change (pipi/selles/mixte), sommeil
- Vitamine D : case à cocher lors de la saisie biberon, reminder automatique en topbar si non donnée
- Stamps enrichis : dernière heure + cumul journée (quantité totale, nombre de changes, durée sommeil)
- Appui long sur un stamp → formulaire pré-rempli du bon type
- Résumé hebdomadaire (vue 7 jours) : moyennes biberons/j, lait/j, changes/j pour le pédiatre
- Partage du résumé du jour (texte ou copie presse-papier)

### 📈 Santé
- Courbes de croissance OMS : poids, taille, périmètre crânien avec percentiles
- Carnet de vaccination (calendrier France 2024)
- Rappel vitamine D (< 24 mois)
- Conseils d'alimentation selon l'âge

### 🌙 Dodo
- Enregistrement nuits et siestes avec durée
- Graphique 7 jours
- Repères de sommeil selon l'âge (OMS)
- Stamps enrichis : durée cumulée nuits / siestes

### 🛠️ Outils
| Module | Description |
|---|---|
| ⏱️ Minuteur | Chrono de tétée par sein avec alternance gauche/droite |
| 💊 Médicaments | Traitements en cours avec alertes de dose |
| 🌡️ Fièvre | Courbe de température, alerte 38.5°C |
| 🥦 Alimentation | Diversification 0-3 ans (OMS/PNNS4/HCSP 2020), grille aliments testés |
| 📊 Statistiques | Graphiques 7j / 30j / 3 mois |
| 📸 Journal de bord | Souvenirs et étapes de développement |
| 🎯 Rappels | RDV et visites médicales |
| 🗂️ Historique | Toutes les entrées, tri par date ou par type |
| 👨‍👩‍👧 Famille | Utilisateurs et rôles (admin / éditeur / lecture) |
| 🆘 Urgence | Fiche baby-sitter avec allergies, médecin, contacts |
| 🔍 Recherche | Recherche globale dans toutes les données |

### ⚙️ Réglages
- Profils multi-enfants
- Thème auto (sombre 21h–7h) ou manuel
- Biométrie (empreinte digitale)
- Export / import JSON de toutes les données
- Export PDF résumé pédiatre

---

## Architecture technique

| Élément | Technologie |
|---|---|
| Framework | React 18 + Vite 5 |
| Mobile | Capacitor 6 (Android) |
| Biométrie | @capgo/capacitor-native-biometric 6.x |
| Export PDF | jsPDF |
| Stockage | localStorage (100% local, aucun serveur) |
| Style | CSS variables (thème Terracotta) |
| Polices | Fredoka (titres), Inter (corps), JetBrains Mono (chiffres) |

---

## Structure du projet

```
omnibaby/
├── src/
│   ├── App.jsx              # Shell principal, navigation, FAB contextuel
│   ├── Auth.jsx             # Écran de verrouillage PIN + biométrie
│   ├── Journal.jsx          # Onglet Journal (saisie, stamps, résumé hebdo)
│   ├── Sante.jsx            # Onglet Santé (courbes, vaccins)
│   ├── Dodo.jsx             # Onglet Dodo (sommeil, graphique)
│   ├── Outils.jsx           # Onglet Outils (grille des 11 modules)
│   ├── Reglages.jsx         # Onglet Réglages (profils, export, biométrie)
│   ├── Modal.jsx            # Bottom-sheet + confirmation abandon formulaire
│   ├── store.jsx            # Store React Context (état global + localStorage)
│   ├── utils.jsx            # Helpers partagés (Accordion, SwipeToDelete, export PDF...)
│   ├── styles.css           # Design system Terracotta
│   ├── version.js           # Version (générée par le CI)
│   ├── data/
│   │   ├── who-growth.js    # Courbes OMS croissance
│   │   └── diversification.js  # Étapes 0-3 ans + catégories aliments
│   └── tools/               # Les 11 modules de l'onglet Outils
│       ├── Minuteur.jsx
│       ├── Medicaments.jsx
│       ├── Fievre.jsx
│       ├── Alimentation.jsx
│       ├── Statistiques.jsx
│       ├── JournalBord.jsx
│       ├── Rappels.jsx
│       ├── Historique.jsx
│       ├── Famille.jsx
│       ├── Urgence.jsx
│       └── Recherche.jsx
├── assets/
│   └── android-icons/       # Icônes par densité (mdpi → xxxhdpi)
├── public/
│   └── icon.png             # Icône source (≥ 1024×1024 px)
├── .github/
│   └── workflows/
│       └── build.yml        # CI/CD GitHub Actions
├── version.properties       # Source de vérité du versioning
├── capacitor.config.json    # Configuration Capacitor
└── package.json
```

---

## Versioning

Le versioning suit [Semantic Versioning](https://semver.org/) :

| Type | Règle | Exemple |
|---|---|---|
| **PATCH** (x.x.X) | Bug fix, correction de build — invisible utilisateur | 2.0.1 |
| **MINOR** (x.X.0) | Nouvelle fonctionnalité visible | 2.1.0 |
| **MAJOR** (X.0.0) | Refonte majeure | 3.0.0 |

Pour incrémenter la version, modifier `version.properties` :
```properties
VERSION_MAJOR=2
VERSION_MINOR=3
VERSION_PATCH=0
```
Le CI génère automatiquement le tag git `v2.3.0` et la GitHub Release.

### Historique des versions
| Version | Description |
|---|---|
| 2.0.0 | Version initiale (migration depuis v1) |
| 2.0.1–2.0.9 | Corrections de build (npm, biométrie, JSX, permissions, icônes…) |
| 2.1.0 | Stamps enrichis · Accordéons · Grille aliments · 36 aliments pré-remplis |
| 2.2.0 | Biométrie (permission Android + bridge natif + toggle Réglages) |
| 2.3.0 | FAB contextuel · Badge minuteur · Reminder vitamine D · Mode baby-sitter · Appui long stamps · Résumé hebdomadaire · Tri Historique · Confirmation abandon · Animations |
| 2.4.0 | Export JSON via partage natif · Import JSON · Export PDF pédiatre |

---

## CI/CD — GitHub Actions

Le workflow `.github/workflows/build.yml` se déclenche à chaque push sur `main` ou manuellement.

**Étapes principales :**
1. Lecture de `version.properties`
2. `npm install` + `npm run build` (Vite → `dist/`)
3. Setup Java 17 + Android SDK
4. `npx cap add android` + `npx cap sync android`
5. Injection permission biométrie dans `AndroidManifest.xml`
6. Génération icônes via `@capacitor/assets` depuis `public/icon.png`
7. Injection keystore + configuration signature Gradle
8. `./gradlew assembleRelease`
9. Tag git + GitHub Release avec l'APK

**Secrets GitHub requis :**
| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Keystore encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_ALIAS` | Alias de la clé (`omnibaby`) |
| `KEY_PASSWORD` | Mot de passe de la clé |

---

## Installation sur Android

1. Télécharger `OmniBaby-vX.X.X.apk` depuis les [Releases](../../releases)
2. Ouvrir le fichier sur le téléphone Android
3. Autoriser l'installation depuis des sources inconnues si demandé
4. Installer — les données existantes sont conservées lors des mises à jour (même keystore)

> **Note Google Play Protect :** l'APK est signé par un keystore personnel (non validé par Google Play). Play Protect peut demander une analyse. Attendre 30–60 secondes puis choisir "Installer quand même", ou désactiver temporairement Play Protect dans les paramètres de sécurité.

---

## Sauvegarde des données

Toutes les données sont stockées localement sur l'appareil (`localStorage`). Aucune donnée n'est envoyée sur un serveur.

**Exporter :** Réglages → Données → 📤 Exporter — partage le fichier JSON via les applications du téléphone (Drive, Messages, email…)

**Importer :** Réglages → Données → 📥 Importer — sélectionner un fichier JSON exporté précédemment

**Export PDF pédiatre :** Réglages → Données → 📄 PDF pédiatre — génère un résumé avec courbes de croissance, vaccins et données récentes

> Pensez à exporter régulièrement. En cas de désinstallation ou de réinitialisation du téléphone, les données non sauvegardées sont perdues.

---

## Générer un keystore de production

Le keystore fourni dans cette session est un keystore de démonstration. Pour une utilisation en production, générer un keystore personnel :

```bash
chmod +x generate-keystore.sh
./generate-keystore.sh
```

Le script génère `omnibaby.keystore` et affiche les 4 valeurs à configurer dans GitHub Secrets.

> ⚠️ **Ne jamais perdre le keystore.** Perdre le keystore = impossible de mettre à jour l'app sur les téléphones existants (il faudrait désinstaller et réinstaller).

---

## Sources des recommandations médicales

- **OMS 2023** — Alimentation du nourrisson et du jeune enfant
- **PNNS4** — Programme National Nutrition Santé 2019–2023
- **HCSP 2020** — Avis relatif à la révision des repères alimentaires pour les enfants de 0 à 3 ans
- **Calendrier vaccinal France 2024** — Santé publique France

> Ces informations sont indicatives et ne remplacent pas l'avis d'un professionnel de santé.
