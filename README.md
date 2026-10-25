# OmniBaby — Application Android de suivi bébé

Application Android de suivi bébé multi-parents, synchronisée en temps réel via Firebase. 100% offline-first, sans publicité, sans tracking.

---

## Fonctionnalités

### 📓 Journal
- Saisie rapide : biberon (sein/biberon, quantité, durée, côté), change, autre ; le sommeil ouvre son formulaire dédié (début / fin / en cours)
- Saisie en 1 tap : Biberon (dernière quantité), Tétée (côté alterné), Pipi, Selles — bouton « Annuler » 5 s en cas de tap par erreur
- Couleur des selles (facultatif) : nuancier, les teintes décolorées (jaune pâle, mastic, blanche) affichent une alerte « à montrer rapidement à un médecin » + appel du médecin
- Vue « Tout » : les 60 derniers jours en direct, bouton « Charger l'historique » pour le reste
- Vitamine D : bandeau « Donnée » en 1 tap tant qu'elle n'est pas notée (< 24 mois)
- Tampons « temps écoulé » : depuis le dernier repas / change, sommeil en cours avec bouton Réveil
- Tap sur un tampon = filtre ; appui long = ajouter ce type d'entrée
- Vue compacte (toggle dans Réglages → Apparence)
- Résumé hebdomadaire : moyennes 7 jours pour le pédiatre
- Swipe gauche → corbeille avec confirmation
- Traçabilité multi-parents : « par Julien » / « modifié par Marie » sur chaque entrée
- Icônes SVG (navigation, journal, réglages)

### 📈 Santé
- Sections repliables : Vitamine D & alimentation, Poids, Taille, Périmètre crânien, Vaccins
- Courbes de croissance OMS : poids, taille, périmètre crânien avec percentiles
- Carnet de vaccination + notification 7 jours avant le prochain vaccin
- PDF pédiatre (voir Réglages)

