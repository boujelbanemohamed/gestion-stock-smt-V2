#!/bin/bash

################################################################################
# Script de sauvegarde automatique
# Sauvegarde la base de données et les fichiers de l'application
################################################################################

set -e

# Configuration
APP_NAME="stock-management"
BACKUP_DIR="/var/backups/${APP_NAME}"
DB_NAME="stock_management"
DB_USER="stockapp"
APP_DIR="/var/www/${APP_NAME}"
RETENTION_DAYS=30  # Garder les sauvegardes pendant 30 jours

# Créer le répertoire de sauvegarde
mkdir -p ${BACKUP_DIR}

# Nom du fichier de sauvegarde avec la date
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}"

echo "================================"
echo "Sauvegarde de ${APP_NAME}"
echo "================================"
echo "Date: $(date)"
echo ""

# Sauvegarde de la base de données PostgreSQL
echo "[1/3] Sauvegarde de la base de données..."
sudo -u postgres pg_dump ${DB_NAME} | gzip > "${BACKUP_FILE}_db.sql.gz"
echo "✓ Base de données sauvegardée: ${BACKUP_FILE}_db.sql.gz"

# Sauvegarde du fichier .env
echo "[2/3] Sauvegarde du fichier .env..."
cp ${APP_DIR}/.env "${BACKUP_FILE}_env"
echo "✓ Fichier .env sauvegardé: ${BACKUP_FILE}_env"

# Sauvegarde des fichiers uploadés (si applicable)
echo "[3/3] Sauvegarde des fichiers uploadés..."
if [ -d "${APP_DIR}/public/uploads" ]; then
    tar -czf "${BACKUP_FILE}_uploads.tar.gz" -C ${APP_DIR}/public uploads
    echo "✓ Fichiers uploadés sauvegardés: ${BACKUP_FILE}_uploads.tar.gz"
else
    echo "⚠ Pas de fichiers uploadés à sauvegarder"
fi

# Nettoyer les anciennes sauvegardes
echo ""
echo "Nettoyage des anciennes sauvegardes (> ${RETENTION_DAYS} jours)..."
find ${BACKUP_DIR} -name "backup_*" -type f -mtime +${RETENTION_DAYS} -delete
echo "✓ Anciennes sauvegardes supprimées"

# Afficher la taille de la sauvegarde
echo ""
echo "Taille de la sauvegarde:"
du -sh ${BACKUP_DIR}

echo ""
echo "================================"
echo "Sauvegarde terminée avec succès!"
echo "================================"
echo "Emplacement: ${BACKUP_DIR}"
echo ""
