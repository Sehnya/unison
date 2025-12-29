/**
 * Service-specific Event Consumer
 * 
 * Provides a higher-level abstraction for services to consume events
 * with automatic retry, backoff, and acknowledgment handling.
 * 
 * Requirements: 15.4
 */

import {
  connect,
  NatsConnection,
  JetStreamClient,
  JetStreamManager,
  StringCodec,
  AckPolicy,
  DeliverPolicy,
  ConsumerMessages,
  JsMsg,
} from 'nats';
import type { DomainEvent, EventTopic } from '@discord-clone/types';
import type { EventHandler, RetryConfig, EventBusConfig } from './types.js';
import { DEFAULT_RETRY_CONFIG, STREAM_CONFIGS } from './types.js';

const sc = StringCodec();

/**
 * Calculate delay with exponential backoff
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Service consumer configuration
 */
export interface ServiceConsumerConfig {
  serviceName: string;
  eventBusConfig: EventBusConfig;
  retryConfig?: RetryConfig;
}

/**
 * Service Event Consumer
 * 
 * A consumer designed for a specific service with:
 * - Durable consumer groups per service
 * - Automatic retry with exponential backoff
 * - Proper acknowledgment after processing
 * 
 * Requirements: 15.4
 */
export class ServiceEventConsumer {
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private jetstreamManager: JetStreamManager | null = null;
  private readonly serviceName: string;
  private readonly eventBusConfig: EventBusConfig;
  private readonly retryConfig: RetryConfig;
  private readonly subscriptions: Map<EventTopic, ConsumerMessages> = new Map();
  private readonly handlers: Map<EventTopic, EventHandler[]> = new Map();
  private running = false;

  constructor(config: ServiceConsumerConfig) {
    this.serviceName = config.serviceName;
    this.eventBusConfig = config.eventBusConfig;
    this.retryConfig = config.retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  /**
   * Connect to NATS
   */
  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }

    const connectionOptions: Parameters<typeof connect>[0] = {
      servers: this.eventBusConfig.servers,
      maxReconnectAttempts: this.eventBusConfig.maxReconnectAttempts ?? 10,
      reconnectTimeWait: this.eventBusConfig.reconnectTimeWait ?? 1000,
    };

    if (this.eventBusConfig.name) {
      connectionOptions.name = `${this.eventBusConfig.name}-${this.serviceName}`;
    }
    if (this.eventBusConfig.user) {
      connectionOptions.user = this.eventBusConfig.user;
    }
    if (this.eventBusConfig.pass) {
      connectionOptions.pass = this.eventBusConfig.pass;
    }
    if (this.eventBusConfig.token) {
      connectionOptions.token = this.eventBusConfig.token;
    }

    this.connection = await connect(connectionOptions);
    this.jetstream = this.connection.jetstream();
    this.jetstreamManager = await this.connection.jetstreamManager();
  }

  /**
   * Subscribe to a topic with a handler
   * Requirements: 15.4
   */
  async subscribe(topic: EventTopic, handler: EventHandler): Promise<void> {
    if (!this.jetstream || !this.jetstreamManager) {
      throw new Error('Not connected to NATS');
    }

    // Add handler
    const handlers = this.handlers.get(topic) ?? [];
    handlers.push(handler);
    this.handlers.set(topic, handlers);

    // If already subscribed, just add the handler
    if (this.subscriptions.has(topic)) {
      return;
    }

    const streamConfig = STREAM_CONFIGS[topic];
    const consumerName = `${this.serviceName}_${streamConfig.name}`;

    // Ensure consumer exists
    try {
      await this.jetstreamManager.consumers.info(streamConfig.name, consumerName);
    } catch {
      // Create consumer if it doesn't exist
      await this.jetstreamManager.consumers.add(streamConfig.name, {
        durable_name: consumerName,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        filter_subject: `${topic}.>`,
        max_deliver: this.retryConfig.maxRetries + 1,
        ack_wait: 30 * 1_000_000_000, // 30 seconds in nanoseconds
      });
    }

    // Get consumer and start consuming
    const consumer = await this.jetstream.consumers.get(streamConfig.name, consumerName);
    const messages = await consumer.consume();
    this.subscriptions.set(topic, messages);

    // Start processing messages
    this.running = true;
    this.processMessages(topic, messages);
  }

  /**
   * Process messages from a subscription
   */
  private async processMessages(
    topic: EventTopic,
    messages: ConsumerMessages
  ): Promise<void> {
    for await (const msg of messages) {
      if (!this.running) {
        break;
      }

      await this.handleMessage(topic, msg);
    }
  }

  /**
   * Handle a single message with retry logic
   * Requirements: 15.4
   */
  private async handleMessage(topic: EventTopic, msg: JsMsg): Promise<void> {
    const handlers = this.handlers.get(topic) ?? [];
    if (handlers.length === 0) {
      msg.ack();
      return;
    }

    let event: DomainEvent;
    try {
      event = JSON.parse(sc.decode(msg.data)) as DomainEvent;
    } catch (error) {
      // Invalid message, acknowledge to prevent infinite retry
      console.error('Failed to parse event:', error);
      msg.ack();
      return;
    }

    // Get delivery attempt from message info
    const deliveryAttempt = msg.info.redeliveryCount;

    try {
      // Execute all handlers
      for (const handler of handlers) {
        await handler(event);
      }

      // Success - acknowledge the message
      msg.ack();
    } catch (error) {
      console.error(`Error processing event (attempt ${deliveryAttempt + 1}):`, error);

      if (deliveryAttempt >= this.retryConfig.maxRetries) {
        // Max retries exceeded, acknowledge to prevent infinite retry
        // In production, you might want to send to a dead letter queue
        console.error(`Max retries exceeded for event ${event.id}, dropping message`);
        msg.ack();
      } else {
        // Calculate backoff delay
        const delay = calculateBackoffDelay(deliveryAttempt, this.retryConfig);

        // NAK with delay for retry
        msg.nak(delay);
      }
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: EventTopic): Promise<void> {
    const messages = this.subscriptions.get(topic);
    if (messages) {
      messages.stop();
      this.subscriptions.delete(topic);
    }
    this.handlers.delete(topic);
  }

  /**
   * Stop all subscriptions and disconnect
   */
  async stop(): Promise<void> {
    this.running = false;
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
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }
}

/**
 * Create a service event consumer
 */
export function createServiceConsumer(config: ServiceConsumerConfig): ServiceEventConsumer {
  return new ServiceEventConsumer(config);
}
