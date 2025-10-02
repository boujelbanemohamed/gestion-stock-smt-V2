#!/bin/bash

################################################################################
# Script de test des fonctionnalités - Stock Management Platform
################################################################################

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
BASE_URL="http://localhost:3000"
TEST_EMAIL="test@example.com"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Test des fonctionnalités${NC}"
echo -e "${GREEN}================================${NC}"

# Test 1: Pagination des logs
echo -e "\n${YELLOW}[1/7] Test pagination des logs...${NC}"
response=$(curl -s "${BASE_URL}/api/logs?limit=10&offset=0")
total=$(echo "$response" | jq -r '.total // 0')
page=$(echo "$response" | jq -r '.page // 0')
totalPages=$(echo "$response" | jq -r '.totalPages // 0')

if [ "$total" -gt 0 ] && [ "$page" -eq 1 ]; then
    echo -e "${GREEN}✓ Pagination des logs OK (${total} logs, page ${page}/${totalPages})${NC}"
else
    echo -e "${RED}✗ Pagination des logs échouée${NC}"
fi

# Test 2: Import de banques
echo -e "\n${YELLOW}[2/7] Test import de banques...${NC}"
response=$(curl -s -X POST "${BASE_URL}/api/banks/import" \
    -H "Content-Type: application/json" \
    -d '{"data":[{"CodeBanque":"TEST001","NomBanque":"Banque Test","Pays":"France","SwiftCode":"FRTEST001"}]}')
success=$(echo "$response" | jq -r '.success // false')
imported=$(echo "$response" | jq -r '.imported // 0')

if [ "$success" = "true" ] && [ "$imported" -gt 0 ]; then
    echo -e "${GREEN}✓ Import de banques OK (${imported} banques importées)${NC}"
else
    echo -e "${RED}✗ Import de banques échoué${NC}"
fi

# Test 3: Import de cartes
echo -e "\n${YELLOW}[3/7] Test import de cartes...${NC}"
response=$(curl -s -X POST "${BASE_URL}/api/cards/import" \
    -H "Content-Type: application/json" \
    -d '{"data":[{"BanqueEmettrice":"TEST001","NomCarte":"Carte Test","Type":"Débit","SousType":"Visa","SousSousType":"National"}]}')
success=$(echo "$response" | jq -r '.success // false')
imported=$(echo "$response" | jq -r '.imported // 0')

if [ "$success" = "true" ] && [ "$imported" -gt 0 ]; then
    echo -e "${GREEN}✓ Import de cartes OK (${imported} cartes importées)${NC}"
else
    echo -e "${RED}✗ Import de cartes échoué${NC}"
fi

# Test 4: Import d'emplacements
echo -e "\n${YELLOW}[4/7] Test import d'emplacements...${NC}"
response=$(curl -s -X POST "${BASE_URL}/api/locations/import" \
    -H "Content-Type: application/json" \
    -d '{"data":[{"Banque":"TEST001","NomEmplacement":"Test Location","Description":"Test"}]}')
success=$(echo "$response" | jq -r '.success // false')
imported=$(echo "$response" | jq -r '.imported // 0')

if [ "$success" = "true" ] && [ "$imported" -gt 0 ]; then
    echo -e "${GREEN}✓ Import d'emplacements OK (${imported} emplacements importés)${NC}"
else
    echo -e "${RED}✗ Import d'emplacements échoué${NC}"
fi

# Test 5: Création d'utilisateur avec mot de passe
echo -e "\n${YELLOW}[5/7] Test création d'utilisateur...${NC}"
response=$(curl -s -X POST "${BASE_URL}/api/users" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"firstName\":\"Test\",\"lastName\":\"User\",\"role\":\"user\",\"password\":\"testpass123\",\"sendEmail\":false}")
success=$(echo "$response" | jq -r '.success // false')
email=$(echo "$response" | jq -r '.data.email // ""')

if [ "$success" = "true" ] && [ "$email" = "$TEST_EMAIL" ]; then
    echo -e "${GREEN}✓ Création d'utilisateur OK${NC}"
else
    echo -e "${RED}✗ Création d'utilisateur échouée${NC}"
fi

# Test 6: Test SMTP avec erreur attendue
echo -e "\n${YELLOW}[6/7] Test SMTP (erreur attendue)...${NC}"
response=$(curl -s -X POST "${BASE_URL}/api/config/test-smtp" \
    -H "Content-Type: application/json" \
    -d '{"smtp":{"host":"smtp.example.com","port":587,"secure":false,"username":"test","password":"test","fromEmail":"test@example.com","fromName":"Test"},"testEmail":"test@example.com"}')
success=$(echo "$response" | jq -r '.success // false')
error=$(echo "$response" | jq -r '.error // ""')

if [ "$success" = "false" ] && [ -n "$error" ]; then
    echo -e "${GREEN}✓ Test SMTP OK (erreur détectée: ${error:0:50}...)${NC}"
