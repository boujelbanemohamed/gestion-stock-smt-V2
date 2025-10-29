#!/bin/bash

set -e

APP_DIR="/var/www/stock-management"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

info "🔍 Diagnostic et correction de l'erreur 500 après déploiement"
info "=================================================================="

cd "$APP_DIR" || { error "Répertoire $APP_DIR non trouvé"; exit 1; }

# 1. Diagnostic PM2
info "1. Vérification PM2..."
pm2 status || warn "PM2 non disponible ou pas d'applications"
pm2 logs --lines 50 --nostream || warn "Impossible de récupérer les logs PM2"

# 2. Vérification des logs Next.js
info "2. Vérification des logs applicatifs..."
if [ -f ".next/trace" ]; then
  tail -50 .next/trace || true
fi

# 3. Vérification de la base de données
info "3. Test de connexion à la base de données..."
if [ -f ".env" ]; then
  source .env 2>/dev/null || true
  if [ -n "${DATABASE_URL:-}" ]; then
    info "DATABASE_URL présent dans .env"
    # Test de connexion simple
    node -e "
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      prisma.\$connect()
        .then(() => { console.log('✅ Connexion DB OK'); process.exit(0); })
        .catch(e => { console.error('❌ Erreur DB:', e.message); process.exit(1); });
    " || warn "Problème de connexion à la base de données"
  else
    error "DATABASE_URL manquant dans .env"
  fi
else
  error "Fichier .env non trouvé"
fi

# 4. Vérification Prisma
info "4. Vérification Prisma Client..."
npx prisma generate || error "Erreur lors de la génération de Prisma Client"

# 5. Vérification des dépendances
info "5. Vérification des dépendances..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  warn "node_modules incomplet, réinstallation..."
  npm ci --prefer-offline --no-audit --no-fund || error "Erreur lors de l'installation des dépendances"
fi

# 6. Vérification du build
info "6. Vérification du build..."
if [ ! -d ".next" ]; then
  warn ".next/ manquant, reconstruction..."
  npm run build || error "Erreur lors du build"
else
  info ".next/ présent, vérification..."
fi

# 7. Vérification des fichiers de configuration
info "7. Vérification des fichiers de configuration..."
[ -f "package.json" ] && success "package.json OK" || error "package.json manquant"
[ -f "next.config.mjs" ] && success "next.config.mjs OK" || error "next.config.mjs manquant"
[ -f "tsconfig.json" ] && success "tsconfig.json OK" || warn "tsconfig.json manquant"

# 8. Nettoyage et reconstruction complète
info "8. Nettoyage et reconstruction complète..."
rm -rf .next
npm ci --prefer-offline --no-audit --no-fund
npx prisma generate
npm run build

# 9. Redémarrage PM2
info "9. Redémarrage de l'application..."
pm2 delete all 2>/dev/null || true
pm2 start npm --name "stock-app" -- start || pm2 restart all

# 10. Attente et test
info "10. Attente du démarrage (10s)..."
sleep 10

info "11. Test de l'API /api/auth/login..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
  success "✅ API répond correctement (code: $HTTP_CODE)"
elif [ "$HTTP_CODE" = "500" ]; then
  error "❌ Erreur 500 persistante"
  info "Logs PM2 récents:"
  pm2 logs --lines 100 --nostream || true
elif [ "$HTTP_CODE" = "000" ]; then
  warn "⚠️ Impossible de contacter l'API (service peut être en cours de démarrage)"
else
  info "Réponse HTTP: $HTTP_CODE"
fi

# 12. Affichage des logs récents
info "12. Derniers logs PM2 (50 lignes):"
pm2 logs --lines 50 --nostream || true

success "Diagnostic terminé. Vérifiez les logs ci-dessus pour identifier le problème."

