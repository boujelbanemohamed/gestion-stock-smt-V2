#!/bin/bash

################################################################################
# Script de restauration depuis une sauvegarde
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
APP_NAME="stock-management"
BACKUP_DIR="/var/backups/${APP_NAME}"
DB_NAME="stock_management"
DB_USER="stockapp"
APP_DIR="/var/www/${APP_NAME}"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Restauration de ${APP_NAME}${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Vérifier qu'un fichier de sauvegarde a été fourni
if [ -z "$1" ]; then
    echo -e "${RED}Erreur: Aucun fichier de sauvegarde spécifié${NC}"
    echo ""
    echo "Usage: $0 <timestamp>"
    echo ""
    echo "Sauvegardes disponibles:"
    ls -lh ${BACKUP_DIR}/backup_*_db.sql.gz 2>/dev/null | awk '{print $9}' | sed 's/.*backup_/  - /' | sed 's/_db.sql.gz//'
    exit 1
fi

TIMESTAMP=$1
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}"

# Vérifier que la sauvegarde existe
if [ ! -f "${BACKUP_FILE}_db.sql.gz" ]; then
    echo -e "${RED}Erreur: Sauvegarde introuvable: ${BACKUP_FILE}_db.sql.gz${NC}"
    exit 1
fi

# Confirmation
echo -e "${YELLOW}ATTENTION: Cette opération va écraser la base de données actuelle!${NC}"
echo -e "Fichier de sauvegarde: backup_${TIMESTAMP}"
read -p "Voulez-vous continuer? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restauration annulée"
    exit 0
fi

# Arrêter l'application
echo ""
echo "[1/4] Arrêt de l'application..."
pm2 stop ${APP_NAME} || true

# Restaurer la base de données
echo "[2/4] Restauration de la base de données..."
gunzip < "${BACKUP_FILE}_db.sql.gz" | sudo -u postgres psql ${DB_NAME}
echo -e "${GREEN}✓ Base de données restaurée${NC}"

# Restaurer le fichier .env
echo "[3/4] Restauration du fichier .env..."
if [ -f "${BACKUP_FILE}_env" ]; then
    cp "${BACKUP_FILE}_env" ${APP_DIR}/.env
    chown stockapp:stockapp ${APP_DIR}/.env
    chmod 600 ${APP_DIR}/.env
    echo -e "${GREEN}✓ Fichier .env restauré${NC}"
fi

# Restaurer les fichiers uploadés
echo "[4/4] Restauration des fichiers uploadés..."
if [ -f "${BACKUP_FILE}_uploads.tar.gz" ]; then
    tar -xzf "${BACKUP_FILE}_uploads.tar.gz" -C ${APP_DIR}/public/
    chown -R stockapp:stockapp ${APP_DIR}/public/uploads
    echo -e "${GREEN}✓ Fichiers uploadés restaurés${NC}"
fi

# Redémarrer l'application
echo ""
echo "Redémarrage de l'application..."
pm2 start ${APP_NAME}

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Restauration terminée!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
