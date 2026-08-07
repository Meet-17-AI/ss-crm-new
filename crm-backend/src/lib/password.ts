import { compare, hash } from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

// Rows written before password hashing was introduced still hold the plaintext
// password. Those are compared directly and upgraded on the next successful
// login so nobody is locked out mid-migration.
const isHashed = (stored: string): boolean => /^\$2[aby]\$/.test(stored);

export const hashPassword = (plain: string): Promise<string> => hash(plain, BCRYPT_ROUNDS);

export const verifyPassword = async (plain: string, stored: string | null | undefined): Promise<boolean> => {
  if (!plain || !stored) return false;
  if (isHashed(stored)) return compare(plain, stored);
  return stored === plain;
};

export const needsRehash = (stored: string | null | undefined): boolean => !!stored && !isHashed(stored);

// Replaces a legacy plaintext password with its hash. Never throws — a failed
// upgrade must not turn an otherwise valid login into an error.
export const upgradeLegacyPassword = async (
  pool: { query: (text: string, values: any[]) => Promise<any> },
  userId: number | string,
  plain: string
): Promise<void> => {
  try {
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [await hashPassword(plain), userId]);
    console.log(`🔐 Upgraded legacy plaintext password to bcrypt for user id ${userId}`);
  } catch (error) {
    console.error('Failed to upgrade legacy password:', error);
  }
};
