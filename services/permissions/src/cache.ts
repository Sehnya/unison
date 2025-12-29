/**
 * Permission Cache Service
 *
 * Implements Redis-based caching for computed permissions.
 * Requirements: 7.3, 7.4, 7.5, 7.6
 */

import type { Snowflake } from '@discord-clone/types';

/**
 * Redis client interface (compatible with ioredis)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: string | number, ...args: (string | number)[]): Promise<[string, string[]]>;
}

/**
 * Cache configuration
 */
export interface PermissionCacheConfig {
  /** TTL in seconds for cached permissions (default: 60) */
  ttl?: number;
  /** Key prefix for permission cache entries */
  keyPrefix?: string;
}

const DEFAULT_CONFIG: Required<PermissionCacheConfig> = {
  ttl: 60,
  keyPrefix: 'permissions',
};

/**
 * Permission Cache Service
 *
 * Cache key format: permissions:{guild_id}:{channel_id}:{user_id}
 */
export class PermissionCacheService {
  private readonly config: Required<PermissionCacheConfig>;

  constructor(
    private readonly redis: RedisClient,
    config: PermissionCacheConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build cache key for permissions
   */
  private buildKey(guildId: Snowflake, channelId: Snowflake, userId: Snowflake): string {
    return `${this.config.keyPrefix}:${guildId}:${channelId}:${userId}`;
  }

  /**
   * Get cached permissions
   * Requirements: 7.3, 7.4
   */
  async get(
    guildId: Snowflake,
    channelId: Snowflake,
    userId: Snowflake
  ): Promise<bigint | null> {
    const key = this.buildKey(guildId, channelId, userId);
    const value = await this.redis.get(key);
    if (value === null) {
      return null;
    }
    return BigInt(value);
  }

  /**
   * Set cached permissions with TTL
   * Requirements: 7.5
   */
  async set(
    guildId: Snowflake,
    channelId: Snowflake,
    userId: Snowflake,
    permissions: bigint
  ): Promise<void> {
    const key = this.buildKey(guildId, channelId, userId);
    await this.redis.setex(key, this.config.ttl, permissions.toString());
  }

  /**
   * Invalidate cached permissions for a specific user in a guild
   * Requirements: 7.6
   */
  async invalidateUser(guildId: Snowflake, userId: Snowflake): Promise<void> {
    const pattern = `${this.config.keyPrefix}:${guildId}:*:${userId}`;
    await this.deleteByPattern(pattern);
  }

  /**
   * Invalidate all cached permissions for a guild
   * Requirements: 7.6
   */
  async invalidateGuild(guildId: Snowflake): Promise<void> {
    const pattern = `${this.config.keyPrefix}:${guildId}:*`;
    await this.deleteByPattern(pattern);
  }

  /**
   * Invalidate all cached permissions for a channel
   * Requirements: 7.6
   */
  async invalidateChannel(guildId: Snowflake, channelId: Snowflake): Promise<void> {
    const pattern = `${this.config.keyPrefix}:${guildId}:${channelId}:*`;
    await this.deleteByPattern(pattern);
  }

  /**
   * Invalidate cache based on event type
   * Requirements: 7.6
   *
   * Event types and their invalidation scope:
   * - role.updated: All entries for the guild
   * - role.deleted: All entries for the guild
   * - member_roles.updated: Specific user in guild
   * - channel_overwrite.updated: All entries for the channel
   * - channel_overwrite.deleted: All entries for the channel
   * - member.removed/banned: Specific user in guild
   */
  async invalidateByEvent(
    eventType: string,
    guildId: Snowflake,
    channelId?: Snowflake,
    userId?: Snowflake
  ): Promise<void> {
    switch (eventType) {
      case 'role.updated':
      case 'role.deleted':
      case 'role.created':
        // Role changes affect all users in the guild
        await this.invalidateGuild(guildId);
        break;

      case 'member_roles.updated':
      case 'member.removed':
      case 'member.banned':
        // Member-specific changes
        if (userId) {
          await this.invalidateUser(guildId, userId);
        }
        break;

      case 'channel_overwrite.updated':
      case 'channel_overwrite.deleted':
        // Channel overwrite changes affect all users in that channel
        if (channelId) {
          await this.invalidateChannel(guildId, channelId);
        }
        break;

      default:
        // Unknown event type, invalidate entire guild to be safe
        await this.invalidateGuild(guildId);
    }
  }

  /**
   * Delete all keys matching a pattern using SCAN
   */
  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }
}
