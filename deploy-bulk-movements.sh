#!/bin/bash

# Désactiver 'set -e' temporairement pour gérer les erreurs manuellement
set +euo pipefail

APP_DIR="/var/www/stock-management"
BRANCH="main"
PM2_APP_NAME="stock-app"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

rollback() {
  error "Une erreur est survenue. ROLLBACK vers le commit précédent: $PREV_COMMIT"
  cd "$APP_DIR" || exit 1
  git reset --hard "$PREV_COMMIT" || true
  npm ci --prefer-offline --no-audit --no-fund || true
  npm run build || true
  pm2 restart all || pm2 start npm --name "stock-app" -- start || true
  error "Rollback exécuté."
  exit 1
}

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

# Nettoyage avant reconstruction
info "Nettoyage du build précédent..."
rm -rf .next
rm -rf node_modules/.cache

# Vérification des variables d'environnement
info "Vérification des variables d'environnement..."
if [ ! -f ".env" ]; then
  error "Fichier .env non trouvé"
  exit 1
fi

# Installation des dépendances
info "Installation des dépendances (npm ci)"
if ! npm ci --prefer-offline --no-audit --no-fund; then
  error "Erreur lors de l'installation des dépendances"
  exit 1
fi

# Prisma (si présent)
if [ -f "prisma/schema.prisma" ]; then
  info "Regénération du client Prisma"
  if ! npx prisma generate; then
    error "Erreur lors de la génération de Prisma Client"
    exit 1
  fi
fi

# Build
info "Construction de l'application (npm run build)"
if ! npm run build; then
  error "Erreur lors du build"
  exit 1
fi
success "Build terminé avec succès"

# Redémarrage PM2
if command -v pm2 >/dev/null 2>&1; then
  info "Arrêt de PM2..."
  pm2 stop all 2>/dev/null || true
  pm2 delete all 2>/dev/null || true
  
  info "Démarrage de PM2..."
  pm2 start npm --name "stock-app" -- start || {
    error "Erreur lors du démarrage PM2"
    exit 1
  }
  
  info "Attente du démarrage (15s)..."
  sleep 15
  
  pm2 status || true
else
  warn "PM2 non détecté. Démarrage via 'npm start' conseillé manuellement."
fi

# Test de l'API /api/auth/login (test critique)
info "Test de l'API /api/auth/login..."
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}' 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
    success "✅ API /api/auth/login répond correctement (code: $HTTP_CODE - réponse attendue)"
  elif [ "$HTTP_CODE" = "500" ]; then
    error "❌ Erreur 500 détectée sur /api/auth/login"
    warn "Affichage des logs PM2 récents..."
    pm2 logs --lines 50 --nostream || true
    error "Veuillez exécuter: ./fix-500-error-bulk-deploy.sh"
    exit 1
  elif [ "$HTTP_CODE" = "000" ]; then
    warn "⚠️ Impossible de contacter l'API (service peut être en cours de démarrage)"
    warn "Vérifiez les logs PM2: pm2 logs"
  else
    info "Réponse HTTP: $HTTP_CODE"
  fi
fi

# Diagnostics rapides
info "Diagnostics rapides"
node -v || warn "Node.js non disponible"
npm -v || warn "npm non disponible"

success "Déploiement terminé. La fonctionnalité de génération en masse est en place."
info "Si vous rencontrez une erreur 500, exécutez: ./fix-500-error-bulk-deploy.sh"
