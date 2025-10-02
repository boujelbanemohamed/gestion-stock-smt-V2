# Guide des Bordereaux de Mouvement

Ce guide explique comment utiliser et tester les bordereaux de mouvement dans l'application Stock Management.

## 📋 Vue d'ensemble

Les bordereaux de mouvement permettent de générer des documents imprimables pour tracer les mouvements de stock. Ils incluent toutes les informations nécessaires pour un suivi professionnel.

## 🎯 Fonctionnalités

### 1. Bordereau Multiple
- **Accès** : Page Mouvements → Bouton "Imprimer Bordereau"
- **Contenu** : Tous les mouvements de la liste actuelle
- **Format** : Tableau avec tous les mouvements

### 2. Bordereau Individuel
- **Accès** : Page Mouvements → Icône imprimante sur une ligne
- **Contenu** : Un mouvement spécifique
- **Format** : Détails complets d'un mouvement

## 📄 Structure du Bordereau

### En-tête
```
Société Monétique Tunisie
Bordereau de Mouvements de Stock

Généré le [date/heure]
Bon de mouvement généré par : [Nom Prénom]
Total: X mouvement(s)
```

### Contenu Principal
- **Tableau des mouvements** avec colonnes :
  - Date et Heure
  - Carte
  - Type
  - De (emplacement source)
  - Vers/Adresse (destination)
  - Quantité
  - Motif
  - Bon de mouvement généré par

### Section Destinataire
```
Destinataire :

Nom :                    Prénom :
________________        ________________

Fonction :              Date :
________________        ________________

                                    Signature :
```

### Pied de Page
```
Adresse : Centre urbain Nord, Sana Center, bloc C – 1082, Tunis
```

## 🧪 Tests et Validation

### Test Automatique
```bash
# Exécuter le script de test des bordereaux
./deployment/test-bordereaux.sh
```

### Test Manuel
1. **Accéder à la page** : `http://localhost:3000/dashboard/movements`
2. **Se connecter** avec un compte administrateur
3. **Tester le bordereau multiple** :
   - Cliquer sur "Imprimer Bordereau"
   - Vérifier l'en-tête "Société Monétique Tunisie"
   - Vérifier la section destinataire formatée
   - Vérifier le pied de page avec l'adresse
4. **Tester le bordereau individuel** :
   - Cliquer sur l'icône imprimante d'une ligne
   - Vérifier le même format

### Éléments à Vérifier

#### ✅ En-tête
- [ ] "Société Monétique Tunisie" en titre principal
- [ ] "Bordereau de Mouvements de Stock" en sous-titre
- [ ] Date et heure de génération
- [ ] "Bon de mouvement généré par : [Nom Prénom]"

#### ✅ Contenu
- [ ] Tableau avec toutes les colonnes
- [ ] Données des mouvements correctes
- [ ] Formatage cohérent

#### ✅ Section Destinataire
- [ ] Titre "Destinataire :"
- [ ] Champs : Nom, Prénom, Fonction, Date
- [ ] Lignes de saisie élégantes (pas de tableau)
- [ ] Zone de signature

#### ✅ Pied de Page
- [ ] Adresse complète : "Centre urbain Nord, Sana Center, bloc C – 1082, Tunis"
- [ ] Absence du texte "Document généré automatiquement..."

## 🔧 Dépannage

### Problème : Bordereau vide
**Cause** : Aucun mouvement dans la base de données
**Solution** :
1. Créer des mouvements via l'interface
2. Ou utiliser les scripts d'import CSV

### Problème : Informations utilisateur manquantes
**Cause** : Utilisateur non connecté ou données manquantes
**Solution** :
1. Se connecter avec un compte valide
2. Vérifier que l'utilisateur a un nom et prénom

### Problème : Format d'impression incorrect
**Cause** : Paramètres d'impression du navigateur
**Solution** :
1. Utiliser Chrome/Firefox
2. Activer "Plus d'outils" → "Impression"
3. Ajuster les marges et l'échelle

## 📊 Données Requises

Pour que les bordereaux fonctionnent correctement, l'application doit avoir :

- **Mouvements** : Au moins un mouvement dans la base de données
- **Utilisateurs** : Utilisateurs avec nom et prénom
- **Cartes** : Cartes associées aux mouvements
- **Emplacements** : Emplacements pour les mouvements
- **Banques** : Banques pour les adresses de destination

## 🎨 Personnalisation

### Modifier l'en-tête
Éditer le fichier : `components/dashboard/movements-management.tsx`
```javascript
<h1>Société Monétique Tunisie</h1>
<h2>Bordereau de Mouvements de Stock</h2>
```

### Modifier l'adresse
Éditer la section footer dans le même fichier :
```javascript
<p>Adresse : Centre urbain Nord, Sana Center, bloc C – 1082, Tunis</p>
```

### Modifier la section destinataire
Ajuster les champs dans la section destinataire :
```javascript
<div style="display: flex; flex-wrap: wrap; gap: 30px;">
  <div style="flex: 1; min-width: 200px;">
    <p>Nom :</p>
    <div style="border-bottom: 2px solid #1e293b;"></div>
  </div>
  // ... autres champs
</div>
```

## 📱 Compatibilité

- **Navigateurs** : Chrome, Firefox, Safari, Edge
- **Impression** : Format A4 recommandé
- **Résolution** : Optimisé pour l'impression

---

**Note** : Les bordereaux sont générés côté client et utilisent les données de l'application en temps réel.
