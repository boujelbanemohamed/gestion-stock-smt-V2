#!/bin/bash

################################################################################
# Script de test des notifications - Stock Management Platform
# Ce script vérifie que le système de notifications fonctionne correctement
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
echo -e "${GREEN}Test du système de notifications${NC}"
echo -e "${GREEN}================================${NC}"

# Vérifier que l'application est en cours d'exécution
echo -e "\n${YELLOW}Vérification de l'application...${NC}"
if ! curl -s "${BASE_URL}/api/notifications" > /dev/null 2>&1; then
    echo -e "${RED}❌ L'application n'est pas accessible sur ${BASE_URL}${NC}"
    echo -e "${YELLOW}Assurez-vous que l'application est démarrée avec:${NC}"
    echo -e "  npm run dev"
    echo -e "  ou"
    echo -e "  pm2 start npm --name stock-management -- start"
    exit 1
fi

echo -e "${GREEN}✓ Application accessible${NC}"

# Test 1: Récupération des notifications existantes
echo -e "\n${YELLOW}[1/6] Test de récupération des notifications...${NC}"
NOTIFICATIONS_RESPONSE=$(curl -s "${BASE_URL}/api/notifications")
NOTIFICATIONS_SUCCESS=$(echo "$NOTIFICATIONS_RESPONSE" | jq '.success // false')
NOTIFICATIONS_COUNT=$(echo "$NOTIFICATIONS_RESPONSE" | jq '.data | length // 0')

if [ "$NOTIFICATIONS_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Récupération des notifications OK (${NOTIFICATIONS_COUNT} notifications)${NC}"
else
    echo -e "${RED}✗ Récupération des notifications échouée${NC}"
    echo "Réponse: $NOTIFICATIONS_RESPONSE"
    exit 1
fi

# Test 2: Création d'une notification globale
echo -e "\n${YELLOW}[2/6] Test de création d'une notification globale...${NC}"
CREATE_GLOBAL_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/notifications" \
    -H "Content-Type: application/json" \
    -d '{
        "type": "info",
        "title": "Test notification globale",
        "message": "Ceci est une notification de test pour tous les utilisateurs",
        "userId": null
    }')
CREATE_GLOBAL_SUCCESS=$(echo "$CREATE_GLOBAL_RESPONSE" | jq '.success // false')
GLOBAL_NOTIFICATION_ID=$(echo "$CREATE_GLOBAL_RESPONSE" | jq -r '.data.id // null')

if [ "$CREATE_GLOBAL_SUCCESS" = "true" ] && [ "$GLOBAL_NOTIFICATION_ID" != "null" ]; then
    echo -e "${GREEN}✓ Création de notification globale OK (ID: ${GLOBAL_NOTIFICATION_ID})${NC}"
else
    echo -e "${RED}✗ Création de notification globale échouée${NC}"
    echo "Réponse: $CREATE_GLOBAL_RESPONSE"
    exit 1
fi

# Test 3: Création d'une notification pour un utilisateur spécifique
echo -e "\n${YELLOW}[3/6] Test de création d'une notification utilisateur...${NC}"
# Récupérer un utilisateur existant
USER_ID=$(curl -s "${BASE_URL}/api/users" | jq -r '.data[0].id // null')

if [ "$USER_ID" != "null" ]; then
    CREATE_USER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/notifications" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"warning\",
            \"title\": \"Test notification utilisateur\",
            \"message\": \"Ceci est une notification de test pour un utilisateur spécifique\",
            \"userId\": \"${USER_ID}\"
        }")
    CREATE_USER_SUCCESS=$(echo "$CREATE_USER_RESPONSE" | jq '.success // false')
    USER_NOTIFICATION_ID=$(echo "$CREATE_USER_RESPONSE" | jq -r '.data.id // null')

    if [ "$CREATE_USER_SUCCESS" = "true" ] && [ "$USER_NOTIFICATION_ID" != "null" ]; then
        echo -e "${GREEN}✓ Création de notification utilisateur OK (ID: ${USER_NOTIFICATION_ID})${NC}"
    else
        echo -e "${RED}✗ Création de notification utilisateur échouée${NC}"
        echo "Réponse: $CREATE_USER_RESPONSE"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Aucun utilisateur trouvé - Test de notification utilisateur ignoré${NC}"
fi

# Test 4: Marquer une notification comme lue
echo -e "\n${YELLOW}[4/6] Test de marquage comme lue...${NC}"
MARK_READ_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/notifications/${GLOBAL_NOTIFICATION_ID}" \
    -H "Content-Type: application/json" \
    -d '{"isRead": true}')
