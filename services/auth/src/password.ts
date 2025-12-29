import argon2 from 'argon2';

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  // Ensure password is a string
  if (typeof password !== 'string') {
    throw new TypeError(`Password must be a string, got ${typeof password}`);
  }
  
  // Ensure password is not empty
  if (!password) {
    throw new Error('Password cannot be empty');
  }
  
  try {
    // Convert to Buffer to ensure proper encoding
    const passwordBuffer = Buffer.from(password, 'utf8');
    
    return await argon2.hash(passwordBuffer, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to hash password: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const passwordBuffer = Buffer.from(password, 'utf8');
    return await argon2.verify(hash, passwordBuffer);
  } catch {
    return false;
  }
}
