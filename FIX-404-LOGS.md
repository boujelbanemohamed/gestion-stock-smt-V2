# Solution: Page Logs Retourne 404

**Problème:** La page `/dashboard/logs` retourne une erreur 404 sur le serveur Red Hat

---

## 🔍 Diagnostic

Cette erreur 404 peut avoir plusieurs causes:

1. ❌ Build non effectué après la mise à jour
2. ❌ Fichiers non présents après le `git pull`
3. ❌ Cache Next.js obsolète
4. ❌ Application pas redémarrée correctement

---

## ✅ Solution Complète

### Sur votre serveur Red Hat :

```bash
# 1. Aller dans le répertoire
cd /var/www/stock-management

# 2. Vérifier que les fichiers sont présents
ls -la app/dashboard/logs/page.tsx
ls -la components/dashboard/logs-panel.tsx
ls -la app/api/logs/route.ts

# 3. Nettoyer le cache et rebuild
rm -rf .next
npm run build

# 4. Redémarrer l'application
pm2 restart stock-management
# ou
sudo systemctl restart stock-management

# 5. Vérifier les logs
pm2 logs stock-management --lines 50
```

---

## 🔧 Solution Rapide

```bash
cd /var/www/stock-management
rm -rf .next
npm run build
pm2 restart stock-management
```

---

## 📋 Vérifications Détaillées

### 1. Vérifier que le Code Est à Jour

```bash
cd /var/www/stock-management

# Vérifier le commit actuel
git log --oneline -1
# Devrait afficher: 4cbf7b9 ou plus récent

# Si ce n'est pas le cas, faire un pull
git pull origin main
```

### 2. Vérifier que les Fichiers Existent

```bash
# Page logs
test -f app/dashboard/logs/page.tsx && echo "✓ Page logs existe" || echo "✗ Page logs manquante"

# Composant logs-panel
test -f components/dashboard/logs-panel.tsx && echo "✓ Composant logs-panel existe" || echo "✗ Composant logs-panel manquant"

# API logs
test -f app/api/logs/route.ts && echo "✓ API logs existe" || echo "✗ API logs manquante"
```

### 3. Vérifier le Build

```bash
# Supprimer le build précédent
rm -rf .next

# Rebuild complet
npm run build

# Vérifier qu'il n'y a pas d'erreurs
echo $?
# Devrait retourner 0
```

### 4. Vérifier que l'Application Tourne

```bash
# Avec PM2
pm2 list | grep stock-management

# Avec systemd
sudo systemctl status stock-management

# Tester l'accès
curl -I http://localhost:3000/dashboard/logs
```

---

## 🔄 Procédure Complète de Résolution

```bash
# Sur le serveur Red Hat
cd /var/www/stock-management

# 1. Vérifier le commit
git log --oneline -1

# 2. Si pas à jour, faire un pull
git pull origin main

# 3. Nettoyer et rebuild
rm -rf .next
rm -rf node_modules/.cache
npm install
npm run build

# 4. Redémarrer
pm2 delete stock-management 2>/dev/null || true
pm2 start npm --name "stock-management" -- start
pm2 save

# 5. Vérifier
sleep 5
curl -I http://localhost:3000/dashboard/logs
pm2 logs stock-management --lines 30
```

---

## 🐛 Debug Approfondi

Si le problème persiste :

### Vérifier les Logs de Build

```bash
# Voir les logs de build
npm run build 2>&1 | tee build.log
cat build.log | grep -i error
```

### Vérifier les Routes Compilées

```bash
# Après le build, vérifier que la route existe
ls -la .next/server/app/dashboard/logs/

# Vérifier le manifeste des routes
cat .next/routes-manifest.json | jq '.staticRoutes' | grep logs
```

### Vérifier les Permissions

```bash
# Permissions du répertoire
ls -ld app/dashboard/logs/

# Propriétaire des fichiers
ls -la app/dashboard/logs/page.tsx
ls -la components/dashboard/logs-panel.tsx
```

---

## 🔍 Tester l'API Directement

```bash
# Tester l'API logs
curl http://localhost:3000/api/logs | jq '.'

# Devrait retourner:
# {
#   "success": true,
#   "data": [...],
#   "total": X
# }
```

---

## 🚨 Si Rien Ne Fonctionne

### Option 1: Redéploiement Complet

```bash
cd /var/www/stock-management

# Sauvegarder la base
pg_dump -U postgres stock_management > backup_emergency.sql

# Nettoyer complètement
pm2 delete stock-management
rm -rf .next node_modules

# Récupérer le code
git fetch origin
git reset --hard origin/main

# Réinstaller
npm install
npx prisma generate
npm run build

# Redémarrer
pm2 start npm --name "stock-management" -- start
pm2 save
```

### Option 2: Vérifier la Configuration Next.js

```bash
# Vérifier next.config.mjs
cat next.config.mjs

# S'assurer qu'il n'y a pas d'erreur
node -c next.config.mjs
```

---

## ✅ Vérification Finale

Une fois le problème résolu:

```bash
# 1. Page accessible
curl -I http://localhost:3000/dashboard/logs
# HTTP/1.1 200 OK ✅

# 2. API fonctionne
curl http://localhost:3000/api/logs | jq '.success'
# true ✅

# 3. Données retournées
curl http://localhost:3000/api/logs | jq '.total'
# Nombre de logs ✅

# 4. Pas d'erreurs dans les logs
pm2 logs stock-management --lines 20 --err
# Aucune erreur ✅
```

---

## 📝 Checklist de Résolution

- [ ] Code à jour (`git pull origin main`)
- [ ] Fichiers présents (page.tsx, logs-panel.tsx, route.ts)
- [ ] Cache nettoyé (`rm -rf .next`)
- [ ] Build effectué (`npm run build`)
- [ ] Application redémarrée (`pm2 restart stock-management`)
- [ ] Page accessible (curl retourne 200)
- [ ] API fonctionne (retourne des données)
- [ ] Pas d'erreurs dans les logs

---

## 🎯 Solution la Plus Probable

Dans 90% des cas, le problème vient du fait que le build n'a pas été refait:

```bash
cd /var/www/stock-management
rm -rf .next
npm run build
pm2 restart stock-management
```

**Essayez ceci en premier !** ⚡

---

*Guide créé pour résoudre l'erreur 404 sur la page logs*
