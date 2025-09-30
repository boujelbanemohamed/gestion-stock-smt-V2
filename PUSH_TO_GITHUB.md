# 🚀 Pousser le code vers GitHub

## ✅ Configuration Git (Déjà fait)

Le dépôt Git a été initialisé et configuré pour pointer vers :
**https://github.com/boujelbanemohamed/gestion-stock-smt-V2**

## 📤 Pousser le code

### Pour la première fois

\`\`\`bash
# Pousser le code vers GitHub
git push -u origin main
\`\`\`

**Note** : Vous devrez peut-être vous authentifier avec GitHub. Il y a deux options :

### Option 1 : Utiliser un Personal Access Token (Recommandé)

1. Allez sur GitHub.com
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. Generate new token
4. Cochez `repo` (Full control of private repositories)
5. Générez et copiez le token

Puis lors du push :
\`\`\`bash
Username: boujelbanemohamed
Password: [Collez votre Personal Access Token]
\`\`\`

### Option 2 : Utiliser SSH

\`\`\`bash
# Générer une clé SSH (si vous n'en avez pas)
ssh-keygen -t ed25519 -C "votre-email@example.com"

# Copier la clé publique
cat ~/.ssh/id_ed25519.pub

# Ajouter la clé à GitHub :
# GitHub.com → Settings → SSH and GPG keys → New SSH key

# Changer l'URL du remote pour SSH
git remote set-url origin git@github.com:boujelbanemohamed/gestion-stock-smt-V2.git

# Puis push
git push -u origin main
\`\`\`

---

## 🔄 Workflow quotidien

### Après avoir fait des modifications

\`\`\`bash
# 1. Voir les fichiers modifiés
git status

# 2. Ajouter les fichiers modifiés
git add .
# ou fichiers spécifiques
git add app/dashboard/page.tsx

# 3. Commit avec un message descriptif
git commit -m "feat: ajout de la fonctionnalité X"

# 4. Pousser vers GitHub
git push
\`\`\`

### Messages de commit conventionnels

\`\`\`bash
git commit -m "feat: nouvelle fonctionnalité"
git commit -m "fix: correction de bug"
git commit -m "docs: mise à jour documentation"
git commit -m "style: formatage du code"
git commit -m "refactor: refactorisation"
git commit -m "test: ajout de tests"
git commit -m "chore: tâches de maintenance"
\`\`\`

---

## 📂 Branches

### Créer une nouvelle branche pour une fonctionnalité

\`\`\`bash
# Créer et basculer sur une nouvelle branche
git checkout -b feature/nouvelle-fonctionnalite

# Faire vos modifications...
git add .
git commit -m "feat: nouvelle fonctionnalité"

# Pousser la branche
git push -u origin feature/nouvelle-fonctionnalite

# Sur GitHub, créer une Pull Request pour merger dans main
\`\`\`

### Revenir à la branche main

\`\`\`bash
git checkout main
git pull  # Récupérer les dernières modifications
\`\`\`

---

## 🔍 Vérifier l'état

\`\`\`bash
# Voir les fichiers modifiés
git status

# Voir l'historique des commits
git log --oneline

# Voir les branches
git branch -a

# Voir les remotes
git remote -v
\`\`\`

---

## ⚠️ Fichiers ignorés

Le fichier `.gitignore` est configuré pour **NE PAS** pousser :
- ❌ `node_modules/`
- ❌ `.env` (secrets)
- ❌ `.env.local` (config locale)
- ❌ `.env.production.local` (secrets production)
- ❌ `.next/` (build)
- ❌ Logs

✅ Les fichiers `.env.production` (template) et `.env.local` (exemple) sont ignorés pour la sécurité.

---

## 🔐 Sécurité - IMPORTANT

### ⚠️ Ne JAMAIS pousser :
- Mots de passe réels
- Clés API
- Secrets de production
- Fichiers `.env` avec des vraies valeurs

### ✅ Pousser uniquement :
- Code source
- Templates de configuration (`.env.example`)
- Documentation
- Scripts

---

## 🚀 Déployer en production

Une fois le code sur GitHub, sur votre serveur Red Hat :

\`\`\`bash
# Le script de déploiement va automatiquement cloner depuis GitHub
cd /tmp/deployment
./deploy.sh

# Ou pour mettre à jour :
cd /var/www/stock-management
git pull origin main
npm install
npm run build
pm2 restart stock-management
\`\`\`

---

## 📋 Checklist première push

- [ ] `.gitignore` configuré
- [ ] `.env` n'est PAS dans Git (vérifié avec `git status`)
- [ ] README.md complet
- [ ] Documentation à jour
- [ ] Code testé localement
- [ ] Authentification GitHub configurée (Token ou SSH)
- [ ] `git push -u origin main` exécuté
- [ ] Vérification sur GitHub.com que tout est là

---

## 💡 Astuces

### Annuler le dernier commit (avant push)

\`\`\`bash
git reset --soft HEAD~1
\`\`\`

### Voir les différences avant commit

\`\`\`bash
git diff
\`\`\`

### Ignorer un fichier après l'avoir déjà commité

\`\`\`bash
git rm --cached fichier-a-ignorer
# Puis ajouter dans .gitignore
echo "fichier-a-ignorer" >> .gitignore
git commit -m "chore: ignore fichier sensible"
\`\`\`

---

**Votre code est prêt à être poussé vers GitHub !** 🎉

Exécutez simplement : `git push -u origin main`
