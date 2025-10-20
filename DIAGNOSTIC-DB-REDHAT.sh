#!/bin/bash

# Script de diagnostic de la base de données RedHat
# À exécuter sur le serveur AVANT le déploiement

echo "=========================================="
echo "🔍 Diagnostic Base de Données RedHat"
echo "=========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_info() { echo -e "ℹ $1"; }

# 1. Vérifier PostgreSQL
echo "1️⃣ Vérification de PostgreSQL..."
if command -v psql &> /dev/null; then
    log_success "PostgreSQL installé"
    psql --version
else
    log_error "PostgreSQL n'est pas installé"
    exit 1
fi

echo ""

# 2. Vérifier la connexion
echo "2️⃣ Test de connexion à PostgreSQL..."
if sudo -u postgres psql -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Connexion PostgreSQL réussie (via sudo)"
elif psql -U postgres -c "SELECT 1;" > /dev/null 2>&1; then
    log_success "Connexion PostgreSQL réussie (directe)"
else
    log_error "Impossible de se connecter à PostgreSQL"
    log_info "Essayez : sudo -u postgres psql"
    exit 1
fi

# Déterminer la méthode de connexion à utiliser
if sudo -u postgres psql -c "SELECT 1;" > /dev/null 2>&1; then
    PSQL_CMD="sudo -u postgres psql"
    PGDUMP_CMD="sudo -u postgres pg_dump"
else
    PSQL_CMD="psql -U postgres"
    PGDUMP_CMD="pg_dump -U postgres"
fi
log_info "Méthode de connexion : $PSQL_CMD"

echo ""

# 3. Vérifier si la base de données existe
echo "3️⃣ Vérification de la base de données 'stock_management'..."
if $PSQL_CMD -lqt | cut -d \| -f 1 | grep -qw stock_management; then
    log_success "Base de données 'stock_management' existe"
else
    log_warning "Base de données 'stock_management' n'existe pas"
    log_info "Création de la base de données..."
    $PSQL_CMD -c "CREATE DATABASE stock_management;"
    log_success "Base de données créée"
fi

echo ""

# 4. Lister les tables
echo "4️⃣ Liste des tables dans la base de données..."
TABLES=$($PSQL_CMD stock_management -c "\dt" 2>&1)

if echo "$TABLES" | grep -q "No relations found"; then
    log_warning "Aucune table trouvée - Base de données VIDE"
    log_info "La base sera initialisée lors du déploiement"
else
    log_success "Tables trouvées :"
    $PSQL_CMD stock_management -c "\dt"
fi

echo ""

# 5. Compter les données (si tables existent)
echo "5️⃣ Comptage des données..."

# Fonction pour compter une table
count_table() {
    local table_name=$1
    local display_name=$2
    
    # Essayer avec guillemets doubles (Prisma style)
    COUNT=$($PSQL_CMD stock_management -t -c "SELECT COUNT(*) FROM \"$table_name\";" 2>/dev/null | xargs)
    
    if [ $? -eq 0 ] && [ ! -z "$COUNT" ]; then
        log_success "$display_name: $COUNT entrées"
        return 0
    fi
    
    # Essayer sans guillemets (minuscules)
    COUNT=$($PSQL_CMD stock_management -t -c "SELECT COUNT(*) FROM ${table_name,,};" 2>/dev/null | xargs)
    
    if [ $? -eq 0 ] && [ ! -z "$COUNT" ]; then
        log_success "$display_name: $COUNT entrées (table en minuscules)"
        return 0
    fi
    
    log_warning "$display_name: Table non trouvée"
    return 1
}

count_table "User" "Utilisateurs"
count_table "Bank" "Banques"
count_table "Card" "Cartes"
count_table "Location" "Emplacements"
count_table "Movement" "Mouvements"
count_table "StockLevel" "Niveaux de stock"
count_table "AuditLog" "Logs d'audit"
count_table "Notification" "Notifications"
count_table "RolePermission" "Permissions"
count_table "AppConfig" "Configuration"

echo ""

# 6. Vérifier le fichier .env
echo "6️⃣ Vérification du fichier .env..."
if [ -f ".env" ]; then
    log_success "Fichier .env trouvé"
    
    if grep -q "DATABASE_URL" .env; then
        log_success "DATABASE_URL configuré"
        grep "^DATABASE_URL=" .env | sed 's/\(.*:\/\/.*:\).*\(@.*\)/\1****\2/'
    else
        log_warning "DATABASE_URL manquant dans .env"
    fi
    
    if grep -q "NODE_ENV" .env; then
        NODE_ENV_VAL=$(grep "^NODE_ENV=" .env | cut -d'=' -f2 | tr -d '"')
        log_info "NODE_ENV=$NODE_ENV_VAL"
    else
        log_warning "NODE_ENV non défini"
    fi
else
    log_warning "Fichier .env non trouvé"
    
    if [ -f ".env.production" ]; then
        log_info "Fichier .env.production trouvé"
        log_info "Copiez-le : cp .env.production .env"
    else
        log_error "Aucun fichier .env ou .env.production"
    fi
fi

echo ""

# 7. Résumé
echo "=========================================="
echo "📊 Résumé du Diagnostic"
echo "=========================================="
echo ""

if echo "$TABLES" | grep -q "No relations found"; then
    echo "État : Base de données VIDE"
    echo ""
    echo "Actions à faire :"
    echo "  1. Vérifier que .env existe et contient DATABASE_URL"
    echo "  2. Exécuter : npx prisma generate"
    echo "  3. Exécuter : npx prisma db push"
    echo "  4. Ou lancer : ./deploy.sh (fait tout automatiquement)"
else
    echo "État : Base de données avec tables existantes"
    echo ""
    echo "Prêt pour le déploiement :"
    echo "  ./deploy.sh"
fi

echo ""

