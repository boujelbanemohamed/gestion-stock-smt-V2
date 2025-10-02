#!/bin/bash

################################################################################
# Script de déploiement - Stock Management Platform
# Pour Red Hat Enterprise Linux / CentOS
################################################################################

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables de configuration
APP_NAME="stock-management"
APP_USER="stockapp"
APP_DIR="/var/www/${APP_NAME}"
DOMAIN="172.17.5.199"  # Adresse IP du serveur de production
NODE_VERSION="18"
DB_NAME="stock_management"
DB_USER="stockapp"
DB_PASSWORD="ChangeThisPassword123!"  # À modifier en production

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Déploiement de Stock Management${NC}"
echo -e "${GREEN}================================${NC}"

# Vérifier si le script est exécuté en tant que root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Erreur: Ce script doit être exécuté en tant que root${NC}"
    exit 1
fi

echo -e "\n${YELLOW}[1/10] Mise à jour du système...${NC}"
dnf update -y

echo -e "\n${YELLOW}[2/10] Installation des dépendances système...${NC}"
# Installer EPEL pour RedHat/CentOS
dnf install -y epel-release

# Installer les dépendances de base
dnf install -y curl wget git nginx postgresql-server postgresql-contrib

# Installer des outils supplémentaires nécessaires
dnf install -y jq openssl

echo -e "\n${YELLOW}[3/10] Installation de Node.js ${NODE_VERSION}...${NC}"
curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
dnf install -y nodejs
npm install -g npm@latest
npm install -g pm2

echo -e "\n${YELLOW}[4/10] Configuration de PostgreSQL...${NC}"
# Initialiser PostgreSQL si ce n'est pas déjà fait
if [ ! -d "/var/lib/pgsql/data/base" ]; then
    # Pour RedHat/CentOS 8+
    if command -v postgresql-setup &> /dev/null; then
        postgresql-setup --initdb
    else
        # Pour RedHat/CentOS 9+
        sudo -u postgres /usr/pgsql-*/bin/initdb -D /var/lib/pgsql/data
    fi
fi

# Démarrer PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Attendre que PostgreSQL soit prêt
sleep 5

# Créer la base de données et l'utilisateur
sudo -u postgres psql <<EOF
-- Créer l'utilisateur
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '${DB_USER}') THEN
        CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;

-- Créer la base de données
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Donner tous les privilèges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF

echo -e "${GREEN}✓ PostgreSQL configuré${NC}"

echo -e "\n${YELLOW}[5/10] Création de l'utilisateur système...${NC}"
if ! id -u ${APP_USER} > /dev/null 2>&1; then
    useradd -r -s /bin/bash -d ${APP_DIR} ${APP_USER}
    echo -e "${GREEN}✓ Utilisateur ${APP_USER} créé${NC}"
else
    echo -e "${GREEN}✓ Utilisateur ${APP_USER} existe déjà${NC}"
fi

echo -e "\n${YELLOW}[6/10] Préparation des répertoires...${NC}"
mkdir -p ${APP_DIR}
mkdir -p /var/log/${APP_NAME}
chown -R ${APP_USER}:${APP_USER} ${APP_DIR}
chown -R ${APP_USER}:${APP_USER} /var/log/${APP_NAME}

echo -e "\n${YELLOW}[7/10] Clonage/Copie de l'application...${NC}"
# Cloner depuis GitHub
if [ ! -d "${APP_DIR}/.git" ]; then
    sudo -u ${APP_USER} git clone https://github.com/boujelbanemohamed/gestion-stock-smt-V2.git ${APP_DIR}
    echo -e "${GREEN}✓ Application clonée depuis GitHub${NC}"
else
    echo -e "${GREEN}✓ Application déjà présente${NC}"
    cd ${APP_DIR}
    sudo -u ${APP_USER} git pull origin main
fi

echo -e "\n${YELLOW}[8/10] Configuration des variables d'environnement...${NC}"
cat > ${APP_DIR}/.env <<EOF
# Base de données PostgreSQL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"

# Configuration de l'application
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://${DOMAIN}"

# Session et sécurité
SESSION_SECRET="$(openssl rand -base64 32)"
JWT_SECRET="$(openssl rand -base64 32)"

# Configuration SMTP (à adapter)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="noreply@${DOMAIN}"
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

chown ${APP_USER}:${APP_USER} ${APP_DIR}/.env
chmod 600 ${APP_DIR}/.env

echo -e "\n${YELLOW}[9/11] Installation des dépendances et build...${NC}"
cd ${APP_DIR}
sudo -u ${APP_USER} npm install --production=false
sudo -u ${APP_USER} npx prisma generate
sudo -u ${APP_USER} npx prisma db push
sudo -u ${APP_USER} npm run build

echo -e "\n${YELLOW}[10/11] Configuration des permissions des rôles...${NC}"
# Démarrer temporairement l'application pour configurer les rôles
sudo -u ${APP_USER} npm run dev &
APP_PID=$!
sleep 10

