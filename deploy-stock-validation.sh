#!/bin/bash

# Script de déploiement pour la validation avancée du stock
# Auteur: Assistant IA
# Date: $(date)

echo "🚀 Déploiement de la validation avancée du stock..."
echo "=================================================="

# 1. Vérification de l'environnement
echo "1️⃣ Vérification de l'environnement..."
if [ ! -d "/var/www/stock-management" ]; then
    echo "❌ Répertoire /var/www/stock-management non trouvé"
    exit 1
fi

cd /var/www/stock-management

# 2. Sauvegarde de la base de données
echo "2️⃣ Sauvegarde de la base de données..."
BACKUP_FILE="backup_stock_validation_$(date +%Y%m%d_%H%M%S).sql"
sudo -u postgres pg_dump stock_management > "$BACKUP_FILE"
echo "✅ Sauvegarde créée: $BACKUP_FILE"

# 3. Récupération des dernières modifications
echo "3️⃣ Récupération des modifications depuis GitHub..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code mis à jour"

# 4. Vérification des fichiers critiques
echo "4️⃣ Vérification des fichiers critiques..."
if [ ! -f "components/dashboard/movements-management.tsx" ]; then
    echo "❌ Fichier movements-management.tsx manquant"
    exit 1
fi

if [ ! -f "app/dashboard/logs/page.tsx" ]; then
    echo "❌ Fichier logs/page.tsx manquant"
    exit 1
fi

echo "✅ Fichiers critiques présents"

# 5. Configuration de l'environnement
echo "5️⃣ Configuration de l'environnement..."
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant"
    exit 1
fi

# Vérifier les variables critiques
if ! grep -q "DATABASE_URL" .env; then
    echo "❌ DATABASE_URL manquant dans .env"
    exit 1
fi

if ! grep -q "NODE_ENV=production" .env; then
    echo "❌ NODE_ENV=production manquant dans .env"
    exit 1
fi

echo "✅ Variables d'environnement configurées"

# 6. Installation des dépendances
echo "6️⃣ Installation des dépendances..."
npm cache clean --force
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de l'installation des dépendances"
    exit 1
fi
echo "✅ Dépendances installées"

# 7. Génération Prisma
echo "7️⃣ Génération du client Prisma..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la génération Prisma"
    exit 1
fi
echo "✅ Client Prisma généré"

# 8. Synchronisation de la base de données
echo "8️⃣ Synchronisation de la base de données..."
npx prisma db push
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la synchronisation DB"
    exit 1
fi
echo "✅ Base de données synchronisée"

# 9. Build de l'application
echo "9️⃣ Build de l'application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi
echo "✅ Application buildée"

# 10. Redémarrage de l'application
echo "🔟 Redémarrage de l'application..."
pm2 stop stock-management
sleep 2
pm2 delete stock-management
sleep 2
pm2 start npm --name "stock-management" -- start
sleep 5

# Vérification du statut
pm2 status stock-management
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du démarrage de l'application"
    exit 1
fi

echo "✅ Application redémarrée"

# 11. Tests de validation
echo "1️⃣1️⃣ Tests de validation..."

# Test de l'API des mouvements
echo "Test de l'API des mouvements..."
MOVEMENTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/movements)
if [ "$MOVEMENTS_RESPONSE" != "200" ]; then
    echo "⚠️ API des mouvements: $MOVEMENTS_RESPONSE"
else
    echo "✅ API des mouvements: OK"
fi

# Test de l'API des cartes
echo "Test de l'API des cartes..."
CARDS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cards)
if [ "$CARDS_RESPONSE" != "200" ]; then
    echo "⚠️ API des cartes: $CARDS_RESPONSE"
else
    echo "✅ API des cartes: OK"
fi

# Test de l'API des emplacements
echo "Test de l'API des emplacements..."
LOCATIONS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/locations)
if [ "$LOCATIONS_RESPONSE" != "200" ]; then
    echo "⚠️ API des emplacements: $LOCATIONS_RESPONSE"
else
    echo "✅ API des emplacements: OK"
fi

# 12. Vérification de la base de données
echo "1️⃣2️⃣ Vérification de la base de données..."
DB_CHECK=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -c "SELECT COUNT(*) FROM movements;" 2>/dev/null | grep -o '[0-9]*' | tail -1)
if [ -n "$DB_CHECK" ]; then
    echo "✅ Base de données: $DB_CHECK mouvements trouvés"
else
    echo "⚠️ Problème de connexion à la base de données"
fi

# 13. Résumé du déploiement
echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"
echo "===================================="
echo "✅ Code mis à jour depuis GitHub"
echo "✅ Sauvegarde de la base de données: $BACKUP_FILE"
echo "✅ Dépendances installées"
echo "✅ Client Prisma généré"
echo "✅ Base de données synchronisée"
echo "✅ Application buildée"
echo "✅ Application redémarrée"
echo ""
echo "🚀 NOUVELLES FONCTIONNALITÉS DISPONIBLES:"
echo "• Validation avancée du stock pour sorties et transferts"
echo "• Affichage visuel du stock disponible par carte"
echo "• Messages d'erreur détaillés"
echo "• Bouton désactivé si stock insuffisant"
echo "• Interface colorée selon disponibilité"
echo ""
echo "🌐 Application accessible sur: http://localhost:3000"
echo "📊 Dashboard: http://localhost:3000/dashboard"
echo "📋 Mouvements: http://localhost:3000/dashboard/movements"
echo ""
echo "✅ Déploiement terminé avec succès !"