### 🌙 Dodo
- Même présentation que le Journal : tampons (dort / éveillé avec bouton Réveil, total du jour, repère pour l'âge comparé à la moyenne 7 jours), lignes et glisser-supprimer communs
- Graphique 7 jours (jour en cours en pointillés, moyenne des jours terminés)
- Repères de sommeil selon l'âge

### 🛠️ Outils
| Module | Description |
|---|---|
| ⏱️ Minuteur | Chrono de tétée par sein ; notification « Tétée en cours » avec boutons Changer de côté / Terminer |
| 💊 Médicaments | Traitements + notification à l'heure de la prochaine dose (reprogrammée à chaque « Dose donnée ») |
| 🌡️ Fièvre | Courbe de température ; alerte dès 38 °C avant 3 mois (38,5 °C ensuite), méthode de prise, appel médecin / 15 |
| 🥦 Alimentation | Diversification 0-3 ans avec dates, grille aliments testés |
| 📊 Statistiques | Graphiques 7j / 30j / 3 mois ; carte « Lait au biberon » (ml/jour, ml/kg/jour, repère d'Appert < 6 mois) |
| 📸 Journal de bord | Souvenirs, premières fois, moments drôles |
| 🧩 Développement | Repères moteurs, langage et éveil par âge |
| 🎯 Rappels | RDV médicaux avec notifications locales |
| 🗂️ Historique | Toutes les entrées, tri par date ou type |
| 👨‍👩‍👧 Famille | Profils PIN de ce téléphone et leurs rôles |
| 🆘 Urgence | Fiche baby-sitter (accessible sans PIN) |
| 🔍 Recherche | Recherche globale dans toutes les données |

### ⚙️ Réglages (5 sections)
- **Bébé** : profils multi-enfants ; **profil test** (badge TEST, barre ocre, 7 jours de données d'exemple en option, Vider / Supprimer) ; suppression complète d'un enfant (profil + toutes ses données, partout ; prénom à retaper pour un vrai enfant)
- **Famille & synchro** : membres, code d'invitation (masqué + Partager), connexion / rejoindre, profils PIN, estimation des lectures Firebase du jour
- **Préférences** : thème, mode nuit (badge « Nuit » = arrêt jusqu'à 7 h), saisie, biométrie — propres à chaque téléphone
- **Rappels & notifications**
- **Sauvegarde & export** : nettoyage des données orphelines (rattachées à un enfant supprimé), JSON, PDF pédiatre (police Poppins embarquée, accents corrects), version

---

## Synchronisation famille (Firebase)

### Principe
Les données sont synchronisées en temps réel entre tous les appareils de la famille via Firebase Firestore. L'app reste utilisable hors-ligne (cache local IndexedDB) et se synchronise au retour du réseau.

### Quota (v3.10.0)
Les tables volumineuses (journal : repas, changes, sommeil ; températures) ne sont écoutées en direct que sur les **60 derniers jours** (`where('date', '>=', …)`, index simple automatique, aucune règle à changer). L'historique plus ancien est lu à la demande, une fois par session : Historique, Recherche, Statistiques 3 mois, export JSON / CSV, suppression d'un enfant, analyse des orphelins, ou bouton « Charger l'historique ». Les données anciennes déjà présentes sur le téléphone sont conservées. Réglages → Famille & synchro affiche une estimation haute des lectures du téléphone (quota gratuit : 50 000 / jour pour toute la famille).

### Premier lancement (4 étapes)
1. Présentation (3 écrans)
2. Ton profil : prénom + code PIN (stocké haché, SHA-256)
3. Synchronisation : connexion, nouveau compte, rejoindre, ou « plus tard »
4. Ton bébé : prénom, naissance, sexe, alimentation — ou « J'attends encore bébé »

### Flux Parent 1 (admin)
1. Étape 3 → « Nouveau compte » : la famille et son code à 6 chiffres sont créés, les données locales migrées
2. Réglages → Famille & synchro → **Partager** le code d'invitation

### Flux Parent 2
1. Étape 3 → « Rejoindre » → code à 6 chiffres + email/mot de passe
2. Le code est vérifié via `familyCodes/{code}` ; sans le bon code, impossible de rejoindre (règles Firestore)

### Règles Firestore
`firestore.rules` doit être publié dans la console Firebase (Firestore → Règles). Depuis la v3.8.0 :
- un éditeur peut modifier les enfants et réglages partagés (pas les membres ni le code) ;
- rejoindre une famille exige le code d'invitation ;
- `familyCodes/{code}` : lecture unitaire seulement, pas de listing ;
- `users/{uid}` : lisible uniquement par son propriétaire.

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
| Cache offline | persistentLocalCache Firestore (IndexedDB) + localStorage |
| Notifications | @capacitor/local-notifications |
| Biométrie | @capgo/capacitor-native-biometric 6.x |
| Export PDF | jsPDF + police Poppins (OFL) chargée à la demande |
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
│   ├── Journal.jsx          # Onglet Journal (assemble src/journal/*)
│   ├── journal/             # entryTypes, EntryForm, TodayOverview, EntryItem, QuickEntryBar, WeekSummary
│   ├── NoChildState.jsx     # État vide « Créer le profil de bébé »
│   ├── ChildForm.jsx        # Formulaire profil enfant
│   ├── ChildManager.jsx     # Choix d'enfant, profil test, suppression, orphelins
│   ├── children.js          # Logique : données par enfant, orphelins, données d'exemple
│   ├── HistoryNotice.jsx    # Historique au-delà de 60 jours : chargement à la demande
│   ├── readCounter.js       # Estimation des lectures Firestore du jour
│   ├── timer.js             # Minuteur de tétée + notification « Tétée en cours »
│   ├── icons.jsx            # Icônes SVG
│   ├── pdf.js               # PDF pédiatre + fiche de garde (chargé à la demande)
│   ├── Sante.jsx            # Courbes croissance, vaccins
│   ├── Dodo.jsx             # Sommeil, graphique
│   ├── Outils.jsx           # Grille 12 modules (icônes SVG)
│   ├── Reglages.jsx         # Réglages, synchro, export, À propos
│   ├── Modal.jsx            # Bottom-sheet + abandon formulaire
│   ├── store.jsx            # Store React Context + sync Firestore temps réel
│   ├── firebase.js          # Init Firebase + exports
│   ├── utils.jsx            # Helpers partagés (dates, Accordion, partage, notifications)
│   ├── assets/fonts/        # Poppins (PDF)
│   ├── styles.css           # Design system Terracotta
│   ├── version.js           # Version (générée par CI)
│   ├── data/
│   │   ├── who-growth.js    # Courbes OMS + calendrier vaccinal
│   │   └── diversification.js  # Étapes 0-3 ans + catégories aliments
│   └── tools/               # 11 modules Outils
├── google-services.json     # Config Firebase Android (à la racine)
├── firestore.rules          # Règles de sécurité Firestore (à publier dans la console)
├── scripts/check-code.mjs   # Vérification statique lancée par la CI avant le build
├── scripts/release-files.json # Empreintes des fichiers livrés (fichier oublié = build bloqué)
├── android-res/             # Ressources Android copiées par la CI (icône de notification)
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
| **3.8.0** | Corrections (saisie, rapport d'activité, Santé, rejoindre une famille), premier lancement en 4 étapes, journal « temps écoulé » + icônes SVG, Réglages en 5 sections, nouveau PDF pédiatre, PIN haché, vérification statique en CI |
| 3.9.0 | Profil test synchronisé, choix d'enfant en touchant son nom, suppression complète d'un enfant, nettoyage des données orphelines |
| 3.10.0 | Synchro 60 jours + historique à la demande (quota Firebase), notification Minuteur, notifications Médicaments/Rappels corrigées, annulation des saisies 1 tap, couleur des selles, seuil fièvre < 3 mois, carte lait au biberon, Dodo au style du Journal, icônes SVG des Outils |
| 3.10.1 | Notification du minuteur : catégorie « Tétée en cours » (sans son), contrôle d'affichage + secours, erreurs visibles ; contrôle CI des icônes et des fichiers livrés (scripts/release-files.json) |
| 3.10.2 | Notification du minuteur réparée (le plugin Capacitor renvoyé par une fonction async bloquait l'appel sans erreur) ; contrôle CI de ce piège |
| 3.11.0 | Icône de notification OmniBaby (pieds + cœur) dans la barre d'état pour le Minuteur, les Rappels et les Médicaments |

---

## CI/CD — GitHub Actions

Le workflow `.github/workflows/build.yml` :
1. Lit `version.properties`
2. `npm install` + `npm run check` (vérification statique : variables non définies, imports cassés, hooks React) + `npm run build` (Vite)
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
- **Fièvre du nourrisson** — avant 3 mois, 38 °C ou plus : examen médical rapide (MSD Manuals)
- **Carte colorimétrique des selles** — dépistage de l'atrésie des voies biliaires (selles décolorées)
- **Règle d'Appert** — besoins en lait jusqu'à 6 mois : poids (g) / 10 + 250 ml / jour

> Ces informations sont indicatives et ne remplacent pas l'avis d'un professionnel de santé.
