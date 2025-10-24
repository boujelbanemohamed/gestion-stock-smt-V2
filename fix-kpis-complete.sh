#!/bin/bash

# Fichier: fix-kpis-complete.sh
# Description: Script pour corriger complètement les KPIs et les erreurs

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_kpis_complete.log"
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
log_message "--- Démarrage de la correction complète des KPIs ---"

cd "$APP_DIR" || error_exit "Impossible de changer de répertoire vers $APP_DIR"

# 1. Arrêter PM2
log_message "1. Arrêt de PM2..."
pm2 delete "$PM2_APP_NAME" 2>/dev/null
pm2 kill 2>/dev/null
sleep 5
log_message "✓ PM2 arrêté"

# 2. Nettoyer complètement
log_message "2. Nettoyage complet..."
rm -rf .next
rm -rf node_modules
rm -rf node_modules/.cache
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma
rm -f package-lock.json
log_message "✓ Nettoyage complet terminé"

# 3. Corriger l'API stats (changer 'type' en 'movementType')
log_message "3. Correction de l'API stats..."
if [ -f "app/api/stats/route.ts" ]; then
  # Remplacer 'type' par 'movementType' dans l'API
  sed -i 's/type: true/movementType: true/g' app/api/stats/route.ts
  sed -i 's/m\.type === '\''entry'\''/m.movementType === '\''entry'\''/g' app/api/stats/route.ts
  sed -i 's/m\.type === '\''exit'\''/m.movementType === '\''exit'\''/g' app/api/stats/route.ts
  sed -i 's/m\.type === '\''transfer'\''/m.movementType === '\''transfer'\''/g' app/api/stats/route.ts
  log_message "✓ API stats corrigée"
else
  error_exit "Fichier app/api/stats/route.ts manquant"
fi

# 4. Installer les dépendances manquantes
log_message "4. Installation des dépendances manquantes..."
npm install --force
npm install @tailwindcss/postcss --save-dev
npm install tailwindcss postcss autoprefixer --save-dev
log_message "✓ Dépendances installées"

# 5. Charger les variables d'environnement
log_message "5. Chargement des variables d'environnement..."
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
  log_message "✓ Variables d'environnement chargées"
else
  error_exit "Fichier .env manquant"
fi

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
if [ $? -eq 0 ]; then
  log_message "✓ Application construite avec succès"
else
  log_message "❌ Échec de la construction, tentative de correction..."
  
  # Installer les dépendances manquantes
  npm install @tailwindcss/postcss --save-dev
  npm install tailwindcss postcss autoprefixer --save-dev
  
  # Réessayer la construction
  npm run build
  if [ $? -eq 0 ]; then
    log_message "✓ Application construite après correction"
  else
    error_exit "Impossible de construire l'application"
  fi
fi

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

# 12. Vérifier les logs
log_message "12. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 13. Tester l'API stats
log_message "13. Test de l'API stats..."
STATS_RESPONSE=$(curl -s "$APP_URL/api/stats")
log_message "Réponse API Stats: $STATS_RESPONSE"

# 14. Vérifier si les nouveaux KPIs sont présents
if echo "$STATS_RESPONSE" | grep -q "totalStockVolume"; then
  log_message "✓ Nouveaux KPIs présents dans l'API"
else
  log_message "❌ Nouveaux KPIs absents de l'API"
  log_message "Logs de l'application:"
  pm2 logs "$PM2_APP_NAME" --lines 10
fi

# 15. Tester l'application complète
log_message "15. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 16. Créer un script de test
log_message "16. Création d'un script de test..."
cat << 'EOF' > test-kpis-complete.sh
#!/bin/bash
echo "Test complet des KPIs..."
echo "1. Test de l'application:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
echo ""
echo "2. Test de l'API stats:"
curl -s http://localhost:3000/api/stats | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/stats
echo ""
echo "3. Statut PM2:"
pm2 status
EOF

chmod +x test-kpis-complete.sh
log_message "✓ Script test-kpis-complete.sh créé"

log_message "--- Correction complète terminée ---"
log_message "Utilisez './test-kpis-complete.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner avec les nouveaux KPIs"
