# Scripts de déploiement Red Hat

Ce dossier contient tous les scripts et configurations nécessaires pour déployer l'application Stock Management sur un serveur Red Hat Enterprise Linux / CentOS.

## 📁 Contenu

| Fichier | Description |
|---------|-------------|
| `deploy.sh` | Script principal de déploiement automatisé |
| `test-features.sh` | Script de test de toutes les fonctionnalités |
| `test-bordereaux.sh` | Script de test des bordereaux de mouvement |
| `fix-permissions.sh` | Script de correction des permissions des rôles |
| `health-check.sh` | Script de vérification de santé de l'application |
| `nginx.conf` | Configuration Nginx (reverse proxy) |
| `setup-ssl.sh` | Configuration automatique SSL avec Let's Encrypt |
| `backup.sh` | Script de sauvegarde automatique |
| `restore.sh` | Script de restauration depuis sauvegarde |
| `update.sh` | Script de mise à jour de l'application |
| `DEPLOYMENT_GUIDE.md` | Guide complet de déploiement |
| `BORDEREAUX_GUIDE.md` | Guide des bordereaux de mouvement |
| `test-notifications.sh` | Script de test du système de notifications |
| `check-redhat.sh` | Script de vérification des prérequis RedHat |
| `migrate-redhat.sh` | Script de migration complet pour RedHat |
| `.env.production.example` | Exemple de configuration pour la production |

## 🚀 Déploiement rapide

### Option 1: Déploiement standard

```bash
# Transférer les fichiers vers le serveur
scp -r deployment root@your-server-ip:/tmp/

# Configurer les variables dans deploy.sh
nano /tmp/deployment/deploy.sh
# Changez :
# - DOMAIN="your-domain.com"
# - DB_PASSWORD="VotreMotDePasseSécurisé"

# Exécuter le déploiement
cd /tmp/deployment
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Migration RedHat (recommandé)

```bash
# Transférer les fichiers vers le serveur
scp -r deployment root@your-server-ip:/tmp/

# Vérifier les prérequis RedHat
cd /tmp/deployment
chmod +x check-redhat.sh
./check-redhat.sh

# Configurer les variables dans migrate-redhat.sh
nano /tmp/deployment/migrate-redhat.sh
# Changez :
# - DOMAIN="your-domain.com"
# - DB_PASSWORD="VotreMotDePasseSécurisé"

# Exécuter la migration complète
chmod +x migrate-redhat.sh
./migrate-redhat.sh
```

### 4. Configurer SSL (après déploiement)

```bash
nano /tmp/deployment/setup-ssl.sh  # Modifier domaine et email
./setup-ssl.sh
```

### 5. Tester les fonctionnalités

```bash
# Test complet des fonctionnalités
./test-features.sh

# Test spécifique des bordereaux
./test-bordereaux.sh

# Test du système de notifications
./test-notifications.sh

# Correction des permissions si nécessaire
./fix-permissions.sh
```

## 📋 Checklist de déploiement

- [ ] Serveur Red Hat/CentOS avec accès root
- [ ] Nom de domaine pointant vers le serveur
- [ ] Modifier `DOMAIN` dans `deploy.sh`
- [ ] Modifier `DB_PASSWORD` dans `deploy.sh`
- [ ] Transférer le code de l'application
- [ ] Exécuter `deploy.sh`
- [ ] Configurer SSL avec `setup-ssl.sh`
- [ ] Tester les fonctionnalités avec `test-features.sh`
- [ ] Tester les bordereaux avec `test-bordereaux.sh`
- [ ] Tester les notifications avec `test-notifications.sh`
- [ ] Corriger les permissions avec `fix-permissions.sh` si nécessaire
- [ ] Configurer les sauvegardes automatiques
- [ ] Tester l'application manuellement

## 🛠️ Commandes post-déploiement

```bash
# Vérifier le statut
pm2 status

# Voir les logs
pm2 logs stock-management

# Tester toutes les fonctionnalités
./test-features.sh

# Tester les bordereaux de mouvement
./test-bordereaux.sh

# Tester le système de notifications
./test-notifications.sh

# Corriger les permissions si problème d'accès
./fix-permissions.sh

# Configurer les sauvegardes
crontab -e
# Ajouter: 0 2 * * * /usr/local/bin/backup-stock-management.sh

# Mettre à jour l'application
/usr/local/bin/update-stock-management.sh
```

## 📖 Documentation complète

Consultez la documentation :
- `DEPLOYMENT_GUIDE.md` - Instructions détaillées étape par étape
- `BORDEREAUX_GUIDE.md` - Guide des bordereaux de mouvement
- Configuration avancée, dépannage, optimisation et sécurité

## 🔒 Sécurité importante

1. **Changez TOUS les mots de passe** dans `.env`
2. **Générez de nouvelles clés** pour SESSION_SECRET et JWT_SECRET
3. **Configurez SSL** immédiatement après le déploiement
4. **Activez les sauvegardes** automatiques
5. **Mettez à jour** régulièrement le système

## 🆘 Dépannage rapide

### L'application ne démarre pas
```bash
pm2 logs stock-management --err
```

### Problème de permissions (accès limité aux pages)
```bash
./fix-permissions.sh
```

### Problème de base de données
```bash
systemctl status postgresql
sudo -u postgres psql stock_management
```

### Nginx ne fonctionne pas
```bash
nginx -t
systemctl status nginx
```

### Test complet des fonctionnalités
```bash
./test-features.sh
```

### Test des bordereaux de mouvement
```bash
./test-bordereaux.sh
```

### Test du système de notifications
```bash
./test-notifications.sh
```

## 🐧 Spécifique RedHat/CentOS

### Vérification des prérequis
```bash
./check-redhat.sh
```

### Migration complète RedHat
```bash
./migrate-redhat.sh
```

### Différences RedHat vs Ubuntu
- **Gestionnaire de paquets** : `dnf` au lieu de `apt`
- **Services** : `systemctl` (identique)
- **Firewall** : `firewalld` au lieu de `ufw`
- **SELinux** : Configuration automatique des permissions
- **PostgreSQL** : Installation via `dnf` avec configuration automatique

## 🔧 Dépannage rapide

### Problème de permissions (accès limité aux pages)
```bash
./fix-permissions.sh
```

### Test des bordereaux de mouvement
```bash
./test-bordereaux.sh
```

### Test du système de notifications
```bash
./test-notifications.sh
```

## 📞 Support

Pour plus d'informations, consultez :
- `DEPLOYMENT_GUIDE.md` - Guide complet de déploiement
- `BORDEREAUX_GUIDE.md` - Guide des bordereaux de mouvement
- Logs de l'application : `pm2 logs`
- Logs système : `journalctl -xe`

---

**Prêt pour la production** ✅
