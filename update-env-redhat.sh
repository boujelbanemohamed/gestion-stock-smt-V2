#!/bin/bash

# Script de mise à jour du .env pour RedHat Production
# Compatible avec le commit 418ac4c et les versions récentes

echo "=========================================="
echo "🔧 Mise à jour .env pour RedHat Production"
echo "=========================================="

# Sauvegarder l'ancien .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✓ Ancien .env sauvegardé"
fi

# Créer le nouveau .env optimisé pour RedHat
cat > .env << 'EOF'
# Base de données PostgreSQL - Configuration RedHat Production
DATABASE_URL="postgresql://postgres@localhost:5432/stock_management?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://172.17.5.199"

# Session et sécurité
SESSION_SECRET="przFeJuWQFfZ15KGJ1+atTmeNfPH9IrlMiTVSXqPG08="
JWT_SECRET="Pq5NWU4IuduKa4qTBP7kU/noGGXhzp8eoQLpDy04Sd8="

# Configuration SMTP (à adapter selon votre serveur)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@172.17.5.199"
SMTP_FROM_NAME="Monetique Tunisie - Gestion de Stocks"

# Configuration des notifications
NOTIFICATIONS_ENABLED="true"
NOTIFICATIONS_LOW_STOCK_ALERTS="true"
NOTIFICATIONS_MOVEMENT_NOTIFICATIONS="true"
NOTIFICATIONS_USER_ACTIVITY_ALERTS="true"
NOTIFICATIONS_LOW_STOCK_THRESHOLD="10"
NOTIFICATIONS_CRITICAL_STOCK_THRESHOLD="5"
NOTIFICATIONS_EMAIL_NOTIFICATIONS="true"
NOTIFICATIONS_IN_APP_NOTIFICATIONS="true"
EOF

echo "✓ Nouveau .env créé avec configuration RedHat"
echo ""
echo "=== CONFIGURATION APPLIQUÉE ==="
echo "DATABASE_URL: postgresql://postgres@localhost:5432/stock_management"
echo "NODE_ENV: production"
echo "API_URL: https://172.17.5.199"
echo ""
echo "=== PROCHAINES ÉTAPES ==="
echo "1. Vérifier la connexion DB: npx prisma db execute --stdin <<< 'SELECT 1;'"
echo "2. Regénérer Prisma: npx prisma generate"
echo "3. Rebuild: NODE_ENV=production npm run build"
echo "4. Redémarrer: pm2 restart stock-management"
echo ""
echo "✅ Configuration .env mise à jour pour RedHat !"
