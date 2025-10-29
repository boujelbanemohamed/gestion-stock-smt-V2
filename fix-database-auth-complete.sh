#!/bin/bash

set -e

APP_DIR="/var/www/stock-management"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

info "🔧 Correction complète de l'erreur 500 - Authentification Base de Données"
info "========================================================================"

cd "$APP_DIR" || { error "Répertoire $APP_DIR non trouvé"; exit 1; }

# 1. Vérification du fichier .env
info "1. Vérification du fichier .env..."
if [ ! -f ".env" ]; then
  error ".env non trouvé. Création d'un fichier .env par défaut..."
  cat > .env << 'EOF'
# Database
DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"

# Session
SESSION_SECRET="your-secret-key-change-in-production"
JWT_SECRET="your-jwt-secret-change-in-production"

# Application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="http://localhost:3000"

# SMTP (optionnel)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM_EMAIL=""
SMTP_FROM_NAME=""

# Notifications
NOTIFICATIONS_ENABLED="true"
NOTIFICATIONS_LOW_STOCK_ALERTS="true"
NOTIFICATIONS_MOVEMENT_NOTIFICATIONS="true"
NOTIFICATIONS_USER_ACTIVITY_ALERTS="true"
NOTIFICATIONS_LOW_STOCK_THRESHOLD="10"
NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD="5"
NOTIFICATIONS_EMAIL_NOTIFICATIONS="false"
NOTIFICATIONS_IN_APP_NOTIFICATIONS="true"
EOF
  warn ".env créé avec des valeurs par défaut. VÉRIFIEZ ET MODIFIEZ LES VALEURS!"
fi

# 2. Vérification de DATABASE_URL dans .env
info "2. Vérification de DATABASE_URL..."
if ! grep -q "^DATABASE_URL=" .env; then
  error "DATABASE_URL manquant dans .env. Ajout..."
  echo 'DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"' >> .env
fi

# Extraction des informations de connexion depuis .env
source .env 2>/dev/null || true

if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL toujours vide après chargement"
  exit 1
fi

info "DATABASE_URL trouvé: $(echo $DATABASE_URL | sed 's/:[^:]*@/:****@/')"

# 3. Vérification PostgreSQL
info "3. Vérification de PostgreSQL..."
if ! systemctl is-active --quiet postgresql && ! systemctl is-active --quiet postgresql-*; then
  warn "PostgreSQL ne semble pas actif. Tentative de démarrage..."
  systemctl start postgresql || systemctl start postgresql-13 || systemctl start postgresql-14 || systemctl start postgresql-15 || true
  sleep 3
fi

# 4. Test de connexion PostgreSQL
info "4. Test de connexion PostgreSQL..."
PGUSER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
PGPASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
PGHOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
PGPORT=$(echo "$DATABASE_URL" | sed -n 's/.*@[^:]*:\([^/]*\)\/.*/\1/p')
PGDB=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

info "Tentative de connexion avec:"
info "  User: $PGUSER"
info "  Host: $PGHOST"
info "  Port: ${PGPORT:-5432}"
info "  Database: $PGDB"

# Test avec psql
if command -v psql >/dev/null 2>&1; then
  export PGPASSWORD="$PGPASS"
  if psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDB" -c "SELECT 1;" >/dev/null 2>&1; then
    success "✅ Connexion PostgreSQL réussie"
  else
    error "❌ Connexion PostgreSQL échouée"
    warn "Vérification de l'utilisateur et de la base de données..."
    
    # Tentative de création de l'utilisateur si nécessaire
    if psql -h "$PGHOST" -p "${PGPORT:-5432}" -U postgres -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
      info "Création de l'utilisateur $PGUSER si nécessaire..."
      psql -h "$PGHOST" -p "${PGPORT:-5432}" -U postgres -d postgres <<EOF 2>/dev/null || true
CREATE USER $PGUSER WITH PASSWORD '$PGPASS';
ALTER USER $PGUSER CREATEDB;
EOF
    fi
    
    # Tentative de création de la base de données
    info "Création de la base $PGDB si nécessaire..."
    psql -h "$PGHOST" -p "${PGPORT:-5432}" -U postgres -d postgres -c "CREATE DATABASE $PGDB;" 2>/dev/null || true
    
    # Nouveau test
    if psql -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDB" -c "SELECT 1;" >/dev/null 2>&1; then
      success "✅ Connexion PostgreSQL réussie après corrections"
    else
      error "❌ Connexion toujours échouée. Vérifiez manuellement:"
      info "  psql -h $PGHOST -p ${PGPORT:-5432} -U $PGUSER -d $PGDB"
      exit 1
    fi
  fi
  unset PGPASSWORD
else
  warn "psql non disponible, test de connexion ignoré"
fi

# 5. Test avec Prisma
info "5. Test de connexion avec Prisma..."
if [ -f "prisma/schema.prisma" ]; then
  # Régénération de Prisma Client
  info "Régénération de Prisma Client..."
  npx prisma generate || error "Erreur lors de la génération Prisma"
  
  # Test de connexion
  if node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.\$connect()
      .then(() => {
        console.log('✅ Connexion Prisma OK');
        return prisma.\$disconnect();
      })
      .then(() => process.exit(0))
      .catch(e => {
        console.error('❌ Erreur Prisma:', e.message);
        process.exit(1);
      });
  " 2>&1; then
    success "✅ Test de connexion Prisma réussi"
  else
    error "❌ Test de connexion Prisma échoué"
    exit 1
  fi
fi

# 6. Nettoyage et reconstruction
info "6. Nettoyage et reconstruction..."
rm -rf .next
rm -rf node_modules/.cache

info "Installation des dépendances..."
npm ci --prefer-offline --no-audit --no-fund || error "Erreur installation dépendances"

info "Construction de l'application..."
npm run build || error "Erreur lors du build"

# 7. Redémarrage PM2 avec variables d'environnement
info "7. Redémarrage de l'application..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Création d'un fichier ecosystem pour PM2 avec les variables d'environnement
if [ -f ".env" ]; then
  info "Création de la configuration PM2 avec variables d'environnement..."
  pm2 start npm --name "stock-app" -- start --update-env || {
    # Alternative: charger .env manuellement
    export $(cat .env | grep -v '^#' | xargs)
    pm2 start npm --name "stock-app" -- start
  }
else
  pm2 start npm --name "stock-app" -- start
fi

info "Attente du démarrage (15s)..."
sleep 15

# 8. Test de l'API
info "8. Test de l'API /api/auth/login..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
  success "✅ API /api/auth/login répond correctement (code: $HTTP_CODE)"
  success "✅ L'erreur 500 est corrigée!"
elif [ "$HTTP_CODE" = "500" ]; then
  error "❌ Erreur 500 persistante"
  warn "Affichage des logs PM2 récents (100 lignes)..."
  pm2 logs --lines 100 --nostream || true
  error "Vérifiez les logs ci-dessus pour identifier le problème"
  exit 1
else
  info "Réponse HTTP: $HTTP_CODE"
fi

# 9. Affichage du statut final
info "9. Statut final..."
pm2 status || true

success "✅ Correction terminée!"
info "Si l'erreur persiste, vérifiez:"
info "  1. Les logs PM2: pm2 logs"
info "  2. Le fichier .env: cat .env"
info "  3. La connexion PostgreSQL: psql -h $PGHOST -U $PGUSER -d $PGDB"

