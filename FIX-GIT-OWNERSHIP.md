# Solution: Erreur "Propriétaire Douteux" Git

**Problème:** `fatal: detected dubious ownership in repository`

---

## 🔧 Solution Rapide (Sur le Serveur Red Hat)

### Étape 1: Se Connecter et Naviguer

```bash
# Se connecter au serveur
ssh votre-utilisateur@votre-serveur-redhat

# Aller dans le répertoire du projet
cd /var/www/stock-management
```

### Étape 2: Ajouter le Répertoire comme Sûr

```bash
# Ajouter le répertoire actuel comme safe.directory
git config --global --add safe.directory $(pwd)

# Ou avec le chemin complet:
git config --global --add safe.directory /var/www/stock-management
```

### Étape 3: Vérifier et Tester

```bash
# Vérifier que c'est bien ajouté
git config --global --list | grep safe.directory

# Tester Git
git status

# Faire le pull
git pull origin main
```

---

## 🔍 Diagnostic du Problème

```bash
# 1. Vérifier qui vous êtes
whoami

# 2. Vérifier le propriétaire du répertoire
ls -ld /var/www/stock-management

# 3. Vérifier le propriétaire du .git
ls -ld /var/www/stock-management/.git
```

---

## 💡 Solutions Alternatives

### Option A: Changer le Propriétaire (Avec sudo)

```bash
# Voir votre nom d'utilisateur
whoami

# Changer le propriétaire du répertoire complet
sudo chown -R $(whoami):$(whoami) /var/www/stock-management

# Vérifier
ls -ld /var/www/stock-management

# Tester
git pull origin main
```

### Option B: Utiliser sudo (Temporaire)

```bash
# Utiliser sudo pour le pull (non recommandé)
sudo git config --global --add safe.directory /var/www/stock-management
sudo -u votre-utilisateur git pull origin main
```

---

## 📋 Exemple Complet de Résolution

```bash
# 1. Connexion
ssh admin@192.168.1.100

# 2. Navigation
cd /var/www/stock-management

# 3. Diagnostic
whoami
# Sortie: admin

ls -ld /var/www/stock-management
# Sortie: drwxr-xr-x 10 root root 4096 Jan 10 14:30 /var/www/stock-management
# ⚠️ Propriétaire = root, mais vous êtes = admin

# 4. Solution A: Ajouter comme safe.directory
git config --global --add safe.directory /var/www/stock-management

# OU Solution B: Changer le propriétaire
sudo chown -R admin:admin /var/www/stock-management

# 5. Test
git pull origin main
# ✅ Devrait fonctionner maintenant
```

---

## 🔄 Intégration dans le Script deploy.sh

Le script `deploy.sh` a été mis à jour pour gérer automatiquement ce problème.

Au début du script, ajoutez:

```bash
# Vérifier et ajouter le répertoire comme sûr si nécessaire
REPO_DIR=$(pwd)
if ! git config --global --get-all safe.directory | grep -q "^${REPO_DIR}$"; then
    echo "ℹ Ajout du répertoire comme safe.directory..."
    git config --global --add safe.directory "$REPO_DIR"
    echo "✓ Répertoire ajouté"
fi
```

---

## ✅ Vérification Finale

Après avoir appliqué la solution:

```bash
# 1. Vérifier la configuration Git
git config --global --list | grep safe.directory
# Devrait afficher: safe.directory=/var/www/stock-management

# 2. Tester Git
git status
# Devrait afficher l'état sans erreur

# 3. Faire le pull
git pull origin main
# Devrait fonctionner normalement

# 4. Continuer avec le déploiement
./deploy.sh
```

---

## 🆘 Si Ça Ne Fonctionne Toujours Pas

### Vérifier les Permissions Détaillées

```bash
# Permissions du répertoire
stat /var/www/stock-management

# Permissions du .git
stat /var/www/stock-management/.git

# Tous les fichiers
ls -la /var/www/stock-management
```

### Réinitialiser Complètement

```bash
# Supprimer toutes les entrées safe.directory
git config --global --unset-all safe.directory

# Ajouter uniquement celle-ci
git config --global --add safe.directory /var/www/stock-management

# Ou désactiver complètement la vérification (non recommandé)
git config --global safe.directory '*'
```

---

## 📝 Résumé

**Commande Principale:**

```bash
git config --global --add safe.directory /var/www/stock-management
```

**Vérification:**

```bash
git pull origin main
```

**Si ça marche:**

```bash
./deploy.sh
```

---

*Guide créé pour résoudre l'erreur de propriétaire Git sur Red Hat*
