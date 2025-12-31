/**
 * Redis Cache Implementation
 * 
 * Connects to Railway Redis instance for caching messages and other data.
 */

import { Redis } from 'ioredis';
import type { CacheOptions, MessageCache, ChannelMessagesCache } from './types.js';

// Singleton instance
let redisInstance: RedisCache | null = null;

/**
 * Redis Cache class
 */
export class RedisCache {
  private client: Redis;
  private keyPrefix: string;
  private defaultTTL: number;
  private connected: boolean = false;

  constructor(options: CacheOptions = {}) {
    const url = options.url || process.env.REDIS_URL;
    
    if (!url) {
      console.warn('⚠️  REDIS_URL not configured - cache will be disabled');
      // Create a dummy client that won't connect
      this.client = new Redis({ lazyConnect: true });
      this.keyPrefix = options.keyPrefix || 'discord:';
      this.defaultTTL = options.defaultTTL || 300; // 5 minutes default
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
    });

    this.keyPrefix = options.keyPrefix || 'discord:';
    this.defaultTTL = options.defaultTTL || 300; // 5 minutes default

    this.client.on('connect', () => {
      console.log('🔄 Redis connecting...');
    });

    this.client.on('ready', () => {
      this.connected = true;
      console.log('✓ Redis connected and ready');
      console.log(`  └─ Host: ${this.client.options.host || 'from URL'}`);
      console.log(`  └─ Key prefix: ${this.keyPrefix}`);
      console.log(`  └─ Default TTL: ${this.defaultTTL}s`);
    });