# Attendre que l'application soit prête
for i in {1..30}; do
    if curl -s http://localhost:3000/api/roles > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Application prête pour la configuration des rôles${NC}"
        break
    fi
    echo -e "${YELLOW}Attente de l'application... (${i}/30)${NC}"
    sleep 2
done

# Corriger les permissions du rôle admin
echo -e "${YELLOW}Configuration des permissions du rôle admin...${NC}"

# Vérifier que jq est installé
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Erreur: jq n'est pas installé. Installation...${NC}"
    dnf install -y jq
fi

# Vérifier que l'API répond correctement
echo -e "${YELLOW}Vérification de l'API...${NC}"
API_RESPONSE=$(curl -s http://localhost:3000/api/roles)
echo "Réponse API: $API_RESPONSE"

# Vérifier si la réponse contient 'success'
if echo "$API_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    ADMIN_ROLE_ID=$(echo "$API_RESPONSE" | jq -r '.data[] | select(.role == "admin") | .id')
    echo "ID du rôle admin trouvé: $ADMIN_ROLE_ID"
else
    echo -e "${RED}Erreur: L'API ne répond pas correctement${NC}"
    echo "Réponse reçue: $API_RESPONSE"
    ADMIN_ROLE_ID=""
fi

if [ "$ADMIN_ROLE_ID" != "null" ] && [ -n "$ADMIN_ROLE_ID" ]; then
    curl -s -X PUT "http://localhost:3000/api/roles/${ADMIN_ROLE_ID}" \
        -H "Content-Type: application/json" \
        -d '{
            "permissions": [
                "dashboard:view","banks:view","banks:create","banks:update","banks:delete","banks:import","banks:export","banks:print",
                "cards:view","cards:create","cards:update","cards:delete","cards:import","cards:export","cards:print",
                "locations:view","locations:create","locations:update","locations:delete","locations:import","locations:export","locations:print",
                "movements:view","movements:create","movements:update","movements:delete","movements:import","movements:export","movements:print",
                "users:view","users:create","users:update","users:delete","users:import","users:export","users:print",
                "logs:view","logs:create","logs:update","logs:delete","logs:import","logs:export","logs:print",
                "config:view","config:create","config:update","config:delete","config:import","config:export","config:print"
            ],
            "description": "Administrateur avec toutes les permissions"
        }' > /dev/null
    echo -e "${GREEN}✓ Permissions du rôle admin configurées${NC}"
else
    echo -e "${RED}✗ Impossible de trouver le rôle admin${NC}"
fi

# Arrêter l'application temporaire
kill $APP_PID 2>/dev/null || true
sleep 2

echo -e "\n${YELLOW}[11/11] Configuration des services...${NC}"

# Configuration PM2
sudo -u ${APP_USER} pm2 start npm --name "${APP_NAME}" -- start
sudo -u ${APP_USER} pm2 save
pm2 startup systemd -u ${APP_USER} --hp ${APP_DIR}

# Copier la configuration Nginx
cp ${APP_DIR}/deployment/nginx.conf /etc/nginx/conf.d/${APP_NAME}.conf
sed -i "s/your-domain.com/${DOMAIN}/g" /etc/nginx/conf.d/${APP_NAME}.conf

# Tester et redémarrer Nginx
nginx -t
systemctl enable nginx
systemctl restart nginx

# Configuration du firewall
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# SELinux (si activé)
if [ "$(getenforce)" != "Disabled" ]; then
    setsebool -P httpd_can_network_connect 1
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Déploiement terminé avec succès!${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "\nInformations importantes:"
echo -e "- Application: http://${DOMAIN} (ou http://$(hostname -I | awk '{print $1}'))"
echo -e "- Logs: /var/log/${APP_NAME}/"
echo -e "- Répertoire: ${APP_DIR}"
echo -e "\nCommandes utiles:"
echo -e "  pm2 status          - Voir le statut de l'application"
echo -e "  pm2 logs ${APP_NAME}   - Voir les logs en temps réel"
echo -e "  pm2 restart ${APP_NAME} - Redémarrer l'application"
echo -e "  systemctl status nginx - Statut de Nginx"
echo -e "\n${YELLOW}N'oubliez pas de:${NC}"
echo -e "1. Configurer SSL avec certbot (Let's Encrypt)"
echo -e "2. Modifier les mots de passe dans .env"
echo -e "3. Configurer les sauvegardes automatiques"
echo -e "4. Tester l'application"
echo -e "5. Configurer SMTP pour l'envoi d'emails"
echo -e "6. Tester la fonctionnalité d'envoi d'emails"
echo -e "7. Vérifier les permissions des utilisateurs"
echo -e "8. Tester l'import CSV (banques, cartes, emplacements)"
echo -e "9. Tester la création d'utilisateurs avec mots de passe"
echo -e "10. Vérifier la pagination du dashboard"
echo -e "11. Tester le système de notifications (création, affichage, marquage)"
echo -e "12. Tester l'impression des bordereaux de mouvement"
echo -e "13. Vérifier le format des bordereaux (Société Monétique Tunisie)"
echo -e "14. Vérifier l'intégration des notifications dans l'interface"
echo ""
