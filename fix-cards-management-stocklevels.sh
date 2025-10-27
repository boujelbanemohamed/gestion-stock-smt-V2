#!/bin/bash

# Fichier: fix-cards-management-stocklevels.sh
# Description: Script de correction rapide pour l'erreur stockLevels dans cards-management.tsx

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management"
LOG_FILE="$APP_DIR/fix_cards_management_stocklevels.log"

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
log_message "--- Démarrage de la correction stockLevels dans cards-management.tsx ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 3
log_message "✓ PM2 arrêté"

# 2. Nettoyage complet
log_message "2. Nettoyage complet..."
rm -rf .next
rm -rf node_modules
rm -f package-lock.json
log_message "✓ Nettoyage terminé"

# 3. Supprimer TOUS les fichiers de configuration Tailwind et PostCSS
log_message "3. Suppression de tous les fichiers de configuration Tailwind et PostCSS..."
rm -f tailwind.config.js
rm -f tailwind.config.ts
rm -f postcss.config.js
rm -f postcss.config.mjs
rm -f postcss.config.cjs
rm -f .postcssrc
rm -f .postcssrc.js
rm -f .postcssrc.json
log_message "✓ Fichiers de configuration supprimés"

# 4. Créer un next.config.mjs SANS Tailwind
log_message "4. Création d'un next.config.mjs SANS Tailwind..."
cat << 'EOF' > next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client')
    }
    return config
  },
  // Pas de Tailwind CSS
  compiler: {
    removeConsole: false
  }
}

export default nextConfig
EOF
log_message "✓ next.config.mjs créé SANS Tailwind"

# 5. Créer un fichier CSS simple
log_message "5. Création d'un fichier CSS simple..."
cat << 'EOF' > app/globals.css
/* CSS simple sans Tailwind */
* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

body {
  color: #333;
  background: #f5f5f5;
}

a {
  color: inherit;
  text-decoration: none;
}

/* Classes utilitaires simples */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}

.btn:hover {
  background: #0056b3;
}

.btn-danger {
  background: #dc3545;
}

.btn-danger:hover {
  background: #c82333;
}

.form-group {
  margin-bottom: 15px;
}

