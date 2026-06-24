/**
 * OmniBaby — Cloud Functions Firebase
 * Gère les Custom Claims pour les règles Firestore sans lecture supplémentaire.
 *
 * Déploiement :
 *   cd functions && npm install && firebase deploy --only functions
 *
 * Prérequis :
 *   firebase init functions (choisir JavaScript, pas TypeScript)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// ----------------------------------------------------------------------
// setFamilyClaim — appelée côté client après création/rejoindre une famille
// Définit familyId + role dans le JWT de l'utilisateur
// ----------------------------------------------------------------------
exports.setFamilyClaim = functions.https.onCall(async (data, context) => {
  // Vérifier que l'utilisateur est authentifié
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Non authentifié');
  }

  const { familyId, role } = data;

  if (!familyId || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'familyId et role requis');
  }

  // Vérifier que l'utilisateur est bien membre de cette famille dans Firestore
  const memberDoc = await admin.firestore()
    .doc(`families/${familyId}/members/${context.auth.uid}`)
    .get();

  if (!memberDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Vous n\'êtes pas membre de cette famille');
  }

  // Définir le Custom Claim
  await admin.auth().setCustomUserClaims(context.auth.uid, {
    familyId,
    role,
  });

  return { success: true };
});

// ----------------------------------------------------------------------
// onUserJoinFamily — Firestore trigger : met à jour le claim automatiquement
// quand un document member est créé ou modifié
// ----------------------------------------------------------------------
exports.onMemberUpdate = functions.firestore
  .document('families/{familyId}/members/{userId}')
  .onWrite(async (change, context) => {
    const { familyId, userId } = context.params;

    if (!change.after.exists) {
      // Membre supprimé → retirer le claim
      await admin.auth().setCustomUserClaims(userId, {});
      return;
    }

    const memberData = change.after.data();
    await admin.auth().setCustomUserClaims(userId, {
      familyId,
      role: memberData.role || 'editeur',
    });

    console.log(`Claim mis à jour : ${userId} → famille ${familyId}, rôle ${memberData.role}`);
  });
