# Solution: Erreur WebSocket et Page 404 en Production

**Problème:** 
- Page logs retourne 404
- Erreur WebSocket: `failed to connect to wss://gstock.monetiquetunisie.com/_next/webpack-hmr`

---

## �� Explication

Cette erreur indique que l'application tourne en **mode développement** (`npm run dev`) au lieu du **mode production** (`npm start`).

**Le mode développement ne doit PAS être utilisé en production !**

---

## ✅ Solution sur Red Hat

### Étape 1: Vérifier le Mode Actuel

```bash
# Se connecter au serveur
cd /var/www/stock-management

# Vérifier comment PM2 démarre l'application
pm2 show stock-management

# Ou voir la liste
pm2 list
```

### Étape 2: Arrêter et Reconfigurer

```bash
# Arrêter l'application actuelle
pm2 delete stock-management

# Vérifier que le build existe
ls -la .next/

# Si .next/ n'existe pas, builder:
npm run build

# Démarrer en mode PRODUCTION
pm2 start npm --name "stock-management" -- start

# Sauvegarder la configuration
pm2 save

# Configurer le démarrage automatique
pm2 startup
```

---

## 🔧 Vérification du package.json

Le fichier `package.json` doit contenir:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",  ← MODE PRODUCTION
    "lint": "next lint"
  }
}
```

---

## 🚀 Script deploy.sh Mis à Jour

Le script a été mis à jour pour démarrer correctement en production.

Vérifiez la section redémarrage dans `deploy.sh`:

```bash
# Devrait contenir:
pm2 restart stock-management || pm2 start npm --name "stock-management" -- start
```

**Le script utilise bien `npm start` (production) et non `npm dev` !**

---

## 📋 Procédure Complète

```bash
# Sur le serveur Red Hat
cd /var/www/stock-management

# 1. Arrêter l'application actuelle
pm2 delete stock-management

# 2. Nettoyer et récupérer les modifications
rm -rf .next
git pull origin main

# 3. Installer et builder
npm install
npx prisma generate
npm run build

# 4. Démarrer en mode PRODUCTION
pm2 start npm --name "stock-management" -- start

# 5. Sauvegarder
pm2 save

# 6. Vérifier
pm2 logs stock-management --lines 20
curl -I http://localhost:3000/dashboard/logs
```

---

## 🔍 Différence Dev vs Production

| Mode | Commande | Quand l'utiliser | WebSocket |
|------|----------|------------------|-----------|
| **Développement** | `npm run dev` | Uniquement en local | ✅ HMR actif |
| **Production** | `npm start` | Sur serveur Red Hat | ❌ Pas de HMR |

---

## ✅ Vérification

### L'application tourne en production si:

```bash
# 1. Vérifier le processus PM2
pm2 list
# Devrait montrer: npm -- start (pas dev)

# 2. Vérifier les logs
pm2 logs stock-management --lines 5
# Devrait montrer: "▲ Next.js X.X.X" sans mention de dev

# 3. Pas d'erreur WebSocket dans la console navigateur

# 4. Page logs accessible
curl -I http://localhost:3000/dashboard/logs
# HTTP/1.1 200 OK
```

---

## 🆘 Si le Problème Persiste

### Vérifier Nginx (si utilisé)

Si vous utilisez Nginx comme reverse proxy:

```bash
# Vérifier la configuration Nginx
cat /etc/nginx/sites-available/stock-management

# La configuration devrait contenir:
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# Recharger Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Vérifier le Port

```bash
# Vérifier que l'application écoute sur le bon port
sudo lsof -i :3000

# Devrait montrer un processus Node.js
```

### Nettoyer Complètement

```bash
cd /var/www/stock-management

# Supprimer tout
pm2 delete stock-management
rm -rf .next node_modules

# Réinstaller
npm install
npx prisma generate

# Builder
npm run build

# Démarrer en production
pm2 start npm --name "stock-management" -- start
pm2 save
```

---

## 🎯 Commande Simple

**La plus simple: utiliser le script de déploiement qui fait tout correctement:**

```bash
cd /var/www/stock-management
./deploy.sh
```

Le script:
- ✅ Builder l'application (`npm run build`)
- ✅ Démarrer en mode production (`npm start`)
- ✅ Redémarrer avec PM2 correctement configuré

---

## 📊 Résumé

| Problème | Cause | Solution |
|----------|-------|----------|
| Erreur WebSocket HMR | Mode dev en production | Utiliser `npm start` |
| Page 404 | Build manquant | `npm run build` puis `npm start` |
| Logs montrent "dev" | Mauvaise commande PM2 | `pm2 start npm -- start` |

---

## ✨ Après Correction

Vous ne devriez plus voir:
- ❌ Erreurs WebSocket dans la console
- ❌ Messages HMR (Hot Module Replacement)
- ❌ Pages 404

Vous devriez voir:
- ✅ Application rapide et stable
- ✅ Toutes les pages accessibles
- ✅ Pas d'erreurs dans la console

---

*Guide créé pour résoudre les erreurs WebSocket et 404 en production*
