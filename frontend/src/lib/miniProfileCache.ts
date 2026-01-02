/**
 * Mini-Profile Cache System
 * Provides in-memory caching for mini-profile data with TTL-based expiration.
 * 
 * Requirements: 5.1, 5.2
 */

import type { MutualFriend } from './miniProfileUtils';

/**
 * Mini-profile data structure returned from the API
 */
export interface MiniProfileData {
  userId: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  backgroundImage: string | null;
  usernameFont: string | null;
  textColor: string | null;
  mutualFriends: MutualFriend[];
}

/**
 * Cache entry structure with timestamp tracking
 */
export interface CachedMiniProfile {
  data: MiniProfileData;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache duration in milliseconds (5 minutes)
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * In-memory cache storage
 */
const cache = new Map<string, CachedMiniProfile>();

/**
 * Gets the current timestamp. Exported for testing purposes.
 */
export function getCurrentTime(): number {
  return Date.now();
}

/**
 * Retrieves a mini-profile from the cache if it exists and hasn't expired.
 * 
 * @param userId - The user ID to look up
 * @param currentTime - Optional current time for testing (defaults to Date.now())
 * @returns The cached MiniProfileData if valid, or null if not found/expired
 * 
 * Requirements: 5.1, 5.2
 */
export function getCachedMiniProfile(
  userId: string,
  currentTime: number = getCurrentTime()
): MiniProfileData | null {
  const entry = cache.get(userId);
  
  if (!entry) {
    return null;
  }
  
  // Check if cache entry has expired
  if (currentTime >= entry.expiresAt) {
    // Remove expired entry
    cache.delete(userId);
    return null;
  }
  
  return entry.data;
}

/**
 * Stores a mini-profile in the cache with TTL-based expiration.
 * 
 * @param userId - The user ID to cache
 * @param data - The mini-profile data to cache
 * @param currentTime - Optional current time for testing (defaults to Date.now())
 * 
 * Requirements: 5.1
 */
export function setCachedMiniProfile(
  userId: string,
  data: MiniProfileData,
  currentTime: number = getCurrentTime()
): void {
  const entry: CachedMiniProfile = {
    data,
    timestamp: currentTime,
    expiresAt: currentTime + CACHE_TTL_MS,
  };
  
  cache.set(userId, entry);
}

/**
 * Invalidates (removes) a specific mini-profile from the cache.
 * 
 * @param userId - The user ID to invalidate
 * @returns true if an entry was removed, false if no entry existed
 */
export function invalidateMiniProfile(userId: string): boolean {
  return cache.delete(userId);
}

/**
 * Clears all entries from the cache.
 */
export function clearMiniProfileCache(): void {
  cache.clear();
}

/**
 * Gets the number of entries currently in the cache.
 * Useful for testing and debugging.
 */
export function getCacheSize(): number {
  return cache.size;
}

/**
 * Checks if a cache entry exists and is valid (not expired).
 * 
 * @param userId - The user ID to check
 * @param currentTime - Optional current time for testing (defaults to Date.now())
 * @returns true if a valid cache entry exists
 */
export function isCached(
  userId: string,
  currentTime: number = getCurrentTime()
): boolean {
  return getCachedMiniProfile(userId, currentTime) !== null;
}

/**
 * Gets the raw cache entry for testing purposes.
 * 
 * @param userId - The user ID to look up
 * @returns The raw CachedMiniProfile entry or undefined
 */
export function getRawCacheEntry(userId: string): CachedMiniProfile | undefined {
  return cache.get(userId);
}
