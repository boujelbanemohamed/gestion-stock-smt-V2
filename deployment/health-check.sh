#!/bin/bash

################################################################################
# Script de vérification de santé du système
# Vérifie que tous les services fonctionnent correctement
################################################################################

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================"
echo "Health Check - Stock Management"
echo "================================"
echo ""

# Fonction pour vérifier un service
check_service() {
    local service=$1
    local name=$2
    
    if systemctl is-active --quiet $service; then
        echo -e "${GREEN}✓${NC} $name: Running"
        return 0
    else
        echo -e "${RED}✗${NC} $name: Not running"
        return 1
    fi
}

# Fonction pour vérifier un port
check_port() {
    local port=$1
    local name=$2
    
    if netstat -tuln | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} $name listening on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $name not listening on port $port"
        return 1
    fi
}

# Vérification des services système
echo "Services système:"
check_service nginx "Nginx"
check_service postgresql "PostgreSQL"

echo ""
echo "Ports réseau:"
check_port 80 "HTTP"
check_port 443 "HTTPS (si SSL configuré)" 
check_port 5432 "PostgreSQL"

echo ""
echo "Application PM2:"
if pm2 list | grep -q "stock-management.*online"; then
    echo -e "${GREEN}✓${NC} Stock Management: Running"
    pm2 list | grep stock-management
else
    echo -e "${RED}✗${NC} Stock Management: Not running"
fi

echo ""
echo "Base de données:"
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw stock_management; then
    echo -e "${GREEN}✓${NC} Database stock_management exists"
    
    # Compter les tables
    TABLE_COUNT=$(sudo -u postgres psql -d stock_management -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    echo -e "${GREEN}✓${NC} Tables count: $TABLE_COUNT"
else
    echo -e "${RED}✗${NC} Database stock_management not found"
fi

echo ""
echo "Espace disque:"
df -h | grep -E '^/dev/' | awk '{print $5 " utilisé sur " $1}'

echo ""
echo "Mémoire:"
free -h | grep Mem | awk '{print "Utilisé: " $3 " / Total: " $2}'

echo ""
echo "Dernière sauvegarde:"
if [ -d "/var/backups/stock-management" ]; then
    LATEST_BACKUP=$(ls -t /var/backups/stock-management/backup_*_db.sql.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        echo -e "${GREEN}✓${NC} $LATEST_BACKUP"
        ls -lh "$LATEST_BACKUP" | awk '{print "  Taille: " $5 " - Date: " $6 " " $7 " " $8}'
    else
        echo -e "${YELLOW}⚠${NC} Aucune sauvegarde trouvée"
    fi
else
    echo -e "${RED}✗${NC} Répertoire de sauvegarde non trouvé"
fi

echo ""
echo "Certificat SSL:"
if [ -d "/etc/letsencrypt/live" ]; then
    CERT_DIRS=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | head -1)
    if [ -n "$CERT_DIRS" ]; then
        CERT_FILE="$CERT_DIRS/cert.pem"
        if [ -f "$CERT_FILE" ]; then
            EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
            echo -e "${GREEN}✓${NC} SSL Certificate expires: $EXPIRY"
        fi
    else
        echo -e "${YELLOW}⚠${NC} SSL not configured"
    fi
else
    echo -e "${YELLOW}⚠${NC} SSL not configured"
fi

echo ""
echo "================================"
