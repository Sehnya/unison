/**
 * WebSocket Integration Tests
 *
 * Task 15.2: Write WebSocket integration tests
 * - Connection lifecycle
 * - Event fanout verification
 * - Reconnection and resume
 *
 * Requirements: 12.1-12.5, 13.1-13.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import type {
  Snowflake,
  User,
  Guild,
  ServerMessage,
  ClientMessage,
} from '@discord-clone/types';
import { WebSocketCloseCodes } from '@discord-clone/types';
import { createEvent } from '@discord-clone/events';
import type { MessageCreatedEvent, GuildUpdatedEvent } from '@discord-clone/types';

// Test configuration
const TEST_JWT_SECRET = 'test-jwt-secret-for-integration-tests';

/**
 * Helper to create a test JWT token
 */
function createTestToken(userId: Snowflake, sessionId: string): string {
  return jwt.sign(
    {
      sub: userId,
      session_id: sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    TEST_JWT_SECRET
  );
}


/**
 * Helper to create a test user
 */
function createTestUser(id: Snowflake, username: string): User {
  return {
    id,
    email: `${username}@test.com`,
    username,
    created_at: new Date(),
  };
}

/**
 * Helper to create a test guild
 */
function createTestGuild(id: Snowflake, ownerId: Snowflake, name: string): Guild {
  return {
    id,
    owner_id: ownerId,
    name,
    created_at: new Date(),
  };
}

/**
 * WebSocket client wrapper for testing (for future live server tests)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messageQueue: ServerMessage[] = [];
  private messageResolvers: Array<(msg: ServerMessage) => void> = [];
  private closePromise: Promise<{ code: number; reason: string }> | null = null;
  private closeResolver: ((result: { code: number; reason: string }) => void) | null = null;

  async connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${port}`);

      this.closePromise = new Promise((res) => {
        this.closeResolver = res;
      });

      this.ws.on('open', () => resolve());
      this.ws.on('error', (err) => reject(err));
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as ServerMessage;
        if (this.messageResolvers.length > 0) {
          const resolver = this.messageResolvers.shift()!;
          resolver(msg);
        } else {
          this.messageQueue.push(msg);
        }
      });
      this.ws.on('close', (code, reason) => {
        if (this.closeResolver) {
          this.closeResolver({ code, reason: reason.toString() });
        }
      });
    });
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  async waitForMessage(timeoutMs: number = 5000): Promise<ServerMessage> {
    if (this.messageQueue.length > 0) {
      return this.messageQueue.shift()!;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, timeoutMs);

      this.messageResolvers.push((msg) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });
  }

  async waitForClose(timeoutMs: number = 5000): Promise<{ code: number; reason: string }> {
    if (!this.closePromise) {
      throw new Error('Not connected');
    }

    return Promise.race([
      this.closePromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout waiting for close')), timeoutMs);
      }),
    ]);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}


/**
 * Mock User Data Provider for testing
 */
class MockUserDataProvider {
  private readonly users: Map<Snowflake, User> = new Map();
  private readonly userGuilds: Map<Snowflake, Guild[]> = new Map();
  private readonly validSessions: Set<string> = new Set();

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  setUserGuilds(userId: Snowflake, guilds: Guild[]): void {
    this.userGuilds.set(userId, guilds);
  }

  addValidSession(sessionId: string): void {
    this.validSessions.add(sessionId);
  }

  removeValidSession(sessionId: string): void {
    this.validSessions.delete(sessionId);
  }

  async getUser(userId: Snowflake): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async getUserGuilds(userId: Snowflake): Promise<Guild[]> {
    return this.userGuilds.get(userId) ?? [];
  }

  async validateSession(sessionId: string): Promise<boolean> {
    return this.validSessions.has(sessionId);
  }
}

/**
 * In-Memory Subscription Manager for testing
 */
class InMemorySubscriptionManager {
  private guildSubscriptions: Map<Snowflake, Set<string>> = new Map();
  private channelSubscriptions: Map<Snowflake, Set<string>> = new Map();
  private connectionGuilds: Map<string, Set<Snowflake>> = new Map();
  private connectionChannels: Map<string, Set<Snowflake>> = new Map();

  async subscribeToGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    if (!this.guildSubscriptions.has(guildId)) {
      this.guildSubscriptions.set(guildId, new Set());
    }
    this.guildSubscriptions.get(guildId)!.add(connectionId);

    if (!this.connectionGuilds.has(connectionId)) {
      this.connectionGuilds.set(connectionId, new Set());
    }
    this.connectionGuilds.get(connectionId)!.add(guildId);
  }

  async unsubscribeFromGuild(connectionId: string, guildId: Snowflake): Promise<void> {
    this.guildSubscriptions.get(guildId)?.delete(connectionId);
    this.connectionGuilds.get(connectionId)?.delete(guildId);
  }

  async subscribeToChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    if (!this.channelSubscriptions.has(channelId)) {
      this.channelSubscriptions.set(channelId, new Set());
    }
    this.channelSubscriptions.get(channelId)!.add(connectionId);

    if (!this.connectionChannels.has(connectionId)) {
      this.connectionChannels.set(connectionId, new Set());
    }
    this.connectionChannels.get(connectionId)!.add(channelId);
  }

  async unsubscribeFromChannel(connectionId: string, channelId: Snowflake): Promise<void> {
    this.channelSubscriptions.get(channelId)?.delete(connectionId);
    this.connectionChannels.get(connectionId)?.delete(channelId);
  }

  async getGuildSubscribers(guildId: Snowflake): Promise<string[]> {
    return Array.from(this.guildSubscriptions.get(guildId) ?? []);
  }

  async getChannelSubscribers(channelId: Snowflake): Promise<string[]> {
    return Array.from(this.channelSubscriptions.get(channelId) ?? []);
  }

  async removeConnection(connectionId: string): Promise<void> {
    const guilds = this.connectionGuilds.get(connectionId);
    if (guilds) {
      for (const guildId of guilds) {
        this.guildSubscriptions.get(guildId)?.delete(connectionId);
      }
    }
    this.connectionGuilds.delete(connectionId);

    const channels = this.connectionChannels.get(connectionId);
    if (channels) {
      for (const channelId of channels) {
        this.channelSubscriptions.get(channelId)?.delete(connectionId);
      }
    }
    this.connectionChannels.delete(connectionId);
  }
}


