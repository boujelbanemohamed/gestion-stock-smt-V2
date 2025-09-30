#!/bin/bash

################################################################################
# Script de configuration SSL avec Let's Encrypt
# Pour Red Hat Enterprise Linux / CentOS
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="your-domain.com"  # À modifier
EMAIL="admin@your-domain.com"  # À modifier

echo -e "${GREEN}Configuration SSL pour ${DOMAIN}${NC}"

# Installer Certbot
echo -e "\n${YELLOW}Installation de Certbot...${NC}"
dnf install -y certbot python3-certbot-nginx

# Obtenir le certificat SSL
echo -e "\n${YELLOW}Obtention du certificat SSL...${NC}"
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} \
    --non-interactive \
    --agree-tos \
    --email ${EMAIL} \
    --redirect

# Configuration du renouvellement automatique
echo -e "\n${YELLOW}Configuration du renouvellement automatique...${NC}"
systemctl enable certbot-renew.timer
systemctl start certbot-renew.timer

# Test du renouvellement
certbot renew --dry-run

echo -e "\n${GREEN}✓ SSL configuré avec succès!${NC}"
echo -e "Certificat installé pour: ${DOMAIN}"
echo -e "Renouvellement automatique activé"
