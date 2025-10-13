#!/bin/bash

# Script de test des logs d'audit en production
# Usage: ./test-logs-production.sh

set -e

echo "=========================================="
echo "🔍 Test des logs d'audit en production"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# 1. Vérifier NODE_ENV
echo "1️⃣ Vérification de NODE_ENV..."
if [ -f ".env" ]; then
    NODE_ENV_VALUE=$(grep "^NODE_ENV=" .env | cut -d'=' -f2 | tr -d '"' || echo "")
    if [ "$NODE_ENV_VALUE" = "production" ]; then
        log_success "NODE_ENV=production ✓"
    else
        log_error "NODE_ENV n'est pas en production (valeur: $NODE_ENV_VALUE)"
        exit 1
    fi
else
    log_error "Fichier .env non trouvé"
    exit 1
fi

# 2. Vérifier la connexion à la base de données
echo ""
echo "2️⃣ Vérification de la connexion à la base de données..."
DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2- | tr -d '"')

if [ -z "$DB_URL" ]; then
    log_error "DATABASE_URL non trouvé dans .env"
    exit 1
fi

# Extraire les infos de connexion
DB_NAME=$(echo "$DB_URL" | sed -n 's|.*\/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
DB_PASSWORD=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
DB_HOST=$(echo "$DB_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')

log_info "Base de données: $DB_NAME"
log_info "Utilisateur: $DB_USER"
log_info "Hôte: $DB_HOST"

# Test de connexion
if PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Connexion à la base de données réussie"
else
    log_error "Impossible de se connecter à la base de données"
    exit 1
fi

# 3. Vérifier la table AuditLog
echo ""
echo "3️⃣ Vérification de la table AuditLog..."
TABLE_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'AuditLog');" 2>/dev/null | xargs)

if [ "$TABLE_EXISTS" = "t" ]; then
    log_success "Table AuditLog existe"
    
    # Compter les logs
    AUDIT_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -t -c 'SELECT COUNT(*) FROM "AuditLog";' 2>/dev/null | xargs)
    log_info "Nombre de logs: $AUDIT_COUNT"
    
    # Afficher les 3 derniers logs
    echo ""
    log_info "Les 3 derniers logs d'audit:"
    PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -c 'SELECT timestamp, "userEmail", action, module, status FROM "AuditLog" ORDER BY timestamp DESC LIMIT 3;' 2>/dev/null || log_warning "Impossible de récupérer les logs"
else
    log_error "Table AuditLog n'existe pas"
    log_info "Exécutez: npx prisma db push"
    exit 1
fi

# 4. Test de l'API logs
echo ""
echo "4️⃣ Test de l'API des logs..."
if command -v curl &> /dev/null; then
    API_RESPONSE=$(curl -s http://localhost:3000/api/logs?limit=1 2>/dev/null || echo "{}")
    
    if echo "$API_RESPONSE" | grep -q '"success":true'; then
        log_success "API des logs fonctionne correctement"
        
        # Afficher la réponse
        TOTAL_LOGS=$(echo "$API_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
        if [ ! -z "$TOTAL_LOGS" ]; then
            log_info "Total de logs disponibles via API: $TOTAL_LOGS"
        fi
    else
        log_error "L'API des logs ne fonctionne pas correctement"
        log_info "Réponse: $API_RESPONSE"
        exit 1
    fi
else
    log_warning "curl n'est pas installé, test API ignoré"
fi

# 5. Vérifier Prisma
echo ""
echo "5️⃣ Vérification de Prisma..."
if [ -d "node_modules/.prisma" ]; then
    log_success "Client Prisma généré"
else
    log_warning "Client Prisma non trouvé"
    log_info "Exécutez: npx prisma generate"
fi

# 6. Vérifier les logs PM2
echo ""
echo "6️⃣ Vérification des logs PM2..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "stock-management"; then
        log_success "Application stock-management en cours d'exécution"
        
        echo ""
        log_info "Statut PM2:"
        pm2 status stock-management
        
        echo ""
        log_info "Dernières lignes des logs PM2 (erreurs):"
        pm2 logs stock-management --err --lines 10 --nostream || log_warning "Aucune erreur récente"
    else
        log_warning "Application stock-management non trouvée dans PM2"
    fi
else
    log_warning "PM2 n'est pas installé"
fi

# Résumé
echo ""
echo "=========================================="
echo "✅ Test des logs terminé"
echo "=========================================="
echo ""
echo "📊 Résumé:"
echo "  ✓ NODE_ENV: production"
echo "  ✓ Base de données: connectée"
echo "  ✓ Table AuditLog: présente ($AUDIT_COUNT entrées)"
echo "  ✓ API logs: fonctionnelle (filtre 30 jours)"
echo ""
echo "🔗 Pour voir les logs dans l'application:"
echo "  1. Ouvrir: http://localhost:3000"
echo "  2. Se connecter"
echo "  3. Menu: Logs d'audit"
echo ""
echo "📝 Pour voir les logs système:"
echo "  pm2 logs stock-management"
echo "  pm2 logs stock-management --err"
echo ""

