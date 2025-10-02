#!/bin/bash

################################################################################
# Script de test des bordereaux de mouvement - Stock Management Platform
# Ce script vérifie que les bordereaux peuvent être générés correctement
################################################################################

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuration
BASE_URL="http://localhost:3000"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Test des bordereaux de mouvement${NC}"
echo -e "${GREEN}================================${NC}"

# Vérifier que l'application est en cours d'exécution
echo -e "\n${YELLOW}Vérification de l'application...${NC}"
if ! curl -s "${BASE_URL}/api/movements" > /dev/null 2>&1; then
    echo -e "${RED}❌ L'application n'est pas accessible sur ${BASE_URL}${NC}"
    echo -e "${YELLOW}Assurez-vous que l'application est démarrée avec:${NC}"
    echo -e "  npm run dev"
    echo -e "  ou"
    echo -e "  pm2 start npm --name stock-management -- start"
    exit 1
fi

echo -e "${GREEN}✓ Application accessible${NC}"

# Vérifier les mouvements disponibles
echo -e "\n${YELLOW}Vérification des mouvements disponibles...${NC}"
MOVEMENTS_COUNT=$(curl -s "${BASE_URL}/api/movements" | jq '.data | length // 0')

if [ "$MOVEMENTS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ ${MOVEMENTS_COUNT} mouvement(s) disponible(s) pour les tests${NC}"
else
    echo -e "${YELLOW}⚠ Aucun mouvement trouvé${NC}"
    echo -e "${YELLOW}Pour tester les bordereaux, créez d'abord des mouvements via l'interface${NC}"
    echo -e "${YELLOW}ou utilisez les scripts d'import CSV${NC}"
    exit 0
fi

# Vérifier que les utilisateurs existent (nécessaires pour les bordereaux)
echo -e "\n${YELLOW}Vérification des utilisateurs...${NC}"
USERS_COUNT=$(curl -s "${BASE_URL}/api/users" | jq '.data | length // 0')

if [ "$USERS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ ${USERS_COUNT} utilisateur(s) trouvé(s)${NC}"
else
    echo -e "${RED}❌ Aucun utilisateur trouvé - Les bordereaux nécessitent des utilisateurs${NC}"
    exit 1
fi

# Vérifier que les cartes existent
echo -e "\n${YELLOW}Vérification des cartes...${NC}"
CARDS_COUNT=$(curl -s "${BASE_URL}/api/cards" | jq '.data | length // 0')

if [ "$CARDS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ ${CARDS_COUNT} carte(s) trouvée(s)${NC}"
else
    echo -e "${RED}❌ Aucune carte trouvée - Les bordereaux nécessitent des cartes${NC}"
    exit 1
fi

# Vérifier que les emplacements existent
echo -e "\n${YELLOW}Vérification des emplacements...${NC}"
LOCATIONS_COUNT=$(curl -s "${BASE_URL}/api/locations" | jq '.data | length // 0')

if [ "$LOCATIONS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ ${LOCATIONS_COUNT} emplacement(s) trouvé(s)${NC}"
else
    echo -e "${RED}❌ Aucun emplacement trouvé - Les bordereaux nécessitent des emplacements${NC}"
    exit 1
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Tests automatiques terminés${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\n${YELLOW}📋 TESTS MANUELS REQUIS :${NC}"
echo -e "1. Ouvrez votre navigateur et allez sur : ${BASE_URL}/dashboard/movements"
echo -e "2. Connectez-vous avec un compte administrateur"
echo -e "3. Testez l'impression des bordereaux :"
echo -e ""
echo -e "${YELLOW}   A. Bordereau multiple :${NC}"
echo -e "   - Cliquez sur le bouton 'Imprimer Bordereau' (icône imprimante)"
echo -e "   - Vérifiez dans la fenêtre d'impression :"
echo -e "     ✓ En-tête : 'Société Monétique Tunisie'"
echo -e "     ✓ Titre : 'Bordereau de Mouvements de Stock'"
echo -e "     ✓ 'Bon de mouvement généré par : [Nom Prénom]'"
echo -e "     ✓ Section 'Destinataire' avec champs formatés"
echo -e "     ✓ Pied de page : 'Adresse : Centre urbain Nord, Sana Center, bloc C – 1082, Tunis'"
echo -e "     ✓ PAS de texte 'Document généré automatiquement...'"
echo -e ""
echo -e "${YELLOW}   B. Bordereau individuel :${NC}"
echo -e "   - Cliquez sur l'icône imprimante d'une ligne de mouvement"
echo -e "   - Vérifiez le même format dans la fenêtre d'impression"
echo -e ""
echo -e "${YELLOW}   C. Section Destinataire :${NC}"
echo -e "   - Vérifiez que les champs sont formatés sans tableau"
echo -e "   - Champs : Nom, Prénom, Fonction, Date, Signature"
echo -e "   - Lignes de saisie élégantes sous chaque label"
echo -e "   - Alignement et espacement corrects"

echo -e "\n${GREEN}✅ Si tous les éléments sont présents, les bordereaux fonctionnent correctement !${NC}"

echo -e "\n${YELLOW}📊 RÉSUMÉ DES DONNÉES DISPONIBLES :${NC}"
echo -e "  - Mouvements : ${MOVEMENTS_COUNT}"
echo -e "  - Utilisateurs : ${USERS_COUNT}"
echo -e "  - Cartes : ${CARDS_COUNT}"
echo -e "  - Emplacements : ${LOCATIONS_COUNT}"

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Test des bordereaux terminé${NC}"
echo -e "${GREEN}================================${NC}"
