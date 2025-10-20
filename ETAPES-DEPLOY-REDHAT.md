# Étapes de Déploiement RedHat - Guide Simple 🚀

## ⚠️ INFORMATION IMPORTANTE

**Votre base de données contient déjà des données réelles.**  
Le script `deploy.sh` est conçu pour **PRÉSERVER toutes vos données existantes**.

---

## 📋 ÉTAPES UNE PAR UNE

### **ÉTAPE 1** : Ouvrir un Terminal et Se Connecter au Serveur

```bash
# Depuis votre Mac
ssh utilisateur@adresse-serveur-redhat
```

**Remplacez :**
- `utilisateur` par votre nom d'utilisateur (ex: root, admin)
- `adresse-serveur-redhat` par l'IP ou le domaine (ex: 192.168.1.100)

**✅ Vous êtes connecté quand vous voyez :**
```
[utilisateur@serveur ~]$
```

---

### **ÉTAPE 2** : Aller dans le Répertoire du Projet

```bash
cd /chemin/vers/stock-management-V2
```

**Chemins possibles :**
- `/var/www/stock-management-V2`
- `/home/app/stock-management-V2`
- `/opt/stock-management-V2`

**✅ Vérification :**
```bash
pwd
# Doit afficher le bon chemin

ls
# Doit afficher : deploy.sh, package.json, app/, components/, etc.
```

---

### **ÉTAPE 3** : Backup Manuel de Sécurité (RECOMMANDÉ)

```bash
# Créer un backup de vos données actuelles
pg_dump -U postgres stock_management > backup_securite_$(date +%Y%m%d_%H%M%S).sql

# Vérifier que le backup est créé
ls -lh backup_securite_*.sql
```

**✅ Vous devez voir :** Un fichier de plusieurs Mo (exemple: 2.4M)

**Important :** Ce backup est votre **filet de sécurité**.

---

### **ÉTAPE 4** : Noter vos Données Actuelles (RECOMMANDÉ)

```bash
# Compter vos données actuelles
psql -U postgres stock_management -c "
SELECT 'Users' as type, COUNT(*) FROM \"User\"
UNION ALL SELECT 'Banks', COUNT(*) FROM \"Bank\"
UNION ALL SELECT 'Cards', COUNT(*) FROM \"Card\"
UNION ALL SELECT 'Movements', COUNT(*) FROM \"Movement\"
UNION ALL SELECT 'AuditLogs', COUNT(*) FROM \"AuditLog\";
"
```

**✅ Notez ces chiffres** (exemple) :
```
  type     | count 
-----------+-------
 Users     |    15
 Banks     |     7
 Cards     |    43
 Movements |   128
 AuditLogs |   250
```

---

### **ÉTAPE 5** : Lancer le Déploiement

```bash
# Rendre le script exécutable
chmod +x deploy.sh

# LANCER LE DÉPLOIEMENT
./deploy.sh
```

**⏱️ Durée : 2-3 minutes**

---

### **ÉTAPE 6** : Surveiller le Déploiement

Le script affichera la progression :

```
========================================
🚀 Déploiement Stock Management SMT V2
========================================

0️⃣ Vérification de la sécurité Git...
✓ Répertoire déjà configuré comme sûr

1️⃣ Vérification de la branche...
✓ Branche: main
ℹ Commit actuel sauvegardé pour rollback: abc123f

2️⃣ Sauvegarde de la base de données...
✓ Backup créé: backup_20251020_150500.sql (2.4M)

3️⃣ Récupération des modifications depuis GitHub...
✓ Fetch effectué

4️⃣ Pull depuis origin/main...
✓ Commit actuel: 7510a7b

5️⃣ Installation des dépendances...
✓ Dépendances installées

6️⃣ Configuration Prisma...
✓ Client Prisma généré
✓ Base de données déjà synchronisée

7️⃣ Vérification et configuration du fichier .env...
✓ NODE_ENV=production configuré dans .env

8️⃣ Nettoyage du cache Next.js...
✓ Cache nettoyé

9️⃣ Build de l'application en mode PRODUCTION...
✓ Build terminé avec succès

🔟 Redémarrage du service...
✓ Application redémarrée avec PM2 en mode PRODUCTION

1️⃣1️⃣ Vérifications post-déploiement...
✓ Application accessible sur http://localhost:3000
✓ API logs fonctionnelle - 250 entrées trouvées
✓ API notifications fonctionnelle
✓ API users fonctionnelle
✓ API banks fonctionnelle
✓ Table AuditLog: 250 entrées
✓ Table Notification: 5 entrées
✓ Toutes les tables principales présentes (10/10)

========================================
✅ Déploiement terminé avec succès !
========================================
```

**✅ Attendez de voir "✅ Déploiement terminé avec succès !"**

---

### **ÉTAPE 7** : Vérifier que les Données Sont Toujours Là

