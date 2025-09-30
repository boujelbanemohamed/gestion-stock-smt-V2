# Guide de déploiement - Red Hat Enterprise Linux

## Prérequis

- Serveur Red Hat Enterprise Linux 8/9 ou CentOS 8/9
- Accès root via SSH
- Nom de domaine configuré pointant vers votre serveur
- Au minimum 2 Go de RAM et 20 Go d'espace disque

## Architecture de déploiement

```
Internet
    ↓
  Nginx (Reverse Proxy + SSL)
    ↓
  Next.js Application (Port 3000) - géré par PM2
    ↓
  PostgreSQL Database (Port 5432)
```

## Installation initiale

### 1. Préparer le serveur

```bash
# Se connecter au serveur
ssh root@your-server-ip

# Transférer les fichiers de déploiement
scp -r deployment root@your-server-ip:/tmp/
```

### 2. Configurer les variables

Éditez le fichier `deploy.sh` et modifiez :

```bash
DOMAIN="your-domain.com"          # Votre nom de domaine
DB_PASSWORD="VotreMotDePasseSécurisé"  # Mot de passe de la base de données
```

### 3. Exécuter le déploiement

```bash
cd /tmp/deployment
chmod +x deploy.sh
./deploy.sh
```

Le script va :
- ✓ Installer Node.js, PostgreSQL, Nginx
- ✓ Configurer la base de données
- ✓ Créer l'utilisateur système
- ✓ Installer l'application
- ✓ Configurer PM2 et Nginx
- ✓ Configurer le firewall

### 4. Transférer votre code

**Option A : Depuis Git**
```bash
cd /var/www/stock-management
sudo -u stockapp git clone https://github.com/votre-repo/stock-management.git .
```

**Option B : Upload manuel**
```bash
# Depuis votre machine locale
scp -r /Users/mohamed/Desktop/stock-management-V2/* root@your-server-ip:/var/www/stock-management/
chown -R stockapp:stockapp /var/www/stock-management
```

### 5. Installer et builder l'application

```bash
cd /var/www/stock-management
sudo -u stockapp npm install
sudo -u stockapp npx prisma generate
sudo -u stockapp npx prisma db push
sudo -u stockapp npm run build
```

### 6. Démarrer l'application

```bash
sudo -u stockapp pm2 start npm --name "stock-management" -- start
sudo -u stockapp pm2 save
pm2 startup systemd -u stockapp --hp /var/www/stock-management
```

### 7. Configurer SSL (Recommandé)

```bash
cd /tmp/deployment
chmod +x setup-ssl.sh
# Éditez le fichier pour mettre votre domaine et email
nano setup-ssl.sh
./setup-ssl.sh
```

## Configuration des sauvegardes automatiques

### 1. Installer les scripts de sauvegarde

```bash
cp /tmp/deployment/backup.sh /usr/local/bin/backup-stock-management.sh
cp /tmp/deployment/restore.sh /usr/local/bin/restore-stock-management.sh
chmod +x /usr/local/bin/backup-stock-management.sh
chmod +x /usr/local/bin/restore-stock-management.sh
```

### 2. Configurer une tâche cron

```bash
crontab -e
```

Ajoutez ces lignes :

```cron
# Sauvegarde quotidienne à 2h du matin
0 2 * * * /usr/local/bin/backup-stock-management.sh >> /var/log/stock-management-backup.log 2>&1

# Sauvegarde hebdomadaire le dimanche à 3h
0 3 * * 0 /usr/local/bin/backup-stock-management.sh >> /var/log/stock-management-backup.log 2>&1
```

## Commandes utiles

### Gestion de l'application

```bash
# Statut de l'application
pm2 status

# Logs en temps réel
pm2 logs stock-management

# Redémarrer l'application
pm2 restart stock-management

# Arrêter l'application
pm2 stop stock-management

# Métriques de performance
pm2 monit
```

### Gestion de la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql stock_management

# Voir les connexions actives
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='stock_management';"

# Sauvegarder manuellement
/usr/local/bin/backup-stock-management.sh

# Restaurer depuis une sauvegarde
/usr/local/bin/restore-stock-management.sh 20250930_020000
```

### Gestion de Nginx

```bash
# Tester la configuration
nginx -t

# Redémarrer Nginx
systemctl restart nginx