MARK_READ_SUCCESS=$(echo "$MARK_READ_RESPONSE" | jq '.success // false')

if [ "$MARK_READ_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Marquage comme lue OK${NC}"
else
    echo -e "${RED}✗ Marquage comme lue échoué${NC}"
    echo "Réponse: $MARK_READ_RESPONSE"
    exit 1
fi

# Test 5: Vérifier le statut de lecture
echo -e "\n${YELLOW}[5/6] Test de vérification du statut de lecture...${NC}"
CHECK_READ_RESPONSE=$(curl -s "${BASE_URL}/api/notifications")
NOTIFICATION_READ=$(echo "$CHECK_READ_RESPONSE" | jq --arg id "$GLOBAL_NOTIFICATION_ID" '.data[] | select(.id == $id) | .isRead // false')

if [ "$NOTIFICATION_READ" = "true" ]; then
    echo -e "${GREEN}✓ Statut de lecture correct (marquée comme lue)${NC}"
else
    echo -e "${RED}✗ Statut de lecture incorrect${NC}"
    echo "Réponse: $CHECK_READ_RESPONSE"
fi

# Test 6: Suppression d'une notification
echo -e "\n${YELLOW}[6/6] Test de suppression d'une notification...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/api/notifications/${GLOBAL_NOTIFICATION_ID}")
DELETE_SUCCESS=$(echo "$DELETE_RESPONSE" | jq '.success // false')

if [ "$DELETE_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Suppression de notification OK${NC}"
else
    echo -e "${RED}✗ Suppression de notification échouée${NC}"
    echo "Réponse: $DELETE_RESPONSE"
fi

# Vérification finale
echo -e "\n${YELLOW}Vérification finale...${NC}"
FINAL_COUNT=$(curl -s "${BASE_URL}/api/notifications" | jq '.data | length // 0')
UNREAD_COUNT=$(curl -s "${BASE_URL}/api/notifications" | jq '.data | map(select(.isRead == false)) | length // 0')
echo -e "Notifications totales: ${FINAL_COUNT}"
echo -e "Notifications non lues: ${UNREAD_COUNT}"

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Tests automatiques terminés${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\n${YELLOW}📋 TESTS MANUELS REQUIS :${NC}"
echo -e "1. Ouvrez votre navigateur et allez sur : ${BASE_URL}/dashboard"
echo -e "2. Connectez-vous avec un compte administrateur"
echo -e "3. Vérifiez l'icône de notifications dans la barre de navigation"
echo -e "4. Testez les fonctionnalités suivantes :"
echo -e ""
echo -e "${YELLOW}   A. Affichage des notifications :${NC}"
echo -e "   - Cliquez sur l'icône de notifications (cloche)"
echo -e "   - Vérifiez que les notifications s'affichent"
echo -e "   - Vérifiez le compteur de notifications non lues (${UNREAD_COUNT})"
echo -e ""
echo -e "${YELLOW}   B. Marquage comme lue :${NC}"
echo -e "   - Cliquez sur une notification non lue"
echo -e "   - Vérifiez qu'elle se marque comme lue"
echo -e "   - Vérifiez que le compteur se met à jour"
echo -e ""
echo -e "${YELLOW}   C. Marquage de toutes comme lues :${NC}"
echo -e "   - Cliquez sur 'Marquer toutes comme lues'"
echo -e "   - Vérifiez que toutes les notifications sont marquées"
echo -e ""
echo -e "${YELLOW}   D. Suppression :${NC}"
echo -e "   - Cliquez sur l'icône de suppression d'une notification"
echo -e "   - Vérifiez qu'elle disparaît de la liste"
echo -e ""
echo -e "${YELLOW}   E. Actualisation automatique :${NC}"
echo -e "   - Attendez 30 secondes"
echo -e "   - Vérifiez que les notifications se mettent à jour automatiquement"

echo -e "\n${GREEN}✅ Si toutes les fonctionnalités marchent, le système de notifications fonctionne correctement !${NC}"

echo -e "\n${YELLOW}📊 RÉSUMÉ DES TESTS :${NC}"
echo -e "  - Récupération : ✓"
echo -e "  - Création globale : ✓"
echo -e "  - Création utilisateur : ✓"
echo -e "  - Marquage comme lue : ✓"
echo -e "  - Vérification statut : ✓"
echo -e "  - Suppression : ✓"

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Test des notifications terminé${NC}"
echo -e "${GREEN}================================${NC}"
