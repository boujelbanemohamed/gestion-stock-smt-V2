#!/bin/bash

# Fichier: fix-kpis.sh
# Description: Script pour corriger l'affichage des KPIs

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_kpis.log"
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
log_message "--- Démarrage de la correction des KPIs ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5
log_message "✓ PM2 arrêté"

# 2. Nettoyer les fichiers temporaires
log_message "2. Nettoyage des fichiers temporaires..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma
log_message "✓ Fichiers temporaires nettoyés"

# 3. Vérifier les fichiers modifiés
log_message "3. Vérification des fichiers modifiés..."
if [ -f "app/api/stats/route.ts" ]; then
  log_message "✓ Fichier app/api/stats/route.ts existe"
  if grep -q "totalStockVolume" app/api/stats/route.ts; then
    log_message "✓ Nouveaux KPIs trouvés dans l'API"
  else
    log_message "❌ Nouveaux KPIs non trouvés dans l'API"
    error_exit "Les nouveaux KPIs ne sont pas présents dans l'API"
  fi
else
  error_exit "Fichier app/api/stats/route.ts manquant"
fi

if [ -f "components/dashboard/dashboard.tsx" ]; then
  log_message "✓ Fichier components/dashboard/dashboard.tsx existe"
  if grep -q "totalStockVolume" components/dashboard/dashboard.tsx; then
    log_message "✓ Nouveaux KPIs trouvés dans le composant Dashboard"
  else
    log_message "❌ Nouveaux KPIs non trouvés dans le composant Dashboard"
    error_exit "Les nouveaux KPIs ne sont pas présents dans le composant Dashboard"
  fi
else
  error_exit "Fichier components/dashboard/dashboard.tsx manquant"
fi

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

# 5. Réinstaller les dépendances
log_message "5. Réinstallation des dépendances..."
npm cache clean --force
npm install --force
log_message "✓ Dépendances réinstallées"

# 6. Regénérer Prisma Client
log_message "6. Regénération de Prisma Client..."
npx prisma generate
log_message "✓ Prisma Client regénéré"

# 7. Synchroniser la base de données
log_message "7. Synchronisation de la base de données..."
npx prisma db push
log_message "✓ Base de données synchronisée"

# 8. Construire l'application
log_message "8. Construction de l'application..."
npm run build
log_message "✓ Application construite"

# 9. Redémarrer l'application
log_message "9. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée"

# 10. Attendre le démarrage
log_message "10. Attente du démarrage (30 secondes)..."
sleep 30

# 11. Vérifier le statut
log_message "11. Vérification du statut..."
pm2 status

# 12. Tester l'API stats
log_message "12. Test de l'API stats..."
STATS_RESPONSE=$(curl -s "$APP_URL/api/stats")
log_message "Réponse API Stats: $STATS_RESPONSE"

# 13. Vérifier si les nouveaux KPIs sont présents
if echo "$STATS_RESPONSE" | grep -q "totalStockVolume"; then
  log_message "✓ Nouveaux KPIs présents dans l'API"
else
  log_message "❌ Nouveaux KPIs absents de l'API"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 20
fi

# 14. Tester l'application complète
log_message "14. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 15. Créer un script de test
log_message "15. Création d'un script de test..."
cat << 'EOF' > test-kpis.sh
#!/bin/bash
echo "Test des KPIs..."
curl -s http://localhost:3000/api/stats | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/stats
EOF

chmod +x test-kpis.sh
log_message "✓ Script test-kpis.sh créé"

log_message "--- Correction terminée ---"
log_message "Utilisez './test-kpis.sh' pour tester les KPIs"
log_message "L'application devrait maintenant afficher les nouveaux KPIs"
