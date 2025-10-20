# Mise à Jour : 418ac4c → 4fcaa25 (19 Commits) 🚀

## 📊 État Actuel

**Version sur RedHat :** `418ac4c` (docs: Guide résolution WebSocket HMR et 404)  
**Version sur GitHub :** `4fcaa25` (fix: Script deploy utilise sudo -u postgres)

**Vous avez : 19 COMMITS de retard**

---

## 📝 Tous les Correctifs à Récupérer

1. ✅ **130f0da** - Amélioration bordereaux (nom + adresse banque)
2. ✅ **d1d23ff** - Logs production RedHat (configuration auto)
3. ✅ **e3684f5** - Logs historiques 30 jours (au lieu de 24h)
4. ✅ **123f560** - Correction table AuditLog
5. ✅ **6dc9849** - Guide déploiement rapide
6. ✅ **f9174ef** - **Système rollback automatique** 🛡️
7. ✅ **ec71d1b** - **Système notifications complet** 🔔
8. ✅ **fd8743b** - Tests APIs & DB complets
9. ✅ **4c1307c** - Amélioration formulaire carte
10. ✅ **7510a7b** - Modal carte seuils 50/100000
11. ✅ **144684e** - Guides protection données existantes
12. ✅ **71e1781** - Fichier commandes déploiement
13. ✅ **526e208** - Script diagnostic DB
14. ✅ **48706c9** - sudo -u postgres (pas de mot de passe)
15. ✅ **7b205ea** - **Adaptation schéma Prisma pour RedHat** 🔧
16. ✅ **3a33a93** - Correction Audit_logs avec underscore
17. ✅ **d3776d2** - Confirmation mode mise à jour
18. ✅ **d49fdb9** - **Fix erreur build Next.js** 🔧
19. ✅ **4fcaa25** - Fix demande mot de passe dans deploy.sh

---

## ⚠️ CORRECTIFS CRITIQUES

### Ces Commits Sont ESSENTIELS :

**🛡️ f9174ef - Rollback Automatique**
- Protection en cas d'erreur pendant déploiement
- Restauration automatique si problème

**🔧 7b205ea + 3a33a93 - Adaptation Schéma**
- Compatible avec VOS tables (Users, Banks, Cards, Movements, Audit_logs)
- **SANS CELA, le déploiement ÉCHOUERA**

**🔧 d49fdb9 - Fix Build Next.js**
- Résout l'erreur de build que vous avez rencontrée
- Configuration .env avant Prisma

**🔐 4fcaa25 - Fix Mot de Passe**
- Utilise sudo -u postgres (pas de mot de passe requis)
- Résout les problèmes de vérifications

---

## 🚀 ÉTAPES DE MISE À JOUR - Une Par Une

### **SUR VOTRE SERVEUR REDHAT :**

---

### **ÉTAPE 1** : Connexion

```bash
ssh root@votre-serveur-redhat
```

---

### **ÉTAPE 2** : Navigation

```bash
cd /var/www/stock-management
```

---

### **ÉTAPE 3** : Vérifier la Version Actuelle

```bash
git log --oneline -1
```

**✅ Doit afficher :** `418ac4c`

---

### **ÉTAPE 4** : Sauvegarder Votre Configuration .env

```bash
cp .env .env.backup.avant_maj_$(date +%Y%m%d)
```

---

### **ÉTAPE 5** : Compter Vos Données AVANT

```bash
echo "=== COMPTAGE AVANT MISE À JOUR ===" > comptage_avant.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Users";' | tee -a comptage_avant.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Banks";' | tee -a comptage_avant.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Cards";' | tee -a comptage_avant.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Movements";' | tee -a comptage_avant.txt

cat comptage_avant.txt
```

**✅ Notez ces chiffres**

---

### **ÉTAPE 6** : Backup Complet de la Base

```bash
sudo -u postgres pg_dump stock_management > backup_avant_maj_$(date +%Y%m%d_%H%M%S).sql

ls -lh backup_avant_maj_*.sql
```

**✅ Vérifiez la taille** (plusieurs Mo)

