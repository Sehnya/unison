/**
 * Event Bus Consumer with Retry Logic
 * 
 * Requirements: 15.4
 */

import {
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
import type { EventHandler, RetryConfig } from './types.js';
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
 * Event consumer with retry and backoff support
 * 
 * Requirements: 15.4
 */
export class EventConsumerWithRetry {
  private readonly jetstream: JetStreamClient;
  private readonly jetstreamManager: JetStreamManager;
  private readonly consumerGroup: string;
  private readonly retryConfig: RetryConfig;
  private readonly subscriptions: Map<EventTopic, ConsumerMessages> = new Map();
  private readonly handlers: Map<EventTopic, EventHandler[]> = new Map();
  private running = false;

  constructor(
    _connection: NatsConnection,
    jetstream: JetStreamClient,
    jetstreamManager: JetStreamManager,
    consumerGroup: string,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.jetstream = jetstream;
    this.jetstreamManager = jetstreamManager;
    this.consumerGroup = consumerGroup;
    this.retryConfig = retryConfig;
  }

  /**
   * Subscribe to a topic with a handler
   * Requirements: 15.4
   */
  async subscribe(topic: EventTopic, handler: EventHandler): Promise<void> {
    // Add handler
    const handlers = this.handlers.get(topic) ?? [];
    handlers.push(handler);
    this.handlers.set(topic, handlers);

    // If already subscribed, just add the handler
    if (this.subscriptions.has(topic)) {
      return;
    }

    const streamConfig = STREAM_CONFIGS[topic];
    const consumerName = `${this.consumerGroup}_${streamConfig.name}`;

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
   * Stop all subscriptions
   */
  async stop(): Promise<void> {
    this.running = false;
    for (const [topic] of this.subscriptions) {
      await this.unsubscribe(topic);
    }
  }
}

/**
 * Create an event consumer for a service
 */
export async function createEventConsumer(
  connection: NatsConnection,
  consumerGroup: string,
  retryConfig?: RetryConfig
): Promise<EventConsumerWithRetry> {
  const jetstream = connection.jetstream();
  const jetstreamManager = await connection.jetstreamManager();

  return new EventConsumerWithRetry(
    connection,
    jetstream,
    jetstreamManager,
    consumerGroup,
    retryConfig
  );
}
