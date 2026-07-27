import { PrismaClient } from "@prisma/client"

// Accès direct à la base de données de test depuis les specs Playwright
// (process Node, pas le navigateur) : utilisé uniquement pour préparer/
// nettoyer un état qu'il serait coûteux ou risqué de provoquer via de
// nombreuses requêtes HTTP réelles (ex. verrouillage de compte, qui partage
// son quota de requêtes avec le rate limiter de /api/auth/login).
export const prisma = new PrismaClient()
