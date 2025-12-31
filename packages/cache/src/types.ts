/**
 * Cache Types
 */

export interface CacheOptions {
  /** Redis connection URL (defaults to REDIS_URL env var) */
  url?: string;
  /** Key prefix for namespacing */
  keyPrefix?: string;
  /** Default TTL in seconds */
  defaultTTL?: number;
}

export interface MessageCache {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_font: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
}

export interface ChannelMessagesCache {
  messages: MessageCache[];
  cachedAt: number;
}
