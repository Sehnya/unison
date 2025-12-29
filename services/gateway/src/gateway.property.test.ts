/**
 * Gateway Property Tests
 * 
 * Feature: discord-clone-core, Property 16: Event Fanout with Idempotent Delivery
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type {
  Snowflake,
  User,
  Guild,
  MessageCreatedEvent,
  GuildUpdatedEvent,
  ChannelCreatedEvent,
  MemberJoinedEvent,
  RoleUpdatedEvent,
  WebSocketEventType,
} from '@discord-clone/types';
import { createEvent } from '@discord-clone/events';
import { EventFanout } from './fanout.js';
import { ConnectionManager } from './connection.js';
import { InMemorySubscriptionManager } from './subscriptions.js';
import type { ClientConnection } from './types.js';

/**
 * Generate a valid Snowflake ID
 */
const snowflakeArb = fc.bigInt({ min: 1n, max: (1n << 63n) - 1n }).map(n => n.toString() as Snowflake);

/**
 * Generate a user
 */
const userArb = fc.record({
  id: snowflakeArb,
  email: fc.emailAddress(),
  username: fc.string({ minLength: 1, maxLength: 32 }),
  created_at: fc.date(),
}).map(({ id, email, username, created_at }) => ({
  id,
  email,
  username,
  created_at,
} as User));

/**
 * Generate a guild
 */
const guildArb = fc.record({
  id: snowflakeArb,
  owner_id: snowflakeArb,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  created_at: fc.date(),
}).map(({ id, owner_id, name, created_at }) => ({
  id,
  owner_id,
  name,
  created_at,
} as Guild));

/**
 * Mock connection for testing
 */
interface MockConnection {
  id: string;
  userId: Snowflake;
  receivedEvents: Array<{ type: WebSocketEventType; data: unknown; eventId: string }>;
}

/**
 * Test harness for event fanout
 */
class EventFanoutTestHarness {
  readonly subscriptionManager: InMemorySubscriptionManager;
  readonly connections: Map<string, MockConnection> = new Map();
  readonly fanout: EventFanout;
  private connectionIdCounter = 0;

  constructor() {
    this.subscriptionManager = new InMemorySubscriptionManager();
    
    // Create a mock connection manager
    const mockConnectionManager = {
      getConnection: (id: string) => {
        const mock = this.connections.get(id);
        if (!mock) return undefined;
        return { id: mock.id, userId: mock.userId } as ClientConnection;
      },
      getUserConnections: (userId: Snowflake) => {
        const result: ClientConnection[] = [];
        for (const [, mock] of this.connections) {
          if (mock.userId === userId) {
            result.push({ id: mock.id, userId: mock.userId } as ClientConnection);
          }
        }
        return result;
      },
      dispatchEvent: (connection: ClientConnection, type: WebSocketEventType, data: unknown, eventId: string) => {
        const mock = this.connections.get(connection.id);
        if (mock) {
          mock.receivedEvents.push({ type, data, eventId });
        }
        return true;
      },
      disconnectSession: async () => {},
      disconnectUser: async () => {},
    } as unknown as ConnectionManager;

    this.fanout = new EventFanout(mockConnectionManager, this.subscriptionManager);
  }

  /**
   * Create a mock connection
   */
  createConnection(userId: Snowflake): MockConnection {
    const id = `conn-${++this.connectionIdCounter}`;
    const connection: MockConnection = {
      id,
      userId,
      receivedEvents: [],
    };
    this.connections.set(id, connection);
    return connection;
  }

  /**
   * Subscribe a connection to a guild
   */
  async subscribeToGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    await this.subscriptionManager.subscribeToGuild(connectionId, guildId);
  }

  /**
   * Subscribe a connection to a channel
   */
  async subscribeToChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    await this.subscriptionManager.subscribeToChannel(connectionId, channelId);
  }

  /**
   * Get events received by a connection
   */
  getReceivedEvents(connectionId: string): Array<{ type: WebSocketEventType; data: unknown; eventId: string }> {
    return this.connections.get(connectionId)?.receivedEvents ?? [];
  }

  /**
   * Clear received events for all connections
   */
  clearReceivedEvents(): void {
    for (const [, conn] of this.connections) {
      conn.receivedEvents = [];
    }
  }
}

