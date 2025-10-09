#!/bin/bash

# Script de déploiement automatisé pour Red Hat
# Repository: https://github.com/boujelbanemohamed/gestion-stock-smt-V2
# Branche: main
# Commit: 779a575

set -e  # Arrêter en cas d'erreur

echo "=========================================="
echo "🚀 Déploiement Gestion Stock SMT V2"
echo "=========================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# 1. Vérifier la branche actuelle
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

# 2. Backup de la base de données
echo ""
echo "2️⃣ Sauvegarde de la base de données..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
if command -v pg_dump &> /dev/null; then
    pg_dump -U postgres stock_management > "$BACKUP_FILE" 2>/dev/null || {
        log_warning "Impossible de créer le backup automatiquement"
        log_info "Veuillez créer un backup manuellement avec:"
        log_info "pg_dump -U postgres stock_management > $BACKUP_FILE"
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

# 5. Installation des dépendances
echo ""
echo "5️⃣ Installation des dépendances..."
npm install
log_success "Dépendances installées"

# 6. Configuration Prisma
echo ""
echo "6️⃣ Configuration Prisma..."
npx prisma generate
log_success "Client Prisma généré"

echo ""
echo "   Application des migrations..."
npx prisma migrate deploy
log_success "Migrations appliquées"

# 7. Vérification du fichier .env
echo ""
echo "7️⃣ Vérification du fichier .env..."
if [ -f ".env" ]; then
    log_success "Fichier .env trouvé"
    if grep -q "DATABASE_URL" .env; then
        log_success "DATABASE_URL configuré"
    else
        log_error "DATABASE_URL manquant dans .env"
        exit 1
    fi
else
    log_error "Fichier .env non trouvé"
    exit 1
fi

# 8. Build de l'application
echo ""
echo "8️⃣ Build de l'application..."
npm run build
log_success "Build terminé avec succès"

# 9. Redémarrage du service
echo ""
echo "9️⃣ Redémarrage du service..."

# Détecter PM2 ou systemd
if command -v pm2 &> /dev/null; then
    log_info "Utilisation de PM2..."
    pm2 restart gestion-stock-smt || pm2 start npm --name "gestion-stock-smt" -- start
    pm2 save
    log_success "Application redémarrée avec PM2"
    echo ""
    pm2 status
elif systemctl list-units --type=service | grep -q "gestion-stock-smt"; then
    log_info "Utilisation de systemd..."
    sudo systemctl restart gestion-stock-smt
    log_success "Service redémarré avec systemd"
    echo ""
    sudo systemctl status gestion-stock-smt --no-pager
else
    log_warning "Aucun gestionnaire de processus détecté (PM2 ou systemd)"
    log_info "Veuillez redémarrer l'application manuellement"
fi

# 10. Vérifications post-déploiement
echo ""
echo "🔟 Vérifications post-déploiement..."

# Attendre que l'application démarre
sleep 5

# Test de l'API
if command -v curl &> /dev/null; then
    if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
        log_success "Application accessible sur http://localhost:3000"
    else
        log_warning "Application non accessible sur http://localhost:3000"
        log_info "Vérifiez les logs pour plus d'informations"
    fi
fi

# Résumé
echo ""
echo "=========================================="
echo "✅ Déploiement terminé avec succès !"
echo "=========================================="
echo ""
echo "📊 Résumé:"
echo "  - Repository: https://github.com/boujelbanemohamed/gestion-stock-smt-V2"
echo "  - Branche: main"
echo "  - Commit: $CURRENT_COMMIT"
echo "  - Backup: $BACKUP_FILE"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Vérifier les logs: pm2 logs gestion-stock-smt"
echo "  2. Tester l'application dans le navigateur"
echo "  3. Vérifier les logs d'audit dans la base de données"
echo ""
echo "🔗 Liens utiles:"
echo "  - Application: http://localhost:3000"
echo "  - Logs: pm2 logs gestion-stock-smt (ou journalctl -u gestion-stock-smt)"
echo "  - Documentation: DEPLOYMENT-GUIDE.md"
echo ""
