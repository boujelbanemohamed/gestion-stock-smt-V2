#!/bin/bash

# Script de correction de l'erreur 404 pour la page logs
# Diagnostique et corrige les problèmes de routage Next.js

echo "=========================================="
echo "🔧 Correction Erreur 404 Page Logs"
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

# 1. Vérifier la structure des fichiers
echo ""
echo "1️⃣ Vérification de la structure des fichiers..."

# Vérifier que le fichier logs/page.tsx existe
if [ -f "app/dashboard/logs/page.tsx" ]; then
    log_success "Fichier app/dashboard/logs/page.tsx existe"
else
    log_error "Fichier app/dashboard/logs/page.tsx manquant"
    exit 1
fi

# Vérifier le contenu du fichier
echo ""
log_info "Contenu du fichier logs/page.tsx:"
head -10 app/dashboard/logs/page.tsx

# 2. Vérifier le build Next.js
echo ""
echo "2️⃣ Vérification du build Next.js..."

# Vérifier que le dossier .next existe
if [ -d ".next" ]; then
    log_success "Dossier .next existe"
    
    # Vérifier les routes générées
    if [ -d ".next/server/app/dashboard/logs" ]; then
        log_success "Route logs générée dans .next"
    else
        log_warning "Route logs non générée dans .next"
        log_info "Contenu du dossier .next/server/app/dashboard:"
        ls -la .next/server/app/dashboard/ 2>/dev/null || log_warning "Dossier dashboard non trouvé"
    fi
else
    log_error "Dossier .next manquant - Build nécessaire"
fi

# 3. Vérifier les routes Next.js
echo ""
echo "3️⃣ Vérification des routes Next.js..."

# Lister toutes les routes dashboard
log_info "Routes dashboard disponibles:"
find app/dashboard -name "page.tsx" -type f | sort

# 4. Vérifier la configuration Next.js
echo ""
echo "4️⃣ Vérification de la configuration Next.js..."

if [ -f "next.config.mjs" ]; then
    log_success "Fichier next.config.mjs existe"
    log_info "Contenu de next.config.mjs:"
    cat next.config.mjs
else
    log_warning "Fichier next.config.mjs manquant"
fi

# 5. Vérifier les imports dans le layout
echo ""
echo "5️⃣ Vérification du layout dashboard..."

if [ -f "app/dashboard/layout.tsx" ]; then
    log_success "Fichier layout.tsx existe"
    
    # Vérifier que la route logs est dans la navigation
    if grep -q "logs" app/dashboard/layout.tsx; then
        log_success "Route logs trouvée dans la navigation"
    else
        log_warning "Route logs non trouvée dans la navigation"
    fi
else
    log_error "Fichier layout.tsx manquant"
fi

# 6. Nettoyer et rebuilder
echo ""
echo "6️⃣ Nettoyage et rebuild..."

log_info "Nettoyage du cache Next.js..."
rm -rf .next
rm -rf node_modules/.cache

log_info "Nettoyage du cache npm..."
npm cache clean --force 2>/dev/null || true

log_info "Regénération Prisma..."
npx prisma generate

log_info "Build de l'application..."
NODE_ENV=production npm run build

# Vérifier que le build a réussi
if [ -d ".next" ]; then
    log_success "Build réussi"
    
    # Vérifier que la route logs est maintenant générée
    if [ -d ".next/server/app/dashboard/logs" ]; then
        log_success "Route logs générée après rebuild"
    else
        log_warning "Route logs toujours non générée"
        log_info "Routes disponibles dans .next:"
        find .next/server/app -name "page.js" -type f | head -10
    fi
else
    log_error "Build échoué"
    exit 1
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
    log_success "Page logs accessible (HTTP 200)"
elif [ "$LOGS_RESPONSE" = "404" ]; then
    log_error "Page logs toujours en 404"
    
    # Vérifier les routes disponibles
    log_info "Routes dashboard testées:"
    for route in banks cards locations movements users logs profile; do
        RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/$route)
        echo "  /dashboard/$route: HTTP $RESPONSE"
    done
else
    log_warning "Page logs retourne HTTP $LOGS_RESPONSE"
fi

# 9. Créer un script de test manuel
echo ""
echo "9️⃣ Création d'un script de test manuel..."

cat > test-logs-manual.sh << 'EOF'
#!/bin/bash

echo "=== Test Manuel de la Page Logs ==="

# Test 1: Vérifier que l'application est accessible
echo "1. Test de l'application..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Application accessible"
else
    echo "❌ Application non accessible"
    exit 1
fi

# Test 2: Tester toutes les routes dashboard
echo "2. Test des routes dashboard..."
for route in banks cards locations movements users logs profile; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/$route)
    if [ "$RESPONSE" = "200" ]; then
        echo "✅ /dashboard/$route: HTTP $RESPONSE"
    else
        echo "❌ /dashboard/$route: HTTP $RESPONSE"
    fi
done

# Test 3: Vérifier les logs PM2
echo "3. Logs PM2:"
pm2 logs stock-management --lines 10

echo ""
echo "=== Instructions de Test ==="
echo "1. Ouvrir http://localhost:3000/dashboard/logs dans le navigateur"
echo "2. Vérifier la console du navigateur pour les erreurs"
echo "3. Tester les autres routes dashboard"
echo "4. Vérifier les logs PM2 si problème persiste"
EOF

chmod +x test-logs-manual.sh
log_success "Script de test manuel créé: test-logs-manual.sh"

# 10. Résumé
echo ""
echo "=========================================="
echo "📊 Résumé de la Correction"
echo "=========================================="

echo "✅ Actions effectuées:"
echo "  - Vérification de la structure des fichiers"
echo "  - Nettoyage du cache Next.js"
echo "  - Regénération Prisma"
echo "  - Rebuild de l'application"
echo "  - Redémarrage de l'application"

echo ""
echo "🔧 Si la page logs ne fonctionne toujours pas:"
echo "1. Exécuter: ./test-logs-manual.sh"
echo "2. Vérifier les logs PM2: pm2 logs stock-management"
echo "3. Vérifier la console du navigateur"
echo "4. Tester les autres routes dashboard"

echo ""
echo "🧪 Pour tester manuellement:"
echo "  ./test-logs-manual.sh"

echo ""
echo "✅ Correction de l'erreur 404 terminée !"
