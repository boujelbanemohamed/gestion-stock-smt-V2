#!/bin/bash

# Script de déploiement automatisé pour Red Hat
# Repository: https://github.com/boujelbanemohamed/gestion-stock-smt-V2
# Branche: main
# Application: stock-management
#
# Conçu pour tourner sans intervention humaine (exécution à distance, cron) :
# aucune invite interactive, et arrêt net (exit != 0) dès qu'une étape ne peut
# plus garantir l'intégrité des données existantes.

set -euo pipefail

echo "=========================================="
echo "🚀 Déploiement Stock Management SMT V2"
echo "=========================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

APP_NAME="stock-management"
DB_BACKUP_DIR="/var/backups/${APP_NAME}"

# Variables globales pour le rollback
PREVIOUS_COMMIT=""
BACKUP_FILE=""
ROLLBACK_TRIGGERED=false

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error()   { echo -e "${RED}✗ $1${NC}"; }
log_info()    { echo -e "ℹ $1"; }

# Rollback en cas d'erreur : restaure le CODE. La base n'est jamais touchée
# automatiquement (voir le message affiché en fin de fonction) — une
# restauration de base est une décision humaine, pas quelque chose à
# déclencher à l'aveugle depuis un trap d'erreur.
rollback() {
    if [ "$ROLLBACK_TRIGGERED" = true ]; then
        return  # Éviter les boucles infinies
    fi
    ROLLBACK_TRIGGERED=true

    echo ""
    echo "=========================================="
    log_error "ERREUR DÉTECTÉE - ROLLBACK DU CODE EN COURS"
    echo "=========================================="
    echo ""

    if [ -n "$PREVIOUS_COMMIT" ]; then
        echo "1️⃣ Restauration du commit précédent..."
        git reset --hard "$PREVIOUS_COMMIT" 2>/dev/null || log_warning "Impossible de restaurer le commit"
        log_success "Code restauré au commit: $PREVIOUS_COMMIT"

        echo ""
        echo "2️⃣ Réinstallation des dépendances..."
        npm install --silent 2>/dev/null || log_warning "Erreur lors de npm install"

        echo ""
        echo "3️⃣ Régénération Prisma..."
        npx prisma generate 2>/dev/null || log_warning "Erreur Prisma"

        echo ""
        echo "4️⃣ Rebuild de l'ancienne version..."
        NODE_ENV=production npm run build 2>/dev/null || log_warning "Erreur de build"

        echo ""
        echo "5️⃣ Redémarrage de l'application..."
        if command -v pm2 &> /dev/null; then
            pm2 delete "$APP_NAME" 2>/dev/null || true
            NODE_ENV=production pm2 start npm --name "$APP_NAME" -- start
            pm2 save
            log_success "Application redémarrée avec l'ancienne version"
        fi
    else
        log_warning "Aucun commit précédent enregistré : le code n'a pas été modifié, rien à restaurer côté code"
    fi

    echo ""
    echo "=========================================="
    log_warning "ROLLBACK DU CODE TERMINÉ"
    echo "=========================================="
    log_info "Code restauré au commit: ${PREVIOUS_COMMIT:-inconnu}"

    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        echo ""
        log_info "Sauvegarde de la base prise AVANT ce déploiement : $BACKUP_FILE"
        log_info "Prisma Migrate exécute chaque migration dans sa propre transaction :"
        log_info "si une migration échoue en cours de route, PostgreSQL l'annule lui-même."
        log_info "Ce script ne restaure PAS la base automatiquement pour autant — c'est"
        log_info "une décision à prendre après inspection. Pour restaurer manuellement :"
        log_info "  gunzip -c \"$BACKUP_FILE\" | sudo -u postgres psql \"${DB_NAME:-<nom_de_la_base>}\""
    fi

    echo ""
    log_error "Déploiement annulé : le CODE a été restauré à l'état précédent."
    log_error "Vérifiez l'état de la BASE avant de relancer un déploiement."
    exit 1
}

trap 'rollback' ERR

# 0. Vérifier et ajouter le répertoire comme sûr si nécessaire
echo "0️⃣ Vérification de la sécurité Git..."
REPO_DIR=$(pwd)
if ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$REPO_DIR"; then
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
    log_error "Ce script ne déploie que la branche 'main' (branche actuelle: $CURRENT_BRANCH)"
    log_info "Script non-interactif — aucune confirmation n'est demandée, le déploiement est annulé par sécurité."
    exit 1
