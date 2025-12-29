/**
 * Gateway Event Consumer
 * 
 * Consumes events from JetStream and routes them to the fanout handler.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

import { connect, NatsConnection, JetStreamClient, JetStreamManager, StringCodec, AckPolicy, DeliverPolicy } from 'nats';
import type { DomainEvent, EventTopic } from '@discord-clone/types';
import { EventTopics } from '@discord-clone/types';
import type { EventFanout } from './fanout.js';

const sc = StringCodec();

/**
 * Stream configurations for gateway consumer
 */
const STREAM_CONFIGS: Record<EventTopic, { name: string; subjects: string[] }> = {
  [EventTopics.GUILD]: { name: 'GUILD_EVENTS', subjects: ['guild.events.>'] },
  [EventTopics.CHANNEL]: { name: 'CHANNEL_EVENTS', subjects: ['channel.events.>'] },
  [EventTopics.MESSAGE]: { name: 'MESSAGE_EVENTS', subjects: ['message.events.>'] },
  [EventTopics.MEMBER]: { name: 'MEMBER_EVENTS', subjects: ['member.events.>'] },
  [EventTopics.ROLE]: { name: 'ROLE_EVENTS', subjects: ['role.events.>'] },
};

/**
 * Gateway Event Consumer Configuration
 */
export interface GatewayEventConsumerConfig {
  /** NATS servers */
  servers: string[];
  /** Consumer group name */
  consumerGroup: string;
  /** Connection name */
  name?: string;
}

/**
 * Gateway Event Consumer
 * 
 * Subscribes to all event topics and routes events to the fanout handler.
 */
export class GatewayEventConsumer {
  private readonly config: GatewayEventConsumerConfig;
  private readonly fanout: EventFanout;
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;
  private jetstreamManager: JetStreamManager | null = null;
  private running = false;
  private readonly consumers: Map<EventTopic, { stop: () => void }> = new Map();

  constructor(config: GatewayEventConsumerConfig, fanout: EventFanout) {
    this.config = config;
    this.fanout = fanout;
  }

  /**
   * Connect to NATS and start consuming events
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Connect to NATS
    this.connection = await connect({
      servers: this.config.servers,
      name: this.config.name ?? 'gateway-consumer',
    });

    this.jetstream = this.connection.jetstream();
    this.jetstreamManager = await this.connection.jetstreamManager();

    this.running = true;

    // Subscribe to all event topics
    const topics = Object.values(EventTopics) as EventTopic[];
    for (const topic of topics) {
      await this.subscribeToTopic(topic);
    }
  }

  /**
   * Subscribe to a specific event topic
   */
  private async subscribeToTopic(topic: EventTopic): Promise<void> {
    if (!this.jetstream || !this.jetstreamManager) {
      throw new Error('Not connected to NATS');
    }

    const streamConfig = STREAM_CONFIGS[topic];
    const consumerName = `${this.config.consumerGroup}_${streamConfig.name}`;

    // Ensure consumer exists
    try {
      await this.jetstreamManager.consumers.info(streamConfig.name, consumerName);
    } catch {
      // Create consumer if it doesn't exist
      await this.jetstreamManager.consumers.add(streamConfig.name, {
        durable_name: consumerName,
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.New, // Only new messages for gateway
        filter_subject: `${topic}.>`,
      });
    }

    // Get consumer and start consuming
    const consumer = await this.jetstream.consumers.get(streamConfig.name, consumerName);
    const messages = await consumer.consume();

    // Store consumer for cleanup
    this.consumers.set(topic, { stop: () => messages.stop() });

    // Process messages
    this.processMessages(topic, messages);
  }

  /**
   * Process messages from a topic
   */
  private async processMessages(
    topic: EventTopic,
    messages: AsyncIterable<{ data: Uint8Array; ack: () => void; nak: (delay?: number) => void }>
  ): Promise<void> {
    for await (const msg of messages) {
      if (!this.running) {
        break;
      }

      try {
        const event = JSON.parse(sc.decode(msg.data)) as DomainEvent;
        await this.fanout.handleEvent(event);
        msg.ack();
      } catch (error) {
        console.error(`Error processing event from ${topic}:`, error);
        // NAK with delay for retry
        msg.nak(5000);
      }
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    this.running = false;

    // Stop all consumers
    for (const [, consumer] of this.consumers) {
      consumer.stop();
    }
    this.consumers.clear();

    // Close connection
    if (this.connection) {
      await this.connection.drain();
      this.connection = null;
      this.jetstream = null;
      this.jetstreamManager = null;
    }
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }
}
