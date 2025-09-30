#!/bin/bash

################################################################################
# Script de mise à jour de l'application
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_NAME="stock-management"
APP_DIR="/var/www/${APP_NAME}"
APP_USER="stockapp"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Mise à jour de ${APP_NAME}${NC}"
echo -e "${GREEN}================================${NC}"

cd ${APP_DIR}

echo -e "\n${YELLOW}[1/7] Sauvegarde avant mise à jour...${NC}"
/usr/local/bin/backup-stock-management.sh

echo -e "\n${YELLOW}[2/7] Récupération des dernières modifications...${NC}"
sudo -u ${APP_USER} git pull origin main

echo -e "\n${YELLOW}[3/7] Installation des dépendances...${NC}"
sudo -u ${APP_USER} npm install

echo -e "\n${YELLOW}[4/7] Génération du client Prisma...${NC}"
sudo -u ${APP_USER} npx prisma generate

echo -e "\n${YELLOW}[5/7] Migration de la base de données...${NC}"
sudo -u ${APP_USER} npx prisma migrate deploy

echo -e "\n${YELLOW}[6/7] Build de l'application...${NC}"
sudo -u ${APP_USER} npm run build

echo -e "\n${YELLOW}[7/7] Redémarrage de l'application...${NC}"
pm2 restart ${APP_NAME}

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Mise à jour terminée!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Vérifiez les logs avec: pm2 logs ${APP_NAME}"
echo ""