describe('Gateway Property Tests', () => {
  /**
   * Feature: discord-clone-core, Property 16: Event Fanout with Idempotent Delivery
   * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
   * 
   * For any event published to the Event_Bus:
   * - All connections subscribed to the relevant entity receive the event
   * - Connections not subscribed to the entity do not receive the event
   * - Events MAY be delivered more than once (at-least-once delivery)
   * - Clients SHALL deduplicate using event IDs
   * - State SHALL converge correctly regardless of duplicate deliveries
   */
  describe('Property 16: Event Fanout with Idempotent Delivery', () => {
    let harness: EventFanoutTestHarness;

    beforeEach(() => {
      harness = new EventFanoutTestHarness();
    });

    it('message events are delivered only to channel subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            channelId: snowflakeArb,
            guildId: snowflakeArb,
            messageId: snowflakeArb,
            authorId: snowflakeArb,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            subscriberCount: fc.integer({ min: 1, max: 5 }),
            nonSubscriberCount: fc.integer({ min: 0, max: 5 }),
          }),
          async ({ channelId, guildId, messageId, authorId, content, subscriberCount, nonSubscriberCount }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create subscribers
            const subscribers: MockConnection[] = [];
            for (let i = 0; i < subscriberCount; i++) {
              const conn = harness.createConnection(`user-${i}` as Snowflake);
              await harness.subscribeToChannel(conn.id, channelId);
              subscribers.push(conn);
            }

            // Create non-subscribers
            const nonSubscribers: MockConnection[] = [];
            for (let i = 0; i < nonSubscriberCount; i++) {
              const conn = harness.createConnection(`non-sub-user-${i}` as Snowflake);
              // Subscribe to a different channel
              await harness.subscribeToChannel(conn.id, `other-channel-${i}` as Snowflake);
              nonSubscribers.push(conn);
            }

            // Create and dispatch message event
            const event = createEvent('message.created', {
              message: {
                id: messageId,
                channel_id: channelId,
                author_id: authorId,
                content,
                mentions: [],
                mention_roles: [],
                created_at: new Date(),
              },
              channel_id: channelId,
              guild_id: guildId,
            }) as MessageCreatedEvent;

            await harness.fanout.handleEvent(event);

            // All subscribers should receive the event
            for (const sub of subscribers) {
              const events = harness.getReceivedEvents(sub.id);
              expect(events.length).toBe(1);
              const firstEvent = events[0];
              expect(firstEvent).toBeDefined();
              expect(firstEvent!.type).toBe('MESSAGE_CREATE');
              expect(firstEvent!.eventId).toBe(event.id);
            }

            // Non-subscribers should not receive the event
            for (const nonSub of nonSubscribers) {
              const events = harness.getReceivedEvents(nonSub.id);
              expect(events.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('guild events are delivered only to guild subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            guild: guildArb,
            subscriberCount: fc.integer({ min: 1, max: 5 }),
            nonSubscriberCount: fc.integer({ min: 0, max: 5 }),
          }),
          async ({ guild, subscriberCount, nonSubscriberCount }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create subscribers
            const subscribers: MockConnection[] = [];
            for (let i = 0; i < subscriberCount; i++) {
              const conn = harness.createConnection(`user-${i}` as Snowflake);
              await harness.subscribeToGuild(conn.id, guild.id);
              subscribers.push(conn);
            }

            // Create non-subscribers
            const nonSubscribers: MockConnection[] = [];
            for (let i = 0; i < nonSubscriberCount; i++) {
              const conn = harness.createConnection(`non-sub-user-${i}` as Snowflake);
              // Subscribe to a different guild
              await harness.subscribeToGuild(conn.id, `other-guild-${i}` as Snowflake);
              nonSubscribers.push(conn);
            }

            // Create and dispatch guild event
            const event = createEvent('guild.updated', {
              guild,
            }) as GuildUpdatedEvent;

            await harness.fanout.handleEvent(event);

            // All subscribers should receive the event
            for (const sub of subscribers) {
              const events = harness.getReceivedEvents(sub.id);
              expect(events.length).toBe(1);
              const firstEvent = events[0];
              expect(firstEvent).toBeDefined();
              expect(firstEvent!.type).toBe('GUILD_UPDATE');
              expect(firstEvent!.eventId).toBe(event.id);
            }

            // Non-subscribers should not receive the event
            for (const nonSub of nonSubscribers) {
              const events = harness.getReceivedEvents(nonSub.id);
              expect(events.length).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duplicate events can be deduplicated by event ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            channelId: snowflakeArb,
            guildId: snowflakeArb,
            messageId: snowflakeArb,
            authorId: snowflakeArb,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            duplicateCount: fc.integer({ min: 2, max: 5 }),
          }),
          async ({ channelId, guildId, messageId, authorId, content, duplicateCount }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create a subscriber
            const conn = harness.createConnection('user-1' as Snowflake);
            await harness.subscribeToChannel(conn.id, channelId);

            // Create the event
            const event = createEvent('message.created', {
              message: {
                id: messageId,
                channel_id: channelId,
                author_id: authorId,
                content,
                mentions: [],
                mention_roles: [],
                created_at: new Date(),
              },
              channel_id: channelId,
              guild_id: guildId,
            }) as MessageCreatedEvent;

            // Dispatch the same event multiple times (simulating at-least-once delivery)
            for (let i = 0; i < duplicateCount; i++) {
              await harness.fanout.handleEvent(event);
            }

            // Connection receives all deliveries
            const events = harness.getReceivedEvents(conn.id);
            expect(events.length).toBe(duplicateCount);

            // All events have the same ID (can be deduplicated by client)
            const eventIds = new Set(events.map(e => e.eventId));
            expect(eventIds.size).toBe(1);
            expect(eventIds.has(event.id)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('channel events are delivered to guild subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            channelId: snowflakeArb,
            guildId: snowflakeArb,
            channelName: fc.string({ minLength: 1, maxLength: 100 }),
            subscriberCount: fc.integer({ min: 1, max: 5 }),
          }),
          async ({ channelId, guildId, channelName, subscriberCount }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create guild subscribers
            const subscribers: MockConnection[] = [];
            for (let i = 0; i < subscriberCount; i++) {
              const conn = harness.createConnection(`user-${i}` as Snowflake);
              await harness.subscribeToGuild(conn.id, guildId);
              subscribers.push(conn);
            }

            // Create and dispatch channel event
            const event = createEvent('channel.created', {
              channel: {
                id: channelId,
                guild_id: guildId,
                type: 0,
                name: channelName,
                position: 0,
                created_at: new Date(),
              },
              guild_id: guildId,
            }) as ChannelCreatedEvent;

            await harness.fanout.handleEvent(event);

            // All guild subscribers should receive the event
            for (const sub of subscribers) {
              const events = harness.getReceivedEvents(sub.id);
              expect(events.length).toBe(1);
              const firstEvent = events[0];
              expect(firstEvent).toBeDefined();
              expect(firstEvent!.type).toBe('CHANNEL_CREATE');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('member events are delivered to guild subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            guildId: snowflakeArb,
            user: userArb,
            subscriberCount: fc.integer({ min: 1, max: 5 }),
          }),
          async ({ guildId, user, subscriberCount }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create guild subscribers
            const subscribers: MockConnection[] = [];
            for (let i = 0; i < subscriberCount; i++) {
              const conn = harness.createConnection(`user-${i}` as Snowflake);
              await harness.subscribeToGuild(conn.id, guildId);
              subscribers.push(conn);
            }

            // Create and dispatch member event
            const event = createEvent('member.joined', {
              guild_id: guildId,
              user,
              joined_at: new Date().toISOString(),
            }) as MemberJoinedEvent;

            await harness.fanout.handleEvent(event);

            // All guild subscribers should receive the event
            for (const sub of subscribers) {
              const events = harness.getReceivedEvents(sub.id);
              expect(events.length).toBe(1);
              const firstEvent = events[0];
              expect(firstEvent).toBeDefined();
              expect(firstEvent!.type).toBe('MEMBER_ADD');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('role events are delivered to guild subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            roleId: snowflakeArb,
            guildId: snowflakeArb,
            roleName: fc.string({ minLength: 1, maxLength: 100 }),
            subscriberCount: fc.integer({ min: 1, max: 5 }),
          }),
          async ({ roleId, guildId, roleName, subscriberCount }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create guild subscribers
            const subscribers: MockConnection[] = [];
            for (let i = 0; i < subscriberCount; i++) {
              const conn = harness.createConnection(`user-${i}` as Snowflake);
              await harness.subscribeToGuild(conn.id, guildId);
              subscribers.push(conn);
            }

            // Create and dispatch role event
            const event = createEvent('role.updated', {
              role: {
                id: roleId,
                guild_id: guildId,
                name: roleName,
                position: 1,
                permissions: 0n,
                created_at: new Date(),
              },
              guild_id: guildId,
            }) as RoleUpdatedEvent;

            await harness.fanout.handleEvent(event);

            // All guild subscribers should receive the event
            for (const sub of subscribers) {
              const events = harness.getReceivedEvents(sub.id);
              expect(events.length).toBe(1);
              const firstEvent = events[0];
              expect(firstEvent).toBeDefined();
              expect(firstEvent!.type).toBe('ROLE_UPDATE');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('state converges correctly with duplicate deliveries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            channelId: snowflakeArb,
            guildId: snowflakeArb,
            messageId: snowflakeArb,
            authorId: snowflakeArb,
            content: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async ({ channelId, guildId, messageId, authorId, content }) => {
            // Reset harness
            harness = new EventFanoutTestHarness();

            // Create a subscriber
            const conn = harness.createConnection('user-1' as Snowflake);
            await harness.subscribeToChannel(conn.id, channelId);

            // Create the event
            const event = createEvent('message.created', {
              message: {
                id: messageId,
                channel_id: channelId,
                author_id: authorId,
                content,
                mentions: [],
                mention_roles: [],
                created_at: new Date(),
              },
              channel_id: channelId,
              guild_id: guildId,
            }) as MessageCreatedEvent;

            // Dispatch multiple times
            await harness.fanout.handleEvent(event);
            await harness.fanout.handleEvent(event);
            await harness.fanout.handleEvent(event);

            // Simulate client-side deduplication
            const events = harness.getReceivedEvents(conn.id);
            const uniqueEventIds = new Set(events.map(e => e.eventId));
            const deduplicatedEvents = Array.from(uniqueEventIds).map(id => 
              events.find(e => e.eventId === id)!
            );

            // After deduplication, should have exactly one event
            expect(deduplicatedEvents.length).toBe(1);
            const firstEvent = deduplicatedEvents[0];
            expect(firstEvent).toBeDefined();
            expect(firstEvent!.type).toBe('MESSAGE_CREATE');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Feature: discord-clone-core, Property 18: Permission Snapshot Consistency
 * Validates: Requirements 9.1, 13.1
 * 
 * For any message delivered to a client, the permission state used for delivery
 * authorization SHALL correspond to a permission snapshot at or after message
 * creation time. This prevents delivering messages to users who couldn't see
 * them at creation time.
 */
describe('Property 18: Permission Snapshot Consistency', () => {
  let harness: EventFanoutTestHarness;

  beforeEach(() => {
    harness = new EventFanoutTestHarness();
  });

  it('messages are only delivered to users subscribed to the channel', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          channelId: snowflakeArb,
          guildId: snowflakeArb,
          messageId: snowflakeArb,
          authorId: snowflakeArb,
          content: fc.string({ minLength: 1, maxLength: 100 }),
          authorizedUserCount: fc.integer({ min: 1, max: 5 }),
          unauthorizedUserCount: fc.integer({ min: 1, max: 5 }),
        }),
        async ({ channelId, guildId, messageId, authorId, content, authorizedUserCount, unauthorizedUserCount }) => {
          // Reset harness
          harness = new EventFanoutTestHarness();

          // Create authorized users (subscribed to channel)
          const authorizedUsers: MockConnection[] = [];
          for (let i = 0; i < authorizedUserCount; i++) {
            const conn = harness.createConnection(`authorized-user-${i}` as Snowflake);
            await harness.subscribeToChannel(conn.id, channelId);
            authorizedUsers.push(conn);
          }

          // Create unauthorized users (not subscribed to channel)
          const unauthorizedUsers: MockConnection[] = [];
          for (let i = 0; i < unauthorizedUserCount; i++) {
            const conn = harness.createConnection(`unauthorized-user-${i}` as Snowflake);
            // Subscribe to a different channel (simulating no permission)
            await harness.subscribeToChannel(conn.id, `other-channel-${i}` as Snowflake);
            unauthorizedUsers.push(conn);
          }

          // Create and dispatch message event
          const event = createEvent('message.created', {
            message: {
              id: messageId,
              channel_id: channelId,
              author_id: authorId,
              content,
              mentions: [],
              mention_roles: [],
              created_at: new Date(),
            },
            channel_id: channelId,
            guild_id: guildId,
          }) as MessageCreatedEvent;

          await harness.fanout.handleEvent(event);

          // Authorized users should receive the message
          for (const user of authorizedUsers) {
            const events = harness.getReceivedEvents(user.id);
            expect(events.length).toBe(1);
            const firstEvent = events[0];
            expect(firstEvent).toBeDefined();
            expect(firstEvent!.type).toBe('MESSAGE_CREATE');
          }

          // Unauthorized users should NOT receive the message
          for (const user of unauthorizedUsers) {
            const events = harness.getReceivedEvents(user.id);
            expect(events.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('permission changes do not retroactively deliver messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          channelId: snowflakeArb,
          guildId: snowflakeArb,
          messageId: snowflakeArb,
          authorId: snowflakeArb,
          content: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ channelId, guildId, messageId, authorId, content }) => {
          // Reset harness
          harness = new EventFanoutTestHarness();

          // Create a user who is NOT subscribed initially
          const user = harness.createConnection('user-1' as Snowflake);
          // User is subscribed to a different channel
          await harness.subscribeToChannel(user.id, 'other-channel' as Snowflake);

          // Create and dispatch message event BEFORE user subscribes
          const event = createEvent('message.created', {
            message: {
              id: messageId,
              channel_id: channelId,
              author_id: authorId,
              content,
              mentions: [],
              mention_roles: [],
              created_at: new Date(),
            },
            channel_id: channelId,
            guild_id: guildId,
          }) as MessageCreatedEvent;

          await harness.fanout.handleEvent(event);

          // User should NOT have received the message
          let events = harness.getReceivedEvents(user.id);
          expect(events.length).toBe(0);

          // Now subscribe the user to the channel (permission granted)
          await harness.subscribeToChannel(user.id, channelId);

          // User still should NOT have the old message (no retroactive delivery)
          events = harness.getReceivedEvents(user.id);
          expect(events.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('subscription at message creation time determines delivery', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          channelId: snowflakeArb,
          guildId: snowflakeArb,
          messageId1: snowflakeArb,
          messageId2: snowflakeArb,
          authorId: snowflakeArb,
          content: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ channelId, guildId, messageId1, messageId2, authorId, content }) => {
          // Reset harness
          harness = new EventFanoutTestHarness();

          // Create a user
          const user = harness.createConnection('user-1' as Snowflake);

          // First message - user NOT subscribed
          const event1 = createEvent('message.created', {
            message: {
              id: messageId1,
              channel_id: channelId,
              author_id: authorId,
              content: content + '-1',
              mentions: [],
              mention_roles: [],
              created_at: new Date(),
            },
            channel_id: channelId,
            guild_id: guildId,
          }) as MessageCreatedEvent;

          await harness.fanout.handleEvent(event1);

          // User should NOT receive first message
          let events = harness.getReceivedEvents(user.id);
          expect(events.length).toBe(0);

          // Subscribe user to channel
          await harness.subscribeToChannel(user.id, channelId);

          // Second message - user IS subscribed
          const event2 = createEvent('message.created', {
            message: {
              id: messageId2,
              channel_id: channelId,
              author_id: authorId,
              content: content + '-2',
              mentions: [],
              mention_roles: [],
              created_at: new Date(),
            },
            channel_id: channelId,
            guild_id: guildId,
          }) as MessageCreatedEvent;

          await harness.fanout.handleEvent(event2);

          // User should receive ONLY the second message
          events = harness.getReceivedEvents(user.id);
          expect(events.length).toBe(1);
          const firstEvent = events[0];
          expect(firstEvent).toBeDefined();
          expect(firstEvent!.eventId).toBe(event2.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
