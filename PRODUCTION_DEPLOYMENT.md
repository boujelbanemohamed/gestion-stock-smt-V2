# Déploiement en Production - Red Hat Enterprise Linux

## 📦 Package de déploiement créé

Tous les scripts nécessaires pour le déploiement sur Red Hat ont été créés dans le dossier **`deployment/`**

### 📁 Fichiers créés :

| Fichier | Description | Taille |
|---------|-------------|--------|
| **deploy.sh** | Script principal de déploiement automatisé | ⭐ Principal |
| **nginx.conf** | Configuration du reverse proxy Nginx | Configuration |
| **setup-ssl.sh** | Installation automatique SSL (Let's Encrypt) | Sécurité |
| **backup.sh** | Sauvegarde automatique base de données + fichiers | Maintenance |
| **restore.sh** | Restauration depuis sauvegarde | Maintenance |
| **update.sh** | Mise à jour de l'application | Maintenance |
| **health-check.sh** | Vérification de l'état du système | Monitoring |
| **DEPLOYMENT_GUIDE.md** | Guide complet (20+ pages) | 📖 Documentation |
| **README.md** | Guide rapide de démarrage | 📖 Documentation |
| **.env.production.example** | Template de configuration production | Configuration |

## 🚀 Déploiement en 4 étapes

### Étape 1 : Préparer le serveur Red Hat

```bash
# Depuis votre machine locale, transférez les fichiers
scp -r deployment root@your-server-ip:/tmp/
scp -r * root@your-server-ip:/tmp/stock-management-app/
```

### Étape 2 : Configurer les variables

Sur le serveur, éditez `deploy.sh` :

```bash
ssh root@your-server-ip
cd /tmp/deployment
nano deploy.sh

# Modifiez ces lignes :
DOMAIN="votre-domaine.com"              # ← Votre domaine
DB_PASSWORD="MotDePasseSécurisé123!"    # ← Mot de passe sécurisé
```

### Étape 3 : Lancer le déploiement

```bash
chmod +x deploy.sh
./deploy.sh
```

Le script va automatiquement :
- ✅ Installer Node.js 18, PostgreSQL, Nginx, PM2
- ✅ Créer la base de données `stock_management`
- ✅ Créer l'utilisateur système `stockapp`
- ✅ Configurer le firewall et SELinux
- ✅ Installer et démarrer l'application
- ✅ Configurer PM2 pour le redémarrage automatique
- ✅ Configurer Nginx comme reverse proxy

**Durée estimée** : 10-15 minutes

### Étape 4 : Configurer SSL (HTTPS)

```bash
cd /tmp/deployment
nano setup-ssl.sh  # Modifier domaine et email

./setup-ssl.sh
```

Cela installera automatiquement un certificat SSL gratuit via Let's Encrypt.

## 📋 Architecture de production

```
┌─────────────────────────────────────────────┐
│         Internet / Utilisateurs              │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│   Nginx (Port 80/443) - Reverse Proxy       │
│   - SSL/TLS Termination                      │
│   - Gzip Compression                         │
│   - Static Files Cache                       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│   Next.js App (Port 3000) - PM2 Managed     │
│   - Server-Side Rendering                    │
│   - API Routes                               │
│   - Authentication                           │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│   PostgreSQL (Port 5432)                     │
│   - stock_management database                │
│   - Automatic backups                        │
└─────────────────────────────────────────────┘
```

## 🔧 Commandes post-déploiement

### Gestion de l'application

```bash
# Voir le statut
pm2 status

# Logs en temps réel
pm2 logs stock-management

# Redémarrer
pm2 restart stock-management

# Monitoring
pm2 monit
```

### Sauvegardes automatiques

Configurez des sauvegardes quotidiennes :

```bash
# Copier les scripts
cp /tmp/deployment/backup.sh /usr/local/bin/backup-stock-management.sh
cp /tmp/deployment/restore.sh /usr/local/bin/restore-stock-management.sh
chmod +x /usr/local/bin/*.sh

# Configurer le cron
crontab -e

# Ajouter cette ligne (sauvegarde à 2h du matin)
0 2 * * * /usr/local/bin/backup-stock-management.sh >> /var/log/backup.log 2>&1
```

### Vérification de santé

```bash
# Installer le script
cp /tmp/deployment/health-check.sh /usr/local/bin/
chmod +x /usr/local/bin/health-check.sh

# Exécuter
/usr/local/bin/health-check.sh
```

### Mise à jour de l'application

```bash
# Copier le script de mise à jour
cp /tmp/deployment/update.sh /usr/local/bin/update-stock-management.sh
chmod +x /usr/local/bin/update-stock-management.sh

# Exécuter une mise à jour
/usr/local/bin/update-stock-management.sh
```

## 🔒 Checklist de sécurité

- [ ] Changez tous les mots de passe par défaut dans `.env`
- [ ] Générez des secrets uniques pour SESSION_SECRET et JWT_SECRET
- [ ] Configurez SSL/HTTPS avec Let's Encrypt
- [ ] Configurez le firewall (ports 80, 443 uniquement)
- [ ] Activez les sauvegardes automatiques quotidiennes
- [ ] Configurez les mises à jour de sécurité automatiques
- [ ] Limitez l'accès SSH (clés uniquement, pas de mot de passe)
- [ ] Configurez fail2ban pour bloquer les tentatives d'intrusion
- [ ] Testez la restauration depuis sauvegarde
- [ ] Configurez le monitoring et les alertes

## 📊 Monitoring et Logs

### Emplacements des logs

```bash
# Application
pm2 logs stock-management

# Nginx
tail -f /var/log/nginx/stock-management-access.log
tail -f /var/log/nginx/stock-management-error.log

# PostgreSQL
tail -f /var/lib/pgsql/data/log/postgresql-*.log

# Sauvegardes
tail -f /var/log/backup.log

# Système
journalctl -u nginx -f
journalctl -xe
```

### Métriques importantes

- **Utilisation CPU** : `htop` ou `top`
- **Mémoire** : `free -h`
- **Disque** : `df -h`
- **Connexions DB** : `sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"`
- **Requêtes PM2** : `pm2 monit`

## 🆘 Dépannage rapide

### L'application ne démarre pas

```bash
# Vérifier les logs
pm2 logs stock-management --err

# Vérifier la configuration
cat /var/www/stock-management/.env

# Redémarrer
pm2 restart stock-management
```

### Erreur de base de données

```bash
# Vérifier PostgreSQL
systemctl status postgresql

# Se connecter
sudo -u postgres psql stock_management

# Vérifier les connexions
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Nginx ne répond pas

```bash
# Tester la configuration
nginx -t

# Voir les erreurs
journalctl -u nginx -n 50

# Redémarrer
systemctl restart nginx
```

## 📈 Optimisations pour la production

### 1. Activer le mode cluster PM2

```bash
pm2 delete stock-management
pm2 start npm --name "stock-management" -i max -- start
pm2 save
```

Cela utilisera tous les CPU disponibles.

### 2. Optimiser PostgreSQL

Pour un serveur avec 4 GB RAM :

```bash
sudo nano /var/lib/pgsql/data/postgresql.conf

# Ajoutez/modifiez :
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 32MB
maintenance_work_mem = 256MB
```

### 3. Configurer un CDN

Utilisez Cloudflare pour :
- Cache global des fichiers statiques
- Protection DDoS
- SSL automatique
- Optimisation des images

## 📞 Support et ressources

### Documentation complète

Consultez **`deployment/DEPLOYMENT_GUIDE.md`** pour :
- Instructions détaillées pas à pas
- Configuration avancée de Nginx
- Optimisation des performances
- Stratégies de sauvegarde
- Monitoring avec PM2 Plus
- Gestion des certificats SSL
- Configuration SELinux

### Commandes de référence

```bash
# Résumé de l'état du système
/usr/local/bin/health-check.sh

# Sauvegarde manuelle
/usr/local/bin/backup-stock-management.sh

# Restaurer (remplacez TIMESTAMP)
/usr/local/bin/restore-stock-management.sh 20250930_020000

# Mise à jour
/usr/local/bin/update-stock-management.sh
```

## 🎯 Prochaines étapes recommandées

1. **Testez le déploiement en environnement de staging** avant la production
2. **Configurez un système de monitoring** (PM2 Plus, New Relic, Datadog)
3. **Implémentez CI/CD** avec GitHub Actions ou GitLab CI
4. **Configurez des alertes** pour les erreurs et downtime
5. **Documentez votre procédure de rollback**
6. **Planifiez des tests de charge** avec Artillery ou k6
7. **Configurez un plan de reprise après sinistre**

---

## ✅ Résumé

Vous disposez maintenant d'un **package de déploiement complet** pour Red Hat :

- ✅ Scripts d'installation automatisés
- ✅ Configuration Nginx optimisée
- ✅ SSL/HTTPS automatique
- ✅ Sauvegardes automatiques
- ✅ Scripts de maintenance
- ✅ Documentation complète
- ✅ Monitoring et health checks

**Temps de déploiement estimé** : 30 minutes pour une installation complète.

**Bonne chance avec votre déploiement en production !** 🚀

---

*Date de création : 30 septembre 2025*  
*Version : 1.0*
