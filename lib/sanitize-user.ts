// Retire les champs qui ne doivent jamais quitter le serveur avant de renvoyer
// un utilisateur au client : mot de passe, secret TOTP et codes de secours 2FA.
export function sanitizeUser<T extends { password?: unknown; twoFactorSecret?: unknown; twoFactorBackupCodes?: unknown }>(
  user: T,
): Omit<T, "password" | "twoFactorSecret" | "twoFactorBackupCodes"> {
  const { password, twoFactorSecret, twoFactorBackupCodes, ...safeUser } = user
  return safeUser
}
