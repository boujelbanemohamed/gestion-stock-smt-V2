# 🚀 SOLUTION COMPLÈTE - Déploiement Red Hat

## ❌ Problème
- Erreur: `failed to collect page data for /api/auth/login`
- Erreur WebSocket en production
- Page logs 404

## ✅ Solution Rapide (5 minutes)

### Sur le serveur Red Hat, exécutez ces commandes :

```bash
cd /var/www/stock-management

# 1. Arrêter l'application
pm2 delete stock-management

# 2. Nettoyer complètement
rm -rf .next node_modules/.cache

# 3. Récupérer la dernière version
git pull origin main

# 4. Réinstaller
npm install
npx prisma generate

# 5. Builder en mode PRODUCTION
NODE_ENV=production npm run build

# 6. Démarrer en PRODUCTION (pas dev!)
pm2 start npm --name "stock-management" -- start

# 7. Sauvegarder
pm2 save

# 8. Vérifier
pm2 logs stock-management --lines 20
```

## 🎯 Commande Unique (Copier/Coller)

```bash
cd /var/www/stock-management && pm2 delete stock-management && rm -rf .next node_modules/.cache && git pull origin main && npm install && npx prisma generate && NODE_ENV=production npm run build && pm2 start npm --name "stock-management" -- start && pm2 save && pm2 logs stock-management --lines 20
```

## ⚠️ Point Crucial

**PM2 doit utiliser `npm start` (PRODUCTION) et NON `npm dev` (DÉVELOPPEMENT)**

Vérifiez avec :
```bash
pm2 list
```

Vous devez voir : `npm -- start` ✅  
PAS : `npm -- dev` ❌

## 📊 Résultat Attendu

✅ Page logs accessible : http://gstock.monetiquetunisie.com/dashboard/logs  
✅ Aucune erreur WebSocket  
✅ Application rapide et stable  

---

**Temps estimé : 5 minutes**




