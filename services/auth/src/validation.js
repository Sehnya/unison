/**
 * Email validation regex
 * Matches standard email format
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Password requirements
 */
export const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
};
/**
 * Validate email format
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    return EMAIL_REGEX.test(email.trim());
}
/**
 * Validate password strength
 * Returns null if valid, or an error message if invalid
 */
export function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return 'Password is required';
    }
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        return `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`;
    }
    if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
        return `Password must be at most ${PASSWORD_REQUIREMENTS.maxLength} characters`;
    }
    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    if (PASSWORD_REQUIREMENTS.requireNumber && !/\d/.test(password)) {
        return 'Password must contain at least one number';
    }
    return null;
}
/**
 * Validate username
 */
export function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return 'Username is required';
    }
    const trimmed = username.trim();
    if (trimmed.length < 1) {
        return 'Username is required';
    }
    if (trimmed.length > 32) {
        return 'Username must be at most 32 characters';
    }
    return null;
}
//# sourceMappingURL=validation.js.map