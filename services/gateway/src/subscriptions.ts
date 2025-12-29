/**
 * Subscription Manager
 * 
 * Manages guild and channel subscriptions using Redis.
 * Requirements: 12.2, 13.1
 */

import { Redis } from 'ioredis';
import type { Snowflake } from '@discord-clone/types';
import type { SubscriptionManager } from './types.js';

/**
 * Redis key prefixes
 */
const KEYS = {
  /** Guild subscribers: guild:{guildId}:subscribers -> Set<connectionId> */
  GUILD_SUBSCRIBERS: (guildId: Snowflake) => `guild:${guildId}:subscribers`,
  /** Channel subscribers: channel:{channelId}:subscribers -> Set<connectionId> */
  CHANNEL_SUBSCRIBERS: (channelId: Snowflake) => `channel:${channelId}:subscribers`,
  /** Connection guilds: connection:{connectionId}:guilds -> Set<guildId> */
  CONNECTION_GUILDS: (connectionId: string) => `connection:${connectionId}:guilds`,
  /** Connection channels: connection:{connectionId}:channels -> Set<channelId> */
  CONNECTION_CHANNELS: (connectionId: string) => `connection:${connectionId}:channels`,
};

/**
 * Redis-based Subscription Manager
 * 
 * Tracks which connections are subscribed to which guilds and channels.
 * Uses Redis Sets for efficient membership operations.
 */
export class RedisSubscriptionManager implements SubscriptionManager {
  private readonly redis: Redis;
  private readonly ttl: number;

  constructor(redisUrl: string, ttl: number = 3600) {
    this.redis = new Redis(redisUrl);
    this.ttl = ttl;
  }

  /**
   * Subscribe connection to a guild
   * Requirements: 12.2
   */
  async subscribeToGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Add connection to guild subscribers
    pipeline.sadd(KEYS.GUILD_SUBSCRIBERS(guildId), connectionId);
    pipeline.expire(KEYS.GUILD_SUBSCRIBERS(guildId), this.ttl);
    
    // Add guild to connection's guilds
    pipeline.sadd(KEYS.CONNECTION_GUILDS(connectionId), guildId);
    pipeline.expire(KEYS.CONNECTION_GUILDS(connectionId), this.ttl);
    
