#!/bin/bash

# Fichier: fix-database-connection.sh
# Description: Script pour corriger la connexion à la base de données

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_database_connection.log"
DB_NAME="stock_management"
DB_USER="stockapp"
DB_PASSWORD="SMT2025"

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
log_message "--- Démarrage de la correction de la connexion à la base de données ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2 complètement
log_message "1. Arrêt complet de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5
log_message "✓ PM2 arrêté"

# 2. Vérifier la connexion à la base de données
log_message "2. Vérification de la connexion à la base de données..."
export PGPASSWORD="$DB_PASSWORD"
if pg_isready -U "$DB_USER" -d "$DB_NAME"; then
  log_message "✓ Base de données accessible"
else
  error_exit "❌ Impossible de se connecter à la base de données. Vérifiez PostgreSQL."
fi
unset PGPASSWORD

# 3. Vérifier et corriger le fichier .env
log_message "3. Vérification et correction du fichier .env..."
if [ -f ".env" ]; then
  log_message "Fichier .env existant:"
  cat .env | tee -a "$LOG_FILE"
else
  log_message "Fichier .env manquant, création..."
fi

# 4. Créer un fichier .env correct
log_message "4. Création d'un fichier .env correct..."
cat << EOF > .env
# Base de données PostgreSQL
DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"

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

log_message "✓ Fichier .env créé avec la configuration correcte"

# 5. Charger les variables d'environnement
log_message "5. Chargement des variables d'environnement..."
set -a
source .env
set +a

# 6. Vérifier les variables critiques
log_message "6. Vérification des variables critiques..."
echo "NODE_ENV: $NODE_ENV"
echo "DATABASE_URL: $DATABASE_URL"
echo "SESSION_SECRET: $SESSION_SECRET"
echo "JWT_SECRET: $JWT_SECRET"

# 7. Nettoyer les fichiers temporaires
log_message "7. Nettoyage des fichiers temporaires..."
rm -rf .next
rm -rf node_modules/.cache
log_message "✓ Fichiers temporaires nettoyés"

# 8. Regénérer Prisma Client
log_message "8. Regénération de Prisma Client..."
npx prisma generate || error_exit "Échec de la regénération de Prisma Client"
log_message "✓ Prisma Client regénéré"

# 9. Synchroniser la base de données
log_message "9. Synchronisation de la base de données..."
npx prisma db push || error_exit "Échec de la synchronisation de la base de données"
log_message "✓ Base de données synchronisée"

# 10. Construire l'application
log_message "10. Construction de l'application..."
npm run build || error_exit "Échec de la construction de l'application"
log_message "✓ Application construite"

# 11. Redémarrer l'application avec les variables d'environnement
log_message "11. Redémarrage de l'application avec les variables d'environnement..."
pm2 start npm --name "$PM2_APP_NAME" -- run start --env production
log_message "✓ Application redémarrée avec PM2"

# 12. Attendre le démarrage
log_message "12. Attente du démarrage (30 secondes)..."
sleep 30

# 13. Vérifier le statut
log_message "13. Vérification du statut..."
pm2 status

# 14. Vérifier les logs
log_message "14. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 15. Tester la connexion à la base de données
log_message "15. Test de la connexion à la base de données..."
export PGPASSWORD="$DB_PASSWORD"
if psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
  log_message "✓ Connexion à la base de données réussie"
else
  log_message "❌ Connexion à la base de données échouée"
fi
unset PGPASSWORD

# 16. Tester l'API d'authentification
log_message "16. Test de l'API d'authentification..."
if curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' | grep -q "success"; then
  log_message "✓ API d'authentification fonctionne"
else
  log_message "❌ API d'authentification ne fonctionne pas"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 10
fi

# 17. Créer un script de test
log_message "17. Création d'un script de test..."
cat << 'EOF' > test-database-connection.sh
#!/bin/bash
echo "Test de la connexion à la base de données..."
export PGPASSWORD="SMT2025"
if psql -U stockapp -d stock_management -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✓ Connexion à la base de données réussie"
else
  echo "❌ Connexion à la base de données échouée"
fi
unset PGPASSWORD

echo "Test de l'API d'authentification..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' \
  -v
EOF

chmod +x test-database-connection.sh
log_message "✓ Script test-database-connection.sh créé"

log_message "--- Correction terminée ---"
log_message "Utilisez './test-database-connection.sh' pour tester la connexion"
log_message "L'application devrait maintenant fonctionner correctement"
