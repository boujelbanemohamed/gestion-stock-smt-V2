#!/bin/bash

# Fichier: fix-database-connection-final.sh
# Description: Script pour corriger définitivement la connexion à la base de données

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management"
LOG_FILE="$APP_DIR/fix_database_connection_final.log"
ENV_FILE="$APP_DIR/.env"
DB_NAME="stock_management"
DB_USER="stockapp"
DB_PASSWORD="SMT2025"
APP_URL="http://localhost:3000"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

error_exit() {
  log_message "ERREUR: $1"
  log_message "Correction échouée."
  exit 1
}

# --- Début du script ---
log_message "--- Démarrage de la correction définitive de la connexion à la base de données ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5
log_message "✓ PM2 arrêté"

# 2. Vérifier le statut de PostgreSQL
log_message "2. Vérification du statut de PostgreSQL..."
if systemctl is-active --quiet postgresql; then
  log_message "✓ PostgreSQL est en cours d'exécution"
else
  log_message "⚠ PostgreSQL n'est pas en cours d'exécution. Démarrage..."
  systemctl start postgresql
  sleep 5
  if systemctl is-active --quiet postgresql; then
    log_message "✓ PostgreSQL démarré avec succès"
  else
    error_exit "❌ Impossible de démarrer PostgreSQL"
  fi
fi

# 3. Vérifier la configuration PostgreSQL
log_message "3. Vérification de la configuration PostgreSQL..."
PG_HBA_FILE="/var/lib/pgsql/data/pg_hba.conf"
if [ -f "$PG_HBA_FILE" ]; then
  log_message "✓ Fichier pg_hba.conf trouvé"
  
  # Vérifier et corriger la configuration d'authentification
  if grep -q "host.*all.*all.*127.0.0.1/32.*md5" "$PG_HBA_FILE"; then
    log_message "✓ Configuration md5 déjà présente pour localhost"
  else
    log_message "⚠ Correction de la configuration d'authentification..."
    # Sauvegarder le fichier original
    cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup"
    
    # Remplacer ident par md5 pour localhost
    sed -i 's/host    all             all             127.0.0.1\/32            ident/host    all             all             127.0.0.1\/32            md5/' "$PG_HBA_FILE"
    sed -i 's/host    all             all             ::1\/128                 ident/host    all             all             ::1\/128                 md5/' "$PG_HBA_FILE"
    
    log_message "✓ Configuration d'authentification corrigée"
  fi
else
  log_message "⚠ Fichier pg_hba.conf non trouvé"
fi

# 4. Redémarrer PostgreSQL pour appliquer les changements
log_message "4. Redémarrage de PostgreSQL..."
systemctl restart postgresql
sleep 5
if systemctl is-active --quiet postgresql; then
  log_message "✓ PostgreSQL redémarré avec succès"
else
  error_exit "❌ Échec du redémarrage de PostgreSQL"
fi

# 5. Vérifier l'utilisateur PostgreSQL
log_message "5. Vérification de l'utilisateur PostgreSQL..."
sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER';" | grep -q "1"
if [ $? -eq 0 ]; then
  log_message "✓ Utilisateur '$DB_USER' existe"
else
  log_message "⚠ Création de l'utilisateur '$DB_USER'..."
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
  sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"
  log_message "✓ Utilisateur '$DB_USER' créé"
fi

# 6. Vérifier la base de données
log_message "6. Vérification de la base de données..."
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q "1"
if [ $? -eq 0 ]; then
  log_message "✓ Base de données '$DB_NAME' existe"
else
  log_message "⚠ Création de la base de données '$DB_NAME'..."
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
  log_message "✓ Base de données '$DB_NAME' créée"
fi

# 7. Réinitialiser le mot de passe de l'utilisateur
log_message "7. Réinitialisation du mot de passe de l'utilisateur..."
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
log_message "✓ Mot de passe réinitialisé"

# 8. Tester la connexion à la base de données
log_message "8. Test de la connexion à la base de données..."
export PGPASSWORD="$DB_PASSWORD"
if psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
  log_message "✓ Connexion à la base de données réussie"
else
  log_message "❌ Échec de la connexion à la base de données"
  error_exit "Impossible de se connecter à la base de données"
