# Fix : Logs Historiques Disparus 🔍

## Problème Rencontré

Les anciens logs d'audit n'apparaissaient plus dans l'interface web (`http://localhost:3001/dashboard/logs`), donnant l'impression qu'ils avaient été supprimés.

## Diagnostic

### ✅ Les données PERSISTENT dans la base de données

```sql
-- Vérification dans PostgreSQL
SELECT COUNT(*) FROM "AuditLog";
-- Résultat: 46 logs présents

SELECT DATE(timestamp) as date, COUNT(*) as count 
FROM "AuditLog" 
GROUP BY DATE(timestamp) 
ORDER BY date DESC;
-- Résultat:
--    date    | count 
-- -----------+-------
--  2025-10-09 |     2
--  2025-10-03 |     1
--  2025-10-01 |    43
```

### ❌ Problème : Filtre par défaut trop restrictif

L'API `/api/logs` avait un **filtre par défaut de 24 heures** qui masquait tous les logs plus anciens.

**Code problématique** (`app/api/logs/route.ts` lignes 45-52) :
```typescript
} else {
  // Par défaut, afficher les logs des 24 dernières heures
  const last24Hours = new Date()
  last24Hours.setHours(last24Hours.getHours() - 24)
  where.timestamp = {
    gte: last24Hours
  }
}
```

**Impact** :
- Les logs du 1er, 3 et 9 octobre n'apparaissaient pas le 13 octobre
- L'utilisateur pensait que les données avaient été perdues
- En réalité, elles étaient simplement filtrées

## Solution Implémentée

### 1. Augmentation de la période par défaut

**Avant** : 24 heures  
**Après** : 30 jours

```typescript
} else {
  // Par défaut, afficher les logs des 30 derniers jours
  // Pour afficher tous les logs, ne pas envoyer de paramètres dateFrom/dateTo
  const last30Days = new Date()
  last30Days.setDate(last30Days.getDate() - 30)
  where.timestamp = {
    gte: last30Days
  }
}
```

### 2. Amélioration du composant logs-panel.tsx

**Changements** :
- ✅ Augmentation de la limite de chargement : `limit=1000` (au lieu de 10)
- ✅ Support des filtres de dates dans l'URL de l'API
- ✅ Rechargement automatique des logs quand les dates changent
- ✅ Suppression du double filtrage par date (API + client)

**Code ajouté** :
```typescript
const loadLogs = async () => {
  try {
    // Construire l'URL avec les paramètres de date si définis
    let url = '/api/logs?limit=1000'
    
    if (startDate) {
      url += `&dateFrom=${startDate}`
    }
    if (endDate) {
      url += `&dateTo=${endDate}`
    }
    
    const response = await fetch(url)
    // ...
  }
}

// Recharger les logs quand les dates changent
useEffect(() => {
  loadLogs()
}, [startDate, endDate])
```

## Résultats

### ✅ Avant (problème)
- Logs visibles : 0 (filtre de 24h)
- Logs dans la DB : 46
- Période affichée : 24 dernières heures

### ✅ Après (solution)
- Logs visibles : 46 (tous les logs des 30 derniers jours)
- Logs dans la DB : 46
- Période affichée : 30 derniers jours par défaut

### Test de l'API

```bash
# Vérifier la base de données
psql "postgresql://mohamed@localhost:5432/stock_management" \
  -c "SELECT COUNT(*) FROM \"AuditLog\";"
# Résultat: 46

# Tester l'API
curl "http://localhost:3001/api/logs?limit=1000" | jq '.total'
# Résultat: 46
```

## Utilisation

### Dans l'interface web

1. **Ouvrir** : http://localhost:3001/dashboard/logs
2. **Par défaut** : Affiche les logs des **30 derniers jours**
3. **Filtrer par dates** : Utiliser les champs de date pour personnaliser la période
4. **Réinitialiser** : Vider les champs de date pour revenir à 30 jours

### Options de filtrage

- **Sans dates** : 30 derniers jours (par défaut)
- **Avec dateFrom** : Tous les logs depuis cette date
- **Avec dateTo** : Tous les logs jusqu'à cette date
- **Les deux** : Période personnalisée

### Exemples d'API

```bash
# 30 derniers jours (défaut)
GET /api/logs

# Depuis le 1er octobre
GET /api/logs?dateFrom=2025-10-01

# Jusqu'au 9 octobre
GET /api/logs?dateTo=2025-10-09

# Période spécifique
GET /api/logs?dateFrom=2025-10-01&dateTo=2025-10-09

# Avec limite personnalisée
GET /api/logs?limit=500&dateFrom=2025-09-01
```

## Recommandations

### Pour le développement local
- ✅ 30 jours par défaut est suffisant pour la plupart des cas
- ✅ Utiliser les filtres de dates pour des recherches spécifiques
- ✅ La pagination limite à 1000 logs par requête

### Pour la production
- 🔧 Considérer un archivage des logs > 90 jours
- 🔧 Ajouter une option "Tous les logs" dans l'interface
- 🔧 Implémenter une pagination côté serveur pour de grandes quantités
- 🔧 Ajouter des index sur la colonne `timestamp` pour les performances

## Notes Techniques

### Nom de la table
- Schéma Prisma : `model AuditLog` avec `@@map("audit_logs")`
- Table PostgreSQL : `AuditLog` (avec majuscule)
- Requêtes SQL : Utiliser `"AuditLog"` avec guillemets

### Performance
- Filtre par date au niveau de l'API (plus rapide)
- Filtres secondaires (action, module, utilisateur) au niveau du client
- Index recommandé sur `timestamp` pour grandes quantités de logs

## Fichiers Modifiés

1. **app/api/logs/route.ts**
   - Ligne 46-52 : Filtre par défaut passé de 24h à 30 jours

2. **components/dashboard/logs-panel.tsx**
   - Ligne 62 : Augmentation limite à 1000 logs
   - Ligne 65-70 : Ajout paramètres de dates dans l'URL
   - Ligne 30-32 : Rechargement automatique au changement de dates
   - Ligne 116-117 : Suppression double filtrage par date

## Validation

### Checklist
- [x] Les données persistent dans la base de données
- [x] L'API retourne tous les logs des 30 derniers jours
- [x] L'interface affiche les logs correctement
- [x] Les filtres de dates fonctionnent
- [x] Le rechargement automatique fonctionne
- [x] Documentation créée

### Commandes de test

```bash
# Test base de données
psql "postgresql://mohamed@localhost:5432/stock_management" \
  -c "SELECT COUNT(*) FROM \"AuditLog\";"

# Test API
curl -s "http://localhost:3001/api/logs?limit=1000" | jq '.total, .data[0].timestamp'

# Test avec dates
curl -s "http://localhost:3001/api/logs?dateFrom=2025-10-01" | jq '.total'
```

---

**Problème résolu : Les logs historiques sont maintenant visibles !** ✅

La période par défaut de 30 jours permet de voir l'historique récent tout en gardant de bonnes performances.

