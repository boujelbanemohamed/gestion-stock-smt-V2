#!/bin/bash

# Fichier: restore-stable-version.sh
# Description: Script pour restaurer la version stable fonctionnelle

# --- Configuration ---
APP_DIR="/var/www/stock-management"
PM2_APP_NAME="stock-management-app"
LOG_FILE="$APP_DIR/restore_stable_version.log"
APP_URL="http://localhost:3000"
STABLE_COMMIT="56107982026842fc924cd989d0a036e43f278936"

# --- Fonctions utilitaires ---

log_message() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

error_exit() {
  log_message "ERREUR: $1"
  log_message "Restauration échouée."
  exit 1
}

# --- Début du script ---
log_message "--- Démarrage de la restauration de la version stable ---"

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

# 3. Restaurer la version stable
log_message "3. Restauration de la version stable (commit: $STABLE_COMMIT)..."
git reset --hard "$STABLE_COMMIT"
if [ $? -eq 0 ]; then
  log_message "✓ Version stable restaurée"
else
  error_exit "Impossible de restaurer la version stable"
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

# 5. Installation des dépendances
log_message "5. Installation des dépendances..."
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

# 10. Construction de l'application
log_message "10. Construction de l'application..."
npm run build
if [ $? -eq 0 ]; then
  log_message "✓ Application construite avec succès"
else
  log_message "❌ Échec de la construction"
  error_exit "Impossible de construire l'application"
fi

# 11. Vérifier que le dossier .next existe
log_message "11. Vérification du dossier .next..."
if [ -d ".next" ]; then
  log_message "✓ Dossier .next trouvé"
  ls -la .next/ | head -5
else
  error_exit "Dossier .next manquant"
fi

# 12. Redémarrer l'application
log_message "12. Redémarrage de l'application..."
pm2 start npm --name "$PM2_APP_NAME" -- run start
log_message "✓ Application redémarrée"

# 13. Attendre le démarrage
log_message "13. Attente du démarrage (30 secondes)..."
sleep 30

# 14. Vérifier le statut
log_message "14. Vérification du statut..."
pm2 status

# 15. Vérifier les logs
log_message "15. Vérification des logs (dernières 20 lignes)..."
pm2 logs "$PM2_APP_NAME" --lines 20

# 16. Tester l'API stats
log_message "16. Test de l'API stats..."
STATS_RESPONSE=$(curl -s "$APP_URL/api/stats")
log_message "Réponse API Stats: $STATS_RESPONSE"

# 17. Tester l'application complète
log_message "17. Test de l'application complète..."
if curl -s -o /dev/null -w "%{http_code}" "$APP_URL" | grep -q "200"; then
  log_message "✓ Application accessible sur $APP_URL"
else
  log_message "❌ Application non accessible sur $APP_URL"
fi

# 18. Créer un script de test final
log_message "18. Création d'un script de test final..."
cat << 'EOF' > test-stable-version.sh
#!/bin/bash
echo "Test de la version stable restaurée..."
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
echo ""
echo "6. Commit actuel:"
git log --oneline -1
EOF

chmod +x test-stable-version.sh
log_message "✓ Script test-stable-version.sh créé"

log_message "--- Restauration de la version stable terminée ---"
log_message "Utilisez './test-stable-version.sh' pour tester l'application"
log_message "L'application devrait maintenant fonctionner avec la version stable (sans les nouveaux KPIs)"
log_message "Commit restauré: $STABLE_COMMIT"
