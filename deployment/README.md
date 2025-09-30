# Scripts de déploiement Red Hat

Ce dossier contient tous les scripts et configurations nécessaires pour déployer l'application Stock Management sur un serveur Red Hat Enterprise Linux / CentOS.

## 📁 Contenu

| Fichier | Description |
|---------|-------------|
| `deploy.sh` | Script principal de déploiement automatisé |
| `nginx.conf` | Configuration Nginx (reverse proxy) |
| `setup-ssl.sh` | Configuration automatique SSL avec Let's Encrypt |
| `backup.sh` | Script de sauvegarde automatique |
| `restore.sh` | Script de restauration depuis sauvegarde |
| `update.sh` | Script de mise à jour de l'application |
| `DEPLOYMENT_GUIDE.md` | Guide complet de déploiement |
| `.env.production.example` | Exemple de configuration pour la production |

## 🚀 Déploiement rapide

### 1. Préparer le serveur

```bash
# Transférer les fichiers vers le serveur
scp -r deployment root@your-server-ip:/tmp/
```

### 2. Configurer les variables

```bash
# Éditez deploy.sh et modifiez :
nano /tmp/deployment/deploy.sh

# Changez :
# - DOMAIN="your-domain.com"
# - DB_PASSWORD="VotreMotDePasseSécurisé"
```

### 3. Exécuter le déploiement

```bash
cd /tmp/deployment
chmod +x deploy.sh
./deploy.sh
```

### 4. Configurer SSL (après déploiement)

```bash
nano /tmp/deployment/setup-ssl.sh  # Modifier domaine et email
./setup-ssl.sh
```

## 📋 Checklist de déploiement

- [ ] Serveur Red Hat/CentOS avec accès root
- [ ] Nom de domaine pointant vers le serveur
- [ ] Modifier `DOMAIN` dans `deploy.sh`
- [ ] Modifier `DB_PASSWORD` dans `deploy.sh`
- [ ] Transférer le code de l'application
- [ ] Exécuter `deploy.sh`
- [ ] Configurer SSL avec `setup-ssl.sh`
- [ ] Configurer les sauvegardes automatiques
- [ ] Tester l'application

## 🛠️ Commandes post-déploiement

```bash
# Vérifier le statut
pm2 status

# Voir les logs
pm2 logs stock-management

# Configurer les sauvegardes
crontab -e
# Ajouter: 0 2 * * * /usr/local/bin/backup-stock-management.sh

# Mettre à jour l'application
/usr/local/bin/update-stock-management.sh
```

## 📖 Documentation complète

Consultez `DEPLOYMENT_GUIDE.md` pour :
- Instructions détaillées étape par étape
- Configuration avancée
- Dépannage
- Optimisation des performances
- Sécurité

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

## 📞 Support

Pour plus d'informations, consultez :
- `DEPLOYMENT_GUIDE.md` - Guide complet
- Logs de l'application : `pm2 logs`
- Logs système : `journalctl -xe`

---

**Prêt pour la production** ✅
