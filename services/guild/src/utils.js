/**
 * Guild Service Utilities
 */
import { randomBytes } from 'crypto';
/**
 * Characters used for invite codes
 * Excludes ambiguous characters (0, O, I, l)
 */
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
/**
 * Default invite code length
 */
const INVITE_CODE_LENGTH = 8;
/**
 * Generate a random invite code
 */
export function generateInviteCode(length = INVITE_CODE_LENGTH) {
    const bytes = randomBytes(length);
    let code = '';
    for (let i = 0; i < length; i++) {
        code += INVITE_CODE_CHARS[bytes[i] % INVITE_CODE_CHARS.length];
    }
    return code;
}
//# sourceMappingURL=utils.js.map