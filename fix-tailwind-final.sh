#!/bin/bash

# Fichier: fix-tailwind-final.sh
# Description: Script pour corriger définitivement Tailwind CSS et les KPIs

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_tailwind_final.log"
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
log_message "--- Démarrage de la correction finale de Tailwind CSS ---"

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

# 3. Charger les variables d'environnement
log_message "3. Chargement des variables d'environnement..."
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  log_message "✓ Variables d'environnement chargées"
else
  error_exit "Fichier .env manquant"
fi

# 4. Installation des dépendances de base
log_message "4. Installation des dépendances de base..."
npm cache clean --force
npm install --force
log_message "✓ Dépendances de base installées"

# 5. Installation spécifique de Tailwind CSS
log_message "5. Installation spécifique de Tailwind CSS..."
npm install tailwindcss postcss autoprefixer --save-dev
npm install @tailwindcss/postcss --save-dev
npm install @tailwindcss/typography --save-dev
npm install @tailwindcss/forms --save-dev
npm install @tailwindcss/aspect-ratio --save-dev
log_message "✓ Tailwind CSS installé"

# 6. Installation de Prisma Client
log_message "6. Installation de Prisma Client..."
npm install @prisma/client --save
npm install prisma --save-dev
log_message "✓ Prisma Client installé"

# 7. Regénération de Prisma Client
log_message "7. Regénération de Prisma Client..."
npx prisma generate
if [ $? -eq 0 ]; then
  log_message "✓ Prisma Client regénéré avec succès"
else
  log_message "❌ Échec de la regénération de Prisma Client"
  error_exit "Impossible de regénérer Prisma Client"
fi

# 8. Vérifier que Tailwind CSS est installé
log_message "8. Vérification de l'installation de Tailwind CSS..."
if [ -d "node_modules/tailwindcss" ]; then
  log_message "✓ Tailwind CSS trouvé dans node_modules"
  ls -la node_modules/tailwindcss/ | head -5
else
  error_exit "Tailwind CSS non trouvé dans node_modules"
fi

# 9. Vérifier que PostCSS est installé
log_message "9. Vérification de l'installation de PostCSS..."
if [ -d "node_modules/postcss" ]; then
  log_message "✓ PostCSS trouvé dans node_modules"
else
  error_exit "PostCSS non trouvé dans node_modules"
fi

# 10. Synchronisation de la base de données
log_message "10. Synchronisation de la base de données..."
npx prisma db push
log_message "✓ Base de données synchronisée"

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
  log_message "❌ Prisma Client ne fonctionne pas"
  error_exit "Prisma Client ne fonctionne pas"
fi

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
cat << 'EOF' > test-tailwind-final.sh
#!/bin/bash
echo "Test final de Tailwind CSS et des KPIs..."
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
echo "5. Test de Tailwind CSS:"
if [ -d "node_modules/tailwindcss" ]; then
  echo "✓ Tailwind CSS installé"
else
  echo "❌ Tailwind CSS non installé"
fi
echo ""
echo "6. Logs récents:"
pm2 logs stock-management-app --lines 5
EOF

chmod +x test-tailwind-final.sh
log_message "✓ Script test-tailwind-final.sh créé"

log_message "--- Correction finale de Tailwind CSS terminée ---"
log_message "Utilisez './test-tailwind-final.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner avec les nouveaux KPIs"
