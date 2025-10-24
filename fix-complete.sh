#!/bin/bash

# Fichier: fix-complete.sh
# Description: Script de réparation complète pour résoudre tous les problèmes

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_complete.log"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# --- Début du script de réparation ---
log_message "--- Démarrage de la réparation complète ---"

cd "$APP_DIR" || exit 1

# 1. Arrêter PM2 complètement
log_message "1. Arrêt complet de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5

# 2. Nettoyer tous les fichiers temporaires
log_message "2. Nettoyage complet des fichiers temporaires..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma
rm -rf node_modules
rm -f package-lock.json

# 3. Créer un fichier .env correct
log_message "3. Création du fichier .env correct..."
cat << EOF > .env
# Base de données PostgreSQL
DATABASE_URL="postgresql://stockapp:SMT2025@localhost:5432/stock_management?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://gstock.monetiquetunisie.com"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@gstock.monetiquetunisie.com"
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

log_message "✓ Fichier .env créé"

# 4. Vérifier la base de données
log_message "4. Vérification de la base de données..."
export PGPASSWORD="SMT2025"
if pg_isready -U stockapp -d stock_management; then
  log_message "✓ Base de données accessible"
else
  log_message "✗ Base de données non accessible, redémarrage de PostgreSQL..."
  systemctl restart postgresql
  sleep 10
  if pg_isready -U stockapp -d stock_management; then
    log_message "✓ Base de données accessible après redémarrage"
  else
    log_message "✗ Base de données toujours non accessible"
  fi
fi
unset PGPASSWORD

# 5. Réinstaller les dépendances
log_message "5. Réinstallation complète des dépendances..."
npm cache clean --force
npm install

# 6. Régénérer Prisma
log_message "6. Régénération de Prisma..."
npx prisma generate

# 7. Synchroniser la base de données
log_message "7. Synchronisation de la base de données..."
npx prisma db push

# 8. Construire l'application
log_message "8. Construction de l'application..."
npm run build

# 9. Vérifier que l'utilisateur existe
log_message "9. Vérification de l'utilisateur dans la base de données..."
export PGPASSWORD="SMT2025"
USER_EXISTS=$(psql -U stockapp -d stock_management -t -c "SELECT COUNT(*) FROM users WHERE email = 'mohamed.boujelbane@monetiquetunisie.com';" 2>/dev/null | tr -d ' ')

if [ "$USER_EXISTS" = "0" ]; then
  log_message "Création de l'utilisateur mohamed.boujelbane@monetiquetunisie.com..."
  
  # Hasher le mot de passe
  HASHED_PASSWORD=$(node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('SMT@2025', 10));")
  
  # Insérer l'utilisateur
  psql -U stockapp -d stock_management -c "
    INSERT INTO users (id, email, password, \"firstName\", \"lastName\", role, \"isActive\", \"createdAt\", \"updatedAt\")
    VALUES (
      'user-$(date +%s)',
      'mohamed.boujelbane@monetiquetunisie.com',
      '$HASHED_PASSWORD',
      'Mohamed',
      'Boujelbane',
      'admin',
      true,
      NOW(),
      NOW()
    );
  " 2>&1
  
  log_message "✓ Utilisateur créé"
else
  log_message "✓ Utilisateur existe déjà"
fi

# Vérifier que l'utilisateur a été créé
psql -U stockapp -d stock_management -c "SELECT id, email, role, \"isActive\" FROM users WHERE email = 'mohamed.boujelbane@monetiquetunisie.com';" 2>&1

unset PGPASSWORD

# 10. Redémarrer l'application
log_message "10. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start

# 11. Attendre le démarrage
log_message "11. Attente du démarrage (30 secondes)..."
sleep 30

# 12. Vérifier le statut
log_message "12. Vérification du statut..."
pm2 status

# 13. Tester l'API d'authentification
log_message "13. Test de l'API d'authentification..."
if curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}' | grep -q "success"; then
  log_message "✓ API d'authentification fonctionne"
else
  log_message "✗ API d'authentification ne fonctionne pas"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 20
fi

# 14. Tester l'application complète
log_message "14. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "✗ Application non accessible"
fi

log_message "--- Réparation terminée ---"
log_message "Vérifiez que l'application fonctionne avec: pm2 logs $PM2_APP_NAME"
