#!/bin/bash

# Fichier: fix-remove-tailwind-completely.sh
# Description: Script pour supprimer complètement Tailwind CSS et PostCSS

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_remove_tailwind_completely.log"
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
log_message "--- Démarrage de la suppression complète de Tailwind CSS ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5
log_message "✓ PM2 arrêté"

# 2. Nettoyage complet
log_message "2. Nettoyage complet..."
rm -rf .next
rm -rf node_modules
rm -rf node_modules/.cache
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma
rm -f package-lock.json
rm -f pnpm-lock.yaml
log_message "✓ Nettoyage complet terminé"

# 3. Supprimer tous les fichiers de configuration Tailwind et PostCSS
log_message "3. Suppression des fichiers de configuration Tailwind et PostCSS..."
rm -f tailwind.config.js
rm -f tailwind.config.ts
rm -f postcss.config.js
rm -f postcss.config.mjs
rm -f postcss.config.cjs
rm -f .postcssrc
rm -f .postcssrc.js
rm -f .postcssrc.json
log_message "✓ Fichiers de configuration supprimés"

# 4. Charger les variables d'environnement
log_message "4. Chargement des variables d'environnement..."
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  log_message "✓ Variables d'environnement chargées"
else
  error_exit "Fichier .env manquant"
fi

# 5. Installation des dépendances sans Tailwind
log_message "5. Installation des dépendances sans Tailwind..."
npm cache clean --force
npm install --force
log_message "✓ Dépendances installées"

# 6. Installation spécifique de Prisma
log_message "6. Installation spécifique de Prisma..."
npm install @prisma/client --save
npm install prisma --save-dev
log_message "✓ Prisma installé"

# 7. Regénération de Prisma Client
log_message "7. Regénération de Prisma Client..."
npx prisma generate
if [ $? -eq 0 ]; then
  log_message "✓ Prisma Client regénéré avec succès"
else
  log_message "❌ Échec de la regénération de Prisma Client"
  error_exit "Impossible de regénérer Prisma Client"
fi

# 8. Synchronisation de la base de données
log_message "8. Synchronisation de la base de données..."
npx prisma db push
log_message "✓ Base de données synchronisée"

# 9. Test de Prisma Client
log_message "9. Test de Prisma Client..."
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
  log_message "❌ Prisma Client ne fonctionne pas"
  error_exit "Prisma Client ne fonctionne pas"
fi

# 10. Créer un next.config.mjs sans Tailwind
log_message "10. Création d'un next.config.mjs sans Tailwind..."
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
log_message "✓ next.config.mjs créé sans Tailwind"

# 11. Créer un fichier CSS simple
log_message "11. Création d'un fichier CSS simple..."
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

# 12. Construction de l'application
log_message "12. Construction de l'application..."
npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite avec succès"
else
  log_message "❌ Échec de la construction"
  error_exit "Impossible de construire l'application"
fi

# 13. Vérifier que le dossier .next existe
log_message "13. Vérification du dossier .next..."
if [ -d ".next" ]; then
  log_message "✓ Dossier .next trouvé"
  ls -la .next/ | head -5
else
  error_exit "Dossier .next manquant"
fi

# 14. Redémarrer l'application
log_message "14. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée"

# 15. Attendre le démarrage
log_message "15. Attente du démarrage (30 secondes)..."
sleep 30

# 16. Vérifier le statut
log_message "16. Vérification du statut..."
pm2 status

# 17. Vérifier les logs
log_message "17. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 18. Tester l'API stats
log_message "18. Test de l'API stats..."
STATS_RESPONSE=$(curl -s "$APP_URL/api/stats")
log_message "Réponse API Stats: $STATS_RESPONSE"

# 19. Vérifier si les nouveaux KPIs sont présents
if echo "$STATS_RESPONSE" | grep -q "totalStockVolume"; then
  log_message "✓ Nouveaux KPIs présents dans l'API"
else
  log_message "❌ Nouveaux KPIs absents de l'API"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 10
fi

# 20. Tester l'application complète
log_message "20. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 21. Créer un script de test final
log_message "21. Création d'un script de test final..."
cat << 'EOF' > test-remove-tailwind.sh
#!/bin/bash
echo "Test final sans Tailwind CSS..."
echo "1. Test de l'application:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
echo ""
echo "2. Test de l'API stats:"
curl -s http://localhost:3000/api/stats | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/stats
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
echo "5. Logs récents:"
pm2 logs stock-management-app --lines 5
EOF

chmod +x test-remove-tailwind.sh
log_message "✓ Script test-remove-tailwind.sh créé"

log_message "--- Suppression complète de Tailwind CSS terminée ---"
log_message "Utilisez './test-remove-tailwind.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner avec les nouveaux KPIs (sans Tailwind CSS)"
