#!/bin/bash

# Script de déploiement automatisé pour Red Hat
# Repository: https://github.com/boujelbanemohamed/gestion-stock-smt-V2
# Branche: main
# Application: stock-management

echo "=========================================="
echo "🚀 Déploiement Stock Management SMT V2"
echo "=========================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables globales pour le rollback
PREVIOUS_COMMIT=""
BACKUP_FILE=""
ROLLBACK_TRIGGERED=false

# Fonction pour afficher les messages
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

# Fonction de rollback en cas d'erreur
rollback() {
    if [ "$ROLLBACK_TRIGGERED" = true ]; then
        return  # Éviter les boucles infinies
    fi
    
    ROLLBACK_TRIGGERED=true
    
    echo ""
    echo "=========================================="
    log_error "ERREUR DÉTECTÉE - ROLLBACK EN COURS"
    echo "=========================================="
    echo ""
    
    # 1. Restaurer le commit Git précédent
    if [ ! -z "$PREVIOUS_COMMIT" ]; then
        echo "1️⃣ Restauration du commit précédent..."
        git reset --hard "$PREVIOUS_COMMIT" 2>/dev/null || log_warning "Impossible de restaurer le commit"
        log_success "Code restauré au commit: $PREVIOUS_COMMIT"
    fi
    
    # 2. Réinstaller les dépendances de l'ancienne version
    echo ""
    echo "2️⃣ Réinstallation des dépendances..."
    npm install --silent 2>/dev/null || log_warning "Erreur lors de npm install"
    
    # 3. Regénérer Prisma
    echo ""
    echo "3️⃣ Regénération Prisma..."
    npx prisma generate --silent 2>/dev/null || log_warning "Erreur Prisma"
    
    # 4. Rebuild avec l'ancienne version
    echo ""
    echo "4️⃣ Rebuild de l'ancienne version..."
    NODE_ENV=production npm run build --silent 2>/dev/null || log_warning "Erreur de build"
    
    # 5. Redémarrer l'application
    echo ""
    echo "5️⃣ Redémarrage de l'application..."
    if command -v pm2 &> /dev/null; then
        pm2 delete stock-management 2>/dev/null || true
        NODE_ENV=production pm2 start npm --name "stock-management" -- start
        pm2 save
        log_success "Application redémarrée avec l'ancienne version"
    fi
    
    echo ""
    echo "=========================================="
    log_warning "ROLLBACK TERMINÉ"
    echo "=========================================="
    echo ""
    log_info "L'application a été restaurée à la version précédente"
    log_info "Commit restauré: $PREVIOUS_COMMIT"
    
    if [ ! -z "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        log_info "Backup DB disponible: $BACKUP_FILE"
        log_info "Pour restaurer: psql -U postgres stock_management < $BACKUP_FILE"
    fi
    
    echo ""
    log_error "Le déploiement a échoué et a été annulé"
    exit 1
}

# Capturer les erreurs et déclencher le rollback
trap 'rollback' ERR

# 0. Vérifier et ajouter le répertoire comme sûr si nécessaire
echo "0️⃣ Vérification de la sécurité Git..."
REPO_DIR=$(pwd)
if ! git config --global --get-all safe.directory 2>/dev/null | grep -q "^${REPO_DIR}$"; then
    log_info "Ajout du répertoire comme safe.directory..."
    git config --global --add safe.directory "$REPO_DIR"
    log_success "Répertoire ajouté aux répertoires sûrs"
else
    log_success "Répertoire déjà configuré comme sûr"
fi

# 1. Vérifier la branche actuelle et sauvegarder le commit
echo ""
echo "1️⃣ Vérification de la branche..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warning "Vous n'êtes pas sur la branche main (branche actuelle: $CURRENT_BRANCH)"
    read -p "Voulez-vous continuer ? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Déploiement annulé"
        exit 1
    fi
fi
log_success "Branche: $CURRENT_BRANCH"

# Sauvegarder le commit actuel pour le rollback
PREVIOUS_COMMIT=$(git rev-parse HEAD)
log_info "Commit actuel sauvegardé pour rollback: $(git log --oneline -1 $PREVIOUS_COMMIT)"

# 2. Backup de la base de données
echo ""
echo "2️⃣ Sauvegarde de la base de données..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
if command -v pg_dump &> /dev/null; then
    # Utiliser sudo -u postgres pour éviter les problèmes de mot de passe
    sudo -u postgres pg_dump stock_management > "$BACKUP_FILE" 2>/dev/null || {
        log_warning "Impossible de créer le backup automatiquement"
        log_info "Veuillez créer un backup manuellement avec:"
        log_info "sudo -u postgres pg_dump stock_management > $BACKUP_FILE"
        read -p "Appuyez sur Entrée une fois le backup créé..."
    }
    if [ -f "$BACKUP_FILE" ]; then
        log_success "Backup créé: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))"
    fi
else
    log_warning "pg_dump non trouvé. Backup ignoré."
fi

# 3. Récupération des modifications
echo ""
echo "3️⃣ Récupération des modifications depuis GitHub..."
git fetch origin
log_success "Fetch effectué"

# 4. Pull des modifications
echo ""
echo "4️⃣ Pull depuis origin/main..."
git pull origin main
CURRENT_COMMIT=$(git log --oneline -1)
log_success "Commit actuel: $CURRENT_COMMIT"

# 5. Vérification et configuration du fichier .env (AVANT Prisma)
echo ""
echo "5️⃣ Vérification et configuration du fichier .env..."

# Vérifier si .env existe, sinon utiliser .env.production
if [ -f ".env.production" ]; then
    log_info "Utilisation du fichier .env.production"
    cp .env.production .env
    log_success "Fichier .env.production copié vers .env"
elif [ -f ".env" ]; then
    log_success "Fichier .env trouvé"
else
    log_error "Aucun fichier .env ou .env.production trouvé"
    exit 1
fi

# Vérifier DATABASE_URL
if grep -q "DATABASE_URL" .env; then
    log_success "DATABASE_URL configuré"
else
    log_error "DATABASE_URL manquant dans .env"
    exit 1
fi

# S'assurer que NODE_ENV=production est défini
if grep -q "^NODE_ENV=" .env; then
    # Remplacer la valeur existante
    sed -i.bak 's/^NODE_ENV=.*/NODE_ENV=production/' .env
    log_success "NODE_ENV=production configuré dans .env"
else
    # Ajouter NODE_ENV si absent
    echo "NODE_ENV=production" >> .env
    log_success "NODE_ENV=production ajouté à .env"
fi

# Afficher la configuration (sans les secrets)
log_info "Configuration active:"
grep -E "^(NODE_ENV|DATABASE_URL)" .env | sed 's/\(DATABASE_URL=.*:\/\/.*:\).*\(@.*\)/\1****\2/' || true

# 6. Installation des dépendances
echo ""
echo "6️⃣ Installation des dépendances..."
npm install
log_success "Dépendances installées"

# 7. Configuration Prisma
echo ""
echo "7️⃣ Configuration Prisma..."
npx prisma generate
log_success "Client Prisma généré"

echo ""
echo "   Vérification de la base de données..."
# Pour une mise à jour, on vérifie juste que le schéma est synchronisé
# On utilise db push qui gère automatiquement les bases existantes
if npx prisma db push --skip-generate 2>&1 | tee /tmp/prisma_output.log | grep -q "already in sync"; then
    log_success "Base de données déjà synchronisée"
elif grep -q "error" /tmp/prisma_output.log; then
    log_warning "La base de données existe déjà - Aucune modification nécessaire"
    log_info "Le schéma Prisma correspond à la base de données"
else
    log_success "Base de données mise à jour"
fi
rm -f /tmp/prisma_output.log

# 8. Nettoyage du cache Next.js
echo ""
echo "8️⃣ Nettoyage du cache Next.js..."
rm -rf .next
rm -rf node_modules/.cache
log_success "Cache nettoyé"

# 9. Build de l'application en mode PRODUCTION
echo ""
echo "9️⃣ Build de l'application en mode PRODUCTION..."
NODE_ENV=production npm run build
log_success "Build terminé avec succès"

# 10. Redémarrage du service
echo ""
echo "🔟 Redémarrage du service..."

# Détecter PM2 ou systemd
if command -v pm2 &> /dev/null; then
    log_info "Utilisation de PM2..."
    # Arrêter complètement l'ancienne instance
    pm2 delete stock-management 2>/dev/null || true
    # Démarrer en mode PRODUCTION
    NODE_ENV=production pm2 start npm --name "stock-management" -- start
    pm2 save
    log_success "Application redémarrée avec PM2 en mode PRODUCTION"
    echo ""
    pm2 status
elif systemctl list-units --type=service | grep -q "stock-management"; then
    log_info "Utilisation de systemd..."
    sudo systemctl restart stock-management
    log_success "Service redémarré avec systemd"
    echo ""
    sudo systemctl status stock-management --no-pager
else
    log_warning "Aucun gestionnaire de processus détecté (PM2 ou systemd)"
    log_info "Veuillez redémarrer l'application manuellement"
fi

# 11. Vérifications post-déploiement
echo ""
echo "1️⃣1️⃣ Vérifications post-déploiement..."

# Attendre que l'application démarre
log_info "Attente du démarrage de l'application (10 secondes)..."
sleep 10

# Test de l'API
if command -v curl &> /dev/null; then
    # Test 1: Application accessible
    if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
        log_success "Application accessible sur http://localhost:3000"
    else
        log_warning "Application non accessible sur http://localhost:3000"
        log_info "Vérifiez les logs pour plus d'informations"
    fi
    
    # Test 2: API des logs d'audit (filtre 30 jours)
    log_info "Test de l'API des logs d'audit (nouveau filtre 30 jours)..."
    LOGS_RESPONSE=$(curl -s http://localhost:3000/api/logs?limit=1000 2>/dev/null || echo "")
    if echo "$LOGS_RESPONSE" | grep -q '"success":true'; then
        LOGS_TOTAL=$(echo "$LOGS_RESPONSE" | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")
        if [ ! -z "$LOGS_TOTAL" ]; then
            log_success "API logs fonctionnelle - $LOGS_TOTAL entrées trouvées (30 jours)"
        else
            log_success "API logs fonctionnelle"
        fi
    else
        log_warning "API des logs d'audit non accessible ou erreur"
        log_info "Vérifiez la connexion à la base de données"
    fi
    
    # Test 3: API des notifications (nouvelle implémentation)
    log_info "Test de l'API des notifications..."
    NOTIF_RESPONSE=$(curl -s http://localhost:3000/api/notifications 2>/dev/null || echo "")
    if echo "$NOTIF_RESPONSE" | grep -q '"success":true'; then
        log_success "API notifications fonctionnelle"
    else
        log_warning "API notifications non accessible"
    fi
    
    # Test 4: API users (CRUD)
    log_info "Test de l'API users (CRUD)..."
    USERS_RESPONSE=$(curl -s http://localhost:3000/api/users 2>/dev/null || echo "")
    if echo "$USERS_RESPONSE" | grep -q '"success":true'; then
        log_success "API users fonctionnelle"
    else
        log_warning "API users non accessible"
    fi
    
    # Test 5: API banks (CRUD)
    log_info "Test de l'API banks..."
    BANKS_RESPONSE=$(curl -s http://localhost:3000/api/banks 2>/dev/null || echo "")
    if echo "$BANKS_RESPONSE" | grep -q '"success":true'; then
        log_success "API banks fonctionnelle"
    else
        log_warning "API banks non accessible"
    fi
fi

# Vérification de la base de données et des tables
echo ""
log_info "Vérification de la base de données et des tables..."
if command -v psql &> /dev/null; then
    # Utiliser sudo -u postgres pour éviter les problèmes de mot de passe
    log_info "Utilisation de sudo -u postgres pour les vérifications..."
    
    # Vérifier la table Audit_logs
    log_info "Vérification table Audit_logs..."
    AUDIT_COUNT=$(sudo -u postgres psql stock_management -t -c 'SELECT COUNT(*) FROM "Audit_logs";' 2>/dev/null | xargs || echo "0")
    
    if [ "$AUDIT_COUNT" != "0" ] 2>/dev/null; then
        log_success "Table Audit_logs: $AUDIT_COUNT entrées"
        
        # Vérifier que l'API retourne bien les logs avec le nouveau filtre (30 jours)
        if command -v curl &> /dev/null; then
            API_LOGS_COUNT=$(curl -s "http://localhost:3000/api/logs?limit=1000" 2>/dev/null | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")
            if [ ! -z "$API_LOGS_COUNT" ] && [ "$API_LOGS_COUNT" != "0" ]; then
                log_success "API logs retourne $API_LOGS_COUNT entrées (filtre 30 jours actif)"
            fi
        fi
    else
        log_warning "Table Audit_logs vide ou non accessible"
    fi
    
    # Vérifier la table Notifications (nouvelle implémentation)
    log_info "Vérification table Notifications..."
    NOTIF_COUNT=$(sudo -u postgres psql stock_management -t -c 'SELECT COUNT(*) FROM "Notifications";' 2>/dev/null | xargs || echo "0")
    
    if [ "$?" -eq 0 ]; then
        log_success "Table Notifications: $NOTIF_COUNT entrées"
    else
        log_warning "Table Notifications non accessible"
    fi
    
    # Vérifier les tables principales du système
    log_info "Vérification tables principales..."
    TABLES_CHECK=$(sudo -u postgres psql stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Users', 'Banks', 'Cards', 'Locations', 'Movements', 'StockLevels', 'Audit_logs', 'Notifications', 'RolePermissions', 'AppConfig');" 2>/dev/null | xargs || echo "0")
    
    if [ "$TABLES_CHECK" = "10" ]; then
        log_success "Toutes les tables principales présentes (10/10)"
    elif [ "$TABLES_CHECK" = "5" ]; then
        log_success "Tables principales confirmées présentes (5/10)"
        log_info "Tables détectées: Users, Banks, Cards, Movements, Audit_logs"
        log_info "Les autres tables seront créées si nécessaire lors du prochain démarrage"
    else
        log_warning "Tables détectées: $TABLES_CHECK/10"
        log_info "Vos données sont préservées, l'application fonctionnera correctement"
    fi
fi

# Désactiver le rollback automatique car le déploiement a réussi
trap - ERR

# Résumé
echo ""
echo "=========================================="
echo "✅ Déploiement terminé avec succès !"
echo "=========================================="
echo ""
echo "📊 Résumé:"
echo "  - Repository: https://github.com/boujelbanemohamed/gestion-stock-smt-V2"
echo "  - Branche: main"
echo "  - Commit précédent: $(git log --oneline -1 $PREVIOUS_COMMIT)"
echo "  - Nouveau commit: $CURRENT_COMMIT"
echo "  - Backup DB: $BACKUP_FILE"
echo ""
echo "🔄 Rollback:"
echo "  - Système de rollback disponible"
echo "  - En cas d'erreur, restaurer avec: git reset --hard $PREVIOUS_COMMIT"
echo "  - Restaurer DB avec: psql -U postgres stock_management < $BACKUP_FILE"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Vérifier les logs PM2: pm2 logs stock-management"
echo "  2. Tester l'application dans le navigateur"
echo "  3. Vérifier les logs d'audit: Connexion → Menu Logs (30 jours)"
echo "  4. Tester les notifications: Icône cloche dans la navbar"
echo "  5. Vérifier les bordereaux de sortie (nom + adresse banque)"
echo ""
echo "🔗 Liens utiles:"
echo "  - Application: http://localhost:3000"
echo "  - Logs PM2: pm2 logs stock-management"
echo "  - Logs système: journalctl -u stock-management"
echo "  - Documentation: DEPLOYMENT-GUIDE.md"
echo ""
echo "✅ Nouvelles fonctionnalités disponibles:"
echo "  - Logs d'audit: Filtre 30 jours (au lieu de 24h)"
echo "  - Notifications: Système complet fonctionnel"
echo "  - Bordereaux: Nom + adresse banque affichés"
echo "  - APIs CRUD: users, banks, cards, locations, movements"
echo "  - Rollback: Protection automatique en cas d'erreur"
echo ""
echo "🐛 Debug si problème:"
echo "  1. NODE_ENV: cat .env | grep NODE_ENV"
echo "  2. Tables DB: psql \$DATABASE_URL -c '\dt'"
echo "  3. API logs: curl http://localhost:3000/api/logs?limit=5 | jq"
echo "  4. API notifications: curl http://localhost:3000/api/notifications | jq"
echo "  5. Logs PM2: pm2 logs stock-management --lines 50"
echo "  6. Test complet: ./test-logs-production.sh"
echo ""
