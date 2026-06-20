# OmniBaby — Application Android de suivi bébé

Application Android de suivi bébé multi-parents, synchronisée en temps réel via Firebase. 100% offline-first, sans publicité, sans tracking.

---

## Fonctionnalités

### 📓 Journal
- Saisie rapide : biberon (sein/biberon, quantité, durée, côté), change, sommeil, autre
- Saisie ultra-rapide en 1 tap : Biberon, Pipi, Selles (heure automatique)
- Vitamine D : cochée lors du biberon, reminder automatique si non donnée (< 24 mois)
- Stamps enrichis : dernière heure + cumul journée
- Appui long sur un stamp → formulaire pré-rempli
- Vue compacte (toggle dans Réglages → Apparence)
- Résumé hebdomadaire : moyennes 7 jours pour le pédiatre
- Swipe gauche → corbeille avec confirmation
- Traçabilité multi-parents : ✍️ Maman / ✏️ Papa visible sur chaque entrée

### 📈 Santé
- Courbes de croissance OMS : poids, taille, périmètre crânien avec percentiles
- Carnet de vaccination (calendrier France 2024)
- Rappel vitamine D (< 24 mois)

### 🌙 Dodo
- Enregistrement nuits et siestes avec durée
- Graphique 7 jours
- Repères de sommeil selon l'âge (OMS)
- Stamps enrichis : durée cumulée nuits / siestes

### 🛠️ Outils
| Module | Description |
|---|---|
| ⏱️ Minuteur | Chrono de tétée par sein avec alternance |
| 💊 Médicaments | Traitements + notifications de dose automatiques |
| 🌡️ Fièvre | Courbe de température, alerte 38.5°C |
| 🥦 Alimentation | Diversification 0-3 ans avec dates, grille aliments testés |
| 📊 Statistiques | Graphiques 7j / 30j / 3 mois |
| 📸 Journal de bord | Souvenirs et étapes de développement |
| 🎯 Rappels | RDV médicaux avec notifications locales |
| 🗂️ Historique | Toutes les entrées, tri par date ou type |
| 👨‍👩‍👧 Famille | Utilisateurs, rôles, code d'invitation famille |
| 🆘 Urgence | Fiche baby-sitter (accessible sans PIN) |
| 🔍 Recherche | Recherche globale dans toutes les données |

### ⚙️ Réglages
- Profils multi-enfants
- Thème auto (sombre 21h–7h) ou manuel
- Vue compacte du Journal
- Biométrie (empreinte digitale)
- Synchronisation famille Firebase (code à 6 chiffres)
- Export / import JSON (partage natif Android)
- Export PDF résumé pédiatre (partage natif Android)
- À propos : version, sources médicales

---

## Synchronisation famille (Firebase)

### Principe
Les données sont synchronisées en temps réel entre tous les appareils de la famille via Firebase Firestore. L'app reste utilisable hors-ligne (cache local IndexedDB) et se synchronise au retour du réseau.

### Flux Parent 1 (admin)
1. Premier lancement → onboarding 3 écrans → créer profil PIN
2. Connexion Firebase → "Créer un compte" (email + mot de passe)
3. Les données locales sont migrées vers Firestore
4. Réglages → Synchronisation → noter le **code famille à 6 chiffres**

### Flux Parent 2
1. Installer l'APK → onboarding → créer profil PIN
2. Connexion Firebase → "Rejoindre une famille" → entrer le code à 6 chiffres
3. Toutes les données se synchronisent instantanément

### Statut de sync (topbar)
- 🟢 Synchronisé
- 🟡 Synchronisation en cours
- 🔴 Erreur de synchronisation
- ⚫ Hors-ligne (fonctionnel en local)

---

## Architecture technique

| Élément | Technologie |
|---|---|
| Framework | React 18 + Vite 5 |
| Mobile | Capacitor 6 (Android) |
| Base de données cloud | Firebase Firestore |
| Authentification | Firebase Auth (email/mot de passe) |
| Cache offline | IndexedDB (via Firebase SDK) + localStorage |
| Notifications | @capacitor/local-notifications |
| Biométrie | @capgo/capacitor-native-biometric 6.x |
| Export PDF | jsPDF |
| Partage fichiers | @capacitor/filesystem + @capacitor/share |
| Stockage local | localStorage |
| Polices | Fredoka (titres), Inter (corps), JetBrains Mono (chiffres) |

---

## Structure du projet

