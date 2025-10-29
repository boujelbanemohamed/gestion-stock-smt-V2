#!/bin/bash

set -e

APP_DIR="/var/www/stock-management"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

info "🔧 Correction du chargement des variables d'environnement dans PM2"
info "=================================================================="

cd "$APP_DIR" || { error "Répertoire $APP_DIR non trouvé"; exit 1; }

# 1. Vérification du fichier .env
info "1. Vérification du fichier .env..."
if [ ! -f ".env" ]; then
  error ".env non trouvé!"
  exit 1
fi

# 2. Lecture et validation de DATABASE_URL
info "2. Vérification de DATABASE_URL..."
source .env 2>/dev/null || true

if [ -z "${DATABASE_URL:-}" ]; then
  error "DATABASE_URL manquant dans .env!"
  exit 1
fi

info "DATABASE_URL trouvé: $(echo $DATABASE_URL | sed 's/:[^:]*@/:****@/')"

# 3. Arrêt de PM2
info "3. Arrêt des processus PM2..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# 4. Création d'un fichier ecosystem.config.js pour PM2
info "4. Création de la configuration PM2 avec variables d'environnement..."

# Lire .env et créer le contenu env pour ecosystem.config.js
ENV_CONTENT=""
while IFS= read -r line || [ -n "$line" ]; do
  # Ignorer les lignes vides et les commentaires
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  
  # Extraire la clé et la valeur
  if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
    KEY="${BASH_REMATCH[1]}"
    VALUE="${BASH_REMATCH[2]}"
    # Nettoyer les espaces au début et à la fin
    KEY=$(echo "$KEY" | xargs)
    VALUE=$(echo "$VALUE" | xargs)
    # Retirer les guillemets au début et à la fin si présents
    VALUE=$(echo "$VALUE" | sed -e 's/^["'\'']//' -e 's/["'\'']$//')
    # Échapper les apostrophes dans la valeur
    VALUE=$(echo "$VALUE" | sed "s/'/\\\'/g")
    ENV_CONTENT="${ENV_CONTENT}      ${KEY}: '${VALUE}',"$'\n'
  fi
done < .env

# Créer le fichier ecosystem.config.js
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'stock-app',
    script: 'npm',
    args: 'start',
    cwd: '$APP_DIR',
    instances: 1,
    exec_mode: 'fork',
    env: {
${ENV_CONTENT%?}
    },
    error_file: '/root/.pm2/logs/stock-app-error.log',
    out_file: '/root/.pm2/logs/stock-app-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

success "Configuration PM2 créée (ecosystem.config.js)"

# 5. Alternative : Créer un script de démarrage avec variables chargées
info "5. Création d'un script de démarrage alternatif..."
cat > start-app.sh <<'EOFSCRIPT'
#!/bin/bash
cd /var/www/stock-management
export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
exec npm start
EOFSCRIPT
chmod +x start-app.sh

# 6. Méthode 1 : Utiliser ecosystem.config.js
info "6. Démarrage avec ecosystem.config.js..."
if pm2 start ecosystem.config.js; then
  success "✅ Application démarrée avec ecosystem.config.js"
else
  warn "Échec avec ecosystem.config.js, utilisation de l'alternative..."
  
  # Méthode 2 : Charger les variables dans le shell et démarrer
  info "Démarrage avec variables chargées depuis .env..."
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
  pm2 start start-app.sh --name stock-app || {
    error "Échec du démarrage PM2"
    exit 1
  }
fi

# 7. Attente et vérification
info "7. Attente du démarrage (20s)..."
sleep 20

# 8. Vérification des variables dans PM2
info "8. Vérification des variables d'environnement dans PM2..."
pm2 describe stock-app | grep -A 50 "env:" | head -20 || true

# 9. Test de l'API
info "9. Test de l'API /api/auth/login..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
  success "✅ API /api/auth/login répond correctement (code: $HTTP_CODE)"
  success "✅ Les variables d'environnement sont correctement chargées!"
elif [ "$HTTP_CODE" = "500" ]; then
  error "❌ Erreur 500 persistante"
  warn "Affichage des logs récents..."
  pm2 logs --lines 50 --nostream || true
  
  warn "Vérification manuelle des variables dans PM2:"
  info "  pm2 describe stock-app | grep DATABASE_URL"
  info "  pm2 env 0"
  exit 1
else
  info "Réponse HTTP: $HTTP_CODE"
fi

# 10. Affichage du statut
info "10. Statut PM2:"
pm2 status || true

info ""
success "✅ Correction terminée!"
info ""
info "Pour vérifier les variables d'environnement:"
info "  pm2 describe stock-app"
info "  pm2 env 0"
info ""
info "Pour voir les logs:"
info "  pm2 logs stock-app"

