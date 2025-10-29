#!/bin/bash

set -euo pipefail

APP_DIR="/var/www/stock-management"
BRANCH="main"
PM2_APP_NAME="stock-app"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

rollback() {
  error "Une erreur est survenue. ROLLBACK vers le commit précédent: $PREV_COMMIT"
  cd "$APP_DIR"
  git reset --hard "$PREV_COMMIT" || true
  npm ci --prefer-offline --no-audit --no-fund || true
  npm run build || true
  pm2 reload all || true
  error "Rollback exécuté."
}

trap 'rollback' ERR

info "Déploiement de la fonctionnalité: Générer en masse les mouvements"
info "Répertoire: $APP_DIR | Branche: $BRANCH"

if [ "$(id -u)" -ne 0 ]; then
  warn "Il est recommandé d'exécuter ce script en root (sudo)."
fi

cd "$APP_DIR"

# Sauvegarde du commit courant pour rollback
PREV_COMMIT=$(git rev-parse HEAD)
info "Commit courant: $PREV_COMMIT"

# Récupération du dernier code
info "Récupération du code depuis origin/$BRANCH"
 git fetch origin "$BRANCH" --quiet
 git checkout "$BRANCH" --quiet
 git reset --hard "origin/$BRANCH"

# Vérification de la présence de la fonction côté UI
if grep -q "generateBulkMovements" components/dashboard/movements-management.tsx; then
  success "La fonctionnalité 'generateBulkMovements' est détectée dans l'UI."
else
  warn "'generateBulkMovements' non détecté dans l'UI. Vérification alternative..."
  if ! grep -q "Générer en masse les mouvements" components/dashboard/movements-management.tsx; then
    error "La version déployée ne contient pas le bouton de génération en masse. Assurez-vous d'avoir mergé la feature."
    exit 1
  fi
  success "Libellé du bouton détecté, poursuite du déploiement."
fi

# Installation des dépendances
info "Installation des dépendances (npm ci)"
 npm ci --prefer-offline --no-audit --no-fund

# Prisma (si présent)
if [ -f "prisma/schema.prisma" ]; then
  info "Regénération du client Prisma"
  npx prisma generate
fi

# Build
info "Construction de l'application (npm run build)"
 npm run build

# Redémarrage PM2
if command -v pm2 >/dev/null 2>&1; then
  info "Redémarrage PM2"
  pm2 reload all || pm2 restart all
  pm2 status || true
else
  warn "PM2 non détecté. Démarrage via 'npm start' conseillé manuellement."
fi

# Diagnostics rapides
info "Diagnostics rapides"
 node -v
 npm -v
 curl -s -o /dev/null -w "%{http_code}\n" http://localhost/ || true

# Vérification API mouvements
if command -v curl >/dev/null 2>&1; then
  info "Test API /api/movements"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/movements || true)
  echo "HTTP /api/movements: $HTTP_CODE"
fi

success "Déploiement terminé. La fonctionnalité de génération en masse est en place."