    this.client.on('error', (err: Error) => {
      console.error('✗ Redis error:', err.message);
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
      console.log('⚠️  Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Build a cache key with prefix
   */
  private key(parts: string[]): string {
    return this.keyPrefix + parts.join(':');
  }

  // ============================================
  // Message Caching
  // ============================================

  /**
   * Cache messages for a channel
   */
  async cacheChannelMessages(
    channelId: string,
    messages: MessageCache[],
    ttl?: number
  ): Promise<void> {
    if (!this.connected) {
      console.log('⚠️  Redis not connected, skipping cache write');
      return;
    }

    try {
      const key = this.key(['channel', channelId, 'messages']);
      const data: ChannelMessagesCache = {
        messages,
        cachedAt: Date.now(),
      };
      await this.client.setex(key, ttl || this.defaultTTL, JSON.stringify(data));
      console.log(`📦 Cached ${messages.length} messages for channel ${channelId} (TTL: ${ttl || this.defaultTTL}s)`);
    } catch (err) {
      console.warn('Failed to cache messages:', err);
    }
  }

  /**
   * Get cached messages for a channel
   */
  async getChannelMessages(channelId: string): Promise<MessageCache[] | null> {
    if (!this.connected) {
      console.log('⚠️  Redis not connected, cache miss');
      return null;
    }

    try {
      const key = this.key(['channel', channelId, 'messages']);
      const data = await this.client.get(key);
      if (!data) {
        console.log(`📭 Cache MISS for channel ${channelId} messages`);
        return null;
      }

      const parsed: ChannelMessagesCache = JSON.parse(data);
      const age = Math.round((Date.now() - parsed.cachedAt) / 1000);
      console.log(`📬 Cache HIT for channel ${channelId} (${parsed.messages.length} messages, ${age}s old)`);
      return parsed.messages;
    } catch (err) {
      console.warn('Failed to get cached messages:', err);
      return null;
    }
  }

  /**
   * Invalidate message cache for a channel
   */
  async invalidateChannelMessages(channelId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.key(['channel', channelId, 'messages']);
      await this.client.del(key);
    } catch (err) {
      console.warn('Failed to invalidate message cache:', err);
    }
  }

  /**
   * Add a new message to the channel cache (prepend to maintain order)
   */
  async addMessageToCache(channelId: string, message: MessageCache): Promise<void> {
    if (!this.connected) return;

    try {
      const existing = await this.getChannelMessages(channelId);
      if (existing) {
        // Add new message and keep only last 50
        const updated = [...existing, message].slice(-50);
        await this.cacheChannelMessages(channelId, updated);
        console.log(`➕ Added message ${message.id} to channel ${channelId} cache`);
      }
    } catch (err) {
      console.warn('Failed to add message to cache:', err);
    }
  }

  /**
   * Update a message in the cache
   */
  async updateMessageInCache(
    channelId: string,
    messageId: string,
    updates: Partial<MessageCache>
  ): Promise<void> {
    if (!this.connected) return;

    try {
      const existing = await this.getChannelMessages(channelId);
      if (existing) {
        const updated = existing.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
        await this.cacheChannelMessages(channelId, updated);
      }
    } catch (err) {
      console.warn('Failed to update message in cache:', err);
    }
  }

  /**
   * Remove a message from the cache
   */
  async removeMessageFromCache(channelId: string, messageId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const existing = await this.getChannelMessages(channelId);
      if (existing) {
        const updated = existing.filter((msg) => msg.id !== messageId);
        await this.cacheChannelMessages(channelId, updated);
      }
    } catch (err) {
      console.warn('Failed to remove message from cache:', err);
    }
  }

  // ============================================
  // User Caching
  // ============================================

  /**
   * Cache user data
   */
  async cacheUser(
    userId: string,
    userData: { username: string; avatar?: string | null; username_font?: string | null },
    ttl?: number
  ): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.key(['user', userId]);
      await this.client.setex(key, ttl || 600, JSON.stringify(userData)); // 10 min default for users
      console.log(`👤 Cached user ${userData.username} (${userId})`);
    } catch (err) {
      console.warn('Failed to cache user:', err);
    }
  }

  /**
   * Get cached user data
   */
  async getUser(userId: string): Promise<{ username: string; avatar?: string | null; username_font?: string | null } | null> {
    if (!this.connected) return null;

    try {
      const key = this.key(['user', userId]);
      const data = await this.client.get(key);
      if (!data) {
        console.log(`👤 User cache MISS for ${userId}`);
        return null;
      }
      console.log(`👤 User cache HIT for ${userId}`);
      return JSON.parse(data);
    } catch (err) {
      console.warn('Failed to get cached user:', err);
      return null;
    }
  }

  /**
   * Invalidate user cache
   */
  async invalidateUser(userId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.key(['user', userId]);
      await this.client.del(key);
    } catch (err) {
      console.warn('Failed to invalidate user cache:', err);
    }
  }

  // ============================================
  // Channel Caching
  // ============================================

  /**
   * Cache channel data
   */
  async cacheChannel(channelId: string, channelData: unknown, ttl?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.key(['channel', channelId, 'info']);
      await this.client.setex(key, ttl || 600, JSON.stringify(channelData));
    } catch (err) {
      console.warn('Failed to cache channel:', err);
    }
  }

  /**
   * Get cached channel data
   */
  async getChannel(channelId: string): Promise<unknown | null> {
    if (!this.connected) return null;

    try {
      const key = this.key(['channel', channelId, 'info']);
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      console.warn('Failed to get cached channel:', err);
      return null;
    }
  }

  /**
   * Invalidate channel cache
   */
  async invalidateChannel(channelId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const pattern = this.key(['channel', channelId, '*']);
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      console.warn('Failed to invalidate channel cache:', err);
    }
  }

  // ============================================
  // Generic Operations
  // ============================================

  /**
   * Set a value with optional TTL
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const fullKey = this.key([key]);
      if (ttl) {
        await this.client.setex(fullKey, ttl, JSON.stringify(value));
      } else {
        await this.client.set(fullKey, JSON.stringify(value));
      }
    } catch (err) {
      console.warn('Failed to set cache:', err);
    }
  }

  /**
   * Get a value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    try {
      const fullKey = this.key([key]);
      const data = await this.client.get(fullKey);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err) {
      console.warn('Failed to get cache:', err);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      const fullKey = this.key([key]);
      await this.client.del(fullKey);
    } catch (err) {
      console.warn('Failed to delete cache:', err);
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
    }
  }
}

/**
 * Create a new Redis cache instance
 */
export function createRedisCache(options?: CacheOptions): RedisCache {
  redisInstance = new RedisCache(options);
  return redisInstance;
}

/**
 * Get the singleton Redis cache instance
 */
export function getRedisCache(): RedisCache | null {
  return redisInstance;
}
