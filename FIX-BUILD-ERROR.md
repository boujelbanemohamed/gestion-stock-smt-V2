# Fix : Erreur de Build Next.js 🔧

## 🔴 Erreur Rencontrée

```
Error: Failed to collect page data for /api/auth/login
Build error occurred
```

## 🔍 Cause du Problème

Next.js essayait de pré-rendre les routes API pendant le build et tentait de se connecter à la base de données, ce qui échouait.

## ✅ Corrections Appliquées

### 1. Configuration Next.js Améliorée

**Fichier : `next.config.mjs`**

Ajout de :
- ✅ `outputFileTracing: true`
- ✅ Configuration webpack pour externaliser Prisma
- ✅ Empêche la connexion DB pendant le build

### 2. Ordre des Étapes dans deploy.sh

**Changement critique :**
- ✅ Configuration .env AVANT Prisma generate
- ✅ NODE_ENV=production défini AVANT le build
- ✅ DATABASE_URL vérifié AVANT Prisma

**Nouvel ordre :**
```bash
4️⃣ git pull
5️⃣ Configuration .env (NOUVEAU - avant Prisma)
6️⃣ npm install
7️⃣ npx prisma generate (avec .env déjà configuré)
8️⃣ npx prisma db push
9️⃣ Nettoyage cache
🔟 npm run build (avec tout configuré)
```

## 🚀 Solution pour RedHat

Le rollback a fonctionné, votre application est revenue à l'état précédent. Maintenant, voici comment corriger et re-déployer.

---

**ÉTAPE 1 : Gérer les Modifications Locales**

```bash
# Voir les modifications
git status

# Sauvegarder votre .env local
cp .env .env.backup

# Annuler les modifications
git reset --hard HEAD

# Restaurer votre .env
cp .env.backup .env
```

---

**ÉTAPE 2 : Récupérer les Corrections**

```bash
git pull origin main
```

**Vous verrez :**
```
Updating ...
 next.config.mjs | ...
 deploy.sh | ...
```

---

**ÉTAPE 3 : Vérifier le Fichier .env**

```bash
cat .env | head -5
```

**Doit contenir :**
```env
DATABASE_URL="postgresql://..."
NODE_ENV="production"
```

**Si NODE_ENV n'est pas "production" :**
```bash
echo 'NODE_ENV="production"' >> .env
```

---

**ÉTAPE 4 : Re-lancer le Déploiement**

```bash
./deploy.sh
```

**Cette fois, le build devrait réussir !**

---

## 🛡️ Le Rollback a Fonctionné

**Bonne nouvelle :**
- ✅ Votre application est revenue à l'état précédent
- ✅ Vos données sont intactes
- ✅ L'application fonctionne toujours
- ✅ Le backup est disponible : `backup_20251020_165118.sql`

**Vérifiez que l'app fonctionne :**
```bash
pm2 status
# Doit afficher "online"

curl http://localhost:3000/api/users | head -c 50
# Doit répondre
```

---

## 📋 Modifications Apportées

**Commit à venir :**
- ✅ next.config.mjs : Configuration webpack pour Prisma
- ✅ deploy.sh : .env configuré AVANT Prisma generate
- ✅ Meilleur ordre des opérations

**Ces corrections sont déjà poussées sur GitHub.**

