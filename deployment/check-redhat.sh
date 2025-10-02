#!/bin/bash

################################################################################
# Script de vérification RedHat - Stock Management Platform
# Vérifie que le serveur RedHat est prêt pour le déploiement
################################################################################

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Vérification RedHat/CentOS${NC}"
echo -e "${GREEN}================================${NC}"

# Vérifier la version du système
echo -e "\n${YELLOW}[1/8] Vérification de la version du système...${NC}"
if [ -f /etc/redhat-release ]; then
    REDHAT_VERSION=$(cat /etc/redhat-release)
    echo -e "${GREEN}✓ Système détecté: ${REDHAT_VERSION}${NC}"
    
    # Vérifier la version majeure
    if [[ $REDHAT_VERSION == *"8"* ]] || [[ $REDHAT_VERSION == *"9"* ]]; then
        echo -e "${GREEN}✓ Version supportée (8 ou 9)${NC}"
    else
        echo -e "${YELLOW}⚠ Version non testée: ${REDHAT_VERSION}${NC}"
        echo -e "${YELLOW}  Le script peut fonctionner mais n'a pas été testé sur cette version${NC}"
    fi
else
    echo -e "${RED}✗ Ce script est conçu pour RedHat/CentOS${NC}"
    exit 1
fi

# Vérifier les privilèges root
echo -e "\n${YELLOW}[2/8] Vérification des privilèges...${NC}"
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}✗ Ce script doit être exécuté en tant que root${NC}"
    echo -e "${YELLOW}  Utilisez: sudo $0${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Exécution en tant que root${NC}"
fi

# Vérifier la connectivité réseau
echo -e "\n${YELLOW}[3/8] Vérification de la connectivité réseau...${NC}"
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connectivité Internet OK${NC}"
else
    echo -e "${RED}✗ Pas de connectivité Internet${NC}"
    echo -e "${YELLOW}  Vérifiez votre configuration réseau${NC}"
    exit 1
fi

# Vérifier l'espace disque
echo -e "\n${YELLOW}[4/8] Vérification de l'espace disque...${NC}"
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${GREEN}✓ Espace disque suffisant (${DISK_USAGE}% utilisé)${NC}"
else
    echo -e "${RED}✗ Espace disque insuffisant (${DISK_USAGE}% utilisé)${NC}"
    echo -e "${YELLOW}  Libérez de l'espace avant de continuer${NC}"
    exit 1
fi

# Vérifier la mémoire
echo -e "\n${YELLOW}[5/8] Vérification de la mémoire...${NC}"
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
if [ "$TOTAL_MEM" -ge 2048 ]; then
    echo -e "${GREEN}✓ Mémoire suffisante (${TOTAL_MEM} MB)${NC}"
else
    echo -e "${YELLOW}⚠ Mémoire faible (${TOTAL_MEM} MB)${NC}"
    echo -e "${YELLOW}  Recommandé: au moins 2 GB de RAM${NC}"
fi

# Vérifier les ports disponibles
echo -e "\n${YELLOW}[6/8] Vérification des ports...${NC}"
PORTS=(80 443 3000 5432)
for port in "${PORTS[@]}"; do
    if netstat -tuln | grep -q ":$port "; then
        echo -e "${YELLOW}⚠ Port ${port} déjà utilisé${NC}"
    else
        echo -e "${GREEN}✓ Port ${port} disponible${NC}"
    fi
done

# Vérifier les services système
echo -e "\n${YELLOW}[7/8] Vérification des services système...${NC}"

# Vérifier systemd
if systemctl --version > /dev/null 2>&1; then
    echo -e "${GREEN}✓ systemd disponible${NC}"
else
    echo -e "${RED}✗ systemd non disponible${NC}"
    exit 1
fi

# Vérifier le firewall
if systemctl is-active --quiet firewalld; then
    echo -e "${GREEN}✓ firewalld actif${NC}"
else
    echo -e "${YELLOW}⚠ firewalld non actif${NC}"
    echo -e "${YELLOW}  Le script l'activera automatiquement${NC}"
fi

# Vérifier SELinux
echo -e "\n${YELLOW}[8/8] Vérification de SELinux...${NC}"
SELINUX_STATUS=$(getenforce 2>/dev/null || echo "Disabled")
if [ "$SELINUX_STATUS" = "Disabled" ]; then
    echo -e "${GREEN}✓ SELinux désactivé${NC}"
elif [ "$SELINUX_STATUS" = "Enforcing" ]; then
    echo -e "${YELLOW}⚠ SELinux en mode Enforcing${NC}"
    echo -e "${YELLOW}  Le script configurera les permissions nécessaires${NC}"
else
    echo -e "${YELLOW}⚠ SELinux en mode ${SELINUX_STATUS}${NC}"
fi

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}Vérification terminée${NC}"
echo -e "${GREEN}================================${NC}"

echo -e "\n${YELLOW}📋 RÉSUMÉ :${NC}"
echo -e "  - Système: ${REDHAT_VERSION}"
echo -e "  - Privilèges: Root ✓"
echo -e "  - Réseau: Internet ✓"
echo -e "  - Disque: ${DISK_USAGE}% utilisé"
echo -e "  - Mémoire: ${TOTAL_MEM} MB"
echo -e "  - SELinux: ${SELINUX_STATUS}"

echo -e "\n${GREEN}✅ Le serveur est prêt pour le déploiement !${NC}"
echo -e "\n${YELLOW}Prochaines étapes :${NC}"
echo -e "1. Modifiez les variables dans deploy.sh (DOMAIN, DB_PASSWORD)"
echo -e "2. Exécutez: ./deploy.sh"
echo -e "3. Configurez SSL avec: ./setup-ssl.sh"
echo -e "4. Testez avec: ./test-features.sh"