---

### **ÉTAPE 7** : Annuler les Modifications Locales

```bash
# Voir s'il y a des modifications locales
git status

# Sauvegarder tout au cas où
git stash push -m "Sauvegarde avant maj du 418ac4c vers 4fcaa25"

# Vérifier que c'est propre
git status
```

**✅ Doit afficher :** `working tree clean`

---

### **ÉTAPE 8** : Récupérer TOUS les Commits depuis GitHub

```bash
git fetch origin
```

---

### **ÉTAPE 9** : Voir Ce Qui Va Être Mis à Jour

```bash
# Voir les 19 commits à récupérer
git log HEAD..origin/main --oneline
```

---

### **ÉTAPE 10** : MISE À JOUR (git pull)

```bash
git pull origin main
```

**✅ Doit afficher :**
```
Updating 418ac4c..4fcaa25
Fast-forward
 prisma/schema.prisma | ...
 deploy.sh | ...
 [beaucoup de fichiers]
 19 files changed, XXX insertions(+), XXX deletions(-)
```

---

### **ÉTAPE 11** : Vérifier la Nouvelle Version

```bash
git log --oneline -1
```

**✅ Doit afficher :**
```
4fcaa25 fix: Script deploy utilise sudo -u postgres...
```

---

### **ÉTAPE 12** : Restaurer Votre .env

```bash
# Restaurer votre configuration
cp .env.backup.avant_maj_* .env

# Vérifier
cat .env | head -5
```

---

### **ÉTAPE 13** : CORRIGER le DATABASE_URL

```bash
# Éditer .env
nano .env
```

**Modifier DATABASE_URL pour utiliser postgres :**
```env
DATABASE_URL="postgresql://postgres@localhost:5432/stock_management"
```

**Sauvegarder :** `Ctrl+O`, `Entrée`, `Ctrl+X`

---

### **ÉTAPE 14** : Tester la Connexion DB

```bash
sudo -u postgres psql stock_management -c "SELECT COUNT(*) FROM \"Users\";"
```

**✅ Doit afficher le nombre d'utilisateurs SANS demander de mot de passe**

---

### **ÉTAPE 15** : LANCER LE DÉPLOIEMENT

```bash
chmod +x deploy.sh
./deploy.sh
```

**⏱️ Durée : 3-5 minutes**

---

### **ÉTAPE 16** : Surveiller la Progression

**Vous devriez voir :**

```
5️⃣ Configuration .env...
✓ DATABASE_URL configuré
✓ NODE_ENV=production

6️⃣ Installation dépendances...
✓ Dépendances installées

7️⃣ Configuration Prisma...
✓ Client Prisma généré
✓ Base de données déjà synchronisée

8️⃣ Nettoyage cache...
✓ Cache nettoyé

9️⃣ Build production...
[Peut prendre 2 minutes]
✓ Build terminé avec succès

🔟 Redémarrage PM2...
✓ Application redémarrée

1️⃣1️⃣ Vérifications...
✓ Application accessible
✓ API logs fonctionnelle - XXX entrées
✓ API notifications fonctionnelle
✓ API users fonctionnelle
✓ API banks fonctionnelle
✓ Table Audit_logs: XXX entrées
✓ Tables principales: 5/10 présentes

✅ Déploiement terminé avec succès !
```

---

### **ÉTAPE 17** : Vérifier les Données APRÈS

```bash
echo "=== COMPTAGE APRÈS MISE À JOUR ===" > comptage_apres.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Users";' | tee -a comptage_apres.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Banks";' | tee -a comptage_apres.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Cards";' | tee -a comptage_apres.txt
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Movements";' | tee -a comptage_apres.txt

cat comptage_apres.txt
```

**✅ COMPAREZ avec comptage_avant.txt - Doit être IDENTIQUE**

---

### **ÉTAPE 18** : Vérifier PM2

```bash
pm2 status
```

**✅ Status doit être :** `online`

```bash
pm2 logs stock-management --lines 30
```

**✅ Pas d'erreurs de connexion DB**

---