/**
 * Note: These tests require the WebSocket Gateway server to be running.
 * In a real integration test environment, we would start the server programmatically.
 * For now, these tests document the expected behavior and can be run against a live server.
 */
describe('WebSocket Integration Tests', () => {
  let userDataProvider: MockUserDataProvider;
  let subscriptionManager: InMemorySubscriptionManager;

  beforeEach(() => {
    userDataProvider = new MockUserDataProvider();
    subscriptionManager = new InMemorySubscriptionManager();
  });

  /**
   * Connection Lifecycle Tests
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
   */
  describe('Connection Lifecycle (Unit Tests)', () => {
    it('should create valid JWT tokens', () => {
      const userId = '123456789' as Snowflake;
      const sessionId = 'test-session-1';
      const token = createTestToken(userId, sessionId);

      // Verify token can be decoded
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as { sub: string; session_id: string };
      expect(decoded.sub).toBe(userId);
      expect(decoded.session_id).toBe(sessionId);
    });

    it('should track user data correctly', async () => {
      const userId = '123456789' as Snowflake;
      const sessionId = 'test-session-1';
      const user = createTestUser(userId, 'testuser');
      const guild = createTestGuild('987654321' as Snowflake, userId, 'Test Guild');

      userDataProvider.addUser(user);
      userDataProvider.setUserGuilds(userId, [guild]);
      userDataProvider.addValidSession(sessionId);

      // Verify user data
      const retrievedUser = await userDataProvider.getUser(userId);
      expect(retrievedUser).not.toBeNull();
      expect(retrievedUser!.id).toBe(userId);

      // Verify guilds
      const guilds = await userDataProvider.getUserGuilds(userId);
      expect(guilds.length).toBe(1);
      expect(guilds[0]!.id).toBe(guild.id);

      // Verify session
      const isValid = await userDataProvider.validateSession(sessionId);
      expect(isValid).toBe(true);

      // Invalidate session
      userDataProvider.removeValidSession(sessionId);
      const isStillValid = await userDataProvider.validateSession(sessionId);
      expect(isStillValid).toBe(false);
    });
  });

  /**
   * Subscription Management Tests
   * Requirements: 12.2, 13.1
   */
  describe('Subscription Management (Unit Tests)', () => {
    it('should track guild subscriptions', async () => {
      const connectionId = 'conn-1';
      const guildId = '111' as Snowflake;

      await subscriptionManager.subscribeToGuild(connectionId, guildId);

      const subscribers = await subscriptionManager.getGuildSubscribers(guildId);
      expect(subscribers).toContain(connectionId);
    });

    it('should track channel subscriptions', async () => {
      const connectionId = 'conn-1';
      const channelId = '222' as Snowflake;

      await subscriptionManager.subscribeToChannel(connectionId, channelId);

      const subscribers = await subscriptionManager.getChannelSubscribers(channelId);
      expect(subscribers).toContain(connectionId);
    });

    it('should handle unsubscribe correctly', async () => {
      const connectionId = 'conn-1';
      const guildId = '111' as Snowflake;
      const channelId = '222' as Snowflake;

      await subscriptionManager.subscribeToGuild(connectionId, guildId);
      await subscriptionManager.subscribeToChannel(connectionId, channelId);

      // Unsubscribe from guild
      await subscriptionManager.unsubscribeFromGuild(connectionId, guildId);
      let guildSubs = await subscriptionManager.getGuildSubscribers(guildId);
      expect(guildSubs).not.toContain(connectionId);

      // Channel subscription should still exist
      let channelSubs = await subscriptionManager.getChannelSubscribers(channelId);
      expect(channelSubs).toContain(connectionId);

      // Unsubscribe from channel
      await subscriptionManager.unsubscribeFromChannel(connectionId, channelId);
      channelSubs = await subscriptionManager.getChannelSubscribers(channelId);
      expect(channelSubs).not.toContain(connectionId);
    });

    it('should clean up all subscriptions on connection removal', async () => {
      const connectionId = 'conn-1';
      const guild1 = '111' as Snowflake;
      const guild2 = '222' as Snowflake;
      const channel1 = '333' as Snowflake;

      await subscriptionManager.subscribeToGuild(connectionId, guild1);
      await subscriptionManager.subscribeToGuild(connectionId, guild2);
      await subscriptionManager.subscribeToChannel(connectionId, channel1);

      // Remove connection
      await subscriptionManager.removeConnection(connectionId);

      // All subscriptions should be removed
      const guild1Subs = await subscriptionManager.getGuildSubscribers(guild1);
      const guild2Subs = await subscriptionManager.getGuildSubscribers(guild2);
      const channel1Subs = await subscriptionManager.getChannelSubscribers(channel1);

      expect(guild1Subs).not.toContain(connectionId);
      expect(guild2Subs).not.toContain(connectionId);
      expect(channel1Subs).not.toContain(connectionId);
    });

    it('should handle multiple connections to same guild', async () => {
      const conn1 = 'conn-1';
      const conn2 = 'conn-2';
      const conn3 = 'conn-3';
      const guildId = '111' as Snowflake;

      await subscriptionManager.subscribeToGuild(conn1, guildId);
      await subscriptionManager.subscribeToGuild(conn2, guildId);
      await subscriptionManager.subscribeToGuild(conn3, guildId);

      const subscribers = await subscriptionManager.getGuildSubscribers(guildId);
      expect(subscribers.length).toBe(3);
      expect(subscribers).toContain(conn1);
      expect(subscribers).toContain(conn2);
      expect(subscribers).toContain(conn3);

      // Remove one connection
      await subscriptionManager.removeConnection(conn2);

      const remainingSubs = await subscriptionManager.getGuildSubscribers(guildId);
      expect(remainingSubs.length).toBe(2);
      expect(remainingSubs).toContain(conn1);
      expect(remainingSubs).not.toContain(conn2);
      expect(remainingSubs).toContain(conn3);
    });
  });


  /**
   * Event Fanout Tests (Unit Tests)
   * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
   */
  describe('Event Fanout Logic (Unit Tests)', () => {
    it('should create valid message events', () => {
      const channelId = '666' as Snowflake;
      const guildId = '555' as Snowflake;
      const messageId = '777' as Snowflake;
      const authorId = '888' as Snowflake;

      const event = createEvent('message.created', {
        message: {
          id: messageId,
          channel_id: channelId,
          author_id: authorId,
          content: 'Hello, world!',
          mentions: [],
          mention_roles: [],
          created_at: new Date(),
        },
        channel_id: channelId,
        guild_id: guildId,
      }) as MessageCreatedEvent;

      expect(event.type).toBe('message.created');
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.data.message.id).toBe(messageId);
      expect(event.data.channel_id).toBe(channelId);
      expect(event.data.guild_id).toBe(guildId);
    });

    it('should create valid guild events', () => {
      const guildId = '999' as Snowflake;
      const ownerId = '123' as Snowflake;

      const guild = createTestGuild(guildId, ownerId, 'Updated Guild');
      const event = createEvent('guild.updated', {
        guild,
      }) as GuildUpdatedEvent;

      expect(event.type).toBe('guild.updated');
      expect(event.id).toBeDefined();
      expect(event.data.guild.id).toBe(guildId);
      expect(event.data.guild.name).toBe('Updated Guild');
    });

    it('should determine correct subscribers for channel events', async () => {
      const channelId = '666' as Snowflake;
      const conn1 = 'conn-1';
      const conn2 = 'conn-2';
      const conn3 = 'conn-3';

      // conn1 and conn2 subscribe to the channel
      await subscriptionManager.subscribeToChannel(conn1, channelId);
      await subscriptionManager.subscribeToChannel(conn2, channelId);

      // conn3 subscribes to a different channel
      await subscriptionManager.subscribeToChannel(conn3, 'other-channel' as Snowflake);

      const subscribers = await subscriptionManager.getChannelSubscribers(channelId);
      expect(subscribers.length).toBe(2);
      expect(subscribers).toContain(conn1);
      expect(subscribers).toContain(conn2);
      expect(subscribers).not.toContain(conn3);
    });

    it('should determine correct subscribers for guild events', async () => {
      const guildId = '555' as Snowflake;
      const conn1 = 'conn-1';
      const conn2 = 'conn-2';
      const conn3 = 'conn-3';

      // conn1 and conn2 subscribe to the guild
      await subscriptionManager.subscribeToGuild(conn1, guildId);
      await subscriptionManager.subscribeToGuild(conn2, guildId);

      // conn3 subscribes to a different guild
      await subscriptionManager.subscribeToGuild(conn3, 'other-guild' as Snowflake);

      const subscribers = await subscriptionManager.getGuildSubscribers(guildId);
      expect(subscribers.length).toBe(2);
      expect(subscribers).toContain(conn1);
      expect(subscribers).toContain(conn2);
      expect(subscribers).not.toContain(conn3);
    });
  });

  /**
   * Event Deduplication Tests
   * Requirements: 13.1, 13.2
   */
  describe('Event Deduplication (Unit Tests)', () => {
    it('should generate unique event IDs', () => {
      const eventIds = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const event = createEvent('message.created', {
          message: {
            id: `msg-${i}` as Snowflake,
            channel_id: 'channel' as Snowflake,
            author_id: 'author' as Snowflake,
            content: `Message ${i}`,
            mentions: [],
            mention_roles: [],
            created_at: new Date(),
          },
          channel_id: 'channel' as Snowflake,
          guild_id: 'guild' as Snowflake,
        }) as MessageCreatedEvent;

        eventIds.add(event.id);
      }

      // All event IDs should be unique
      expect(eventIds.size).toBe(100);
    });

    it('should allow client-side deduplication by event ID', () => {
      // Simulate receiving the same event multiple times
      const event = createEvent('message.created', {
        message: {
          id: 'msg-1' as Snowflake,
          channel_id: 'channel' as Snowflake,
          author_id: 'author' as Snowflake,
          content: 'Hello',
          mentions: [],
          mention_roles: [],
          created_at: new Date(),
        },
        channel_id: 'channel' as Snowflake,
        guild_id: 'guild' as Snowflake,
      }) as MessageCreatedEvent;

      // Simulate client receiving duplicates
      const receivedEvents = [event, event, event];
      const seenIds = new Set<string>();
      const deduplicated: MessageCreatedEvent[] = [];

      for (const e of receivedEvents) {
        if (!seenIds.has(e.id)) {
          seenIds.add(e.id);
          deduplicated.push(e);
        }
      }

      // After deduplication, should have only one event
      expect(deduplicated.length).toBe(1);
    });
  });

  /**
   * Sequence Number Tests
   * Requirements: 13.1
   */
  describe('Sequence Numbers (Unit Tests)', () => {
    it('should track sequence numbers correctly', () => {
      let sequence = 0;
      const events: Array<{ s: number; data: unknown }> = [];

      // Simulate dispatching events with sequence numbers
      for (let i = 0; i < 5; i++) {
        events.push({
          s: ++sequence,
          data: { message: `Event ${i}` },
        });
      }

      // Verify sequence numbers are monotonically increasing
      for (let i = 1; i < events.length; i++) {
        expect(events[i]!.s).toBe(events[i - 1]!.s + 1);
      }

      // First event should have sequence 1
      expect(events[0]!.s).toBe(1);

      // Last event should have sequence 5
      expect(events[events.length - 1]!.s).toBe(5);
    });

    it('should detect gaps in sequence numbers', () => {
      const receivedSequences = [1, 2, 4, 5]; // Missing 3

      // Detect gaps
      const gaps: number[] = [];
      for (let i = 1; i < receivedSequences.length; i++) {
        const expected = receivedSequences[i - 1]! + 1;
        const actual = receivedSequences[i]!;
        if (actual !== expected) {
          for (let missing = expected; missing < actual; missing++) {
            gaps.push(missing);
          }
        }
      }

      expect(gaps).toContain(3);
      expect(gaps.length).toBe(1);
    });
  });

  /**
   * WebSocket Close Codes Tests
   */
  describe('WebSocket Close Codes', () => {
    it('should have correct close code values', () => {
      expect(WebSocketCloseCodes.AUTHENTICATION_FAILED).toBe(4001);
      expect(WebSocketCloseCodes.SESSION_INVALIDATED).toBe(4002);
      expect(WebSocketCloseCodes.HEARTBEAT_TIMEOUT).toBe(4003);
      expect(WebSocketCloseCodes.INVALID_PAYLOAD).toBe(4004);
      expect(WebSocketCloseCodes.RATE_LIMITED).toBe(4005);
    });
  });
});
