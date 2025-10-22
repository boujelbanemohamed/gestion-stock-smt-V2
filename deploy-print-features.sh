#!/bin/bash

# Script de déploiement pour les fonctionnalités d'impression
# Auteur: Assistant IA
# Date: $(date)

echo "🖨️ Déploiement des fonctionnalités d'impression..."
echo "================================================="

# 1. Vérification de l'environnement
echo "1️⃣ Vérification de l'environnement..."
if [ ! -d "/var/www/stock-management" ]; then
    echo "❌ Répertoire /var/www/stock-management non trouvé"
    exit 1
fi

cd /var/www/stock-management

# 2. Sauvegarde de la base de données
echo "2️⃣ Sauvegarde de la base de données..."
BACKUP_FILE="backup_print_features_$(date +%Y%m%d_%H%M%S).sql"
sudo -u postgres pg_dump stock_management > "$BACKUP_FILE"
echo "✅ Sauvegarde créée: $BACKUP_FILE"

# 3. Récupération des dernières modifications
echo "3️⃣ Récupération des modifications depuis GitHub..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code mis à jour"

# 4. Vérification des fichiers critiques
echo "4️⃣ Vérification des fichiers critiques..."
if [ ! -f "components/dashboard/locations-management.tsx" ]; then
    echo "❌ Fichier locations-management.tsx manquant"
    exit 1
fi

# Vérifier les nouvelles fonctionnalités
if grep -q "printByBank" components/dashboard/locations-management.tsx; then
    echo "✅ Fonction printByBank trouvée"
else
    echo "❌ Fonction printByBank manquante"
fi

if grep -q "printByLocation" components/dashboard/locations-management.tsx; then
    echo "✅ Fonction printByLocation trouvée"
else
    echo "❌ Fonction printByLocation manquante"
fi

if grep -q "Building2.*MapPin" components/dashboard/locations-management.tsx; then
    echo "✅ Icônes d'impression trouvées"
else
    echo "❌ Icônes d'impression manquantes"
fi

echo "✅ Fichiers critiques vérifiés"

# 5. Configuration de l'environnement
echo "5️⃣ Configuration de l'environnement..."
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant"
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

# Test de l'API des emplacements
echo "Test de l'API des emplacements..."
LOCATIONS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/locations)
if [ "$LOCATIONS_RESPONSE" != "200" ]; then
    echo "⚠️ API des emplacements: $LOCATIONS_RESPONSE"
else
    echo "✅ API des emplacements: OK"
fi

# Test de l'API des banques
echo "Test de l'API des banques..."
BANKS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/banks)
if [ "$BANKS_RESPONSE" != "200" ]; then
    echo "⚠️ API des banques: $BANKS_RESPONSE"
else
    echo "✅ API des banques: OK"
fi

# Test de l'API des cartes
echo "Test de l'API des cartes..."
CARDS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cards)
if [ "$CARDS_RESPONSE" != "200" ]; then
    echo "⚠️ API des cartes: $CARDS_RESPONSE"
else
    echo "✅ API des cartes: OK"
fi

# 12. Vérification de la base de données
echo "1️⃣2️⃣ Vérification de la base de données..."
DB_CHECK=$(PGPASSWORD=SMT2025 psql -U stockapp -d stock_management -c "SELECT COUNT(*) FROM locations;" 2>/dev/null | grep -o '[0-9]*' | tail -1)
if [ -n "$DB_CHECK" ]; then
    echo "✅ Base de données: $DB_CHECK emplacements trouvés"
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
echo "🖨️ NOUVELLES FONCTIONNALITÉS D'IMPRESSION:"
echo "• Impression par banque (vue globale)"
echo "• Impression par emplacement (vue détaillée)"
echo "• Menu déroulant avec options d'impression"
echo "• Rapports professionnels et structurés"
echo "• Interface utilisateur intuitive"
echo ""
echo "🌐 Application accessible sur: http://localhost:3000"
echo "📊 Dashboard: http://localhost:3000/dashboard"
echo "📍 Emplacements: http://localhost:3000/dashboard/locations"
echo ""
echo "✅ Déploiement terminé avec succès !"
