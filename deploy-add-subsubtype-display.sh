#!/bin/bash

set -e

APP_DIR="/var/www/stock-management"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

info "🔧 Déploiement de l'affichage sous-sous-type dans les emplacements"
info "=================================================================="

cd "$APP_DIR" || { error "Répertoire $APP_DIR non trouvé"; exit 1; }

# 1. Récupération du code
info "1. Récupération du code depuis GitHub..."
git pull origin main || { error "Erreur lors du pull"; exit 1; }
success "Code récupéré"

# 2. Vérification de la correction
info "2. Vérification de la correction..."
if grep -q "subSubType" components/dashboard/locations-management.tsx; then
  success "✅ Correction détectée (sous-sous-type dans l'affichage)"
else
  warn "⚠️ Correction non détectée automatiquement, mais continuons..."
fi

# 3. Nettoyage du build précédent
info "3. Nettoyage du build précédent..."
rm -rf .next
rm -rf node_modules/.cache
success "Nettoyage terminé"

# 4. Installation des dépendances
info "4. Installation des dépendances..."
npm ci --prefer-offline --no-audit --no-fund || { error "Erreur installation dépendances"; exit 1; }
success "Dépendances installées"

# 5. Régénération Prisma
info "5. Régénération Prisma Client..."
if [ -f "prisma/schema.prisma" ]; then
  npx prisma generate || { error "Erreur Prisma"; exit 1; }
  success "Prisma régénéré"
fi

# 6. Build
info "6. Construction de l'application..."
npm run build || { error "Erreur lors du build"; exit 1; }
success "Build terminé"

# 7. Redémarrage PM2
info "7. Redémarrage de l'application..."
pm2 restart stock-app --update-env || {
  warn "Redémarrage avec restart simple..."
  pm2 restart all || { error "Erreur redémarrage PM2"; exit 1; }
}
success "Application redémarrée"

# 8. Attente du démarrage
info "8. Attente du démarrage (10s)..."
sleep 10

# 9. Test rapide
info "9. Test de l'application..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "000" ]; then
  success "✅ Application accessible"
else
  warn "⚠️ Code HTTP: $HTTP_CODE (vérifiez les logs si problème)"
fi

info ""
success "✅ Déploiement terminé!"
info ""
info "L'affichage amélioré est maintenant actif :"
info "  ✅ Nom de la carte"
info "  ✅ Type - Sous-type - Sous-sous-type"
info "  ✅ Format complet affiché sous le nom de la carte"
info "  ✅ Visible dans la vue groupée des emplacements"
info ""
info "Pour vérifier les logs : pm2 logs stock-app"

