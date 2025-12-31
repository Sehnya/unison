/**
 * Redis Cache Package
 * 
 * Provides caching layer for messages and other frequently accessed data.
 * Connects to Railway Redis instance via REDIS_URL environment variable.
 */

export { RedisCache, createRedisCache, getRedisCache } from './redis.js';
export type { CacheOptions, MessageCache } from './types.js';