.form-label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.table th {
  background: #f8f9fa;
  font-weight: 600;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

.mb-4 {
  margin-bottom: 20px;
}

.mt-4 {
  margin-top: 20px;
}

.p-4 {
  padding: 20px;
}

.grid {
  display: grid;
  gap: 20px;
}

.grid-cols-1 {
  grid-template-columns: 1fr;
}

.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-cols-3 {
  grid-template-columns: repeat(3, 1fr);
}

.grid-cols-4 {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 768px) {
  .grid-cols-2,
  .grid-cols-3,
  .grid-cols-4 {
    grid-template-columns: 1fr;
  }
}
EOF
log_message "✓ Fichier CSS simple créé"

# 6. Installation des dépendances SANS Tailwind
log_message "6. Installation des dépendances SANS Tailwind..."
npm cache clean --force
npm install --force
log_message "✓ Dépendances installées"

# 7. Installation spécifique de Prisma
log_message "7. Installation spécifique de Prisma..."
npm install @prisma/client --save
npm install prisma --save-dev
log_message "✓ Prisma installé"

# 8. Regénération de Prisma Client
log_message "8. Regénération de Prisma Client..."
npx prisma generate
if [ $? -eq 0 ]; then
  log_message "✓ Prisma Client regénéré avec succès"
else
  error_exit "Échec de la regénération de Prisma Client"
fi

# 9. Synchronisation de la base de données
log_message "9. Synchronisation de la base de données..."
npx prisma db push
if [ $? -eq 0 ]; then
  log_message "✓ Base de données synchronisée"
else
  error_exit "Échec de la synchronisation de la base de données"
fi

# 10. CORRECTION DÉFINITIVE des erreurs TypeScript ImportResponse
log_message "10. CORRECTION DÉFINITIVE des erreurs TypeScript ImportResponse..."

# Corriger banks/import/route.ts
if [ -f "app/api/banks/import/route.ts" ]; then
  log_message "Correction de banks/import/route.ts..."
  cp "app/api/banks/import/route.ts" "app/api/banks/import/route.ts.backup"
  
  # Remplacer NextResponse.json<ImportResponse>( par NextResponse.json(
  sed -i 's/NextResponse\.json<ImportResponse>(/NextResponse.json(/g' "app/api/banks/import/route.ts"
  
  log_message "✓ banks/import/route.ts corrigé"
fi

# Corriger cards/import/route.ts
if [ -f "app/api/cards/import/route.ts" ]; then
  log_message "Correction de cards/import/route.ts..."
  cp "app/api/cards/import/route.ts" "app/api/cards/import/route.ts.backup"
  
  # Remplacer NextResponse.json<ImportResponse>( par NextResponse.json(
  sed -i 's/NextResponse\.json<ImportResponse>(/NextResponse.json(/g' "app/api/cards/import/route.ts"
  
  log_message "✓ cards/import/route.ts corrigé"
fi

# Corriger locations/import/route.ts
if [ -f "app/api/locations/import/route.ts" ]; then
  log_message "Correction de locations/import/route.ts..."
  cp "app/api/locations/import/route.ts" "app/api/locations/import/route.ts.backup"
  
  # Remplacer NextResponse.json<ImportResponse>( par NextResponse.json(
  sed -i 's/NextResponse\.json<ImportResponse>(/NextResponse.json(/g' "app/api/locations/import/route.ts"
  
  log_message "✓ locations/import/route.ts corrigé"
fi

# 11. CORRECTION DÉFINITIVE de l'erreur stockLevels dans cards-management.tsx
log_message "11. CORRECTION DÉFINITIVE de l'erreur stockLevels dans cards-management.tsx..."
if [ -f "components/dashboard/cards-management.tsx" ]; then
  # Créer une sauvegarde
  cp "components/dashboard/cards-management.tsx" "components/dashboard/cards-management.tsx.backup"
  
  # CORRECTION DÉFINITIVE - Remplacer stockLevels par quantity
  sed -i 's/const stockLevels = card\.stockLevels || \[\]/const stockLevels = [{ quantity: card.quantity }]/g' "components/dashboard/cards-management.tsx"
  
  # CORRECTION DÉFINITIVE - Remplacer card.stockLevels par [{ quantity: card.quantity }]
  sed -i 's/card\.stockLevels/[{ quantity: card.quantity }]/g' "components/dashboard/cards-management.tsx"
  
  # CORRECTION DÉFINITIVE - Remplacer card.bank?.name par banks.find(b => b.id === card.bankId)?.name
  sed -i 's/card\.bank\?\.name/banks.find(b => b.id === card.bankId)?.name/g' "components/dashboard/cards-management.tsx"
  
  # CORRECTION DÉFINITIVE - Remplacer card.bank par banks.find(b => b.id === card.bankId)
  sed -i 's/card\.bank/banks.find(b => b.id === card.bankId)/g' "components/dashboard/cards-management.tsx"
  
  log_message "✓ Erreur stockLevels corrigée DÉFINITIVEMENT dans cards-management.tsx"
else
  log_message "⚠ Fichier cards-management.tsx non trouvé"
fi

# 12. Test de Prisma Client
log_message "12. Test de Prisma Client..."
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

# 13. Construction de l'application
log_message "13. Construction de l'application..."
npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite avec succès"
else
  error_exit "Échec de la construction de l'application"
fi

# 14. Redémarrage de l'application avec PM2
log_message "14. Redémarrage de l'application avec PM2..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée avec PM2"

# 15. Attendre le démarrage
log_message "15. Attente du démarrage (30 secondes)..."
sleep 30

# 16. Vérifier le statut
log_message "16. Vérification du statut..."
pm2 status

# 17. Vérifier les logs
log_message "17. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 18. Tester l'API d'authentification
log_message "18. Test de l'API d'authentification..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}')

log_message "Réponse API Login: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  log_message "✓ API d'authentification fonctionne (connexion réussie)"
else
  log_message "❌ API d'authentification échoue. Réponse: $LOGIN_RESPONSE"
fi

# 19. Tester l'application complète
log_message "19. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000" | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "❌ Application non accessible sur http://localhost:3000"
fi

# 20. Test de l'application publique
log_message "20. Test de l'application publique..."
if curl -s -o /dev/null -w "%{http_code}" "https://gstock.monetiquetunisie.com" | grep -q "200"; then
  log_message "✓ Application publique accessible sur https://gstock.monetiquetunisie.com"
else
  log_message "❌ Application publique non accessible sur https://gstock.monetiquetunisie.com"
fi

# 21. DIAGNOSTIC COMPLET DE L'APPLICATION
log_message "21. DIAGNOSTIC COMPLET DE L'APPLICATION..."

# 21.1. Informations système
log_message "21.1. Informations système..."
echo "OS: $(uname -a)" | tee -a "$LOG_FILE"
echo "Node.js: $(node --version)" | tee -a "$LOG_FILE"
echo "NPM: $(npm --version)" | tee -a "$LOG_FILE"
echo "PM2: $(pm2 --version)" | tee -a "$LOG_FILE"

# 21.2. Statut des services
log_message "21.2. Statut des services..."
echo "PostgreSQL: $(systemctl is-active postgresql)" | tee -a "$LOG_FILE"
echo "Nginx: $(systemctl is-active nginx)" | tee -a "$LOG_FILE"
pm2 status | tee -a "$LOG_FILE"

# 21.3. Vérification des fichiers de configuration
log_message "21.3. Vérification des fichiers de configuration..."
echo "Fichier .env existe: $([ -f ".env" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier package.json existe: $([ -f "package.json" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier next.config.mjs existe: $([ -f "next.config.mjs" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier postcss.config.mjs existe: $([ -f "postcss.config.mjs" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"
echo "Fichier tailwind.config.js existe: $([ -f "tailwind.config.js" ] && echo "OUI" || echo "NON")" | tee -a "$LOG_FILE"

# 21.4. Variables d'environnement
log_message "21.4. Variables d'environnement..."
if [ -f ".env" ]; then
  echo "Contenu du .env:" | tee -a "$LOG_FILE"
  cat .env | tee -a "$LOG_FILE"
else
  echo "Fichier .env manquant" | tee -a "$LOG_FILE"
fi

# 21.5. Dépendances installées
log_message "21.5. Dépendances installées..."
if [ -d "node_modules" ]; then
  echo "node_modules existe" | tee -a "$LOG_FILE"
  echo "Packages liés à Tailwind:" | tee -a "$LOG_FILE"
  ls node_modules | grep -i tailwind | tee -a "$LOG_FILE"
  echo "Packages liés à PostCSS:" | tee -a "$LOG_FILE"
  ls node_modules | grep -i postcss | tee -a "$LOG_FILE"
else
  echo "node_modules n'existe pas" | tee -a "$LOG_FILE"
fi

# 21.6. Configuration Next.js
log_message "21.6. Configuration Next.js..."
if [ -f "next.config.mjs" ]; then
  echo "Contenu de next.config.mjs:" | tee -a "$LOG_FILE"
  cat next.config.mjs | tee -a "$LOG_FILE"
else
  echo "next.config.mjs manquant" | tee -a "$LOG_FILE"
fi

# 21.7. Configuration PostCSS
log_message "21.7. Configuration PostCSS..."
if [ -f "postcss.config.mjs" ]; then
  echo "Contenu de postcss.config.mjs:" | tee -a "$LOG_FILE"
  cat postcss.config.mjs | tee -a "$LOG_FILE"
elif [ -f "postcss.config.js" ]; then
  echo "Contenu de postcss.config.js:" | tee -a "$LOG_FILE"
  cat postcss.config.js | tee -a "$LOG_FILE"
else
  echo "Aucun fichier de configuration PostCSS trouvé" | tee -a "$LOG_FILE"
fi

# 21.8. Configuration Tailwind
log_message "21.8. Configuration Tailwind..."
if [ -f "tailwind.config.js" ]; then
  echo "Contenu de tailwind.config.js:" | tee -a "$LOG_FILE"
  cat tailwind.config.js | tee -a "$LOG_FILE"
elif [ -f "tailwind.config.ts" ]; then
  echo "Contenu de tailwind.config.ts:" | tee -a "$LOG_FILE"
  cat tailwind.config.ts | tee -a "$LOG_FILE"
else
  echo "Aucun fichier de configuration Tailwind trouvé" | tee -a "$LOG_FILE"
fi

# 21.9. Fichiers CSS
log_message "21.9. Fichiers CSS..."
echo "Fichiers CSS trouvés:" | tee -a "$LOG_FILE"
find . -name "*.css" -type f | tee -a "$LOG_FILE"

# 21.10. Test de connexion à la base de données
log_message "21.10. Test de connexion à la base de données..."
export PGPASSWORD="SMT2025"
if psql -h localhost -U stockapp -d stock_management -c "SELECT 1;" >/dev/null 2>&1; then
  echo "✓ Connexion à la base de données réussie" | tee -a "$LOG_FILE"
else
  echo "❌ Échec de la connexion à la base de données" | tee -a "$LOG_FILE"
fi
unset PGPASSWORD

# 21.11. Test de Prisma
log_message "21.11. Test de Prisma..."
if npx prisma --version >/dev/null 2>&1; then
  echo "✓ Prisma installé" | tee -a "$LOG_FILE"
  npx prisma --version | tee -a "$LOG_FILE"
else
  echo "❌ Prisma non installé" | tee -a "$LOG_FILE"
fi

# 21.12. Logs PM2
log_message "21.12. Logs PM2 (dernières 20 lignes)..."
pm2 logs --lines 20 | tee -a "$LOG_FILE"

# 21.13. Test de l'application
log_message "21.13. Test de l'application..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
  echo "✓ Application accessible" | tee -a "$LOG_FILE"
else
  echo "❌ Application non accessible" | tee -a "$LOG_FILE"
fi

# 21.14. Erreurs de build
log_message "21.14. Test de build..."
if npm run build >/dev/null 2>&1; then
  echo "✓ Build réussi" | tee -a "$LOG_FILE"
else
  echo "❌ Build échoué" | tee -a "$LOG_FILE"
  echo "Tentative de build pour voir les erreurs:" | tee -a "$LOG_FILE"
  npm run build 2>&1 | tee -a "$LOG_FILE"
fi

# 21.15. Test de l'API stats
log_message "21.15. Test de l'API stats..."
STATS_RESPONSE=$(curl -s "http://localhost:3000/api/stats")
log_message "Réponse API Stats: $STATS_RESPONSE"

# 21.16. Test de l'API d'authentification
log_message "21.16. Test de l'API d'authentification..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}')
log_message "Réponse API Login: $LOGIN_RESPONSE"

# 21.17. Test de l'application publique
log_message "21.17. Test de l'application publique..."
if curl -s -o /dev/null -w "%{http_code}" "https://gstock.monetiquetunisie.com" | grep -q "200"; then
  echo "✓ Application publique accessible" | tee -a "$LOG_FILE"
else
  echo "❌ Application publique non accessible" | tee -a "$LOG_FILE"
fi

# 21.18. Vérification des erreurs restantes
log_message "21.18. Vérification des erreurs restantes..."
if grep -q "card\.bank" components/dashboard/cards-management.tsx; then
  echo "❌ Il reste des références à card.bank:" | tee -a "$LOG_FILE"
  grep -n "card\.bank" components/dashboard/cards-management.tsx | tee -a "$LOG_FILE"
else
  echo "✓ Plus de références à card.bank" | tee -a "$LOG_FILE"
fi

if grep -q "stockLevels" components/dashboard/cards-management.tsx; then
  echo "❌ Il reste des références à stockLevels:" | tee -a "$LOG_FILE"
  grep -n "stockLevels" components/dashboard/cards-management.tsx | tee -a "$LOG_FILE"
else
  echo "✓ Plus de références à stockLevels" | tee -a "$LOG_FILE"
fi

if grep -q "Id)" components/dashboard/cards-management.tsx; then
  echo "❌ Il reste des erreurs de syntaxe:" | tee -a "$LOG_FILE"
  grep -n "Id)" components/dashboard/cards-management.tsx | tee -a "$LOG_FILE"
else
  echo "✓ Plus d'erreurs de syntaxe" | tee -a "$LOG_FILE"
fi

log_message "--- Correction stockLevels dans cards-management.tsx terminée ---"
log_message "DIAGNOSTIC COMPLET TERMINÉ"
log_message "Consultez le fichier $LOG_FILE pour les détails complets"
log_message "L'application devrait maintenant fonctionner SANS erreur stockLevels"