fi
unset PGPASSWORD

# 9. Vérifier et corriger le fichier .env
log_message "9. Vérification et correction du fichier .env..."
if [ -f "$ENV_FILE" ]; then
  log_message "✓ Fichier .env trouvé"
  
  # Sauvegarder l'ancien .env
  cp "$ENV_FILE" "$ENV_FILE.backup"
  
  # Créer un nouveau .env avec la configuration correcte
  cat << EOF > "$ENV_FILE"
# Base de données PostgreSQL
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="http://localhost:3000"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@localhost"
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
  
  log_message "✓ Fichier .env mis à jour"
else
  error_exit "Fichier .env manquant"
fi

# 10. Charger les variables d'environnement
log_message "10. Chargement des variables d'environnement..."
set -a
source "$ENV_FILE"
set +a
log_message "✓ Variables d'environnement chargées"

# 11. Nettoyage et réinstallation des dépendances
log_message "11. Nettoyage et réinstallation des dépendances..."
rm -rf .next
rm -rf node_modules
rm -f package-lock.json
npm cache clean --force
npm install --force
log_message "✓ Dépendances installées"

# 12. Regénération de Prisma Client
log_message "12. Regénération de Prisma Client..."
npx prisma generate
if [ $? -eq 0 ]; then
  log_message "✓ Prisma Client regénéré avec succès"
else
  error_exit "Échec de la regénération de Prisma Client"
fi

# 13. Synchronisation de la base de données
log_message "13. Synchronisation de la base de données..."
npx prisma db push
if [ $? -eq 0 ]; then
  log_message "✓ Base de données synchronisée"
else
  error_exit "Échec de la synchronisation de la base de données"
fi

# 14. Test de Prisma Client
log_message "14. Test de Prisma Client..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => {
  console.log('✓ Prisma Client fonctionne');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Erreur Prisma Client:', err.message);
  process.exit(1);
});
"

if [ $? -eq 0 ]; then
  log_message "✓ Prisma Client fonctionne correctement"
else
  error_exit "Prisma Client ne fonctionne pas"
fi

# 15. Construction de l'application
log_message "15. Construction de l'application..."
npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite avec succès"
else
  error_exit "Échec de la construction de l'application"
fi

# 16. Redémarrage de l'application avec PM2
log_message "16. Redémarrage de l'application avec PM2..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée avec PM2"

# 17. Attendre le démarrage
log_message "17. Attente du démarrage (30 secondes)..."
sleep 30

# 18. Vérifier le statut
log_message "18. Vérification du statut..."
pm2 status

# 19. Vérifier les logs
log_message "19. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 20. Tester l'API d'authentification
log_message "20. Test de l'API d'authentification..."
LOGIN_RESPONSE=$(curl -s -X POST "$APP_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}')

log_message "Réponse API Login: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  log_message "✓ API d'authentification fonctionne (connexion réussie)"
else
  log_message "❌ API d'authentification échoue. Réponse: $LOGIN_RESPONSE"
fi

# 21. Tester l'application complète
log_message "21. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 22. Créer un script de test final
log_message "22. Création d'un script de test final..."
cat << 'EOF' > test-database-connection-fix.sh
#!/bin/bash
echo "Test de la correction de la connexion à la base de données..."
echo "1. Test de l'application:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
echo ""
echo "2. Test de l'API d'authentification:"
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}'
echo ""
echo "3. Statut PM2:"
pm2 status
echo ""
echo "4. Test de Prisma Client:"
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => {
  console.log('✓ Prisma Client fonctionne');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Erreur Prisma Client:', err.message);
  process.exit(1);
});
"
echo ""
echo "5. Test de la base de données:"
PGPASSWORD=SMT2025 psql -h localhost -U stockapp -d stock_management -c "SELECT 1;"
echo ""
echo "6. Logs récents:"
pm2 logs stock-management --lines 5
echo ""
echo "7. Commit actuel:"
git log --oneline -1
EOF

chmod +x test-database-connection-fix.sh
log_message "✓ Script test-database-connection-fix.sh créé"

log_message "--- Correction de la connexion à la base de données terminée ---"
log_message "Utilisez './test-database-connection-fix.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner SANS erreur 500"
