/**
 * Event Replay
 * 
 * Handles replaying events for reconnection scenarios.
 * Requirements: 12.2
 */

import { connect, NatsConnection, JetStreamClient, StringCodec, DeliverPolicy, AckPolicy } from 'nats';
import type { DomainEvent, Snowflake } from '@discord-clone/types';
import type { ClientConnection } from './types.js';
import type { ConnectionManager } from './connection.js';

const sc = StringCodec();

/**
 * Event Replay Configuration
 */
export interface EventReplayConfig {
  /** NATS servers */
  servers: string[];
  /** Replay window duration in milliseconds */
  replayWindowMs: number;
  /** Maximum events to replay */
  maxReplayEvents: number;
}

/**
 * Default replay configuration
 */
export const DEFAULT_REPLAY_CONFIG: EventReplayConfig = {
  servers: (process.env.NATS_SERVERS || 'nats://localhost:4222').split(','),
  replayWindowMs: 5 * 60 * 1000, // 5 minutes
  maxReplayEvents: 1000,
};

/**
 * Stream configurations for replay
 */
const STREAM_NAMES = [
  'GUILD_EVENTS',
  'CHANNEL_EVENTS',
  'MESSAGE_EVENTS',
  'MEMBER_EVENTS',
  'ROLE_EVENTS',
];

/**
 * Event Replay Manager
 * 
 * Handles replaying missed events when a client reconnects.
 */
export class EventReplayManager {
  private readonly config: EventReplayConfig;
  private readonly connectionManager: ConnectionManager;
  private connection: NatsConnection | null = null;
  private jetstream: JetStreamClient | null = null;

  constructor(config: EventReplayConfig, connectionManager: ConnectionManager) {
    this.config = config;
    this.connectionManager = connectionManager;
  }

  /**
   * Connect to NATS
   */
  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }

    this.connection = await connect({
      servers: this.config.servers,
      name: 'gateway-replay',
    });

    this.jetstream = this.connection.jetstream();
  }

  /**
   * Disconnect from NATS
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();
      this.connection = null;
      this.jetstream = null;
    }
  }

  /**
   * Replay events for a connection since a given event ID
   * Returns true if replay was successful, false if resync is required
   */
  async replayEvents(
    connection: ClientConnection,
    lastEventId: string,
    guildIds: Snowflake[]
  ): Promise<boolean> {
    if (!this.jetstream) {
      throw new Error('Not connected to NATS');
    }

    // Parse the last event timestamp from the event ID
    // Event IDs are UUIDs, so we need to track timestamps separately
    // For now, we'll use a time-based approach
    const replayStartTime = Date.now() - this.config.replayWindowMs;

    // Check if the replay window has been exceeded
    // In a real implementation, we'd store event timestamps and check against lastEventId
    // For now, we'll assume the client is within the replay window

    const replayedEvents: DomainEvent[] = [];

    try {
      // Replay events from each stream
      for (const streamName of STREAM_NAMES) {
        const events = await this.fetchEventsFromStream(
          streamName,
          replayStartTime,
          guildIds
        );
        replayedEvents.push(...events);
      }

      // Sort events by timestamp
      replayedEvents.sort((a, b) => a.timestamp - b.timestamp);

      // Filter events after the last event ID
      // In a real implementation, we'd compare event IDs
      const eventsToReplay = replayedEvents.filter(e => e.id !== lastEventId);

      // Check if we have too many events (replay window exceeded)
      if (eventsToReplay.length > this.config.maxReplayEvents) {
        return false; // Resync required
      }

      // Dispatch replayed events to the connection
      for (const event of eventsToReplay) {
        this.dispatchReplayedEvent(connection, event);
      }

      return true;
    } catch (error) {
      console.error('Error replaying events:', error);
      return false;
    }
  }

  /**
   * Fetch events from a stream within the replay window
   */
  private async fetchEventsFromStream(
    streamName: string,
    startTime: number,
    guildIds: Snowflake[]
  ): Promise<DomainEvent[]> {
    if (!this.jetstream) {
      return [];
    }

    const events: DomainEvent[] = [];

    try {
      // Create an ephemeral consumer for replay
      const consumerName = `replay-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      // Get the consumer
      const consumer = await this.jetstream.consumers.get(streamName, consumerName).catch(async () => {
        // Create ephemeral consumer
        const jsm = await this.connection!.jetstreamManager();
        await jsm.consumers.add(streamName, {
          durable_name: consumerName,
          ack_policy: AckPolicy.None,
          deliver_policy: DeliverPolicy.StartTime,
          opt_start_time: new Date(startTime).toISOString(),
        });
        return this.jetstream!.consumers.get(streamName, consumerName);
      });

      // Fetch messages
      const messages = await consumer.fetch({ max_messages: this.config.maxReplayEvents });

      for await (const msg of messages) {
        try {
          const event = JSON.parse(sc.decode(msg.data)) as DomainEvent;
          
          // Filter by guild IDs if applicable
          if (this.eventMatchesGuilds(event, guildIds)) {
            events.push(event);
          }
        } catch {
          // Skip invalid messages
        }
      }

      // Clean up ephemeral consumer
      try {
        const jsm = await this.connection!.jetstreamManager();
        await jsm.consumers.delete(streamName, consumerName);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error) {
      console.error(`Error fetching events from ${streamName}:`, error);
    }

    return events;
  }

  /**
   * Check if an event matches the user's guild subscriptions
   */
  private eventMatchesGuilds(event: DomainEvent, guildIds: Snowflake[]): boolean {
    const data = event.data as unknown as Record<string, unknown>;
    
    // Check for guild_id in event data
    if (data.guild_id && guildIds.includes(data.guild_id as Snowflake)) {
      return true;
    }

    // Check for guild.id in event data
    const guild = data.guild as { id?: Snowflake } | undefined;
    if (guild?.id && guildIds.includes(guild.id)) {
      return true;
    }

    return false;
  }

  /**
   * Dispatch a replayed event to a connection
   */
  private dispatchReplayedEvent(connection: ClientConnection, event: DomainEvent): void {
    const wsEventType = this.mapEventType(event.type);
    if (wsEventType) {
      this.connectionManager.dispatchEvent(connection, wsEventType as import('@discord-clone/types').WebSocketEventType, event.data, event.id);
    }
  }

  /**
   * Map domain event type to WebSocket event type
   */
  private mapEventType(eventType: string): string | null {
    const mapping: Record<string, string> = {
      'message.created': 'MESSAGE_CREATE',
      'message.updated': 'MESSAGE_UPDATE',
      'message.deleted': 'MESSAGE_DELETE',
      'guild.created': 'GUILD_CREATE',
      'guild.updated': 'GUILD_UPDATE',
      'guild.deleted': 'GUILD_DELETE',
      'channel.created': 'CHANNEL_CREATE',
      'channel.updated': 'CHANNEL_UPDATE',
      'channel.deleted': 'CHANNEL_DELETE',
      'member.joined': 'MEMBER_ADD',
      'member.left': 'MEMBER_REMOVE',
      'member.removed': 'MEMBER_REMOVE',
      'member.banned': 'MEMBER_REMOVE',
      'member.unbanned': 'MEMBER_UPDATE',
      'member.updated': 'MEMBER_UPDATE',
      'role.created': 'ROLE_CREATE',
      'role.updated': 'ROLE_UPDATE',
      'role.deleted': 'ROLE_DELETE',
    };

    return mapping[eventType] ?? null;
  }
}
