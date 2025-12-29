/**
 * NATS JetStream Event Bus Client
 * 
 * Requirements: 15.1, 15.2, 15.3
 */

import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  AckPolicy,
  DeliverPolicy,
  RetentionPolicy,
  StorageType,
} from 'nats';
import type { DomainEvent, EventTopic } from '@discord-clone/types';
import { getEventTopic } from '@discord-clone/events';
import type {
  EventBusClient,
  EventBusConfig,
  EventHandler,
  StreamConfig,
} from './types.js';
import { STREAM_CONFIGS } from './types.js';

const sc = StringCodec();

/**
 * Get the NATS subject for an event
 * Format: {topic}.{entity_id} for entity-local ordering
 */
export function getEventSubject(event: DomainEvent): string {
  const topic = getEventTopic(event.type);
  const entityId = getEntityId(event);
  return `${topic}.${entityId}`;
}

/**
 * Extract entity ID from event for subject routing
 * This ensures events for the same entity go to the same subject for ordering
 */
function getEntityId(event: DomainEvent): string {
  const data = event.data as unknown as Record<string, unknown>;
  
  // Message events - use channel_id for ordering within channel
  if (event.type.startsWith('message.')) {
    return String(data.channel_id ?? 'unknown');
  }
  
  // Channel events - use channel_id or guild_id
  if (event.type.startsWith('channel.') || event.type.startsWith('channel_overwrite.')) {
    return String(data.channel_id ?? data.guild_id ?? 'unknown');
  }
  
  // Member events - use guild_id for ordering within guild
  if (event.type.startsWith('member.') || event.type.startsWith('member_roles.')) {
    return String(data.guild_id ?? 'unknown');
  }
  
  // Role events - use guild_id
  if (event.type.startsWith('role.')) {
    return String(data.guild_id ?? 'unknown');
  }
  
  // Guild events - use guild_id or guild.id
  if (event.type.startsWith('guild.')) {
    const guild = data.guild as { id?: string } | undefined;
    return String(data.guild_id ?? guild?.id ?? 'unknown');
  }
  
  // Session events - use user_id
  if (event.type.startsWith('session.') || event.type.startsWith('sessions.')) {
    return String(data.user_id ?? 'unknown');
  }
  
  return 'unknown';
}

/**
 * NATS JetStream Event Bus Client
 * 
 * Implements event publishing and consuming using NATS JetStream
 * for durable message delivery.
 * 
 * Requirements: 15.1, 15.2, 15.3
 */
export class JetStreamEventBus implements EventBusClient {
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private jetstreamManager: JetStreamManager | null = null;
  private readonly config: EventBusConfig;
  private readonly handlers: Map<EventTopic, EventHandler[]> = new Map();
  private readonly subscriptions: Map<EventTopic, { unsubscribe: () => void }> = new Map();

  constructor(config: EventBusConfig) {
    this.config = config;
  }

