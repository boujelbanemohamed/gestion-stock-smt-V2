#!/bin/bash

# Script de diagnostic complet pour RedHat
# Résout les problèmes de connexion DB et variables d'environnement

echo "=========================================="
echo "🔍 Diagnostic Complet RedHat"
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

# 1. Diagnostic PostgreSQL
echo ""
echo "1️⃣ Diagnostic PostgreSQL..."

# Vérifier si PostgreSQL est démarré
if systemctl is-active --quiet postgresql; then
    log_success "PostgreSQL est démarré"
else
    log_warning "PostgreSQL n'est pas démarré"
    log_info "Démarrage de PostgreSQL..."
    systemctl start postgresql
    sleep 3
    if systemctl is-active --quiet postgresql; then
        log_success "PostgreSQL démarré avec succès"
    else
        log_error "Impossible de démarrer PostgreSQL"
    fi
fi

# Vérifier les processus PostgreSQL
echo ""
log_info "Processus PostgreSQL:"
ps aux | grep postgres | grep -v grep || log_warning "Aucun processus PostgreSQL trouvé"

# Vérifier les ports
echo ""
log_info "Ports PostgreSQL:"
netstat -tlnp | grep 5432 || log_warning "Port 5432 non ouvert"

# 2. Test de connexion avec stockapp
echo ""
echo "2️⃣ Test de connexion avec stockapp:SMT2025..."

# Test de connexion directe
if PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -c "SELECT 1;" 2>/dev/null; then
    log_success "Connexion stockapp:SMT2025 réussie"
else
    log_error "Connexion stockapp:SMT2025 échouée"
    
    # Vérifier si l'utilisateur stockapp existe
    echo ""
    log_info "Vérification de l'utilisateur stockapp..."
    if sudo -u postgres psql -c "\du" | grep -q stockapp; then
        log_success "Utilisateur stockapp existe"
    else
        log_warning "Utilisateur stockapp n'existe pas"
        log_info "Création de l'utilisateur stockapp..."
        sudo -u postgres psql -c "CREATE USER stockapp WITH PASSWORD 'SMT2025';" 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE stock_management TO stockapp;" 2>/dev/null || true
    fi
    
    # Vérifier si la base stock_management existe
    echo ""
    log_info "Vérification de la base stock_management..."
    if sudo -u postgres psql -c "\l" | grep -q stock_management; then
        log_success "Base stock_management existe"
    else
        log_warning "Base stock_management n'existe pas"
        log_info "Création de la base stock_management..."
        sudo -u postgres createdb stock_management 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE stock_management TO stockapp;" 2>/dev/null || true
    fi
fi

# 3. Diagnostic des variables d'environnement
echo ""
echo "3️⃣ Diagnostic des variables d'environnement..."

if [ -f ".env" ]; then
    log_success "Fichier .env trouvé"
    
    # Vérifier NODE_ENV
    if grep -q "NODE_ENV=production" .env; then
        log_success "NODE_ENV=production ✓"
    else
        log_warning "NODE_ENV manquant ou incorrect"
    fi
    
    # Vérifier DATABASE_URL
    if grep -q "DATABASE_URL=" .env; then
        log_success "DATABASE_URL configuré ✓"
        DATABASE_URL=$(grep "DATABASE_URL=" .env | cut -d'=' -f2 | tr -d '"')
        log_info "DATABASE_URL: $DATABASE_URL"
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
else
    log_error "Fichier .env manquant"
fi

# 4. Test de connexion Prisma
echo ""
echo "4️⃣ Test de connexion Prisma..."

# Charger les variables d'environnement
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    
    # Test de connexion Prisma
    if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
        log_success "Connexion Prisma réussie"
    else
        log_error "Connexion Prisma échouée"
        log_info "Vérification de la configuration DATABASE_URL..."
        echo "DATABASE_URL actuel: $DATABASE_URL"
    fi
fi

# 5. Vérification des tables
echo ""
echo "5️⃣ Vérification des tables..."

if PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -c "\dt" 2>/dev/null; then
    log_success "Tables accessibles"
    
    # Compter les tables
    TABLE_COUNT=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "0")
    log_info "Nombre de tables: $TABLE_COUNT"
    
    # Vérifier les tables principales
    MAIN_TABLES=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'banks', 'cards', 'locations', 'movements', 'audit_logs');" 2>/dev/null | xargs || echo "0")
    log_info "Tables principales: $MAIN_TABLES/5"
    
    if [ "$MAIN_TABLES" -ge "5" ]; then
        log_success "Tables principales présentes"
    else
        log_warning "Tables principales manquantes"
    fi
else
    log_error "Impossible d'accéder aux tables"
fi

# 6. Résumé et recommandations
echo ""
echo "=========================================="
echo "📊 Résumé du Diagnostic"
echo "=========================================="

# Vérifier PostgreSQL
if systemctl is-active --quiet postgresql; then
    echo "✅ PostgreSQL: Démarré"
else
    echo "❌ PostgreSQL: Arrêté"
fi

# Vérifier connexion stockapp
if PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -c "SELECT 1;" 2>/dev/null; then
    echo "✅ Connexion stockapp: OK"
else
    echo "❌ Connexion stockapp: Échec"
fi

# Vérifier .env
if [ -f ".env" ] && grep -q "NODE_ENV=production" .env && grep -q "DATABASE_URL=" .env; then
    echo "✅ Variables d'environnement: OK"
else
    echo "❌ Variables d'environnement: Problème"
fi

# Vérifier Prisma
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    echo "✅ Prisma: OK"
else
    echo "❌ Prisma: Échec"
fi

echo ""
echo "🔧 Actions recommandées:"
echo "1. Vérifier que PostgreSQL est démarré: systemctl status postgresql"
echo "2. Vérifier que l'utilisateur stockapp existe: sudo -u postgres psql -c '\du'"
echo "3. Vérifier que la base stock_management existe: sudo -u postgres psql -c '\l'"
echo "4. Tester la connexion: PGPASSWORD=SMT2025 psql -U stockapp -d stock_management"
echo "5. Vérifier le .env: cat .env | grep DATABASE_URL"
echo ""
echo "✅ Diagnostic terminé !"
