# Fix : Problème de Connexion Base de Données 🔧

## 🔴 Problème Rencontré

```
⚠ API des logs d'audit non accessible
⚠ API notifications non accessible  
⚠ API users non accessible
⚠ API banks non accessible

Mot de passe pour l'utilisateur stockapp : [demandé]
```

## 🔍 Cause

Le fichier `.env` contient :
```env
DATABASE_URL="postgresql://stockapp:MOT_DE_PASSE@localhost:5432/stock_management"
```

L'utilisateur `stockapp` nécessite un mot de passe que le système n'a pas.

**Résultat :**
- ❌ L'application ne peut pas se connecter à la base de données
- ❌ Toutes les APIs retournent des erreurs
- ❌ Les vérifications du script demandent le mot de passe

## ✅ SOLUTION : Utiliser l'utilisateur `postgres`

Sur RedHat, l'utilisateur système `postgres` peut se connecter SANS mot de passe.

### ÉTAPE 1 : Éditer le fichier .env

```bash
# Sur le serveur RedHat
nano /var/www/stock-management/. env
```

**Trouvez la ligne DATABASE_URL et modifiez-la :**

**AVANT :**
```env
DATABASE_URL="postgresql://stockapp:password@localhost:5432/stock_management"
```

**APRÈS :**
```env
DATABASE_URL="postgresql://postgres@localhost:5432/stock_management"
```

**Points importants :**
- ✅ Remplacer `stockapp` par `postgres`
- ✅ Enlever `:password` (pas de mot de passe nécessaire)
- ✅ Garder `@localhost:5432/stock_management`

**Sauvegarder :** `Ctrl+O`, `Entrée`, `Ctrl+X`

---

### ÉTAPE 2 : Tester la Connexion

```bash
# Tester avec psql directement
sudo -u postgres psql stock_management -c "SELECT COUNT(*) FROM \"Users\";"
```

**✅ Doit afficher le nombre d'utilisateurs (ex: 15)**

---

### ÉTAPE 3 : Redémarrer l'Application

```bash
# Redémarrer PM2 avec la nouvelle configuration
pm2 restart stock-management

# Attendre 5 secondes
sleep 5

# Vérifier les logs
pm2 logs stock-management --lines 20
```

**✅ Ne devrait PAS afficher d'erreurs de connexion DB**

---

### ÉTAPE 4 : Tester les APIs

```bash
# Test API users
curl http://localhost:3000/api/users

# Doit retourner: {"success":true,"data":[...]}
```

**✅ Si ça marche, c'est résolu !**

---

## 🚀 RE-DÉPLOIEMENT

Maintenant que la connexion DB est corrigée :

```bash
# Récupérer les dernières corrections depuis GitHub
git pull origin main

# Re-lancer le déploiement
./deploy.sh
```

**Cette fois, les vérifications fonctionneront sans demander de mot de passe !**

---

## 📋 COMMANDES COMPLÈTES - Copier-Coller

```bash
# === SUR LE SERVEUR REDHAT ===

# 1. Éditer .env
nano .env

# 2. Modifier DATABASE_URL pour :
#    DATABASE_URL="postgresql://postgres@localhost:5432/stock_management"
#    (Enlever stockapp et le mot de passe)

# 3. Sauvegarder (Ctrl+O, Entrée, Ctrl+X)

# 4. Tester la connexion
sudo -u postgres psql stock_management -c "SELECT COUNT(*) FROM \"Users\";"

# 5. Redémarrer l'application
pm2 restart stock-management

# 6. Attendre un peu
sleep 10

# 7. Tester les APIs
curl http://localhost:3000/api/users | head -c 100

# 8. Si ça marche, récupérer les corrections
git pull origin main

# 9. Re-déployer
./deploy.sh
```

---

## 🔐 Alternative : Configurer le Mot de Passe stockapp

Si vous voulez garder l'utilisateur `stockapp` :

```bash
# 1. Créer/Réinitialiser le mot de passe
sudo -u postgres psql

# 2. Dans psql :
ALTER USER stockapp WITH PASSWORD 'VotreMotDePasseSecurise123';
GRANT ALL PRIVILEGES ON DATABASE stock_management TO stockapp;
\q

# 3. Mettre à jour .env avec le BON mot de passe
nano .env

# 4. DATABASE_URL="postgresql://stockapp:VotreMotDePasseSecurise123@localhost:5432/stock_management"
```

**Mais utiliser `postgres` est PLUS SIMPLE sur RedHat !**

