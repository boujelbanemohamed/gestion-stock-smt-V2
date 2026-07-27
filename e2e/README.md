# Tests end-to-end (Playwright)

Contrairement à la suite `npm test` (Vitest), qui mocke Prisma et `fetch`,
ces tests pilotent un vrai navigateur contre une vraie instance de
l'application connectée à une **vraie base de données PostgreSQL**. Ils
valident des parcours complets (connexion, création d'un mouvement,
verrouillage de compte) tels qu'un utilisateur les vivrait réellement.

## ⚠️ Ne jamais utiliser la base de production

Ces tests créent, modifient et suppriment des données. Utilisez impérativement
une base de données **dédiée aux tests**, distincte de celle configurée dans
votre `.env` habituel.

## Installation (une seule fois)

```bash
npx playwright install chromium
```

## Configuration

1. Créez une base de données PostgreSQL dédiée, par exemple :
   ```bash
   createdb gestion_stock_e2e
   ```
2. Créez un fichier `.env.test` (ou exportez temporairement `DATABASE_URL`
   dans votre shell) pointant vers cette base :
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/gestion_stock_e2e?schema=public"
   JWT_SECRET="un-secret-de-test-quelconque-32-caracteres-minimum"
   JWT_REFRESH_SECRET="un-autre-secret-de-test-32-caracteres-minimum"
   ```
3. Appliquez le schéma et semez les données de test :
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/gestion_stock_e2e?schema=public" npx prisma db push
   DATABASE_URL="postgresql://user:password@localhost:5432/gestion_stock_e2e?schema=public" npm run db:seed
   ```
   Le seed crée notamment les comptes `admin@monetique.tn` / `manager@monetique.tn`
   / `user@monetique.tn`, tous avec le mot de passe `password123`.

## Exécution

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/gestion_stock_e2e?schema=public" npm run test:e2e
```

Playwright démarre automatiquement `npm run dev` sur le port 3010 (configurable
via `PLAYWRIGHT_PORT`) s'il n'est pas déjà lancé, exécute les specs, puis
génère un rapport HTML (`playwright-report/index.html`, ouvrez-le avec
`npx playwright show-report`).

Pour piloter les tests pas à pas avec l'interface graphique de Playwright :

```bash
npm run test:e2e:ui
```

## Organisation

- `global-setup.ts` : s'authentifie **une seule fois** pour toute la suite
  (via l'API, sans passer par le formulaire) et sauvegarde la session dans
  `.auth/admin.json`, réutilisée par la plupart des specs.
- `helpers.ts` : identifiants de test et fonction `login()` (pour les specs
  qui doivent explicitement passer par le formulaire de connexion).
- `db.ts` : accès Prisma direct à la base de test, utilisé uniquement par
  `account-lockout.spec.ts` pour préparer/nettoyer un état sans consommer de
  requêtes HTTP.
- `login.spec.ts`, `logout.spec.ts`, `movement.spec.ts`, `account-lockout.spec.ts` :
  les parcours testés.

## ⚠️ Le rate limiter de /api/auth/login (5 requêtes / 15 min / IP)

`/api/auth/login` est volontairement limité à 5 requêtes par IP toutes les
15 minutes (protection anti-bruteforce). Toute la suite e2e a été conçue pour
rester largement sous ce quota (une poignée de vraies requêtes de connexion
au total, le reste réutilise la session partagée). Si vous ajoutez de
nouveaux tests qui appellent `login()` ou soumettent le formulaire de
connexion, gardez ce budget à l'esprit — sinon vous verrez des échecs 429
qui n'ont rien à voir avec un vrai bug de l'application. En cas de doute
pendant le développement, redémarrer le serveur Next.js réinitialise le
compteur (stocké en mémoire, pas en base).
