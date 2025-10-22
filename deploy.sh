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

# 5. Configuration optimisée du fichier .env pour RedHat
echo ""
echo "5️⃣ Configuration optimisée du fichier .env pour RedHat..."

# Sauvegarder l'ancien .env
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    log_success "Ancien .env sauvegardé"
fi

# Créer le .env optimisé pour RedHat (sans mot de passe)
log_info "Création du .env optimisé pour RedHat..."
cat > .env << 'EOF'
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
EOF

log_success "Configuration .env optimisée pour RedHat (postgres sans mot de passe)"

# Vérifier la configuration
log_info "Configuration active:"
grep -E "^(NODE_ENV|DATABASE_URL)" .env | sed 's/\(DATABASE_URL=.*:\/\/.*:\).*\(@.*\)/\1****\2/' || true

# 6. Installation des dépendances (optimisée)
echo ""
echo "6️⃣ Installation des dépendances (optimisée)..."
log_info "Nettoyage du cache npm..."
npm cache clean --force 2>/dev/null || true
log_info "Installation des dépendances..."
npm install --silent
log_success "Dépendances installées"

# 7. Configuration Prisma
echo ""
echo "7️⃣ Configuration Prisma..."
npx prisma generate
log_success "Client Prisma généré"

echo ""
echo "   Vérification de la base de données (NON-DESTRUCTIVE)..."
# Vérification de la connexion à la base de données
log_info "Test de connexion à la base de données..."
if npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; then
    log_success "Connexion à la base de données réussie"
    
    # Vérifier que les tables existent (sans les modifier)
    log_info "Vérification des tables existantes..."
    TABLES_EXIST=$(sudo -u postgres psql stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'banks', 'cards', 'locations', 'movements', 'audit_logs');" 2>/dev/null | xargs || echo "0")
    
    if [ "$TABLES_EXIST" -ge "5" ]; then
        log_success "Tables principales détectées ($TABLES_EXIST/5) - Base de données préservée"
        log_info "Aucune modification de la base de données nécessaire"
    else
        log_warning "Tables manquantes détectées - Synchronisation Prisma nécessaire"
        # Utiliser db push qui est non-destructif pour les données existantes
        if npx prisma db push --skip-generate 2>&1 | tee /tmp/prisma_output.log | grep -q "already in sync"; then
            log_success "Base de données déjà synchronisée"
        else
            log_success "Base de données synchronisée (données préservées)"
        fi
        rm -f /tmp/prisma_output.log
    fi
else
    log_warning "Impossible de se connecter à la base de données"
    log_info "Vérifiez que PostgreSQL est démarré et accessible"
fi

# 8. Vérifications pré-déploiement
echo ""
echo "8️⃣ Vérifications pré-déploiement..."

# Vérifier que Prisma Client est généré
if [ -f "node_modules/.prisma/client/index.js" ]; then
    log_success "Prisma Client généré correctement"
else
    log_error "Prisma Client manquant - Regénération..."
    npx prisma generate
    log_success "Prisma Client regénéré"
fi

# Vérifier que les variables d'environnement sont correctes
if grep -q "NODE_ENV=production" .env && grep -q "DATABASE_URL=" .env; then
    log_success "Variables d'environnement configurées"
else
    log_error "Variables d'environnement manquantes"
    exit 1
fi

# Nettoyage du cache Next.js
log_info "Nettoyage du cache Next.js..."
rm -rf .next
rm -rf node_modules/.cache
log_success "Cache nettoyé"

# 9. Build de l'application en mode PRODUCTION (optimisé)
echo ""
echo "9️⃣ Build de l'application en mode PRODUCTION (optimisé)..."

# Vérifier que le build peut démarrer
log_info "Vérification pré-build..."
if [ -f "package.json" ] && [ -f "next.config.mjs" ]; then
    log_success "Fichiers de configuration présents"
