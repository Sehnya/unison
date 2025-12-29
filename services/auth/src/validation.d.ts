/**
 * Password requirements
 */
export declare const PASSWORD_REQUIREMENTS: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumber: boolean;
};
/**
 * Validate email format
 */
export declare function isValidEmail(email: string): boolean;
/**
 * Validate password strength
 * Returns null if valid, or an error message if invalid
 */
export declare function validatePassword(password: string): string | null;
/**
 * Validate username
 */
export declare function validateUsername(username: string): string | null;
//# sourceMappingURL=validation.d.ts.map