### **ÉTAPE 19** : Tester dans le Navigateur

**Ouvrir :** `http://votre-domaine.com`

**Vérifier :**
- ✅ Connexion fonctionne
- ✅ Menu Banques → Vos 7 banques sont là
- ✅ Menu Cartes → Vos 43 cartes sont là
- ✅ Menu Logs → Logs visibles (30 jours)
- ✅ Icône 🔔 → Notifications fonctionnent
- ✅ Modal "Ajouter carte" → Seuil max = 100000

---

### **ÉTAPE 20** : Vérifier le Commit Final

```bash
git log --oneline -1
```

**✅ Doit afficher :**
```
4fcaa25 fix: Script deploy utilise sudo -u postgres...
```

---

## 📋 COMMANDES COMPLÈTES - Copier-Coller

**Exécutez TOUT ceci sur votre serveur RedHat :**

```bash
# === PRÉPARATION ===

cd /var/www/stock-management

# Sauvegardes
cp .env .env.backup.avant_maj
sudo -u postgres pg_dump stock_management > backup_complet_$(date +%Y%m%d).sql

# Comptage avant
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Users";'
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Banks";'
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Cards";'

# === MISE À JOUR ===

# Annuler modifications locales
git stash

# Pull tous les commits (418ac4c → 4fcaa25)
git pull origin main

# Restaurer .env
cp .env.backup.avant_maj .env

# IMPORTANT : Corriger DATABASE_URL
nano .env
# Modifier pour : DATABASE_URL="postgresql://postgres@localhost:5432/stock_management"
# Sauvegarder : Ctrl+O, Entrée, Ctrl+X

# Vérifier NODE_ENV
grep NODE_ENV .env || echo 'NODE_ENV="production"' >> .env

# === DÉPLOIEMENT ===

chmod +x deploy.sh
./deploy.sh

# === VÉRIFICATIONS ===

# Commit
git log --oneline -1

# PM2
pm2 status

# Données
sudo -u postgres psql stock_management -c 'SELECT COUNT(*) FROM "Users";'

# API
curl http://localhost:3000/api/users | head -c 100
```

---

## 🎯 NOUVELLES FONCTIONNALITÉS

### Après cette mise à jour, vous aurez :

**1. Système de Rollback Automatique** 🛡️
- Protection si erreur pendant déploiement
- Restauration automatique

**2. Logs d'Audit Améliorés** 📊
- Filtre 30 jours (au lieu de 24h)
- 1000 logs affichés (au lieu de 10)
- Compatible table `Audit_logs`

**3. Système de Notifications** 🔔
- API complète fonctionnelle
- Badge compteur
- Affichage dans l'interface

**4. Modal Carte Amélioré** 📝
- Seuil max : 100000
- Meilleurs placeholders

**5. Bordereaux Améliorés** 📄
- Nom + adresse banque affichés

**6. Scripts Corrigés** 🔧
- Pas de demande de mot de passe
- Utilise sudo -u postgres
- Compatible avec vos tables RedHat

---

## 🛡️ Sécurité

**Protections en place :**
- ✅ Backup automatique avant mise à jour
- ✅ Rollback automatique si erreur
- ✅ Schéma Prisma adapté à VOS tables
- ✅ Aucune suppression de données
- ✅ Mode mise à jour (pas nouvelle installation)

---

## ⏱️ Temps Estimé

- Préparation : 2 minutes
- git pull : 10 secondes
- ./deploy.sh : 3-5 minutes
- Vérifications : 2 minutes

**Total : ~10 minutes**

---

## 📞 En Cas de Problème

**Si le déploiement échoue :**
- ✅ Le rollback automatique restaure l'état précédent
- ✅ Votre application continue de fonctionner
- ✅ Vos données sont intactes
- ✅ Backup disponible : `backup_complet_XXX.sql`

**Restauration manuelle si nécessaire :**
```bash
git reset --hard 418ac4c
pm2 restart stock-management
```

---

**Vous êtes prêt à passer de 418ac4c à 4fcaa25 avec 19 correctifs importants !** 🚀