    await pipeline.exec();
  }

  /**
   * Unsubscribe connection from a guild
   * Requirements: 12.2
   */
  async unsubscribeFromGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Remove connection from guild subscribers
    pipeline.srem(KEYS.GUILD_SUBSCRIBERS(guildId), connectionId);
    
    // Remove guild from connection's guilds
    pipeline.srem(KEYS.CONNECTION_GUILDS(connectionId), guildId);
    
    await pipeline.exec();
  }

  /**
   * Subscribe connection to a channel
   * Requirements: 12.2
   */
  async subscribeToChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Add connection to channel subscribers
    pipeline.sadd(KEYS.CHANNEL_SUBSCRIBERS(channelId), connectionId);
    pipeline.expire(KEYS.CHANNEL_SUBSCRIBERS(channelId), this.ttl);
    
    // Add channel to connection's channels
    pipeline.sadd(KEYS.CONNECTION_CHANNELS(connectionId), channelId);
    pipeline.expire(KEYS.CONNECTION_CHANNELS(connectionId), this.ttl);
    
    await pipeline.exec();
  }

  /**
   * Unsubscribe connection from a channel
   * Requirements: 12.2
   */
  async unsubscribeFromChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    // Remove connection from channel subscribers
    pipeline.srem(KEYS.CHANNEL_SUBSCRIBERS(channelId), connectionId);
    
    // Remove channel from connection's channels
    pipeline.srem(KEYS.CONNECTION_CHANNELS(connectionId), channelId);
    
    await pipeline.exec();
  }

  /**
   * Get connections subscribed to a guild
   * Requirements: 13.1
   */
  async getGuildSubscribers(guildId: Snowflake): Promise<string[]> {
    return this.redis.smembers(KEYS.GUILD_SUBSCRIBERS(guildId));
  }

  /**
   * Get connections subscribed to a channel
   * Requirements: 13.1
   */
  async getChannelSubscribers(channelId: Snowflake): Promise<string[]> {
    return this.redis.smembers(KEYS.CHANNEL_SUBSCRIBERS(channelId));
  }

  /**
   * Remove all subscriptions for a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    // Get all guilds and channels the connection is subscribed to
    const [guilds, channels] = await Promise.all([
      this.redis.smembers(KEYS.CONNECTION_GUILDS(connectionId)),
      this.redis.smembers(KEYS.CONNECTION_CHANNELS(connectionId)),
    ]);

    const pipeline = this.redis.pipeline();

    // Remove connection from all guild subscriber sets
    for (const guildId of guilds) {
      pipeline.srem(KEYS.GUILD_SUBSCRIBERS(guildId as Snowflake), connectionId);
    }

    // Remove connection from all channel subscriber sets
    for (const channelId of channels) {
      pipeline.srem(KEYS.CHANNEL_SUBSCRIBERS(channelId as Snowflake), connectionId);
    }

    // Delete connection's guild and channel sets
    pipeline.del(KEYS.CONNECTION_GUILDS(connectionId));
    pipeline.del(KEYS.CONNECTION_CHANNELS(connectionId));

    await pipeline.exec();
  }

  /**
   * Get all guild subscriptions for a connection
   */
  async getConnectionGuilds(connectionId: string): Promise<Snowflake[]> {
    const guilds = await this.redis.smembers(KEYS.CONNECTION_GUILDS(connectionId));
    return guilds as Snowflake[];
  }

  /**
   * Get all channel subscriptions for a connection
   */
  async getConnectionChannels(connectionId: string): Promise<Snowflake[]> {
    const channels = await this.redis.smembers(KEYS.CONNECTION_CHANNELS(connectionId));
    return channels as Snowflake[];
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * In-memory Subscription Manager (for testing)
 */
export class InMemorySubscriptionManager implements SubscriptionManager {
  private readonly guildSubscribers: Map<Snowflake, Set<string>> = new Map();
  private readonly channelSubscribers: Map<Snowflake, Set<string>> = new Map();
  private readonly connectionGuilds: Map<string, Set<Snowflake>> = new Map();
  private readonly connectionChannels: Map<string, Set<Snowflake>> = new Map();

  async subscribeToGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    // Add to guild subscribers
    let subscribers = this.guildSubscribers.get(guildId);
    if (!subscribers) {
      subscribers = new Set();
      this.guildSubscribers.set(guildId, subscribers);
    }
    subscribers.add(connectionId);

    // Add to connection guilds
    let guilds = this.connectionGuilds.get(connectionId);
    if (!guilds) {
      guilds = new Set();
      this.connectionGuilds.set(connectionId, guilds);
    }
    guilds.add(guildId);
  }

  async unsubscribeFromGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    this.guildSubscribers.get(guildId)?.delete(connectionId);
    this.connectionGuilds.get(connectionId)?.delete(guildId);
  }

  async subscribeToChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    // Add to channel subscribers
    let subscribers = this.channelSubscribers.get(channelId);
    if (!subscribers) {
      subscribers = new Set();
      this.channelSubscribers.set(channelId, subscribers);
    }
    subscribers.add(connectionId);

    // Add to connection channels
    let channels = this.connectionChannels.get(connectionId);
    if (!channels) {
      channels = new Set();
      this.connectionChannels.set(connectionId, channels);
    }
    channels.add(channelId);
  }

  async unsubscribeFromChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    this.channelSubscribers.get(channelId)?.delete(connectionId);
    this.connectionChannels.get(connectionId)?.delete(channelId);
  }

  async getGuildSubscribers(guildId: Snowflake): Promise<string[]> {
    return Array.from(this.guildSubscribers.get(guildId) ?? []);
  }

  async getChannelSubscribers(channelId: Snowflake): Promise<string[]> {
    return Array.from(this.channelSubscribers.get(channelId) ?? []);
  }

  async removeConnection(connectionId: string): Promise<void> {
    // Remove from all guild subscriber sets
    const guilds = this.connectionGuilds.get(connectionId);
    if (guilds) {
      for (const guildId of guilds) {
        this.guildSubscribers.get(guildId)?.delete(connectionId);
      }
    }

    // Remove from all channel subscriber sets
    const channels = this.connectionChannels.get(connectionId);
    if (channels) {
      for (const channelId of channels) {
        this.channelSubscribers.get(channelId)?.delete(connectionId);
      }
    }

    // Delete connection's sets
    this.connectionGuilds.delete(connectionId);
    this.connectionChannels.delete(connectionId);
  }

  async getConnectionGuilds(connectionId: string): Promise<Snowflake[]> {
    return Array.from(this.connectionGuilds.get(connectionId) ?? []);
  }

  async getConnectionChannels(connectionId: string): Promise<Snowflake[]> {
    return Array.from(this.connectionChannels.get(connectionId) ?? []);
  }
}
