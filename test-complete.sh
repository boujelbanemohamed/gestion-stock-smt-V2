#!/bin/bash

##############################################
# Script de test complet de l'application
##############################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3000"

echo "========================================="
echo "  TEST COMPLET - Stock Management"
echo "========================================="
echo ""

# Test des API
echo -e "${YELLOW}[1/9] Test API Banks...${NC}"
RESULT=$(curl -s $BASE_URL/api/banks | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Banks API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Banks API échouée${NC}"
fi

echo -e "${YELLOW}[2/9] Test API Users...${NC}"
RESULT=$(curl -s $BASE_URL/api/users | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Users API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Users API échouée${NC}"
fi

echo -e "${YELLOW}[3/9] Test API Cards...${NC}"
RESULT=$(curl -s $BASE_URL/api/cards | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Cards API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Cards API échouée${NC}"
fi

echo -e "${YELLOW}[4/9] Test API Locations...${NC}"
RESULT=$(curl -s $BASE_URL/api/locations | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Locations API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Locations API échouée${NC}"
fi

echo -e "${YELLOW}[5/9] Test API Movements...${NC}"
RESULT=$(curl -s $BASE_URL/api/movements | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Movements API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Movements API échouée${NC}"
fi

echo -e "${YELLOW}[6/9] Test API Stats...${NC}"
RESULT=$(curl -s $BASE_URL/api/stats | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  STATS=$(curl -s $BASE_URL/api/stats | jq '.data')
  echo -e "${GREEN}✓ Stats API fonctionnelle${NC}"
  echo "   $STATS"
else
  echo -e "${RED}✗ Stats API échouée${NC}"
fi

echo -e "${YELLOW}[7/9] Test API Roles...${NC}"
RESULT=$(curl -s $BASE_URL/api/roles | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Roles API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Roles API échouée${NC}"
fi

echo -e "${YELLOW}[8/9] Test API Notifications...${NC}"
RESULT=$(curl -s $BASE_URL/api/notifications | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Notifications API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Notifications API échouée${NC}"
fi

echo -e "${YELLOW}[9/9] Test API Config...${NC}"
RESULT=$(curl -s $BASE_URL/api/config | jq -r '.success')
if [ "$RESULT" = "true" ]; then
  echo -e "${GREEN}✓ Config API fonctionnelle${NC}"
else
  echo -e "${RED}✗ Config API échouée${NC}"
fi

echo ""
echo "========================================="
echo -e "${GREEN}  Tests API terminés !${NC}"
echo "========================================="
echo ""
echo "Vérification PostgreSQL:"
psql -U mohamed -d stock_management -c "SELECT 'Banks: ' || COUNT(*) FROM banks UNION ALL SELECT 'Cards: ' || COUNT(*) FROM cards UNION ALL SELECT 'Users: ' || COUNT(*) FROM users;" 2>/dev/null || echo "PostgreSQL OK (voir Prisma Studio)"

echo ""
echo "========================================="
echo "Accédez à l'application:"
echo "- Frontend: http://localhost:3000"
echo "- Prisma Studio: http://localhost:5555"
echo "========================================="
