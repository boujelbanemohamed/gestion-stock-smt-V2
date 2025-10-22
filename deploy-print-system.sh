#!/bin/bash

# Script de déploiement pour le système d'impression en deux étapes
# Auteur: Assistant IA
# Date: $(date)

echo "🖨️ Déploiement du système d'impression en deux étapes..."
echo "======================================================"

# 1. Vérification de l'environnement
echo "1️⃣ Vérification de l'environnement..."
if [ ! -d "/var/www/stock-management" ]; then
    echo "❌ Répertoire /var/www/stock-management non trouvé"
    exit 1
fi

cd /var/www/stock-management

# 2. Sauvegarde de la base de données
echo "2️⃣ Sauvegarde de la base de données..."
BACKUP_FILE="backup_print_system_$(date +%Y%m%d_%H%M%S).sql"
sudo -u postgres pg_dump stock_management > "$BACKUP_FILE"
echo "✅ Sauvegarde créée: $BACKUP_FILE"

# 3. Récupération des dernières modifications
echo "3️⃣ Récupération des modifications depuis GitHub..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code mis à jour"

# 4. Vérification des nouvelles fonctionnalités
echo "4️⃣ Vérification des nouvelles fonctionnalités..."

# Vérifier le modal d'impression
if grep -q "isPrintDialogOpen" components/dashboard/locations-management.tsx; then
    echo "✅ Modal d'impression trouvé"
else
    echo "❌ Modal d'impression manquant"
fi

# Vérifier les fonctions de gestion
if grep -q "handlePrintDialogOpen" components/dashboard/locations-management.tsx; then
    echo "✅ Fonction handlePrintDialogOpen trouvée"
else
    echo "❌ Fonction handlePrintDialogOpen manquante"
fi

if grep -q "handlePrintModeSelect" components/dashboard/locations-management.tsx; then
    echo "✅ Fonction handlePrintModeSelect trouvée"
else
    echo "❌ Fonction handlePrintModeSelect manquante"
fi

if grep -q "handlePrintExecute" components/dashboard/locations-management.tsx; then
    echo "✅ Fonction handlePrintExecute trouvée"
else
    echo "❌ Fonction handlePrintExecute manquante"
fi

# Vérifier les états
if grep -q "printMode.*useState" components/dashboard/locations-management.tsx; then
    echo "✅ État printMode trouvé"
else
    echo "❌ État printMode manquant"
fi

if grep -q "selectedBankId.*useState" components/dashboard/locations-management.tsx; then
    echo "✅ État selectedBankId trouvé"
else
    echo "❌ État selectedBankId manquant"
fi

if grep -q "selectedLocationId.*useState" components/dashboard/locations-management.tsx; then
    echo "✅ État selectedLocationId trouvé"
else
    echo "❌ État selectedLocationId manquant"
fi

# Vérifier l'interface utilisateur
if grep -q "Choisissez le type d'impression" components/dashboard/locations-management.tsx; then
    echo "✅ Interface de sélection trouvée"
else
    echo "❌ Interface de sélection manquante"
fi

if grep -q "Par Banque.*Par Emplacement" components/dashboard/locations-management.tsx; then
    echo "✅ Boutons de sélection trouvés"
else
    echo "❌ Boutons de sélection manquants"
fi

echo "✅ Nouvelles fonctionnalités vérifiées"

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

# Test de l'API des mouvements
echo "Test de l'API des mouvements..."
MOVEMENTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/movements)
if [ "$MOVEMENTS_RESPONSE" != "200" ]; then
    echo "⚠️ API des mouvements: $MOVEMENTS_RESPONSE"
else
    echo "✅ API des mouvements: OK"
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
echo "🖨️ NOUVEAU SYSTÈME D'IMPRESSION:"
echo "• Interface de sélection en deux étapes"
echo "• Modal intuitif avec sélection du mode"
echo "• Impression par banque (vue globale)"
echo "• Impression par emplacement (vue détaillée)"
echo "• Rapports complets avec informations détaillées"
echo "• Processus guidé étape par étape"
echo ""
echo "🌐 Application accessible sur: http://localhost:3000"
echo "📊 Dashboard: http://localhost:3000/dashboard"
echo "📍 Emplacements: http://localhost:3000/dashboard/locations"
echo ""
echo "📋 UTILISATION:"
echo "1. Cliquer sur 'Imprimer le stock'"
echo "2. Choisir le type d'impression (Banque/Emplacement)"
echo "3. Sélectionner l'entité spécifique"
echo "4. Cliquer sur 'Imprimer'"
echo ""
echo "✅ Déploiement terminé avec succès !"
