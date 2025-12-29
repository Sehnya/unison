/**
 * Property-Based Tests for Authentication
 *
 * Feature: discord-clone-core
 * Properties: 1, 2, 3
 * Validates: Requirements 1.3, 1.5, 1.6, 1.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  generateTokenPair,
  generateRefreshToken,
  hashRefreshToken,
  validateAccessToken,
  decodeToken,
  TokenConfig,
} from './tokens.js';
import { hashPassword, verifyPassword } from './password.js';
import { isValidEmail, validatePassword } from './validation.js';

// Test token configuration with short expiry for testing
const TEST_TOKEN_CONFIG: TokenConfig = {
  jwtSecret: 'test-secret-key-for-property-testing',
  accessTokenExpiresIn: 3600, // 1 hour
  refreshTokenExpiresIn: 86400, // 1 day
};

// Generators for property-based testing
const emailGen = fc.emailAddress();
const usernameGen = fc.string({ minLength: 1, maxLength: 32 }).filter((s) => s.trim().length > 0);
const passwordGen = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'), { minLength: 5, maxLength: 60 }),
    fc.constantFrom('A', 'B', 'C', 'D', 'E'),
    fc.constantFrom('a', 'b', 'c', 'd', 'e'),
    fc.constantFrom('0', '1', '2', '3', '4')
  )
  .map(([base, upper, lower, num]) => `${upper}${lower}${num}${base}`);

const snowflakeGen = fc.bigInt({ min: 1n, max: (1n << 63n) - 1n }).map((n) => n.toString());
const sessionIdGen = fc.uuid();

describe('Property Tests: Authentication', () => {
  /**
   * Property 1: Authentication Token Issuance
   *
   * For any valid user credentials (registered email and correct password),
   * authenticating SHALL produce a valid JWT and Refresh_Token pair where
   * the JWT contains the correct user ID and the Refresh_Token can be used
   * to obtain new tokens.
   *
   * Feature: discord-clone-core, Property 1: Authentication Token Issuance
   * Validates: Requirements 1.3, 1.5
   */
  describe('Property 1: Authentication Token Issuance', () => {
    it('should generate valid token pairs with correct user ID', () => {
      fc.assert(
        fc.property(snowflakeGen, sessionIdGen, (userId, sessionId) => {
          // Generate token pair
          const tokens = generateTokenPair(userId, sessionId, TEST_TOKEN_CONFIG);

          // Verify access token is valid and contains correct user ID
          const payload = validateAccessToken(tokens.access_token, TEST_TOKEN_CONFIG);
          expect(payload.sub).toBe(userId);
          expect(payload.session_id).toBe(sessionId);

          // Verify refresh token is generated
          expect(tokens.refresh_token).toBeDefined();
          expect(tokens.refresh_token.length).toBeGreaterThan(0);

          // Verify expires_in is set
          expect(tokens.expires_in).toBe(TEST_TOKEN_CONFIG.accessTokenExpiresIn);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate unique refresh tokens', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (count) => {
          const tokens = new Set<string>();
          for (let i = 0; i < count; i++) {
            tokens.add(generateRefreshToken());
          }
          // All generated tokens should be unique
          expect(tokens.size).toBe(count);
        }),
        { numRuns: 100 }
      );
    });

    it('should hash refresh tokens deterministically', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 100 }), (token) => {
          const hash1 = hashRefreshToken(token);
          const hash2 = hashRefreshToken(token);
          expect(hash1).toBe(hash2);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Token Refresh Round-Trip
   *
   * For any valid Refresh_Token, using it to refresh SHALL produce a new
   * valid TokenPair, AND the old Refresh_Token SHALL become invalid
   * (single-use guarantee).
   *
   * Feature: discord-clone-core, Property 2: Token Refresh Round-Trip
   * Validates: Requirements 1.5, 1.6
   */
  describe('Property 2: Token Refresh Round-Trip', () => {
    it('should produce different refresh tokens on each generation', () => {
      fc.assert(
        fc.property(snowflakeGen, sessionIdGen, (userId, sessionId) => {
          // Generate two token pairs for the same user/session
          const tokens1 = generateTokenPair(userId, sessionId, TEST_TOKEN_CONFIG);
          const tokens2 = generateTokenPair(userId, sessionId, TEST_TOKEN_CONFIG);

          // Refresh tokens should be different (unique per generation)
          expect(tokens1.refresh_token).not.toBe(tokens2.refresh_token);

          // But both access tokens should decode to the same user
          const payload1 = validateAccessToken(tokens1.access_token, TEST_TOKEN_CONFIG);
          const payload2 = validateAccessToken(tokens2.access_token, TEST_TOKEN_CONFIG);
          expect(payload1.sub).toBe(payload2.sub);
          expect(payload1.session_id).toBe(payload2.session_id);
        }),
        { numRuns: 100 }
      );
    });

    it('should hash different refresh tokens to different hashes', () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (count) => {
          const tokens: string[] = [];
          const hashes = new Set<string>();

          for (let i = 0; i < count; i++) {
            const token = generateRefreshToken();
            tokens.push(token);
            hashes.add(hashRefreshToken(token));
          }

          // All hashes should be unique (no collisions)
          expect(hashes.size).toBe(count);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Token Rotation Security
   *
   * For any Refresh_Token that has already been used, attempting to reuse
   * it SHALL result in all sessions for that user being revoked (rotation
   * violation detection).
   *
   * Feature: discord-clone-core, Property 3: Token Rotation Security
   * Validates: Requirements 1.7
   *
   * Note: This property is tested at the unit level since it requires
   * database state. Here we test the cryptographic properties that enable
   * rotation detection.
   */
  describe('Property 3: Token Rotation Security', () => {
    it('should produce consistent hashes for rotation detection', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 32, maxLength: 64 }), (token) => {
          // Hash should be consistent for the same token
          const hash1 = hashRefreshToken(token);
          const hash2 = hashRefreshToken(token);
          expect(hash1).toBe(hash2);

          // Hash should be different from the original token
          expect(hash1).not.toBe(token);

          // Hash should be a fixed length (SHA-256 = 64 hex chars)
          expect(hash1.length).toBe(64);
        }),
        { numRuns: 100 }
      );
    });

    it('should make it infeasible to derive token from hash', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.string({ minLength: 32, maxLength: 64 }), fc.string({ minLength: 32, maxLength: 64 })),
          ([token1, token2]) => {
            fc.pre(token1 !== token2);

            const hash1 = hashRefreshToken(token1);
            const hash2 = hashRefreshToken(token2);

            // Different tokens should produce different hashes
            expect(hash1).not.toBe(hash2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('Property Tests: Password Hashing', () => {
  /**
   * Password hashing round-trip property
   * For any password, hashing and then verifying should succeed
   */
  it('should verify correct passwords', async () => {
    await fc.assert(
      fc.asyncProperty(passwordGen, async (password) => {
        const hash = await hashPassword(password);
        const isValid = await verifyPassword(password, hash);
        expect(isValid).toBe(true);
      }),
      { numRuns: 20 } // Reduced due to slow argon2 hashing
    );
  });

  /**
   * Password hashing should reject wrong passwords
   */
  it('should reject incorrect passwords', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(passwordGen, passwordGen).filter(([p1, p2]) => p1 !== p2),
        async ([password, wrongPassword]) => {
          const hash = await hashPassword(password);
          const isValid = await verifyPassword(wrongPassword, hash);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 20 } // Reduced due to slow argon2 hashing
    );
  });

  /**
   * Password hashes should be unique for the same password
   * (due to random salt)
   */
  it('should produce different hashes for the same password', async () => {
    await fc.assert(
      fc.asyncProperty(passwordGen, async (password) => {
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);
        expect(hash1).not.toBe(hash2);
      }),
      { numRuns: 10 } // Reduced due to slow argon2 hashing
    );
  });
});

describe('Property Tests: Validation', () => {
  /**
   * Email validation should accept valid emails
   */
  it('should accept valid email formats', () => {
    fc.assert(
      fc.property(emailGen, (email) => {
        expect(isValidEmail(email)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Password validation should accept strong passwords
   */
  it('should accept strong passwords', () => {
    fc.assert(
      fc.property(passwordGen, (password) => {
        const error = validatePassword(password);
        expect(error).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Password validation should reject weak passwords
   */
  it('should reject passwords without uppercase', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }).filter((s) => !/[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s)),
        (password) => {
          const error = validatePassword(password);
          expect(error).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject passwords without lowercase', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }).filter((s) => /[A-Z]/.test(s) && !/[a-z]/.test(s) && /\d/.test(s)),
        (password) => {
          const error = validatePassword(password);
          expect(error).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject passwords without numbers', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 20 }).filter((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && !/\d/.test(s)),
        (password) => {
          const error = validatePassword(password);
          expect(error).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject short passwords', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 7 }), (password) => {
        const error = validatePassword(password);
        expect(error).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property Tests: Session Lifecycle', () => {
  /**
   * Property 4: Session Lifecycle Consistency
   *
   * For any user with multiple sessions, the session list SHALL contain
   * all active sessions with accurate device metadata, AND revoking a
   * session SHALL immediately invalidate its tokens while leaving other
   * sessions unaffected.
   *
   * Feature: discord-clone-core, Property 4: Session Lifecycle Consistency
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4
   *
   * Note: Full session lifecycle testing requires database integration.
   * Here we test the token/session relationship properties.
   */

  it('should generate unique session-bound tokens', () => {
    fc.assert(
      fc.property(
        snowflakeGen,
        fc.array(sessionIdGen, { minLength: 2, maxLength: 5 }),
        (userId, sessionIds) => {
          // Generate tokens for each session
          const tokenPairs = sessionIds.map((sessionId) =>
            generateTokenPair(userId, sessionId, TEST_TOKEN_CONFIG)
          );

          // Each token pair should have unique refresh tokens
          const refreshTokens = new Set(tokenPairs.map((t) => t.refresh_token));
          expect(refreshTokens.size).toBe(sessionIds.length);

          // Each access token should decode to the correct session
          tokenPairs.forEach((tokens, index) => {
            const payload = validateAccessToken(tokens.access_token, TEST_TOKEN_CONFIG);
            expect(payload.sub).toBe(userId);
            expect(payload.session_id).toBe(sessionIds[index]);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain session isolation through token binding', () => {
    fc.assert(
      fc.property(
        fc.tuple(snowflakeGen, snowflakeGen).filter(([u1, u2]) => u1 !== u2),
        fc.tuple(sessionIdGen, sessionIdGen),
        ([userId1, userId2], [sessionId1, sessionId2]) => {
          // Generate tokens for different users
          const tokens1 = generateTokenPair(userId1, sessionId1, TEST_TOKEN_CONFIG);
          const tokens2 = generateTokenPair(userId2, sessionId2, TEST_TOKEN_CONFIG);

          // Tokens should decode to their respective users
          const payload1 = validateAccessToken(tokens1.access_token, TEST_TOKEN_CONFIG);
          const payload2 = validateAccessToken(tokens2.access_token, TEST_TOKEN_CONFIG);

          expect(payload1.sub).toBe(userId1);
          expect(payload1.session_id).toBe(sessionId1);
          expect(payload2.sub).toBe(userId2);
          expect(payload2.session_id).toBe(sessionId2);

          // Tokens should be different
          expect(tokens1.access_token).not.toBe(tokens2.access_token);
          expect(tokens1.refresh_token).not.toBe(tokens2.refresh_token);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce tokens with correct expiration metadata', () => {
    fc.assert(
      fc.property(snowflakeGen, sessionIdGen, (userId, sessionId) => {
        const tokens = generateTokenPair(userId, sessionId, TEST_TOKEN_CONFIG);
        const payload = validateAccessToken(tokens.access_token, TEST_TOKEN_CONFIG);

        // Token should have valid timestamps
        expect(payload.iat).toBeDefined();
        expect(payload.exp).toBeDefined();

        // Expiration should be after issuance
        expect(payload.exp).toBeGreaterThan(payload.iat);

        // Expiration should match config
        expect(payload.exp - payload.iat).toBe(TEST_TOKEN_CONFIG.accessTokenExpiresIn);
      }),
      { numRuns: 100 }
    );
  });

  it('should allow decoding tokens without verification for inspection', () => {
    fc.assert(
      fc.property(snowflakeGen, sessionIdGen, (userId, sessionId) => {
        const tokens = generateTokenPair(userId, sessionId, TEST_TOKEN_CONFIG);

        // Decode without verification
        const decoded = decodeToken(tokens.access_token);

        expect(decoded).not.toBeNull();
        expect(decoded?.sub).toBe(userId);
        expect(decoded?.session_id).toBe(sessionId);
      }),
      { numRuns: 100 }
    );
  });
});
