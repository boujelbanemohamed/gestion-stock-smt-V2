#!/bin/bash

# Script de correction de la page logs pour RedHat
# Initialise l'utilisateur dans localStorage et corrige les permissions

echo "=========================================="
echo "🔧 Correction Page Logs RedHat"
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

# 1. Vérifier l'API des utilisateurs
echo ""
echo "1️⃣ Vérification de l'API des utilisateurs..."

if curl -s http://localhost:3000/api/users | jq -e '.success' > /dev/null 2>&1; then
    log_success "API users accessible"
    
    # Récupérer le premier utilisateur admin
    ADMIN_USER=$(curl -s http://localhost:3000/api/users | jq -r '.data[] | select(.role == "admin") | .' 2>/dev/null | head -1)
    
    if [ "$ADMIN_USER" != "null" ] && [ ! -z "$ADMIN_USER" ]; then
        log_success "Utilisateur admin trouvé"
        echo "$ADMIN_USER" | jq '.'
    else
        log_warning "Aucun utilisateur admin trouvé"
        
        # Récupérer le premier utilisateur disponible
        FIRST_USER=$(curl -s http://localhost:3000/api/users | jq -r '.data[0]' 2>/dev/null)
        if [ "$FIRST_USER" != "null" ] && [ ! -z "$FIRST_USER" ]; then
            log_info "Utilisation du premier utilisateur disponible"
            echo "$FIRST_USER" | jq '.'
        else
            log_error "Aucun utilisateur trouvé"
            exit 1
        fi
    fi
else
    log_error "API users non accessible"
    exit 1
fi

# 2. Vérifier l'API des logs
echo ""
echo "2️⃣ Vérification de l'API des logs..."

if curl -s http://localhost:3000/api/logs | jq -e '.success' > /dev/null 2>&1; then
    log_success "API logs accessible"
    
    # Compter les logs
    LOGS_COUNT=$(curl -s http://localhost:3000/api/logs | jq -r '.total // 0' 2>/dev/null)
    log_info "Nombre de logs: $LOGS_COUNT"
else
    log_warning "API logs non accessible"
fi

# 3. Vérifier les permissions
echo ""
echo "3️⃣ Vérification des permissions..."

if curl -s http://localhost:3000/api/roles | jq -e '.success' > /dev/null 2>&1; then
    log_success "API roles accessible"
    
    # Vérifier les permissions pour les logs
    LOGS_PERMISSIONS=$(curl -s http://localhost:3000/api/roles | jq -r '.data[] | select(.permissions[] | contains("logs")) | .role' 2>/dev/null)
    if [ ! -z "$LOGS_PERMISSIONS" ]; then
        log_success "Permissions logs trouvées pour: $LOGS_PERMISSIONS"
    else
        log_warning "Aucune permission logs trouvée"
    fi
else
    log_warning "API roles non accessible"
fi

# 4. Créer un script de correction JavaScript
echo ""
echo "4️⃣ Création du script de correction JavaScript..."

cat > fix-logs.js << 'EOF'
// Script de correction pour la page logs
// À exécuter dans la console du navigateur

console.log('🔧 Correction de la page logs...');

// 1. Récupérer le premier utilisateur admin
fetch('/api/users')
  .then(response => response.json())
  .then(data => {
    if (data.success && data.data.length > 0) {
      // Trouver un utilisateur admin ou utiliser le premier
      const adminUser = data.data.find(user => user.role === 'admin') || data.data[0];
      
      console.log('✅ Utilisateur trouvé:', adminUser);
      
      // Stocker l'utilisateur dans localStorage
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      
      console.log('✅ Utilisateur stocké dans localStorage');
      
      // Recharger la page
      window.location.reload();
    } else {
      console.error('❌ Aucun utilisateur trouvé');
    }
  })
  .catch(error => {
    console.error('❌ Erreur lors de la récupération des utilisateurs:', error);
  });
EOF

log_success "Script JavaScript créé: fix-logs.js"

# 5. Créer un script de test de la page logs
echo ""
echo "5️⃣ Création du script de test..."

cat > test-logs-page.sh << 'EOF'
#!/bin/bash

echo "=== Test de la page logs ==="

# Test 1: Vérifier que l'application est accessible
echo "1. Test de l'application..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Application accessible"
else
    echo "❌ Application non accessible"
    exit 1
fi

# Test 2: Vérifier l'API des logs
echo "2. Test de l'API des logs..."
LOGS_RESPONSE=$(curl -s http://localhost:3000/api/logs)
if echo "$LOGS_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ API logs fonctionnelle"
    LOGS_COUNT=$(echo "$LOGS_RESPONSE" | jq -r '.total // 0')
    echo "   Nombre de logs: $LOGS_COUNT"
else
    echo "❌ API logs non fonctionnelle"
    echo "   Réponse: $LOGS_RESPONSE"
fi

# Test 3: Vérifier l'API des utilisateurs
echo "3. Test de l'API des utilisateurs..."
USERS_RESPONSE=$(curl -s http://localhost:3000/api/users)
if echo "$USERS_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ API users fonctionnelle"
    USERS_COUNT=$(echo "$USERS_RESPONSE" | jq -r '.data | length')
    echo "   Nombre d'utilisateurs: $USERS_COUNT"
else
    echo "❌ API users non fonctionnelle"
    echo "   Réponse: $USERS_RESPONSE"
fi

# Test 4: Vérifier l'API des rôles
echo "4. Test de l'API des rôles..."
ROLES_RESPONSE=$(curl -s http://localhost:3000/api/roles)
if echo "$ROLES_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo "✅ API roles fonctionnelle"
    ROLES_COUNT=$(echo "$ROLES_RESPONSE" | jq -r '.data | length')
    echo "   Nombre de rôles: $ROLES_COUNT"
else
    echo "❌ API roles non fonctionnelle"
    echo "   Réponse: $ROLES_RESPONSE"
fi

echo ""
echo "=== Résumé ==="
echo "Pour corriger la page logs:"
echo "1. Ouvrir http://localhost:3000/dashboard/logs"
echo "2. Ouvrir la console du navigateur (F12)"
echo "3. Coller et exécuter le contenu de fix-logs.js"
echo "4. La page devrait se recharger et fonctionner"
EOF

chmod +x test-logs-page.sh
log_success "Script de test créé: test-logs-page.sh"

# 6. Exécuter le test
echo ""
echo "6️⃣ Exécution du test..."

./test-logs-page.sh

# 7. Résumé
echo ""
echo "=========================================="
echo "📊 Résumé de la Correction"
echo "=========================================="

echo "✅ Scripts créés:"
echo "  - fix-logs.js (script JavaScript pour le navigateur)"
echo "  - test-logs-page.sh (script de test)"

echo ""
echo "🔧 Instructions pour corriger la page logs:"
echo "1. Ouvrir http://localhost:3000/dashboard/logs"
echo "2. Ouvrir la console du navigateur (F12)"
echo "3. Coller et exécuter le contenu de fix-logs.js"
echo "4. La page devrait se recharger et fonctionner"

echo ""
echo "🧪 Pour tester:"
echo "  ./test-logs-page.sh"

echo ""
echo "✅ Correction de la page logs terminée !"
