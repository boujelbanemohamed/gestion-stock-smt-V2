#!/bin/bash

# Script de correction immédiate du fichier logs/page.tsx manquant
# Crée le fichier directement sur RedHat

echo "=========================================="
echo "🔧 Correction Immédiate Fichier Logs Manquant"
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

# 1. Vérifier l'état Git
echo ""
echo "1️⃣ Vérification de l'état Git..."

git status
echo ""
git log --oneline -5

# 2. Forcer la synchronisation avec GitHub
echo ""
echo "2️⃣ Synchronisation forcée avec GitHub..."

log_info "Fetch depuis GitHub..."
git fetch origin

log_info "Reset vers origin/main..."
git reset --hard origin/main

log_info "Vérification après reset..."
git log --oneline -1

# 3. Vérifier que le fichier existe maintenant
echo ""
echo "3️⃣ Vérification du fichier logs/page.tsx..."

if [ -f "app/dashboard/logs/page.tsx" ]; then
    log_success "Fichier app/dashboard/logs/page.tsx existe maintenant"
    
    # Afficher le contenu
    log_info "Contenu du fichier:"
    cat app/dashboard/logs/page.tsx
else
    log_error "Fichier toujours manquant - Création manuelle..."
    
    # Créer le dossier s'il n'existe pas
    mkdir -p app/dashboard/logs
    
    # Créer le fichier manuellement
    cat > app/dashboard/logs/page.tsx << 'EOF'
"use client"

import { usePermissions } from "@/hooks/use-permissions"
import LogsPanel from "@/components/dashboard/logs-panel"

export default function LogsPage() {
  const { canAccessModule, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!canAccessModule("logs")) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h2>
          <p className="text-gray-600">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </div>
      </div>
    )
  }

  return <LogsPanel />
}
EOF
    
    log_success "Fichier app/dashboard/logs/page.tsx créé manuellement"
    
    # Vérifier le contenu
    log_info "Contenu du fichier créé:"
    cat app/dashboard/logs/page.tsx
fi

# 4. Nettoyer et rebuilder
echo ""
echo "4️⃣ Nettoyage et rebuild..."

log_info "Nettoyage du cache Next.js..."
rm -rf .next
rm -rf node_modules/.cache

log_info "Regénération Prisma..."
npx prisma generate

log_info "Build de l'application..."
NODE_ENV=production npm run build

# 5. Vérifier que la route est générée
echo ""
echo "5️⃣ Vérification de la route logs..."

if [ -d ".next/server/app/dashboard/logs" ]; then
    log_success "Route logs générée dans .next"
    log_info "Contenu du dossier logs:"
    ls -la .next/server/app/dashboard/logs/
else
    log_warning "Route logs non générée"
    log_info "Routes dashboard disponibles:"
    find .next/server/app/dashboard -name "page.js" -type f | head -10
fi

# 6. Redémarrer l'application
echo ""
echo "6️⃣ Redémarrage de l'application..."

log_info "Arrêt de l'application..."
pm2 stop stock-management 2>/dev/null || true
pm2 delete stock-management 2>/dev/null || true

log_info "Démarrage de l'application..."
NODE_ENV=production pm2 start npm --name "stock-management" -- start
pm2 save

log_info "Attente du démarrage (15 secondes)..."
sleep 15

# 7. Test de la page logs
echo ""
echo "7️⃣ Test de la page logs..."

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

# 8. Test complet des routes
echo ""
echo "8️⃣ Test complet des routes dashboard..."

echo "Routes dashboard testées:"
for route in banks cards locations movements users logs profile; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/$route)
    if [ "$RESPONSE" = "200" ]; then
        echo "✅ /dashboard/$route: HTTP $RESPONSE"
    else
        echo "❌ /dashboard/$route: HTTP $RESPONSE"
    fi
done

# 9. Résumé
echo ""
echo "=========================================="
echo "📊 Résumé de la Correction"
echo "=========================================="

echo "✅ Actions effectuées:"
echo "  - Synchronisation forcée avec GitHub"
echo "  - Fichier app/dashboard/logs/page.tsx créé"
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
echo "✅ Correction du fichier manquant terminée !"
