#!/bin/bash

# Fichier: fix-build-final.sh
# Description: Script pour corriger définitivement le build et les KPIs

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/fix_build_final.log"
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
log_message "--- Démarrage de la correction finale du build ---"

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
rm -rf node_modules/.cache
rm -rf node_modules/@prisma/client
rm -rf node_modules/.prisma
log_message "✓ Nettoyage terminé"

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

# 4. Regénérer Prisma Client
log_message "4. Regénération de Prisma Client..."
npx prisma generate
log_message "✓ Prisma Client regénéré"

# 5. Synchroniser la base de données
log_message "5. Synchronisation de la base de données..."
npx prisma db push
log_message "✓ Base de données synchronisée"

# 6. Construire l'application en mode développement d'abord
log_message "6. Construction de l'application en mode développement..."
NODE_ENV=development npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite en mode développement"
else
  log_message "❌ Échec de la construction en mode développement"
  error_exit "Impossible de construire l'application"
fi

# 7. Vérifier que le dossier .next existe
log_message "7. Vérification du dossier .next..."
if [ -d ".next" ]; then
  log_message "✓ Dossier .next trouvé"
  ls -la .next/ | head -10
else
  error_exit "Dossier .next manquant"
fi

# 8. Redémarrer l'application en mode développement
log_message "8. Redémarrage de l'application en mode développement..."
NODE_ENV=development pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée en mode développement"

# 9. Attendre le démarrage
log_message "9. Attente du démarrage (30 secondes)..."
sleep 30

# 10. Vérifier le statut
log_message "10. Vérification du statut..."
pm2 status

# 11. Vérifier les logs
log_message "11. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

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
  pm2 logs "$PM2_APP_NAME" --lines 10
fi

# 14. Tester l'application complète
log_message "14. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 15. Essayer de construire en mode production
log_message "15. Tentative de construction en mode production..."
NODE_ENV=production npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite en mode production"
  
  # Redémarrer en mode production
  log_message "16. Redémarrage en mode production..."
  pm2 delete "$PM2_APP_NAME" 2>/dev/null
  sleep 3
  NODE_ENV=production pm2 start npm --name "$PM2_APP_NAME" -- run start
  sleep 30
  
  # Vérifier le statut final
  log_message "17. Vérification du statut final..."
  pm2 status
  
  # Test final
  log_message "18. Test final de l'application..."
  if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
    log_message "✓ Application accessible en mode production"
  else
    log_message "❌ Application non accessible en mode production, retour en mode développement"
    pm2 delete "$PM2_APP_NAME" 2>/dev/null
    NODE_ENV=development pm2 start npm --name "$PM2_APP_NAME" -- run start
  fi
else
  log_message "❌ Échec de la construction en mode production, resté en mode développement"
fi

# 19. Créer un script de test final
log_message "19. Création d'un script de test final..."
cat << 'EOF' > test-final.sh
#!/bin/bash
echo "Test final de l'application..."
echo "1. Test de l'application:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
echo ""
echo "2. Test de l'API stats:"
curl -s http://localhost:3000/api/stats | jq '.' 2>/dev/null || curl -s http://localhost:3000/api/stats
echo ""
echo "3. Statut PM2:"
pm2 status
echo ""
echo "4. Logs récents:"
pm2 logs stock-management-app --lines 5
EOF

chmod +x test-final.sh
log_message "✓ Script test-final.sh créé"

log_message "--- Correction finale terminée ---"
log_message "Utilisez './test-final.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner avec les nouveaux KPIs"