```bash
# Recompter les données
psql -U postgres stock_management -c "
SELECT 'Users' as type, COUNT(*) FROM \"User\"
UNION ALL SELECT 'Banks', COUNT(*) FROM \"Bank\"
UNION ALL SELECT 'Cards', COUNT(*) FROM \"Card\"
UNION ALL SELECT 'Movements', COUNT(*) FROM \"Movement\"
UNION ALL SELECT 'AuditLogs', COUNT(*) FROM \"AuditLog\";
"
```

**✅ Comparez avec l'ÉTAPE 4 :**
- Les chiffres doivent être **identiques** (ou légèrement supérieurs)
- **Aucune perte de données**

---

### **ÉTAPE 8** : Tester dans le Navigateur

```
# Ouvrir votre navigateur
http://votre-domaine.com
ou
http://adresse-ip-serveur
```

**Tests à faire :**

**1. Connexion**
```
✓ Connectez-vous avec vos identifiants
✓ Vérifiez que vous voyez le dashboard
```

**2. Vérifier les Banques**
```
Menu → Banques
✓ Toutes vos banques sont là ?
✓ Nombre correct ?
```

**3. Vérifier les Cartes**
```
Menu → Cartes
✓ Toutes vos cartes sont là ?
✓ Nombre correct ?

→ Cliquer "Ajouter une carte"
✓ Placeholder Sous-type : "ex. Nationale" ?
✓ Placeholder Sous-sous-type : "ex. Nom de la carte" ?
✓ Seuil max : 100000 ?
```

**4. Vérifier les Mouvements**
```
Menu → Mouvements
✓ Tout l'historique est là ?
```

**5. Vérifier les Logs**
```
Menu → Logs d'audit
✓ Logs visibles (30 jours) ?
✓ Nombre cohérent ?
```

**6. Vérifier les Notifications**
```
Icône 🔔 en haut à droite
✓ Badge avec nombre ?
✓ Liste des notifications ?
```

---

### **ÉTAPE 9** : Vérifier les Logs PM2

```bash
# Voir les 50 dernières lignes
pm2 logs stock-management --lines 50

# Vérifier qu'il n'y a PAS d'erreurs (lignes rouges)
```

**✅ Bon signe :** Seulement des requêtes normales (GET /api/...)

---

### **ÉTAPE 10** : Test Final

```bash
# Créer une nouvelle carte de test via l'interface
# Vérifier qu'elle a bien maxThreshold = 100000

# Ou via API
curl -X POST http://localhost:3000/api/cards \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Carte",
    "type": "Visa",
    "subType": "Nationale",
    "subSubType": "Test Card Name",
    "bankId": "votre-bank-id"
  }'

# Vérifier le seuil max
curl http://localhost:3000/api/cards | jq '.data[] | select(.name=="Test Carte") | .maxThreshold'

# Attendu: 100000
```

---

## 🎉 DÉPLOIEMENT RÉUSSI !

Si toutes les étapes sont ✅ :

**Votre serveur RedHat a maintenant :**
- ✅ Toutes vos données existantes (PRÉSERVÉES)
- ✅ Logs d'audit visibles sur 30 jours
- ✅ Système de notifications fonctionnel
- ✅ Modal carte avec nouveaux seuils (min: 50, max: 100000)
- ✅ Bordereaux avec nom + adresse banque
- ✅ Protection rollback pour futurs déploiements

---

## 🆘 EN CAS DE PROBLÈME

### Le Déploiement a Échoué

**Le rollback automatique restaure tout :**
```
⚠️ ROLLBACK TERMINÉ
✓ Application restaurée à la version précédente
✓ Vos données sont intactes
```

### Des Données Semblent Manquer

**1. Vérifier dans la DB directement**
```bash
psql -U postgres stock_management -c "SELECT COUNT(*) FROM \"Card\";"
```

**2. Vérifier les filtres dans l'interface**
- Les logs : filtre 30 jours (modifier les dates pour voir plus ancien)
- Les cartes : vérifier qu'aucun filtre n'est actif

**3. Restaurer depuis backup si vraiment nécessaire**
```bash
pm2 stop stock-management
psql -U postgres stock_management < backup_securite_xxx.sql
pm2 start stock-management
```

---

## 📞 Support

**Guides disponibles sur le serveur :**

```bash
cat DEPLOY-WITH-EXISTING-DATA.md  # Guide complet données existantes
cat DEPLOY-NOW.md                 # Guide déploiement rapide
cat ROLLBACK-GUIDE.md             # Guide rollback
cat UPDATE-REDHAT-README.md       # Guide mise à jour détaillé
```

**Tests automatiques :**
```bash
./test-logs-production.sh  # Test complet du système
```

---

## ✨ Résumé en 3 Commandes

```bash
# 1. Connexion
ssh utilisateur@serveur-redhat

# 2. Navigation + Déploiement
cd /chemin/vers/stock-management-V2 && ./deploy.sh

# 3. Vérification
pm2 status && curl http://localhost:3000/api/users | jq '.data | length'
```

**Vos données sont protégées à 100% !** 🛡️