# Voir les logs
tail -f /var/log/nginx/stock-management-access.log
tail -f /var/log/nginx/stock-management-error.log
```

### Gestion des certificats SSL

```bash
# Renouveler manuellement
certbot renew

# Vérifier l'expiration
certbot certificates

# Test de renouvellement
certbot renew --dry-run
```

## Mise à jour de l'application

### Méthode automatique

```bash
cp /tmp/deployment/update.sh /usr/local/bin/update-stock-management.sh
chmod +x /usr/local/bin/update-stock-management.sh
/usr/local/bin/update-stock-management.sh
```

### Méthode manuelle

```bash
cd /var/www/stock-management

# Sauvegarde
/usr/local/bin/backup-stock-management.sh

# Mise à jour
sudo -u stockapp git pull
sudo -u stockapp npm install
sudo -u stockapp npx prisma generate
sudo -u stockapp npx prisma migrate deploy
sudo -u stockapp npm run build

# Redémarrage
pm2 restart stock-management
```

## Monitoring et logs

### Emplacements des logs

```bash
# Logs de l'application
pm2 logs stock-management

# Logs Nginx
/var/log/nginx/stock-management-access.log
/var/log/nginx/stock-management-error.log

# Logs PostgreSQL
/var/lib/pgsql/data/log/

# Logs de sauvegarde
/var/log/stock-management-backup.log
```

### Installation de monitoring (optionnel)

```bash
# PM2 Plus (monitoring gratuit)
pm2 link [secret-key] [public-key]

# Logrotate pour les logs Nginx
cat > /etc/logrotate.d/stock-management <<EOF
/var/log/nginx/stock-management-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nginx adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 \$(cat /var/run/nginx.pid)
    endscript
}
EOF
```

## Sécurité

### Firewall

```bash
# Voir les règles actives
firewall-cmd --list-all

# Ajouter une règle
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --reload
```

### SELinux

```bash
# Voir le statut
getenforce

# Autoriser Nginx à se connecter au réseau
setsebool -P httpd_can_network_connect 1

# Voir les logs SELinux
ausearch -m avc -ts recent
```

### Mises à jour de sécurité

```bash
# Mettre à jour le système
dnf update -y

# Configurer les mises à jour automatiques
dnf install -y dnf-automatic
systemctl enable --now dnf-automatic.timer
```

## Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs stock-management --err

# Vérifier les permissions
ls -la /var/www/stock-management

# Vérifier les variables d'environnement
sudo -u stockapp cat /var/www/stock-management/.env
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL fonctionne
systemctl status postgresql

# Tester la connexion
sudo -u postgres psql stock_management

# Vérifier les permissions
sudo -u postgres psql -c "\du"
```

### Nginx ne démarre pas

```bash
# Tester la configuration
nginx -t

# Voir les erreurs
journalctl -u nginx -n 50

# Vérifier les ports
netstat -tlnp | grep nginx
```

### Problème de SSL

```bash
# Renouveler le certificat
certbot renew --force-renewal

# Vérifier la configuration
certbot certificates

# Logs de certbot
journalctl -u certbot
```

## Performance et optimisation

### Configuration PM2 pour la production

```bash
# Utiliser le mode cluster (plusieurs instances)
pm2 delete stock-management
pm2 start npm --name "stock-management" -i max -- start

# Configurer les limites mémoire
pm2 start npm --name "stock-management" --max-memory-restart 1G -- start
```

### Optimisation PostgreSQL

```bash
# Éditer la configuration
nano /var/lib/pgsql/data/postgresql.conf

# Paramètres recommandés pour 2GB RAM :
# shared_buffers = 512MB
# effective_cache_size = 1536MB
# work_mem = 16MB
# maintenance_work_mem = 128MB

# Redémarrer PostgreSQL
systemctl restart postgresql
```

### Cache et CDN

Pour améliorer les performances, considérez :
- Cloudflare pour le CDN et protection DDoS
- Redis pour le cache de session
- Nginx caching pour les fichiers statiques

## Support et contact

Pour toute question ou problème :
- Documentation Next.js : https://nextjs.org/docs
- Documentation Prisma : https://www.prisma.io/docs
- Documentation PM2 : https://pm2.keymetrics.io/docs

---

**Date de création** : 30 septembre 2025
**Version** : 1.0
