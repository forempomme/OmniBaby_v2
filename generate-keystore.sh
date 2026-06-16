#!/bin/bash
# =====================================================================
# generate-keystore.sh
# Génère le keystore de signature pour OmniBaby.
# À exécuter UNE SEULE FOIS, localement, puis committer le résultat
# dans GitHub Secrets (KEYSTORE_BASE64).
#
# Prérequis : Java JDK installé (keytool disponible dans le PATH)
# =====================================================================

set -e

KEYSTORE_FILE="omnibaby.keystore"
ALIAS="omnibaby"
DNAME="CN=OmniBaby, OU=Mobile, O=OmniBaby, L=Paris, S=IDF, C=FR"
VALIDITY_DAYS=10950  # 30 ans

echo "=== Génération du keystore OmniBaby ==="
echo ""

# Demander les mots de passe
read -s -p "Mot de passe du keystore : " STORE_PASS
echo ""
read -s -p "Confirmer le mot de passe : " STORE_PASS2
echo ""

if [ "$STORE_PASS" != "$STORE_PASS2" ]; then
  echo "Erreur : les mots de passe ne correspondent pas."
  exit 1
fi

read -s -p "Mot de passe de la clé (peut être identique) : " KEY_PASS
echo ""

# Générer le keystore
keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity $VALIDITY_DAYS \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "$DNAME"

echo ""
echo "✅ Keystore généré : $KEYSTORE_FILE"
echo ""

# Encoder en base64 pour le secret GitHub
BASE64_VALUE=$(base64 -w 0 "$KEYSTORE_FILE")

echo "=== Secrets à configurer dans GitHub ==="
echo "(Settings → Secrets and variables → Actions)"
echo ""
echo "KEYSTORE_BASE64 :"
echo "$BASE64_VALUE"
echo ""
echo "KEYSTORE_PASSWORD : $STORE_PASS"
echo "KEY_ALIAS : $ALIAS"
echo "KEY_PASSWORD : $KEY_PASS"
echo ""
echo "⚠️  IMPORTANT : conservez ces valeurs dans un endroit sécurisé."
echo "    Perdre le keystore = impossible de mettre à jour l'app sur les téléphones existants."