fi
log_success "Branche: $CURRENT_BRANCH"

PREVIOUS_COMMIT=$(git rev-parse HEAD)
log_info "Commit actuel sauvegardé pour rollback: $(git log --oneline -1 "$PREVIOUS_COMMIT")"

# 2. Vérifier .env AVANT toute opération risquée. Ce script ne génère plus de
# .env à la volée : les versions précédentes écrasaient la configuration
# réelle avec des valeurs codées en dur en clair dans ce fichier (SMTP cassé,
# secrets JWT/session figés et exposés dans l'historique Git) à chaque
# déploiement.
echo ""
echo "2️⃣ Vérification du fichier .env..."
if [ ! -f ".env" ]; then
    log_error ".env introuvable dans $(pwd)."
    log_info "Créez-le à partir de deployment/.env.production.example puis relancez."
    exit 1
fi
for key in DATABASE_URL NODE_ENV JWT_SECRET SESSION_SECRET; do
    if ! grep -q "^${key}=" .env; then
        log_error "Variable manquante dans .env : $key"
        exit 1
    fi
done
log_success ".env présent et complet (non modifié par ce script)"

DATABASE_URL_VALUE=$(grep '^DATABASE_URL=' .env | head -1 | sed -E 's/^DATABASE_URL=//; s/^"//; s/"$//')
if [[ "$DATABASE_URL_VALUE" =~ ^postgresql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/([^?\"]+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    log_error "Impossible d'analyser DATABASE_URL dans .env (format attendu : postgresql://user:pass@host:port/db)"
    exit 1
fi

psql_query() {
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "$1"
}

# 3. Sauvegarde de la base — étape bloquante : sans backup réussi, pas de
# déploiement. (Auparavant, un échec de pg_dump se contentait d'un
# avertissement et d'une invite interactive, ce qui pouvait laisser passer un
# déploiement sans aucune sauvegarde récente.)
echo ""
echo "3️⃣ Sauvegarde de la base de données (obligatoire)..."
if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump introuvable — impossible de garantir une sauvegarde. Déploiement annulé."
    exit 1
fi
mkdir -p "$DB_BACKUP_DIR"
BACKUP_FILE="${DB_BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
if ! sudo -u postgres pg_dump "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    log_error "Échec de la sauvegarde de la base de données. Déploiement annulé (aucune donnée à risque)."
    rm -f "$BACKUP_FILE"
    BACKUP_FILE=""
    exit 1
fi
log_success "Backup créé: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# 4. Récupération des modifications
echo ""
echo "4️⃣ Récupération des modifications depuis GitHub..."
git fetch origin
git pull origin main
CURRENT_COMMIT=$(git log --oneline -1)
log_success "Commit actuel: $CURRENT_COMMIT"

# 5. Installation des dépendances
echo ""
echo "5️⃣ Installation des dépendances..."
npm install --silent
log_success "Dépendances installées"

# 6. Génération du client Prisma
echo ""
echo "6️⃣ Génération du client Prisma..."
npx prisma generate
log_success "Client Prisma généré"

# 7. Migrations de base de données — remplace l'ancien "prisma db push" par
# un historique de migrations tracé (prisma/migrations), la méthode sûre
# recommandée par Prisma pour la production.
#
# Auto-baseline : si la base contient déjà des tables applicatives mais
# aucun historique Prisma Migrate (cas de cette base, gérée jusqu'ici via
# db push), la première migration est enregistrée comme "déjà appliquée"
# SANS exécuter son SQL — les tables existent déjà, on ne fait qu'aligner le
# suivi de Prisma sur la réalité. Une fois cette base amorcée, chaque
# déploiement suivant n'applique que les migrations réellement nouvelles.
echo ""
echo "7️⃣ Migrations de base de données..."

if ! psql_query "SELECT 1;" > /dev/null; then
    log_error "Connexion à la base impossible avec les identifiants de .env. Déploiement annulé."
    exit 1
fi
log_success "Connexion à la base de données réussie"

MIGRATIONS_TABLE=$(psql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';")
if [ "$MIGRATIONS_TABLE" = "0" ]; then
    APP_TABLE_EXISTS=$(psql_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='cards';")
    if [ "$APP_TABLE_EXISTS" != "0" ]; then
        FIRST_MIGRATION=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | xargs -n1 basename 2>/dev/null | sort | head -1)
        if [ -z "$FIRST_MIGRATION" ]; then
            log_error "Base existante mais aucune migration trouvée dans prisma/migrations — impossible d'amorcer le suivi."
            exit 1
        fi
        log_warning "Base existante sans historique Prisma Migrate détectée"
        log_info "Amorçage (baseline) de la migration '${FIRST_MIGRATION}' — aucun SQL exécuté, données intactes..."
        npx prisma migrate resolve --applied "$FIRST_MIGRATION"
        log_success "Baseline enregistrée : le suivi Prisma Migrate correspond maintenant à l'état réel de la base"
    fi
fi

log_info "Application des migrations en attente..."
npx prisma migrate deploy
log_success "Migrations appliquées"

# 8. Vérifications pré-build
echo ""
echo "8️⃣ Vérifications pré-déploiement..."
if [ -f "node_modules/.prisma/client/index.js" ]; then
    log_success "Prisma Client généré correctement"
else
    log_error "Prisma Client manquant après génération — annulation"
    exit 1
fi
if [ ! -f "package.json" ] || [ ! -f "next.config.mjs" ]; then
    log_error "Fichiers de configuration manquants (package.json / next.config.mjs)"
    exit 1
fi
log_info "Nettoyage du cache Next.js..."
rm -rf .next node_modules/.cache
log_success "Cache nettoyé"

# 9. Build de l'application en mode PRODUCTION
echo ""
echo "9️⃣ Build de l'application en mode PRODUCTION..."
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

# 10. Redémarrage du service
echo ""
echo "🔟 Redémarrage du service..."
if command -v pm2 &> /dev/null; then
    log_info "Utilisation de PM2..."
    pm2 stop "$APP_NAME" 2>/dev/null || true
    pm2 delete "$APP_NAME" 2>/dev/null || true
    sleep 3
    NODE_ENV=production pm2 start npm --name "$APP_NAME" -- start
    pm2 save
    log_info "Attente du démarrage (5 secondes)..."
    sleep 5
    if pm2 list | grep -q "${APP_NAME}.*online"; then
        log_success "Application redémarrée avec PM2 en mode PRODUCTION"
    else
        log_error "L'application n'apparaît pas 'online' dans PM2 après redémarrage"
        exit 1
    fi
    echo ""
    pm2 status
elif systemctl list-units --type=service | grep -q "$APP_NAME"; then
    log_info "Utilisation de systemd..."
    sudo systemctl restart "$APP_NAME"
    log_success "Service redémarré avec systemd"
    echo ""
    sudo systemctl status "$APP_NAME" --no-pager
else
    log_error "Aucun gestionnaire de processus détecté (PM2 ou systemd) — redémarrage manuel requis"
    exit 1
fi

# 11. Vérifications post-déploiement (informatives, non bloquantes : l'appli
# tourne déjà à ce stade, un souci ici ne doit pas déclencher un rollback).
echo ""
echo "1️⃣1️⃣ Vérifications post-déploiement..."
log_info "Attente du démarrage de l'application (10 secondes)..."
sleep 10

if command -v curl &> /dev/null; then
    if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
        log_success "Application accessible sur http://localhost:3000"
    else
        log_warning "Application non accessible sur http://localhost:3000 — vérifiez les logs (pm2 logs $APP_NAME)"
    fi
fi

echo ""
log_info "État des migrations Prisma :"
npx prisma migrate status || log_warning "Impossible de récupérer le statut des migrations"

log_info "Pour un contrôle de santé plus complet : ./deployment/health-check.sh"

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
echo "  - Commit précédent: $(git log --oneline -1 "$PREVIOUS_COMMIT")"
echo "  - Nouveau commit: $CURRENT_COMMIT"
echo "  - Backup DB: $BACKUP_FILE"
echo ""
echo "🔄 En cas de problème constaté après coup :"
echo "  - Revenir au code précédent : git reset --hard $PREVIOUS_COMMIT (puis rebuild/redémarrage manuel)"
echo "  - Restaurer la base depuis ce backup : gunzip -c \"$BACKUP_FILE\" | sudo -u postgres psql \"$DB_NAME\""
echo ""
echo "🔗 Liens utiles:"
echo "  - Application: http://localhost:3000"
echo "  - Logs PM2: pm2 logs $APP_NAME"
echo "  - Logs système: journalctl -u $APP_NAME"
echo "  - Documentation: DEPLOYMENT-GUIDE.md"
echo ""
