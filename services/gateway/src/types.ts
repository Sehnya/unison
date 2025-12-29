/**
 * Gateway Types
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import type { Snowflake, User, Guild, TokenPayload } from '@discord-clone/types';
import type { WebSocket } from 'ws';

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  /** Port to listen on */
  port: number;
  /** JWT secret for token validation */
  jwtSecret: string;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  /** Heartbeat timeout in milliseconds */
  heartbeatTimeout: number;
  /** Maximum send buffer size per connection */
  maxSendBufferSize: number;
  /** Rate limit: max events per second per connection */
  maxEventsPerSecond: number;
  /** Replay window duration in milliseconds */
  replayWindowMs: number;
  /** Redis URL for subscription tracking */
  redisUrl?: string;
  /** NATS servers for event bus */
  natsServers?: string[];
}

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  port: 8080,
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
  heartbeatInterval: 45000, // 45 seconds
  heartbeatTimeout: 60000, // 60 seconds
  maxSendBufferSize: 1000, // 1000 events
  maxEventsPerSecond: 100,
  replayWindowMs: 5 * 60 * 1000, // 5 minutes
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  natsServers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
};

/**
 * Connection state
 */
export type ConnectionState = 'connecting' | 'identifying' | 'ready' | 'resuming' | 'disconnected';

/**
 * Client connection
 */
export interface ClientConnection {
  /** Unique connection ID */
  id: string;
  /** WebSocket instance */
  socket: WebSocket;
  /** Connection state */
  state: ConnectionState;
  /** User ID (set after IDENTIFY) */
  userId?: Snowflake;
  /** Session ID (set after IDENTIFY) */
  sessionId?: string;
  /** Token payload (set after IDENTIFY) */
  tokenPayload?: TokenPayload;
  /** User data (set after IDENTIFY) */
  user?: User;
  /** Guilds the user is a member of */
  guilds: Guild[];
  /** Channel subscriptions */
  channelSubscriptions: Set<Snowflake>;
  /** Last heartbeat received timestamp */
  lastHeartbeat: number;
  /** Heartbeat timeout handle */
  heartbeatTimeout?: NodeJS.Timeout;
  /** Last event sequence number sent */
  lastSequence: number;
  /** Last event ID sent */
  lastEventId?: string;
  /** Send buffer for backpressure handling */
  sendBuffer: QueuedEvent[];
  /** Rate limit: events sent in current window */
  eventsSentInWindow: number;
  /** Rate limit: window start timestamp */
  rateLimitWindowStart: number;
  /** Connection created timestamp */
  createdAt: number;
}

/**
 * Queued event for send buffer
 */
export interface QueuedEvent {
  /** Event type */
  type: string;
  /** Event data */
  data: unknown;
  /** Sequence number */
  sequence: number;
  /** Event ID */
  eventId: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * User data provider interface
 */
export interface UserDataProvider {
  /** Get user by ID */
  getUser(userId: Snowflake): Promise<User | null>;
  /** Get guilds for a user */
  getUserGuilds(userId: Snowflake): Promise<Guild[]>;
  /** Validate session */
  validateSession(sessionId: string): Promise<boolean>;
}

/**
 * Subscription manager interface
 */
export interface SubscriptionManager {
  /** Subscribe connection to a guild */
  subscribeToGuild(connectionId: string, guildId: Snowflake): Promise<void>;
  /** Unsubscribe connection from a guild */
  unsubscribeFromGuild(connectionId: string, guildId: Snowflake): Promise<void>;
  /** Subscribe connection to a channel */
  subscribeToChannel(connectionId: string, channelId: Snowflake): Promise<void>;
  /** Unsubscribe connection from a channel */
  unsubscribeFromChannel(connectionId: string, channelId: Snowflake): Promise<void>;
  /** Get connections subscribed to a guild */
  getGuildSubscribers(guildId: Snowflake): Promise<string[]>;
  /** Get connections subscribed to a channel */
  getChannelSubscribers(channelId: Snowflake): Promise<string[]>;
  /** Remove all subscriptions for a connection */
  removeConnection(connectionId: string): Promise<void>;
  /** Get all guild subscriptions for a connection */
  getConnectionGuilds(connectionId: string): Promise<Snowflake[]>;
  /** Get all channel subscriptions for a connection */
  getConnectionChannels(connectionId: string): Promise<Snowflake[]>;
}
