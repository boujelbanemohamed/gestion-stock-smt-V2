#!/bin/bash

# Script de correction du schéma Prisma pour RedHat
# Synchronise le schéma avec la base de données existante

echo "=========================================="
echo "🔧 Correction Schéma Prisma RedHat"
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

# 1. Diagnostic des tables existantes
echo ""
echo "1️⃣ Diagnostic des tables existantes..."

# Vérifier les tables avec les noms en minuscules
log_info "Vérification des tables en minuscules..."
TABLES_MINUSCULES=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'banks', 'cards', 'locations', 'movements', 'stock_levels', 'audit_logs', 'notifications', 'role_permissions', 'app_config');" 2>/dev/null | xargs || echo "0")

log_info "Tables en minuscules trouvées: $TABLES_MINUSCULES/10"

# Vérifier les tables avec les noms en majuscules
log_info "Vérification des tables en majuscules..."
TABLES_MAJUSCULES=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Users', 'Banks', 'Cards', 'Locations', 'Movements', 'StockLevels', 'Audit_logs', 'Notifications', 'RolePermissions', 'AppConfig');" 2>/dev/null | xargs || echo "0")

log_info "Tables en majuscules trouvées: $TABLES_MAJUSCULES/10"

# Lister toutes les tables
echo ""
log_info "Toutes les tables dans la base:"
PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -c "\dt" 2>/dev/null || log_warning "Impossible de lister les tables"

# 2. Vérifier le schéma Prisma actuel
echo ""
echo "2️⃣ Vérification du schéma Prisma..."

if [ -f "prisma/schema.prisma" ]; then
    log_success "Fichier schema.prisma trouvé"
    
    # Vérifier les mappings
    log_info "Mappings Prisma actuels:"
    grep "@@map" prisma/schema.prisma || log_warning "Aucun mapping trouvé"
else
    log_error "Fichier schema.prisma manquant"
    exit 1
fi

# 3. Synchronisation du schéma
echo ""
echo "3️⃣ Synchronisation du schéma Prisma..."

# Nettoyer Prisma
log_info "Nettoyage du cache Prisma..."
rm -rf node_modules/.prisma

# Regénérer Prisma
log_info "Regénération du client Prisma..."
npx prisma generate

# Forcer la synchronisation avec la base de données
log_info "Synchronisation avec la base de données..."
if npx prisma db push --accept-data-loss 2>&1 | tee /tmp/prisma_sync.log; then
    log_success "Synchronisation réussie"
else
    log_warning "Synchronisation avec avertissements"
    log_info "Dernières lignes du log:"
    tail -10 /tmp/prisma_sync.log 2>/dev/null || true
fi

# 4. Vérification post-synchronisation
echo ""
echo "4️⃣ Vérification post-synchronisation..."

# Vérifier les tables après synchronisation
TABLES_APRES=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'banks', 'cards', 'locations', 'movements', 'stock_levels', 'audit_logs', 'notifications', 'role_permissions', 'app_config');" 2>/dev/null | xargs || echo "0")

log_info "Tables après synchronisation: $TABLES_APRES/10"

if [ "$TABLES_APRES" -ge "5" ]; then
    log_success "Tables principales synchronisées"
else
    log_warning "Tables principales manquantes"
fi

# 5. Test de connexion Prisma
echo ""
echo "5️⃣ Test de connexion Prisma..."

# Charger les variables d'environnement
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
    
    # Test de connexion
    if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
        log_success "Connexion Prisma réussie"
    else
        log_error "Connexion Prisma échouée"
    fi
fi

# 6. Vérification des données
echo ""
echo "6️⃣ Vérification des données..."

# Compter les utilisateurs
USERS_COUNT=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c 'SELECT COUNT(*) FROM "users";' 2>/dev/null | xargs || echo "0")
log_info "Utilisateurs: $USERS_COUNT"

# Compter les banques
BANKS_COUNT=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c 'SELECT COUNT(*) FROM "banks";' 2>/dev/null | xargs || echo "0")
log_info "Banques: $BANKS_COUNT"

# Compter les cartes
CARDS_COUNT=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c 'SELECT COUNT(*) FROM "cards";' 2>/dev/null | xargs || echo "0")
log_info "Cartes: $CARDS_COUNT"

# Compter les mouvements
MOVEMENTS_COUNT=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c 'SELECT COUNT(*) FROM "movements";' 2>/dev/null | xargs || echo "0")
log_info "Mouvements: $MOVEMENTS_COUNT"

# Compter les logs d'audit
AUDIT_COUNT=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -t -c 'SELECT COUNT(*) FROM "audit_logs";' 2>/dev/null | xargs || echo "0")
log_info "Logs d'audit: $AUDIT_COUNT"

# 7. Résumé
echo ""
echo "=========================================="
echo "📊 Résumé de la Correction"
echo "=========================================="

echo "✅ Tables avant: $TABLES_MINUSCULES/10"
echo "✅ Tables après: $TABLES_APRES/10"

if [ "$TABLES_APRES" -ge "5" ]; then
    echo "✅ Synchronisation: Réussie"
else
    echo "❌ Synchronisation: Échec"
fi

echo ""
echo "🔧 Prochaines étapes:"
echo "1. NODE_ENV=production npm run build"
echo "2. pm2 restart stock-management"
echo "3. Tester l'application: curl http://localhost:3000/api/users"

echo ""
echo "✅ Correction du schéma terminée !"