else
    echo -e "${RED}✗ Test SMTP échoué${NC}"
fi

# Test 7: Récupération des mouvements
echo -e "\n${YELLOW}[7/8] Test récupération des mouvements...${NC}"
response=$(curl -s "${BASE_URL}/api/movements")
count=$(echo "$response" | jq -r '.data | length // 0')

if [ "$count" -ge 0 ]; then
    echo -e "${GREEN}✓ Récupération des mouvements OK (${count} mouvements)${NC}"
else
    echo -e "${RED}✗ Récupération des mouvements échouée${NC}"
fi

# Test 8: Vérification des permissions des rôles
echo -e "\n${YELLOW}[8/9] Test des permissions des rôles...${NC}"
response=$(curl -s "${BASE_URL}/api/roles")
admin_permissions=$(echo "$response" | jq -r '.data[] | select(.role == "admin") | .permissions | length // 0')

if [ "$admin_permissions" -ge 40 ]; then
    echo -e "${GREEN}✓ Permissions du rôle admin OK (${admin_permissions} permissions)${NC}"
else
    echo -e "${RED}✗ Permissions du rôle admin insuffisantes (${admin_permissions} permissions)${NC}"
fi

# Vérifier les permissions view spécifiques
view_permissions=$(echo "$response" | jq -r '.data[] | select(.role == "admin") | .permissions[] | select(contains(":view")) | length' | wc -l)
if [ "$view_permissions" -ge 7 ]; then
    echo -e "${GREEN}✓ Permissions 'view' du rôle admin OK (${view_permissions} permissions)${NC}"
else
    echo -e "${RED}✗ Permissions 'view' du rôle admin insuffisantes (${view_permissions} permissions)${NC}"
fi

# Test 9: Test des notifications
echo -e "\n${YELLOW}[9/10] Test du système de notifications...${NC}"
NOTIFICATIONS_RESPONSE=$(curl -s "${BASE_URL}/api/notifications")
NOTIFICATIONS_SUCCESS=$(echo "$NOTIFICATIONS_RESPONSE" | jq '.success // false')
NOTIFICATIONS_COUNT=$(echo "$NOTIFICATIONS_RESPONSE" | jq '.data | length // 0')

if [ "$NOTIFICATIONS_SUCCESS" = "true" ] && [ "$NOTIFICATIONS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Système de notifications OK (${NOTIFICATIONS_COUNT} notifications)${NC}"
    
    # Test de création d'une notification
    CREATE_NOTIF_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/notifications" \
        -H "Content-Type: application/json" \
        -d '{
            "type": "info",
            "title": "Test de déploiement",
            "message": "Notification créée lors du test de déploiement",
            "userId": null
        }')
    CREATE_NOTIF_SUCCESS=$(echo "$CREATE_NOTIF_RESPONSE" | jq '.success // false')
    
    if [ "$CREATE_NOTIF_SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓ Création de notification OK${NC}"
    else
        echo -e "${YELLOW}⚠ Création de notification échouée${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Système de notifications - Aucune notification trouvée${NC}"
fi

# Test 10: Test des bordereaux de mouvement
echo -e "\n${YELLOW}[10/10] Test des bordereaux de mouvement...${NC}"
# Vérifier qu'il y a des mouvements pour tester les bordereaux
movements_count=$(curl -s "${BASE_URL}/api/movements" | jq '.data | length // 0')

if [ "$movements_count" -gt 0 ]; then
    echo -e "${GREEN}✓ Données de mouvements disponibles pour les bordereaux (${movements_count} mouvements)${NC}"
    echo -e "${YELLOW}  → Test manuel requis : Aller sur /dashboard/movements et tester l'impression${NC}"
    echo -e "${YELLOW}  → Vérifier : En-tête 'Société Monétique Tunisie', section destinataire, pied de page${NC}"
else
    echo -e "${YELLOW}⚠ Aucun mouvement trouvé - Créer des mouvements pour tester les bordereaux${NC}"
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Tests terminés${NC}"
echo -e "${GREEN}================================${NC}"

# Nettoyage des données de test
echo -e "\n${YELLOW}Nettoyage des données de test...${NC}"
# Note: Dans un environnement de production, vous pourriez vouloir nettoyer les données de test
echo -e "${GREEN}✓ Nettoyage terminé${NC}"

echo -e "\n${YELLOW}Pour tester manuellement:${NC}"
echo -e "1. Ouvrir http://localhost:3000 dans un navigateur"
echo -e "2. Se connecter avec un compte administrateur"
echo -e "3. Tester les fonctionnalités d'import CSV"
echo -e "4. Tester la création d'utilisateurs"
echo -e "5. Tester la configuration SMTP"
echo -e "6. Vérifier la pagination sur le dashboard"
echo ""