  /**
   * Connect to NATS and initialize JetStream
   */
  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }

    const connectionOptions: Parameters<typeof connect>[0] = {
      servers: this.config.servers,
      maxReconnectAttempts: this.config.maxReconnectAttempts ?? 10,
      reconnectTimeWait: this.config.reconnectTimeWait ?? 1000,
    };
    
    if (this.config.name) {
      connectionOptions.name = this.config.name;
    }
    if (this.config.user) {
      connectionOptions.user = this.config.user;
    }
    if (this.config.pass) {
      connectionOptions.pass = this.config.pass;
    }
    if (this.config.token) {
      connectionOptions.token = this.config.token;
    }
    
    this.connection = await connect(connectionOptions);

    this.jetstream = this.connection.jetstream();
    this.jetstreamManager = await this.connection.jetstreamManager();

    // Initialize streams for all topics
    await this.initializeStreams();
  }

  /**
   * Initialize JetStream streams for all event topics
   * Requirements: 15.3
   */
  private async initializeStreams(): Promise<void> {
    if (!this.jetstreamManager) {
      throw new Error('JetStream manager not initialized');
    }

    for (const [, streamConfig] of Object.entries(STREAM_CONFIGS)) {
      await this.ensureStream(streamConfig);
    }
  }

  /**
   * Ensure a stream exists with the given configuration
   */
  private async ensureStream(config: StreamConfig): Promise<void> {
    if (!this.jetstreamManager) {
      throw new Error('JetStream manager not initialized');
    }

    try {
      // Try to get existing stream
      await this.jetstreamManager.streams.info(config.name);
    } catch {
      // Stream doesn't exist, create it
      const streamOptions: Parameters<typeof this.jetstreamManager.streams.add>[0] = {
        name: config.name,
        subjects: config.subjects,
        num_replicas: config.replicas ?? 1,
        retention: config.retention === 'interest' 
          ? RetentionPolicy.Interest 
          : config.retention === 'workqueue'
            ? RetentionPolicy.Workqueue
            : RetentionPolicy.Limits,
        storage: config.storage === 'memory' 
          ? StorageType.Memory 
          : StorageType.File,
      };
      
      if (config.maxAge !== undefined) {
        streamOptions.max_age = config.maxAge;
      }
      if (config.maxBytes !== undefined) {
        streamOptions.max_bytes = config.maxBytes;
      }
      if (config.maxMsgs !== undefined) {
        streamOptions.max_msgs = config.maxMsgs;
      }
      
      await this.jetstreamManager.streams.add(streamOptions);
    }
  }

  /**
   * Disconnect from NATS
   */
  async disconnect(): Promise<void> {
    // Unsubscribe from all topics
    for (const [topic] of this.subscriptions) {
      await this.unsubscribe(topic);
    }

    if (this.connection) {
      await this.connection.drain();
      this.connection = null;
      this.jetstream = null;
      this.jetstreamManager = null;
    }
  }

  /**
   * Check if connected to NATS
   */
  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  /**
   * Publish an event to the event bus
   * Requirements: 15.2
   */
  async publish(event: DomainEvent): Promise<void> {
    if (!this.jetstream) {
      throw new Error('Not connected to NATS');
    }

    const subject = getEventSubject(event);
    const payload = sc.encode(JSON.stringify(event));

    await this.jetstream.publish(subject, payload, {
      msgID: event.id, // Use event ID for deduplication
    });
  }

  /**
   * Publish multiple events in batch
   */
  async publishBatch(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Subscribe to events on a topic
   */
  async subscribe(topic: EventTopic, handler: EventHandler): Promise<void> {
    // Add handler to the list
    const handlers = this.handlers.get(topic) ?? [];
    handlers.push(handler);
    this.handlers.set(topic, handlers);

    // If already subscribed, just add the handler
    if (this.subscriptions.has(topic)) {
      return;
    }

    // Create subscription
    if (!this.jetstream) {
      throw new Error('Not connected to NATS');
    }

    const streamConfig = STREAM_CONFIGS[topic];
    const consumer = await this.jetstream.consumers.get(
      streamConfig.name,
      `${streamConfig.name}_consumer`
    ).catch(async () => {
      // Consumer doesn't exist, create it
      if (!this.jetstreamManager) {
        throw new Error('JetStream manager not initialized');
      }
      await this.jetstreamManager.consumers.add(streamConfig.name, {
        durable_name: `${streamConfig.name}_consumer`,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        filter_subject: `${topic}.>`,
      });
      return this.jetstream!.consumers.get(streamConfig.name, `${streamConfig.name}_consumer`);
    });

    const messages = await consumer.consume();
    
    // Process messages asynchronously
    (async () => {
      for await (const msg of messages) {
        try {
          const event = JSON.parse(sc.decode(msg.data)) as DomainEvent;
          const topicHandlers = this.handlers.get(topic) ?? [];
          
          for (const h of topicHandlers) {
            await h(event);
          }
          
          msg.ack();
        } catch (error) {
          // NAK the message for retry
          msg.nak();
          console.error('Error processing event:', error);
        }
      }
    })();

    this.subscriptions.set(topic, {
      unsubscribe: () => messages.stop(),
    });
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: EventTopic): Promise<void> {
    const subscription = this.subscriptions.get(topic);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(topic);
    }
    this.handlers.delete(topic);
  }

  /**
   * Close all subscriptions
   */
  async close(): Promise<void> {
    await this.disconnect();
  }
}