```
omnibaby/
├── src/
│   ├── App.jsx              # Shell principal, navigation, skeleton loader
│   ├── Auth.jsx             # Onboarding + écran PIN + biométrie + Firebase Auth
│   ├── Journal.jsx          # Journal (saisie rapide, swipe, traçabilité)
│   ├── Sante.jsx            # Courbes croissance, vaccins
│   ├── Dodo.jsx             # Sommeil, graphique
│   ├── Outils.jsx           # Grille 11 modules
│   ├── Reglages.jsx         # Réglages, synchro, export, À propos
│   ├── Modal.jsx            # Bottom-sheet + abandon formulaire
│   ├── store.jsx            # Store React Context + sync Firestore temps réel
│   ├── firebase.js          # Init Firebase + exports
│   ├── utils.jsx            # Helpers partagés (Accordion, notifications, PDF...)
│   ├── styles.css           # Design system Terracotta
│   ├── version.js           # Version (générée par CI)
│   ├── data/
│   │   ├── who-growth.js    # Courbes OMS + calendrier vaccinal
│   │   └── diversification.js  # Étapes 0-3 ans + catégories aliments
│   └── tools/               # 11 modules Outils
├── google-services.json     # Config Firebase Android (à la racine)
├── firestore.rules          # Règles de sécurité Firestore
├── assets/android-icons/    # Icônes par densité
├── public/icon.png          # Icône source ≥ 1024×1024px
├── .github/workflows/build.yml
├── version.properties       # SOURCE DE VÉRITÉ du versioning
├── capacitor.config.json
└── package.json
```

---

## Versioning (Semantic Versioning)

| Type | Règle | Exemple |
|---|---|---|
| PATCH (x.x.X) | Bug fix, correction de build | 3.0.1 |
| MINOR (x.X.0) | Nouvelle fonctionnalité visible | 3.1.0 |
| MAJOR (X.0.0) | Refonte majeure d'architecture | 3.0.0 |

### Historique
| Version | Description |
|---|---|
| 2.0.0 | Version initiale (migration depuis v1) |
| 2.0.1–2.0.10 | Corrections de build |
| 2.1.0 | Stamps enrichis, accordéons, grille aliments |
| 2.2.0 | Biométrie |
| 2.3.0 | FAB contextuel, baby-sitter, résumé hebdo, animations |
| 2.4.0 | Export JSON/PDF via partage natif |
| 2.5.0 | Topbar, saisie rapide, vue compacte, transitions |
| **3.0.0** | **Firebase Realtime Sync — refonte majeure** |
| 3.0.1–3.0.2 | Corrections Firebase (écran blanc, topbar) |
| 3.1.0 | Améliorations UI (stamps, modal handle, FAB, chips) |
| 3.2.0 | Recherche, notifications, onboarding, IDs UUID, Famille Firebase |

---

## CI/CD — GitHub Actions

Le workflow `.github/workflows/build.yml` :
1. Lit `version.properties`
2. `npm install` + `npm run build` (Vite)
3. Setup Java 17 + Android SDK
4. `npx cap add android` + `npx cap sync android`
5. Copie `google-services.json` → `android/app/`
6. Permission biométrie dans `AndroidManifest.xml`
7. Génération icônes via `@capacitor/assets`
8. Signature Gradle + `./gradlew assembleRelease`
9. Tag git + GitHub Release

**Secrets GitHub requis :**
| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Keystore encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe keystore |
| `KEY_ALIAS` | `omnibaby` |
| `KEY_PASSWORD` | Mot de passe clé |

---

## Installation Android

1. Télécharger `OmniBaby-vX.X.X.apk` depuis les [Releases](../../releases)
2. Ouvrir sur Android → autoriser sources inconnues → installer
3. Si Play Protect bloque : attendre 30s → "Installer quand même"

---

## Sauvegarde des données

**Avec Firebase (recommandé) :** données sauvegardées automatiquement dans le cloud. Réinstallation = reconnexion au compte = récupération complète.

**Sans Firebase :** données uniquement en local. En cas de désinstallation ou réinitialisation, les données sont perdues. **Pensez à exporter régulièrement** via Réglages → Données → Exporter JSON.

---

## Sources médicales

- **OMS 2023** — Alimentation du nourrisson et du jeune enfant
- **PNNS4** — Programme National Nutrition Santé 2019–2023
- **HCSP 2020** — Repères alimentaires 0-3 ans
- **Calendrier vaccinal France 2024** — Santé publique France

> Ces informations sont indicatives et ne remplacent pas l'avis d'un professionnel de santé.
