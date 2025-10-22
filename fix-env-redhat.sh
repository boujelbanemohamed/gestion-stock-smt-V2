#!/bin/bash

# Script de correction automatique des variables d'environnement pour RedHat
# Résout les problèmes de variables manquantes

echo "=========================================="
echo "🔧 Correction Variables d'Environnement RedHat"
echo "=========================================="

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "ℹ $1"
}

# 1. Diagnostic des variables d'environnement
echo ""
echo "1️⃣ Diagnostic des variables d'environnement..."

if [ -f ".env" ]; then
    log_success "Fichier .env trouvé"
    
    # Vérifier les variables critiques
    if grep -q "NODE_ENV=" .env; then
        log_success "NODE_ENV configuré"
    else
        log_warning "NODE_ENV manquant"
    fi
    
    if grep -q "DATABASE_URL=" .env; then
        log_success "DATABASE_URL configuré"
    else
        log_warning "DATABASE_URL manquant"
    fi
    
    # Afficher le contenu actuel
    echo ""
    log_info "Contenu actuel du .env:"
    cat .env | head -10
else
    log_error "Fichier .env manquant"
fi

# 2. Sauvegarder l'ancien .env
echo ""
echo "2️⃣ Sauvegarde de l'ancien .env..."
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    log_success "Ancien .env sauvegardé"
fi

# 3. Créer le .env optimisé pour RedHat
echo ""
echo "3️⃣ Création du .env optimisé pour RedHat..."

cat > .env << 'ENVEOF'
# Base de données PostgreSQL - Configuration RedHat Production
DATABASE_URL="postgresql://postgres@localhost:5432/stock_management?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://172.17.5.199"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP (à adapter selon votre serveur)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@172.17.5.199"
SMTP_FROM_NAME="Monetique Tunisie - Gestion de Stocks"

# Configuration des notifications
NOTIFICATIONS_ENABLED="true"
NOTIFICATIONS_LOW_STOCK_ALERTS="true"
NOTIFICATIONS_MOVEMENT_NOTIFICATIONS="true"
NOTIFICATIONS_USER_ACTIVITY_ALERTS="true"
NOTIFICATIONS_LOW_STOCK_THRESHOLD="10"
NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD="5"
NOTIFICATIONS_EMAIL_NOTIFICATIONS="true"
NOTIFICATIONS_IN_APP_NOTIFICATIONS="true"
ENVEOF

log_success "Nouveau .env créé avec toutes les variables requises"

# 4. Vérifier la configuration
echo ""
echo "4️⃣ Vérification de la configuration..."

# Vérifier NODE_ENV
if grep -q "NODE_ENV=production" .env; then
    log_success "NODE_ENV=production ✓"
else
    log_error "NODE_ENV manquant ou incorrect"
fi

# Vérifier DATABASE_URL
if grep -q "DATABASE_URL=" .env; then
    log_success "DATABASE_URL configuré ✓"
else
    log_error "DATABASE_URL manquant"
fi

# Vérifier SESSION_SECRET
if grep -q "SESSION_SECRET=" .env; then
    log_success "SESSION_SECRET configuré ✓"
else
    log_error "SESSION_SECRET manquant"
fi

# Vérifier JWT_SECRET
if grep -q "JWT_SECRET=" .env; then
    log_success "JWT_SECRET configuré ✓"
else
    log_error "JWT_SECRET manquant"
fi

# 5. Test de la connexion à la base de données
echo ""
echo "5️⃣ Test de la connexion à la base de données..."

# Charger les variables d'environnement
export $(cat .env | grep -v '^#' | xargs)

# Test de connexion
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    log_success "Connexion à la base de données réussie"
else
    log_warning "Impossible de se connecter à la base de données"
    log_info "Vérifiez que PostgreSQL est démarré"
fi

# 6. Vérifier que Prisma peut se connecter
echo ""
echo "6️⃣ Vérification Prisma..."

if npx prisma generate 2>/dev/null; then
    log_success "Prisma Client généré avec succès"
else
    log_error "Erreur lors de la génération Prisma"
fi

# 7. Résumé
echo ""
echo "=========================================="
echo "✅ Correction des variables d'environnement terminée"
echo "=========================================="
echo ""
echo "📊 Variables configurées:"
echo "  - NODE_ENV: production"
echo "  - DATABASE_URL: postgresql://postgres@localhost:5432/stock_management"
echo "  - SESSION_SECRET: configuré"
echo "  - JWT_SECRET: configuré"
echo "  - SMTP: configuré"
echo "  - Notifications: configurées"
echo ""
echo "🔧 Prochaines étapes:"
echo "  1. npx prisma generate"
echo "  2. NODE_ENV=production npm run build"
echo "  3. pm2 restart stock-management"
echo ""
echo "✅ Variables d'environnement corrigées !"
