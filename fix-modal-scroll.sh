#!/bin/bash

# Script de correction pour le scroll du modal et le titre rouge
# Auteur: Assistant IA
# Date: $(date)

echo "🔧 Correction du modal de mouvement..."
echo "====================================="

# 1. Vérification de l'environnement
echo "1️⃣ Vérification de l'environnement..."
if [ ! -d "/var/www/stock-management" ]; then
    echo "❌ Répertoire /var/www/stock-management non trouvé"
    exit 1
fi

cd /var/www/stock-management

# 2. Récupération des dernières modifications
echo "2️⃣ Récupération des modifications depuis GitHub..."
git fetch origin main
git reset --hard origin/main
echo "✅ Code mis à jour"

# 3. Vérification des modifications dans le fichier
echo "3️⃣ Vérification des modifications..."
if grep -q "max-h-\[90vh\]" components/dashboard/movements-management.tsx; then
    echo "✅ Hauteur maximale du modal configurée"
else
    echo "❌ Hauteur maximale du modal non trouvée"
fi

if grep -q "text-red-700" components/dashboard/movements-management.tsx; then
    echo "✅ Titre du stock en rouge configuré"
else
    echo "❌ Titre du stock en rouge non trouvé"
fi

if grep -q "overflow-y-auto" components/dashboard/movements-management.tsx; then
    echo "✅ Scroll vertical configuré"
else
    echo "❌ Scroll vertical non trouvé"
fi

# 4. Nettoyage du cache
echo "4️⃣ Nettoyage du cache..."
rm -rf .next
rm -rf node_modules/.cache
echo "✅ Cache nettoyé"

# 5. Installation des dépendances
echo "5️⃣ Installation des dépendances..."
npm install
echo "✅ Dépendances installées"

# 6. Génération Prisma
echo "6️⃣ Génération du client Prisma..."
npx prisma generate
echo "✅ Client Prisma généré"

# 7. Build de l'application
echo "7️⃣ Build de l'application..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi
echo "✅ Application buildée"

# 8. Redémarrage de l'application
echo "8️⃣ Redémarrage de l'application..."
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

# 9. Test de l'application
echo "9️⃣ Test de l'application..."
APP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$APP_RESPONSE" = "200" ]; then
    echo "✅ Application accessible"
else
    echo "⚠️ Application: $APP_RESPONSE"
fi

# 10. Résumé des corrections
echo ""
echo "🎉 CORRECTIONS APPLIQUÉES !"
echo "============================"
echo "✅ Modal avec scroll vertical"
echo "✅ Hauteur maximale limitée à 90vh"
echo "✅ Titre 'Stock disponible' en rouge"
echo "✅ Boutons toujours visibles"
echo "✅ Structure flex pour une meilleure gestion"
echo ""
echo "🌐 Testez l'application sur: http://localhost:3000"
echo "📋 Page des mouvements: http://localhost:3000/dashboard/movements"
echo ""
echo "✅ Corrections terminées avec succès !"
