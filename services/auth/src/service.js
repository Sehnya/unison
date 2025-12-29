import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { AuthRepository } from './repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { generateTokenPair, generateRefreshToken, hashRefreshToken, validateAccessToken, DEFAULT_TOKEN_CONFIG, } from './tokens.js';
import { isValidEmail, validatePassword, validateUsername } from './validation.js';
import { InvalidCredentialsError, EmailAlreadyExistsError, InvalidEmailFormatError, WeakPasswordError, RefreshTokenInvalidError, SessionNotFoundError, UserNotFoundError, } from './errors.js';
/**
 * Auth Service - Handles user authentication and session management
 */
export class AuthService {
    repository;
    snowflake;
    tokenConfig;
    constructor(pool, config = {}) {
        this.repository = new AuthRepository(pool);
        this.snowflake = new SnowflakeGenerator(config.workerId ?? 0);
        this.tokenConfig = config.tokenConfig ?? DEFAULT_TOKEN_CONFIG;
    }
    /**
     * Register a new user
     * Requirements: 1.1, 1.2
     */
    async register(email, password, username, deviceInfo) {
        // Validate email format
        if (!isValidEmail(email)) {
            throw new InvalidEmailFormatError();
        }
        // Validate password strength
        const passwordError = validatePassword(password);
        if (passwordError) {
            throw new WeakPasswordError(passwordError);
        }
        // Validate username
        const usernameError = validateUsername(username);
        if (usernameError) {
            throw new WeakPasswordError(usernameError); // Reusing for validation errors
        }
        // Check if email already exists
        const emailExists = await this.repository.emailExists(email);
        if (emailExists) {
            throw new EmailAlreadyExistsError();
        }
        // Hash password
        const passwordHash = await hashPassword(password);
        // Generate Snowflake ID
        const userId = this.snowflake.generate();
        // Create user
        const user = await this.repository.createUser(userId, email, username, passwordHash);
        // Generate tokens and create session
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const session = await this.repository.createSession(userId, refreshTokenHash, deviceInfo);
        const tokens = generateTokenPair(userId, session.id, this.tokenConfig);
        // Replace the generated refresh token with our own
        tokens.refresh_token = refreshToken;
        return { user, tokens, session };
    }
    /**
     * Login with email and password
     * Requirements: 1.3, 1.4, 2.1
     */
    async login(email, password, deviceInfo) {
        // Find user by email
        const userWithPassword = await this.repository.findUserByEmail(email);
        if (!userWithPassword) {
            // Don't reveal whether email exists
            throw new InvalidCredentialsError();
        }
        // Verify password
        const isValid = await verifyPassword(password, userWithPassword.password_hash);
        if (!isValid) {
            throw new InvalidCredentialsError();
        }
        // Create session
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const session = await this.repository.createSession(userWithPassword.id, refreshTokenHash, deviceInfo);
        // Generate tokens
        const tokens = generateTokenPair(userWithPassword.id, session.id, this.tokenConfig);
        tokens.refresh_token = refreshToken;
        // Remove password_hash from user object
        const { password_hash: _, ...user } = userWithPassword;
        return {
            user,
            tokens,
            sessionId: session.id,
        };
    }
    /**
     * Refresh tokens using a refresh token
     * Requirements: 1.5, 1.6, 1.7
     */
    async refreshTokens(refreshToken) {
        // Hash the provided refresh token
        const refreshTokenHash = hashRefreshToken(refreshToken);
        // Check if this token was previously used (rotation violation)
        const usedToken = await this.repository.findUsedRefreshToken(refreshTokenHash);
        if (usedToken) {
            // Rotation violation detected - revoke all sessions for the user
            await this.handleRotationViolation(usedToken.user_id);
            throw new RefreshTokenInvalidError();
        }
        // Find session by refresh token hash
        const session = await this.repository.findSessionByRefreshTokenHash(refreshTokenHash);
        if (!session) {
            // Token not found - invalid token
            throw new RefreshTokenInvalidError();
        }
        // Store the current token as used before rotating
        await this.repository.storeUsedRefreshToken(session.id, refreshTokenHash, session.user_id);
        // Generate new refresh token (rotation)
        const newRefreshToken = generateRefreshToken();
        const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
        // Update session with new refresh token
        const updatedSession = await this.repository.updateSessionRefreshToken(session.id, newRefreshTokenHash);
        if (!updatedSession) {
            throw new RefreshTokenInvalidError();
        }
        // Generate new token pair
        const tokens = generateTokenPair(session.user_id, session.id, this.tokenConfig);
        tokens.refresh_token = newRefreshToken;
        return tokens;
    }
    /**
     * Detect and handle refresh token rotation violation
     * Requirements: 1.7
     * This is called when a refresh token is reused after being rotated
     */
    async handleRotationViolation(userId) {
        // Revoke all sessions for the user
        await this.repository.deleteAllUserSessions(userId);
        // Clean up used refresh tokens
        await this.repository.deleteUsedRefreshTokensForUser(userId);
    }
    /**
     * Validate an access token
     */
    validateToken(token) {
        return validateAccessToken(token, this.tokenConfig);
    }
    /**
     * Logout - invalidate current session
     * Requirements: 2.4
     */
    async logout(sessionId) {
        const deleted = await this.repository.deleteSession(sessionId);
        if (!deleted) {
            throw new SessionNotFoundError();
        }
    }
    /**
     * Get all sessions for a user
     * Requirements: 2.2
     */
    async getSessions(userId) {
        return this.repository.getSessionsByUserId(userId);
    }
    /**
     * Revoke a specific session
     * Requirements: 2.3
     */
    async revokeSession(userId, sessionId) {
        // Verify session belongs to user
        const session = await this.repository.findSessionById(sessionId);
        if (!session || session.user_id !== userId) {
            throw new SessionNotFoundError();
        }
        await this.repository.deleteSession(sessionId);
    }
    /**
     * Revoke all sessions for a user
     */
    async revokeAllSessions(userId) {
        return this.repository.deleteAllUserSessions(userId);
    }
    /**
     * Get user by ID
     */
    async getUserById(userId) {
        const user = await this.repository.findUserById(userId);
        if (!user) {
            throw new UserNotFoundError();
        }
        return user;
    }
    /**
     * Get session by ID
     */
    async getSessionById(sessionId) {
        const session = await this.repository.findSessionById(sessionId);
        if (!session) {
            throw new SessionNotFoundError();
        }
        return session;
    }
}
//# sourceMappingURL=service.js.map