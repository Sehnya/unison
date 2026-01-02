import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  getCachedMiniProfile,
  setCachedMiniProfile,
  invalidateMiniProfile,
  clearMiniProfileCache,
  getCacheSize,
  isCached,
  getRawCacheEntry,
  CACHE_TTL_MS,
  type MiniProfileData,
} from './miniProfileCache';

/**
 * Property 5: Cache Validity
 * 
 * For any cached mini-profile entry with timestamp T and cache duration D (5 minutes),
 * a request at time R SHALL return cached data if R < T + D, otherwise SHALL indicate cache miss.
 * 
 * **Validates: Requirements 5.1, 5.2**
 */
describe('miniProfileCache - Property 5: Cache Validity', () => {
  // Clear cache before each test
  beforeEach(() => {
    clearMiniProfileCache();
  });

  // Arbitrary for generating valid user IDs
  const userIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);

  // Arbitrary for generating valid MiniProfileData
  const miniProfileDataArb = fc.record({
    userId: userIdArb,
    username: fc.string({ minLength: 1, maxLength: 32 }),
    avatar: fc.option(fc.webUrl(), { nil: null }),
    bio: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
    backgroundImage: fc.option(fc.webUrl(), { nil: null }),
    usernameFont: fc.option(fc.constantFrom('Inter', 'Roboto', 'Open Sans', 'Lato'), { nil: null }),
    textColor: fc.option(
      fc.array(fc.constantFrom(...'0123456789ABCDEFabcdef'.split('')), { minLength: 6, maxLength: 6 })
        .map(chars => '#' + chars.join('')),
      { nil: null }
    ),
    mutualFriends: fc.array(
      fc.record({
        id: userIdArb,
        username: fc.string({ minLength: 1, maxLength: 32 }),
        avatar: fc.option(fc.webUrl(), { nil: null }),
      }),
      { maxLength: 10 }
    ),
  });

  // Arbitrary for timestamps (reasonable range)
  const timestampArb = fc.integer({ min: 1000000000000, max: 2000000000000 });

  it('returns cached data when request time is before expiration (R < T + D)', () => {
    fc.assert(
      fc.property(
        userIdArb,
        miniProfileDataArb,
        timestampArb,
        fc.integer({ min: 0, max: CACHE_TTL_MS - 1 }),
        (userId, profileData, cacheTime, timeDelta) => {
          // Set the userId in the profile data to match
          const data: MiniProfileData = { ...profileData, userId };
          
          // Cache the data at time T
          setCachedMiniProfile(userId, data, cacheTime);
          
          // Request at time R where R < T + D (within TTL)
          const requestTime = cacheTime + timeDelta;
          const result = getCachedMiniProfile(userId, requestTime);
          
          // Should return the cached data
          expect(result).not.toBeNull();
          expect(result).toEqual(data);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null (cache miss) when request time is at or after expiration (R >= T + D)', () => {
    fc.assert(
      fc.property(
        userIdArb,
        miniProfileDataArb,
        timestampArb,
        fc.integer({ min: 0, max: CACHE_TTL_MS * 2 }),
        (userId, profileData, cacheTime, extraTime) => {
          // Set the userId in the profile data to match
          const data: MiniProfileData = { ...profileData, userId };
          
          // Cache the data at time T
          setCachedMiniProfile(userId, data, cacheTime);
          
          // Request at time R where R >= T + D (at or after expiration)
          const requestTime = cacheTime + CACHE_TTL_MS + extraTime;
          const result = getCachedMiniProfile(userId, requestTime);
          
          // Should return null (cache miss)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cache entry has correct expiration time (expiresAt = T + D)', () => {
    fc.assert(
      fc.property(
        userIdArb,
        miniProfileDataArb,
        timestampArb,
        (userId, profileData, cacheTime) => {
          const data: MiniProfileData = { ...profileData, userId };
          
          setCachedMiniProfile(userId, data, cacheTime);
          
          const entry = getRawCacheEntry(userId);
          
          expect(entry).toBeDefined();
          expect(entry!.timestamp).toBe(cacheTime);
          expect(entry!.expiresAt).toBe(cacheTime + CACHE_TTL_MS);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isCached returns true before expiration and false after', () => {
    fc.assert(
      fc.property(
        userIdArb,
        miniProfileDataArb,
        timestampArb,
        (userId, profileData, cacheTime) => {
          const data: MiniProfileData = { ...profileData, userId };
          
          setCachedMiniProfile(userId, data, cacheTime);
          
          // Before expiration
          const beforeExpiry = cacheTime + CACHE_TTL_MS - 1;
          expect(isCached(userId, beforeExpiry)).toBe(true);
          
          // At expiration
          const atExpiry = cacheTime + CACHE_TTL_MS;
          expect(isCached(userId, atExpiry)).toBe(false);
          
          // After expiration
          const afterExpiry = cacheTime + CACHE_TTL_MS + 1;
          expect(isCached(userId, afterExpiry)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalidateMiniProfile removes entry from cache', () => {
    fc.assert(
      fc.property(
        userIdArb,
        miniProfileDataArb,
        timestampArb,
        (userId, profileData, cacheTime) => {
          const data: MiniProfileData = { ...profileData, userId };
          
          setCachedMiniProfile(userId, data, cacheTime);
          expect(isCached(userId, cacheTime)).toBe(true);
          
          const removed = invalidateMiniProfile(userId);
          expect(removed).toBe(true);
          expect(isCached(userId, cacheTime)).toBe(false);
          
          // Invalidating again returns false
          const removedAgain = invalidateMiniProfile(userId);
          expect(removedAgain).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clearMiniProfileCache removes all entries', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(userIdArb, miniProfileDataArb), { minLength: 1, maxLength: 10 }),
        timestampArb,
        (entries, cacheTime) => {
          // Add multiple entries
          for (const [userId, profileData] of entries) {
            const data: MiniProfileData = { ...profileData, userId };
            setCachedMiniProfile(userId, data, cacheTime);
          }
          
          expect(getCacheSize()).toBeGreaterThan(0);
          
          clearMiniProfileCache();
          
          expect(getCacheSize()).toBe(0);
          
          // All entries should be gone
          for (const [userId] of entries) {
            expect(isCached(userId, cacheTime)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cache TTL is exactly 5 minutes (300000ms)', () => {
    expect(CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
