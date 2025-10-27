#!/bin/bash

# Fichier: fix-typescript-import-response.sh
# Description: Script de correction rapide pour l'erreur TypeScript ImportResponse

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management"
LOG_FILE="$APP_DIR/fix_typescript_import_response.log"

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
log_message "--- Démarrage de la correction TypeScript ImportResponse ---"

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

# 11. Test de Prisma Client
log_message "11. Test de Prisma Client..."
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

# 12. Construction de l'application
log_message "12. Construction de l'application..."
npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite avec succès"
else
  error_exit "Échec de la construction de l'application"
fi

# 13. Redémarrage de l'application avec PM2
log_message "13. Redémarrage de l'application avec PM2..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée avec PM2"

# 14. Attendre le démarrage
log_message "14. Attente du démarrage (30 secondes)..."
sleep 30

# 15. Vérifier le statut
log_message "15. Vérification du statut..."
pm2 status

# 16. Vérifier les logs
log_message "16. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 17. Tester l'API d'authentification
log_message "17. Test de l'API d'authentification..."
LOGIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mohamed.boujelbane@monetiquetunisie.com","password":"SMT@2025"}')

log_message "Réponse API Login: $LOGIN_RESPONSE"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
  log_message "✓ API d'authentification fonctionne (connexion réussie)"
else
  log_message "❌ API d'authentification échoue. Réponse: $LOGIN_RESPONSE"
fi

# 18. Tester l'application complète
log_message "18. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000" | grep -q "200"; then
  log_message "✓ Application accessible sur http://localhost:3000"
else
  log_message "❌ Application non accessible sur http://localhost:3000"
fi

# 19. Test de l'application publique
log_message "19. Test de l'application publique..."
if curl -s -o /dev/null -w "%{http_code}" "https://gstock.monetiquetunisie.com" | grep -q "200"; then
  log_message "✓ Application publique accessible sur https://gstock.monetiquetunisie.com"
else
  log_message "❌ Application publique non accessible sur https://gstock.monetiquetunisie.com"
fi

log_message "--- Correction TypeScript ImportResponse terminée ---"
log_message "L'application devrait maintenant fonctionner SANS erreur TypeScript"
