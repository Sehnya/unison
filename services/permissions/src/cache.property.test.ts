/**
 * Property-Based Tests for Permission Cache Consistency
 *
 * Feature: discord-clone-core
 * Property 10: Permission Cache Consistency
 * Validates: Requirements 7.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PermissionCacheService, type RedisClient } from './cache.js';

// Mock Redis client for testing
class MockRedisClient implements RedisClient {
  private store: Map<string, { value: string; expiresAt: number }> = new Map();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<string | null> {
    this.store.set(key, { value, expiresAt: Date.now() + 60000 });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }

  async scan(cursor: string | number, ...args: (string | number)[]): Promise<[string, string[]]> {
    // Simple implementation: return all matching keys in one scan
    const matchIndex = args.indexOf('MATCH');
    const pattern = matchIndex >= 0 ? String(args[matchIndex + 1]) : '*';
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const keys = Array.from(this.store.keys()).filter((k) => regex.test(k));
    return ['0', keys];
  }

  // Helper for tests
  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

// Generators
const snowflakeGen = fc.bigInt({ min: 1n, max: (1n << 63n) - 1n }).map((n) => n.toString());
const permissionBitsetGen = fc.bigInt({ min: 0n, max: (1n << 11n) - 1n });

describe('Property Tests: Permission Cache Consistency', () => {
  /**
   * Property 10: Permission Cache Consistency
   *
   * For any permission-affecting change (role update, role assignment,
   * channel overwrite change), subsequent permission checks SHALL reflect
   * the updated permissions (cache invalidation correctness).
   *
   * Feature: discord-clone-core, Property 10: Permission Cache Consistency
   * Validates: Requirements 7.6
   */
  describe('Property 10: Permission Cache Consistency', () => {
    it('cached value should be retrievable', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          async (guildId, channelId, userId, permissions) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set a value in cache
            await cache.set(guildId, channelId, userId, permissions);

            // Retrieve it
            const cached = await cache.get(guildId, channelId, userId);

            // Should match
            expect(cached).toBe(permissions);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalidateUser should remove all entries for that user in the guild', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          fc.array(snowflakeGen, { minLength: 1, maxLength: 5 }),
          permissionBitsetGen,
          async (guildId, userId, channelIds, permissions) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions for user across multiple channels
            for (const channelId of channelIds) {
              await cache.set(guildId, channelId, userId, permissions);
            }

            // Verify they're cached
            for (const channelId of channelIds) {
              const cached = await cache.get(guildId, channelId, userId);
              expect(cached).toBe(permissions);
            }

            // Invalidate user
            await cache.invalidateUser(guildId, userId);

            // All entries should be gone
            for (const channelId of channelIds) {
              const cached = await cache.get(guildId, channelId, userId);
              expect(cached).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalidateGuild should remove all entries for that guild', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          fc.array(snowflakeGen, { minLength: 1, maxLength: 3 }),
          fc.array(snowflakeGen, { minLength: 1, maxLength: 3 }),
          permissionBitsetGen,
          async (guildId, channelIds, userIds, permissions) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions for multiple users across multiple channels
            for (const channelId of channelIds) {
              for (const userId of userIds) {
                await cache.set(guildId, channelId, userId, permissions);
              }
            }

            // Invalidate guild
            await cache.invalidateGuild(guildId);

            // All entries should be gone
            for (const channelId of channelIds) {
              for (const userId of userIds) {
                const cached = await cache.get(guildId, channelId, userId);
                expect(cached).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalidateChannel should remove all entries for that channel', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          fc.array(snowflakeGen, { minLength: 1, maxLength: 5 }),
          permissionBitsetGen,
          async (guildId, channelId, userIds, permissions) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions for multiple users in the channel
            for (const userId of userIds) {
              await cache.set(guildId, channelId, userId, permissions);
            }

            // Invalidate channel
            await cache.invalidateChannel(guildId, channelId);

            // All entries should be gone
            for (const userId of userIds) {
              const cached = await cache.get(guildId, channelId, userId);
              expect(cached).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('role.updated event should invalidate entire guild', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          fc.array(snowflakeGen, { minLength: 1, maxLength: 3 }),
          fc.array(snowflakeGen, { minLength: 1, maxLength: 3 }),
          permissionBitsetGen,
          async (guildId, channelIds, userIds, permissions) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions
            for (const channelId of channelIds) {
              for (const userId of userIds) {
                await cache.set(guildId, channelId, userId, permissions);
              }
            }

            // Trigger role.updated event
            await cache.invalidateByEvent('role.updated', guildId);

            // All entries should be gone
            for (const channelId of channelIds) {
              for (const userId of userIds) {
                const cached = await cache.get(guildId, channelId, userId);
                expect(cached).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('role.deleted event should invalidate entire guild', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          fc.array(snowflakeGen, { minLength: 1, maxLength: 3 }),
          fc.array(snowflakeGen, { minLength: 1, maxLength: 3 }),
          permissionBitsetGen,
          async (guildId, channelIds, userIds, permissions) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions
            for (const channelId of channelIds) {
              for (const userId of userIds) {
                await cache.set(guildId, channelId, userId, permissions);
              }
            }

            // Trigger role.deleted event
            await cache.invalidateByEvent('role.deleted', guildId);

            // All entries should be gone
            for (const channelId of channelIds) {
              for (const userId of userIds) {
                const cached = await cache.get(guildId, channelId, userId);
                expect(cached).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('member_roles.updated event should invalidate only that user', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          async (guildId, channelId, userId1, userId2, permissions) => {
            // Ensure different users
            fc.pre(userId1 !== userId2);

            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions for both users
            await cache.set(guildId, channelId, userId1, permissions);
            await cache.set(guildId, channelId, userId2, permissions);

            // Trigger member_roles.updated for user1
            await cache.invalidateByEvent('member_roles.updated', guildId, undefined, userId1);

            // User1's cache should be gone
            const cached1 = await cache.get(guildId, channelId, userId1);
            expect(cached1).toBeNull();

            // User2's cache should still exist
            const cached2 = await cache.get(guildId, channelId, userId2);
            expect(cached2).toBe(permissions);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('channel_overwrite.updated event should invalidate only that channel', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          async (guildId, channelId1, channelId2, userId, permissions) => {
            // Ensure different channels
            fc.pre(channelId1 !== channelId2);

            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions for user in both channels
            await cache.set(guildId, channelId1, userId, permissions);
            await cache.set(guildId, channelId2, userId, permissions);

            // Trigger channel_overwrite.updated for channel1
            await cache.invalidateByEvent('channel_overwrite.updated', guildId, channelId1);

            // Channel1's cache should be gone
            const cached1 = await cache.get(guildId, channelId1, userId);
            expect(cached1).toBeNull();

            // Channel2's cache should still exist
            const cached2 = await cache.get(guildId, channelId2, userId);
            expect(cached2).toBe(permissions);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('member.removed event should invalidate only that user', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          async (guildId, channelId, userId1, userId2, permissions) => {
            // Ensure different users
            fc.pre(userId1 !== userId2);

            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions for both users
            await cache.set(guildId, channelId, userId1, permissions);
            await cache.set(guildId, channelId, userId2, permissions);

            // Trigger member.removed for user1
            await cache.invalidateByEvent('member.removed', guildId, undefined, userId1);

            // User1's cache should be gone
            const cached1 = await cache.get(guildId, channelId, userId1);
            expect(cached1).toBeNull();

            // User2's cache should still exist
            const cached2 = await cache.get(guildId, channelId, userId2);
            expect(cached2).toBe(permissions);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('invalidation should not affect other guilds', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          async (guildId1, guildId2, channelId, userId, permissions) => {
            // Ensure different guilds
            fc.pre(guildId1 !== guildId2);

            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set permissions in both guilds
            await cache.set(guildId1, channelId, userId, permissions);
            await cache.set(guildId2, channelId, userId, permissions);

            // Invalidate guild1
            await cache.invalidateGuild(guildId1);

            // Guild1's cache should be gone
            const cached1 = await cache.get(guildId1, channelId, userId);
            expect(cached1).toBeNull();

            // Guild2's cache should still exist
            const cached2 = await cache.get(guildId2, channelId, userId);
            expect(cached2).toBe(permissions);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cache miss should return null', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          async (guildId, channelId, userId) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Don't set anything, just try to get
            const cached = await cache.get(guildId, channelId, userId);
            expect(cached).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('setting new value should overwrite old value', () => {
      fc.assert(
        fc.asyncProperty(
          snowflakeGen,
          snowflakeGen,
          snowflakeGen,
          permissionBitsetGen,
          permissionBitsetGen,
          async (guildId, channelId, userId, permissions1, permissions2) => {
            const redis = new MockRedisClient();
            const cache = new PermissionCacheService(redis, { ttl: 60 });

            // Set first value
            await cache.set(guildId, channelId, userId, permissions1);

            // Set second value
            await cache.set(guildId, channelId, userId, permissions2);

            // Should get second value
            const cached = await cache.get(guildId, channelId, userId);
            expect(cached).toBe(permissions2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
