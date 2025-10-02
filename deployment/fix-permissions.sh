#!/bin/bash

################################################################################
# Script de correction des permissions - Stock Management Platform
# Ce script corrige les permissions des rôles après déploiement
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
echo -e "${GREEN}Correction des permissions${NC}"
echo -e "${GREEN}================================${NC}"

# Vérifier que l'application est en cours d'exécution
echo -e "\n${YELLOW}Vérification de l'application...${NC}"
if ! curl -s "${BASE_URL}/api/roles" > /dev/null 2>&1; then
    echo -e "${RED}❌ L'application n'est pas accessible sur ${BASE_URL}${NC}"
    echo -e "${YELLOW}Assurez-vous que l'application est démarrée avec:${NC}"
    echo -e "  npm run dev"
    echo -e "  ou"
    echo -e "  pm2 start npm --name stock-management -- start"
    exit 1
fi

echo -e "${GREEN}✓ Application accessible${NC}"

# Récupérer l'ID du rôle admin
echo -e "\n${YELLOW}Récupération du rôle admin...${NC}"
ADMIN_ROLE_ID=$(curl -s "${BASE_URL}/api/roles" | jq -r '.data[] | select(.role == "admin") | .id')

if [ "$ADMIN_ROLE_ID" = "null" ] || [ -z "$ADMIN_ROLE_ID" ]; then
    echo -e "${RED}❌ Impossible de trouver le rôle admin${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Rôle admin trouvé (ID: ${ADMIN_ROLE_ID})${NC}"

# Vérifier les permissions actuelles
echo -e "\n${YELLOW}Vérification des permissions actuelles...${NC}"
CURRENT_PERMISSIONS=$(curl -s "${BASE_URL}/api/roles" | jq -r '.data[] | select(.role == "admin") | .permissions | length')
CURRENT_VIEW_PERMISSIONS=$(curl -s "${BASE_URL}/api/roles" | jq -r '.data[] | select(.role == "admin") | .permissions[] | select(contains(":view")) | length' | wc -l)

echo -e "Permissions actuelles: ${CURRENT_PERMISSIONS}"
echo -e "Permissions 'view': ${CURRENT_VIEW_PERMISSIONS}"

# Mettre à jour les permissions si nécessaire
if [ "$CURRENT_PERMISSIONS" -lt 40 ] || [ "$CURRENT_VIEW_PERMISSIONS" -lt 7 ]; then
    echo -e "\n${YELLOW}Mise à jour des permissions du rôle admin...${NC}"
    
    RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/roles/${ADMIN_ROLE_ID}" \
        -H "Content-Type: application/json" \
        -d '{
            "permissions": [
                "dashboard:view","banks:view","banks:create","banks:update","banks:delete","banks:import","banks:export","banks:print",
                "cards:view","cards:create","cards:update","cards:delete","cards:import","cards:export","cards:print",
                "locations:view","locations:create","locations:update","locations:delete","locations:import","locations:export","locations:print",
                "movements:view","movements:create","movements:update","movements:delete","movements:import","movements:export","movements:print",
                "users:view","users:create","users:update","users:delete","users:import","users:export","users:print",
                "logs:view","logs:create","logs:update","logs:delete","logs:import","logs:export","logs:print",
                "config:view","config:create","config:update","config:delete","config:import","config:export","config:print"
            ],
            "description": "Administrateur avec toutes les permissions"
        }')
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')
    
    if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ Permissions mises à jour avec succès${NC}"
        
        # Vérifier les nouvelles permissions
        NEW_PERMISSIONS=$(curl -s "${BASE_URL}/api/roles" | jq -r '.data[] | select(.role == "admin") | .permissions | length')
        NEW_VIEW_PERMISSIONS=$(curl -s "${BASE_URL}/api/roles" | jq -r '.data[] | select(.role == "admin") | .permissions[] | select(contains(":view")) | length' | wc -l)
        
        echo -e "Nouvelles permissions: ${NEW_PERMISSIONS}"
        echo -e "Nouvelles permissions 'view': ${NEW_VIEW_PERMISSIONS}"
        
        if [ "$NEW_PERMISSIONS" -ge 40 ] && [ "$NEW_VIEW_PERMISSIONS" -ge 7 ]; then
            echo -e "${GREEN}✓ Correction des permissions réussie${NC}"
        else
            echo -e "${RED}❌ Correction des permissions échouée${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Erreur lors de la mise à jour des permissions${NC}"
        echo -e "Réponse: $RESPONSE"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Les permissions sont déjà correctes${NC}"
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Correction terminée avec succès${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\n${YELLOW}Prochaines étapes:${NC}"
echo -e "1. Rafraîchir la page dans votre navigateur (F5)"
echo -e "2. Vérifier que toutes les pages sont accessibles"
echo -e "3. Tester la navigation entre les modules"
echo -e "4. Vérifier les permissions dans la page Utilisateurs"
echo ""
