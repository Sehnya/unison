/**
 * Event Bus Types
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 */

import type { DomainEvent, EventTopic } from '@discord-clone/types';

/**
 * Stream configuration for NATS JetStream
 */
export interface StreamConfig {
  name: string;
  subjects: string[];
  maxAge?: number; // nanoseconds
  maxBytes?: number;
  maxMsgs?: number;
  replicas?: number;
  retention?: 'limits' | 'interest' | 'workqueue';
  storage?: 'file' | 'memory';
}

/**
 * Consumer configuration for NATS JetStream
 */
export interface ConsumerConfig {
  name: string;
  durableName?: string;
  filterSubject?: string;
  ackWait?: number; // nanoseconds
  maxDeliver?: number;
  maxAckPending?: number;
  deliverPolicy?: 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time';
}

/**
 * Event handler function type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * Event bus publisher interface
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
}

/**
 * Event bus consumer interface
 */
export interface EventConsumer {
  subscribe(topic: EventTopic, handler: EventHandler): Promise<void>;
  unsubscribe(topic: EventTopic): Promise<void>;
  close(): Promise<void>;
}

/**
 * Event bus client interface
 */
export interface EventBusClient extends EventPublisher, EventConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  servers: string[];
  name?: string;
  user?: string;
  pass?: string;
  token?: string;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
}

/**
 * Retry configuration for consumers
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Stream definitions for each event topic
 * Requirements: 15.3
 */
export const STREAM_CONFIGS: Record<EventTopic, StreamConfig> = {
  'guild.events': {
    name: 'GUILD_EVENTS',
    subjects: ['guild.events.>'],
    maxAge: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
    retention: 'limits',
    storage: 'file',
  },
  'channel.events': {
    name: 'CHANNEL_EVENTS',
    subjects: ['channel.events.>'],
    maxAge: 7 * 24 * 60 * 60 * 1_000_000_000,
    retention: 'limits',
    storage: 'file',
  },
  'message.events': {
    name: 'MESSAGE_EVENTS',
    subjects: ['message.events.>'],
    maxAge: 24 * 60 * 60 * 1_000_000_000, // 1 day for messages
    retention: 'limits',
    storage: 'file',
  },
  'member.events': {
    name: 'MEMBER_EVENTS',
    subjects: ['member.events.>'],
    maxAge: 7 * 24 * 60 * 60 * 1_000_000_000,
    retention: 'limits',
    storage: 'file',
  },
  'role.events': {
    name: 'ROLE_EVENTS',
    subjects: ['role.events.>'],
    maxAge: 7 * 24 * 60 * 60 * 1_000_000_000,
    retention: 'limits',
    storage: 'file',
  },
};