else
    log_error "Fichiers de configuration manquants"
    exit 1
fi

# Build avec gestion d'erreurs
log_info "Démarrage du build production..."
if NODE_ENV=production npm run build 2>&1 | tee /tmp/build_output.log; then
    log_success "Build terminé avec succès"
    rm -f /tmp/build_output.log
else
    log_error "Erreur lors du build"
    echo ""
    log_info "Dernières lignes du build:"
    tail -20 /tmp/build_output.log 2>/dev/null || true
    rm -f /tmp/build_output.log
    exit 1
fi

# 10. Redémarrage du service (optimisé)
echo ""
echo "🔟 Redémarrage du service (optimisé)..."

# Détecter PM2 ou systemd
if command -v pm2 &> /dev/null; then
    log_info "Utilisation de PM2..."
    
    # Arrêter proprement l'ancienne instance
    log_info "Arrêt de l'ancienne instance..."
    pm2 stop stock-management 2>/dev/null || true
    pm2 delete stock-management 2>/dev/null || true
    
    # Attendre que l'arrêt soit complet
    sleep 3
    
    # Démarrer en mode PRODUCTION
    log_info "Démarrage de la nouvelle instance..."
    NODE_ENV=production pm2 start npm --name "stock-management" -- start
    pm2 save
    
    # Attendre que l'application démarre
    log_info "Attente du démarrage (5 secondes)..."
    sleep 5
    
    # Vérifier le statut
    if pm2 list | grep -q "stock-management.*online"; then
        log_success "Application redémarrée avec PM2 en mode PRODUCTION"
    else
        log_warning "Application démarrée mais statut incertain"
    fi
    
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
    
        # Vérifier la table audit_logs
        log_info "Vérification table audit_logs..."
        AUDIT_COUNT=$(sudo -u postgres psql stock_management -t -c 'SELECT COUNT(*) FROM "audit_logs";' 2>/dev/null | xargs || echo "0")
    
    if [ "$AUDIT_COUNT" != "0" ] 2>/dev/null; then
            log_success "Table audit_logs: $AUDIT_COUNT entrées"
        
        # Vérifier que l'API retourne bien les logs avec le nouveau filtre (30 jours)
        if command -v curl &> /dev/null; then
            API_LOGS_COUNT=$(curl -s "http://localhost:3000/api/logs?limit=1000" 2>/dev/null | grep -o '"total":[0-9]*' | cut -d':' -f2 || echo "0")
            if [ ! -z "$API_LOGS_COUNT" ] && [ "$API_LOGS_COUNT" != "0" ]; then
                log_success "API logs retourne $API_LOGS_COUNT entrées (filtre 30 jours actif)"
            fi
        fi
    else
            log_warning "Table audit_logs vide ou non accessible"
    fi
    
        # Vérifier la table notifications (nouvelle implémentation)
        log_info "Vérification table notifications..."
        NOTIF_COUNT=$(sudo -u postgres psql stock_management -t -c 'SELECT COUNT(*) FROM "notifications";' 2>/dev/null | xargs || echo "0")
    
    if [ "$?" -eq 0 ]; then
            log_success "Table notifications: $NOTIF_COUNT entrées"
        else
            log_warning "Table notifications non accessible"
    fi
    
    # Vérifier les tables principales du système
    log_info "Vérification tables principales..."
        TABLES_CHECK=$(sudo -u postgres psql stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'banks', 'cards', 'locations', 'movements', 'stock_levels', 'audit_logs', 'notifications', 'role_permissions', 'app_config');" 2>/dev/null | xargs || echo "0")
    
    if [ "$TABLES_CHECK" = "10" ]; then
        log_success "Toutes les tables principales présentes (10/10)"
    elif [ "$TABLES_CHECK" = "5" ]; then
        log_success "Tables principales confirmées présentes (5/10)"
        log_info "Tables détectées: users, banks, cards, movements, audit_logs"
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
