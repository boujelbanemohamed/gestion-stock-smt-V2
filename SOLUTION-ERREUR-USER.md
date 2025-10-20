# Solution : Erreur "la relation user n'existe pas" 🔧

## 🔴 Erreur Rencontrée

Lors de l'exécution de l'étape 4 (comptage des données) :

```bash
psql -U postgres stock_management -c "SELECT COUNT(*) FROM \"User\";"
```

**Erreur :**
```
ERROR: relation "user" does not exist
```

---

## 🔍 Diagnostic Rapide

### Sur votre serveur RedHat, exécutez :

```bash
# Vérifier si la base de données existe
psql -U postgres -l | grep stock

# Vérifier les tables dans la base
psql -U postgres stock_management -c "\dt"
```

**3 cas possibles :**

---

## ✅ SOLUTION SELON VOTRE CAS

### **CAS 1 : La base est VIDE** (No relations found)

**Résultat de `\dt` :**
```
No relations found.
```

**C'est normal pour une première installation !**

**Solution : PASSEZ DIRECTEMENT À L'ÉTAPE 5**

```bash
# Ne pas essayer de compter les données
# Passer directement au déploiement
./deploy.sh
```

**Le script `deploy.sh` va :**
1. ✅ Créer toutes les tables automatiquement
2. ✅ Initialiser la base de données
3. ✅ Démarrer l'application

**Après le déploiement, vous pourrez créer vos données via l'interface.**

---

### **CAS 2 : Les tables existent mais avec des noms différents**

**Résultat de `\dt` :**
```
 Schema |      Name       | Type  
--------+-----------------+-------
 public | users           | table
 public | banks           | table
 public | cards           | table
```

**Les tables sont en MINUSCULES** (users, banks) au lieu de **User, Bank**.

**Solution : Utiliser les noms corrects**

```bash
# Compter avec les noms en minuscules
psql -U postgres stock_management -c "SELECT COUNT(*) FROM users;"
psql -U postgres stock_management -c "SELECT COUNT(*) FROM banks;"
psql -U postgres stock_management -c "SELECT COUNT(*) FROM cards;"
```

**Puis continuer le déploiement :**
```bash
./deploy.sh
```

---

### **CAS 3 : Les tables existent avec le bon nom**

**Résultat de `\dt` :**
```
 Schema |      Name      | Type  
--------+----------------+-------
 public | User           | table
 public | Bank           | table
 public | Card           | table
```

**Les tables ont les bons noms (User, Bank, Card).**

**Solution : La commande devrait fonctionner**

Si vous avez toujours l'erreur, essayez :

```bash
# Vérifier la connexion
psql -U postgres stock_management -c "SELECT 1;"

# Si ça marche, compter individuellement
psql -U postgres stock_management -c 'SELECT COUNT(*) FROM "User";'
```

---

## 🚀 SOLUTION RAPIDE (Recommandée)

**Au lieu de compter manuellement, utilisez le script de diagnostic :**

```bash
# Sur le serveur RedHat, dans le répertoire du projet
cd /var/www/stock-management-V2

# Rendre le script exécutable
chmod +x DIAGNOSTIC-DB-REDHAT.sh

# Lancer le diagnostic
./DIAGNOSTIC-DB-REDHAT.sh
```

**Ce script va :**
1. ✅ Vérifier PostgreSQL
2. ✅ Vérifier la base de données
3. ✅ Lister les tables
4. ✅ Compter les données (avec gestion des différents noms)
5. ✅ Vérifier le fichier .env
6. ✅ Vous dire quoi faire ensuite

---

## 📋 NOUVELLES ÉTAPES SIMPLIFIÉES

**Remplacez les ÉTAPES 3-4 par :**

### **NOUVELLE ÉTAPE 3** : Diagnostic Complet

```bash
# Sur le serveur RedHat
cd /var/www/stock-management-V2

# Télécharger les derniers scripts depuis GitHub
git fetch origin
git checkout origin/main -- DIAGNOSTIC-DB-REDHAT.sh
chmod +x DIAGNOSTIC-DB-REDHAT.sh

# Lancer le diagnostic
./DIAGNOSTIC-DB-REDHAT.sh
```

**Regardez le résultat du diagnostic et suivez ses recommandations.**

---

### **NOUVELLE ÉTAPE 4** : Backup (Seulement si Base NON Vide)

```bash
# Si le diagnostic montre que vous avez des données :
pg_dump -U postgres stock_management > backup_securite_$(date +%Y%m%d).sql
ls -lh backup_securite_*.sql

# Si le diagnostic montre "Base VIDE" :
# Passer cette étape (pas de données à sauvegarder)
```

---

### **ÉTAPE 5** : Déploiement

```bash
# Dans tous les cas (base vide ou pleine)
./deploy.sh
```

**Le script gère automatiquement les deux situations :**
- Base vide → Initialise tout
- Base pleine → Préserve les données, met à jour le code

---

## 🔧 COMMANDES DE DÉPANNAGE

### Si vous ne pouvez pas vous connecter à PostgreSQL

```bash
# Vérifier que PostgreSQL tourne
systemctl status postgresql

# Si arrêté, le démarrer
sudo systemctl start postgresql

# Vérifier la connexion
psql -U postgres -c "SELECT 1;"
```

### Si la base n'existe pas

```bash
# Créer la base de données
psql -U postgres -c "CREATE DATABASE stock_management;"

# Vérifier
psql -U postgres -l | grep stock
```

### Si vous avez un problème de mot de passe

```bash
# Se connecter en tant qu'utilisateur postgres système
sudo -u postgres psql

# Une fois connecté
\l                    # Lister les bases
\c stock_management   # Se connecter à la base
\dt                   # Lister les tables
\q                    # Quitter
```

---

## ✅ COMMANDES CORRIGÉES - Copier-Coller

**Pour éviter l'erreur, utilisez ceci :**

```bash
# 1. Connexion
ssh root@serveur-redhat

# 2. Navigation
cd /var/www/stock-management-V2

# 3. Diagnostic complet (sans erreur)
chmod +x DIAGNOSTIC-DB-REDHAT.sh
./DIAGNOSTIC-DB-REDHAT.sh

# 4. Backup (si le diagnostic montre des données)
pg_dump -U postgres stock_management > backup_securite_$(date +%Y%m%d).sql 2>/dev/null

# 5. Déploiement
chmod +x deploy.sh
./deploy.sh

# Le script gère automatiquement base vide ou pleine
```

---

## 🎯 Résumé

**L'erreur "relation user n'existe pas" signifie :**
- Soit la base de données est vide (première installation)
- Soit les tables ont des noms différents
- Soit problème de connexion PostgreSQL

**Solution :**
1. ✅ Utiliser le script `DIAGNOSTIC-DB-REDHAT.sh`
2. ✅ Suivre ses recommandations
3. ✅ Lancer `./deploy.sh` qui gère tous les cas

**Vos données sont protégées dans tous les cas !** 🛡️

Le script `deploy.sh` crée les tables si elles n'existent pas, ou préserve les données si elles existent.

