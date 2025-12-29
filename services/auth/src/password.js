import * as argon2 from 'argon2';
/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password) {
    return argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
    });
}
/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
    try {
        return await argon2.verify(hash, password);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=password.js.map