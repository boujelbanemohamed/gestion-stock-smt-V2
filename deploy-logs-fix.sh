#!/bin/bash

# Script de déploiement rapide pour corriger la page logs
# Déploie le fichier manquant et redémarre l'application

echo "=========================================="
echo "🚀 Déploiement Correction Page Logs"
echo "=========================================="

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_info() {
    echo -e "ℹ $1"
}

# 1. Récupérer les dernières modifications
echo ""
echo "1️⃣ Récupération des modifications..."

git pull origin main
log_success "Modifications récupérées"

# 2. Vérifier que le fichier logs/page.tsx existe
echo ""
echo "2️⃣ Vérification du fichier logs/page.tsx..."

if [ -f "app/dashboard/logs/page.tsx" ]; then
    log_success "Fichier app/dashboard/logs/page.tsx existe"
    
    # Afficher le contenu du fichier
    log_info "Contenu du fichier:"
    head -10 app/dashboard/logs/page.tsx
else
    log_error "Fichier app/dashboard/logs/page.tsx manquant"
    exit 1
fi

# 3. Nettoyer le cache
echo ""
echo "3️⃣ Nettoyage du cache..."

log_info "Nettoyage du cache Next.js..."
rm -rf .next
rm -rf node_modules/.cache

log_success "Cache nettoyé"

# 4. Regénérer Prisma
echo ""
echo "4️⃣ Regénération Prisma..."

npx prisma generate
log_success "Prisma regénéré"

# 5. Build de l'application
echo ""
echo "5️⃣ Build de l'application..."

NODE_ENV=production npm run build
log_success "Build terminé"

# 6. Vérifier que la route logs est générée
echo ""
echo "6️⃣ Vérification de la route logs..."

if [ -d ".next/server/app/dashboard/logs" ]; then
    log_success "Route logs générée dans .next"
else
    log_warning "Route logs non générée dans .next"
    log_info "Routes disponibles:"
    find .next/server/app/dashboard -name "page.js" -type f | head -5
fi

# 7. Redémarrer l'application
echo ""
echo "7️⃣ Redémarrage de l'application..."

log_info "Arrêt de l'application..."
pm2 stop stock-management 2>/dev/null || true
pm2 delete stock-management 2>/dev/null || true

log_info "Démarrage de l'application..."
NODE_ENV=production pm2 start npm --name "stock-management" -- start
pm2 save

log_info "Attente du démarrage (15 secondes)..."
sleep 15

# 8. Test de la page logs
echo ""
echo "8️⃣ Test de la page logs..."

# Test de l'application
if curl -s http://localhost:3000 > /dev/null; then
    log_success "Application accessible"
else
    log_error "Application non accessible"
    exit 1
fi

# Test de la page logs
LOGS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/logs)
if [ "$LOGS_RESPONSE" = "200" ]; then
    log_success "Page logs accessible (HTTP 200) ✅"
elif [ "$LOGS_RESPONSE" = "404" ]; then
    log_error "Page logs toujours en 404 ❌"
    
    # Vérifier les autres routes
    log_info "Test des autres routes:"
    for route in banks cards locations movements users; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/$route)
        echo "  /dashboard/$route: HTTP $RESPONSE"
    done
else
    log_warning "Page logs retourne HTTP $LOGS_RESPONSE"
fi

# 9. Test complet des routes
echo ""
echo "9️⃣ Test complet des routes dashboard..."

echo "Routes dashboard testées:"
for route in banks cards locations movements users logs profile; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/$route)
    if [ "$RESPONSE" = "200" ]; then
        echo "✅ /dashboard/$route: HTTP $RESPONSE"
    else
        echo "❌ /dashboard/$route: HTTP $RESPONSE"
    fi
done

# 10. Résumé
echo ""
echo "=========================================="
echo "📊 Résumé du Déploiement"
echo "=========================================="

echo "✅ Actions effectuées:"
echo "  - Fichier app/dashboard/logs/page.tsx vérifié"
echo "  - Cache Next.js nettoyé"
echo "  - Prisma regénéré"
echo "  - Application rebuilée"
echo "  - Application redémarrée"

echo ""
echo "🔗 Test de la page logs:"
echo "  http://localhost:3000/dashboard/logs"

echo ""
echo "🧪 Si la page logs ne fonctionne toujours pas:"
echo "1. Vérifier les logs PM2: pm2 logs stock-management"
echo "2. Vérifier la console du navigateur"
echo "3. Tester les autres routes dashboard"

echo ""
echo "✅ Déploiement de la correction terminé !"
