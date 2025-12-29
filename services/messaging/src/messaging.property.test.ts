/**
 * Property-Based Tests for Messaging Service
 *
 * Feature: discord-clone-core
 * Properties: 11, 12, 19
 * Validates: Requirements 9.1, 9.5, 10.1-10.5, 11.2, 11.3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { MessagingService, type PermissionChecker } from './service.js';
import { Permissions } from '@discord-clone/types';
import type { Snowflake, Message } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';

// Test database configuration
const TEST_DB_CONFIG = {
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432'),
  database: process.env.POSTGRES_DB ?? 'discord_clone_test',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
};

// Generators for property-based testing
const snowflakeGenerator = new SnowflakeGenerator(999); // Test worker ID

const messageContentGen = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Mock permission checker that allows all permissions by default
 */
class MockPermissionChecker implements PermissionChecker {
  private permissions: Map<string, bigint> = new Map();

  setPermissions(userId: Snowflake, channelId: Snowflake, permissions: bigint): void {
    this.permissions.set(`${userId}:${channelId}`, permissions);
  }

  async hasPermission(userId: Snowflake, channelId: Snowflake, permission: bigint): Promise<boolean> {
    const key = `${userId}:${channelId}`;
    const userPerms = this.permissions.get(key);
    if (userPerms === undefined) {
      // Default: allow all permissions
      return true;
    }
    // Check for ADMINISTRATOR
    if ((userPerms & Permissions.ADMINISTRATOR) !== 0n) {
      return true;
    }
    return (userPerms & permission) === permission;
  }

  clear(): void {
    this.permissions.clear();
  }
}


describe('Property Tests: Messaging Service', () => {
  let pool: Pool;
  let messagingService: MessagingService;
  let permissionChecker: MockPermissionChecker;
  let testUserIds: Snowflake[] = [];
  let testGuildIds: Snowflake[] = [];
  let testChannelIds: Snowflake[] = [];
  let dbAvailable = false;

  beforeAll(async () => {
    pool = new Pool(TEST_DB_CONFIG);

    // Test database connection
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch {
      console.warn('Database not available, skipping integration tests');
      dbAvailable = false;
      return;
    }

    permissionChecker = new MockPermissionChecker();
    messagingService = new MessagingService(pool, {
      workerId: 1,
      permissionChecker,
    });
  });

  afterAll(async () => {
    if (pool) {
      // Clean up test data in reverse order of dependencies
      for (const channelId of testChannelIds) {
        await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]).catch(() => {});
        await pool.query('DELETE FROM channels WHERE id = $1', [channelId]).catch(() => {});
      }
      for (const guildId of testGuildIds) {
        await pool.query('DELETE FROM guilds WHERE id = $1', [guildId]).catch(() => {});
      }
      for (const userId of testUserIds) {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
      }
      await pool.end();
    }
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    permissionChecker.clear();
  });

  /**
   * Helper to create a test user
   */
  async function createTestUser(username: string): Promise<Snowflake> {
    const userId = snowflakeGenerator.generate();
    const email = `${userId}_${Date.now()}@test.com`;
    await pool.query(
      `INSERT INTO users (id, email, username, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [userId, email, username, 'test_hash']
    );
    testUserIds.push(userId);
    return userId;
  }

  /**
   * Helper to create a test guild
   */
  async function createTestGuild(ownerId: Snowflake, name: string): Promise<Snowflake> {
    const guildId = snowflakeGenerator.generate();
    await pool.query(
      `INSERT INTO guilds (id, owner_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [guildId, ownerId, name]
    );
    testGuildIds.push(guildId);
    return guildId;
  }

  /**
   * Helper to create a test channel
   */
  async function createTestChannel(guildId: Snowflake, name: string): Promise<Snowflake> {
    const channelId = snowflakeGenerator.generate();
    await pool.query(
      `INSERT INTO channels (id, guild_id, type, name, position)
       VALUES ($1, $2, 0, $3, 0)
       ON CONFLICT (id) DO NOTHING`,
      [channelId, guildId, name]
    );
    testChannelIds.push(channelId);
    return channelId;
  }

  /**
   * Helper to add a small delay between message creations
   * This ensures Snowflake IDs are generated with different timestamps
   */
  async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  /**
   * Property 11: Message Pagination Ordering
   *
   * *For any* channel with messages:
   * - Messages are returned ordered by Snowflake_ID (chronologically)
   * - Cursor-based pagination (before/after) returns correct subsets
   * - Page size never exceeds 100 messages
   * - Pagination is stable (same query returns same results if no changes)
   *
   * Feature: discord-clone-core, Property 11: Message Pagination Ordering
   * Validates: Requirements 10.2, 10.3, 10.4
   */
  describe('Property 11: Message Pagination Ordering', () => {
    it('should return messages ordered by Snowflake ID (chronologically)', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (messageCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create messages with small delays to ensure different timestamps
            const createdMessages: Message[] = [];
            for (let i = 0; i < messageCount; i++) {
              const message = await messagingService.createMessage(
                channelId,
                userId,
                `Message ${i + 1}`
              );
              createdMessages.push(message);
              await delay(5); // Small delay to ensure different Snowflake timestamps
            }

            // Fetch messages
            const fetchedMessages = await messagingService.getMessages(channelId, userId);

            // Verify ordering: messages should be in chronological order (oldest first)
            for (let i = 1; i < fetchedMessages.length; i++) {
              const prevId = BigInt(fetchedMessages[i - 1]!.id);
              const currId = BigInt(fetchedMessages[i]!.id);
              expect(currId).toBeGreaterThan(prevId);
            }

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return correct subset with before cursor', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }),
          async (messageCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create messages
            const createdMessages: Message[] = [];
            for (let i = 0; i < messageCount; i++) {
              const message = await messagingService.createMessage(
                channelId,
                userId,
                `Message ${i + 1}`
              );
              createdMessages.push(message);
              await delay(5);
            }

            // Pick a cursor in the middle
            const cursorIndex = Math.floor(messageCount / 2);
            const cursorMessage = createdMessages[cursorIndex]!;

            // Fetch messages before cursor
            const beforeMessages = await messagingService.getMessages(channelId, userId, {
              before: cursorMessage.id,
            });

            // All returned messages should have IDs less than cursor
            for (const msg of beforeMessages) {
              expect(BigInt(msg.id)).toBeLessThan(BigInt(cursorMessage.id));
            }

            // Should return messages in chronological order
            for (let i = 1; i < beforeMessages.length; i++) {
              expect(BigInt(beforeMessages[i]!.id)).toBeGreaterThan(BigInt(beforeMessages[i - 1]!.id));
            }

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should return correct subset with after cursor', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }),
          async (messageCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create messages
            const createdMessages: Message[] = [];
            for (let i = 0; i < messageCount; i++) {
              const message = await messagingService.createMessage(
                channelId,
                userId,
                `Message ${i + 1}`
              );
              createdMessages.push(message);
              await delay(5);
            }

            // Pick a cursor in the middle
            const cursorIndex = Math.floor(messageCount / 2);
            const cursorMessage = createdMessages[cursorIndex]!;

            // Fetch messages after cursor
            const afterMessages = await messagingService.getMessages(channelId, userId, {
              after: cursorMessage.id,
            });

            // All returned messages should have IDs greater than cursor
            for (const msg of afterMessages) {
              expect(BigInt(msg.id)).toBeGreaterThan(BigInt(cursorMessage.id));
            }

            // Should return messages in chronological order
            for (let i = 1; i < afterMessages.length; i++) {
              expect(BigInt(afterMessages[i]!.id)).toBeGreaterThan(BigInt(afterMessages[i - 1]!.id));
            }

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should never exceed page size limit of 100', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 150 }),
          async (requestedLimit) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create 110 messages (more than max page size)
            for (let i = 0; i < 110; i++) {
              await messagingService.createMessage(channelId, userId, `Message ${i + 1}`);
            }

            // Request with various limits
            const messages = await messagingService.getMessages(channelId, userId, {
              limit: requestedLimit,
            });

            // Should never exceed 100
            expect(messages.length).toBeLessThanOrEqual(100);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 5 } // Fewer runs due to creating many messages
      );
    });

    it('should be stable (same query returns same results)', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          async (messageCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create messages
            for (let i = 0; i < messageCount; i++) {
              await messagingService.createMessage(channelId, userId, `Message ${i + 1}`);
              await delay(5);
            }

            // Fetch messages twice
            const firstFetch = await messagingService.getMessages(channelId, userId);
            const secondFetch = await messagingService.getMessages(channelId, userId);

            // Results should be identical
            expect(firstFetch.length).toBe(secondFetch.length);
            for (let i = 0; i < firstFetch.length; i++) {
              expect(firstFetch[i]!.id).toBe(secondFetch[i]!.id);
              expect(firstFetch[i]!.content).toBe(secondFetch[i]!.content);
            }

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Property 12: Permission Enforcement Symmetry
   *
   * *For any* user and channel:
   * - If user has SEND_MESSAGES permission, message creation succeeds
   * - If user lacks SEND_MESSAGES permission, message creation fails with permission error
   * - If user has READ_MESSAGE_HISTORY permission, message fetch succeeds
   * - If user lacks READ_MESSAGE_HISTORY permission, message fetch fails with permission error
   *
   * Feature: discord-clone-core, Property 12: Permission Enforcement Symmetry
   * Validates: Requirements 9.1, 9.5, 10.1, 10.5
   */
  describe('Property 12: Permission Enforcement Symmetry', () => {
    it('should allow message creation when user has SEND_MESSAGES permission', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(messageContentGen, async (content) => {
          const userId = await createTestUser('testuser');
          const guildId = await createTestGuild(userId, 'Test Guild');
          const channelId = await createTestChannel(guildId, 'test-channel');

          // Grant SEND_MESSAGES permission
          permissionChecker.setPermissions(userId, channelId, Permissions.SEND_MESSAGES);

          // Should succeed
          const message = await messagingService.createMessage(channelId, userId, content);
          expect(message).toBeDefined();
          expect(message.content).toBe(content);

          // Clean up
          await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject message creation when user lacks SEND_MESSAGES permission', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(messageContentGen, async (content) => {
          const userId = await createTestUser('testuser');
          const guildId = await createTestGuild(userId, 'Test Guild');
          const channelId = await createTestChannel(guildId, 'test-channel');

          // Grant only READ permission (no SEND_MESSAGES)
          permissionChecker.setPermissions(userId, channelId, Permissions.READ_MESSAGE_HISTORY);

          // Should fail with permission error
          let permissionDenied = false;
          try {
            await messagingService.createMessage(channelId, userId, content);
          } catch (error) {
            if (error instanceof Error && error.message.includes('SEND_MESSAGES')) {
              permissionDenied = true;
            }
          }

          expect(permissionDenied).toBe(true);
        }),
        { numRuns: 10 }
      );
    });

    it('should allow message fetch when user has READ_MESSAGE_HISTORY permission', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (messageCount) => {
            const authorId = await createTestUser('author');
            const readerId = await createTestUser('reader');
            const guildId = await createTestGuild(authorId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Author has all permissions
            permissionChecker.setPermissions(
              authorId,
              channelId,
              Permissions.SEND_MESSAGES | Permissions.READ_MESSAGE_HISTORY
            );

            // Create some messages
            for (let i = 0; i < messageCount; i++) {
              await messagingService.createMessage(channelId, authorId, `Message ${i + 1}`);
            }

            // Reader has READ_MESSAGE_HISTORY permission
            permissionChecker.setPermissions(readerId, channelId, Permissions.READ_MESSAGE_HISTORY);

            // Should succeed
            const messages = await messagingService.getMessages(channelId, readerId);
            expect(messages.length).toBe(messageCount);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject message fetch when user lacks READ_MESSAGE_HISTORY permission', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (messageCount) => {
            const authorId = await createTestUser('author');
            const readerId = await createTestUser('reader');
            const guildId = await createTestGuild(authorId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Author has all permissions
            permissionChecker.setPermissions(
              authorId,
              channelId,
              Permissions.SEND_MESSAGES | Permissions.READ_MESSAGE_HISTORY
            );

            // Create some messages
            for (let i = 0; i < messageCount; i++) {
              await messagingService.createMessage(channelId, authorId, `Message ${i + 1}`);
            }

            // Reader has only SEND_MESSAGES (no READ_MESSAGE_HISTORY)
            permissionChecker.setPermissions(readerId, channelId, Permissions.SEND_MESSAGES);

            // Should fail with permission error
            let permissionDenied = false;
            try {
              await messagingService.getMessages(channelId, readerId);
            } catch (error) {
              if (error instanceof Error && error.message.includes('READ_MESSAGE_HISTORY')) {
                permissionDenied = true;
              }
            }

            expect(permissionDenied).toBe(true);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should allow all operations when user has ADMINISTRATOR permission', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(messageContentGen, async (content) => {
          const adminId = await createTestUser('admin');
          const guildId = await createTestGuild(adminId, 'Test Guild');
          const channelId = await createTestChannel(guildId, 'test-channel');

          // Admin has only ADMINISTRATOR permission (should grant all)
          permissionChecker.setPermissions(adminId, channelId, Permissions.ADMINISTRATOR);

          // Should be able to create messages
          const message = await messagingService.createMessage(channelId, adminId, content);
          expect(message).toBeDefined();

          // Should be able to read messages
          const messages = await messagingService.getMessages(channelId, adminId);
          expect(messages.length).toBe(1);

          // Clean up
          await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
        }),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Property 17: Message Idempotency
   *
   * *For any* duplicated message.created event with the same message ID, the system
   * SHALL converge to a single message instance. Duplicate events from JetStream
   * retries SHALL NOT create duplicate messages.
   *
   * Feature: discord-clone-core, Property 17: Message Idempotency
   * Validates: Requirements 9.2, 15.2
   */
  describe('Property 17: Message Idempotency', () => {
    it('should handle duplicate message creation idempotently', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          fc.integer({ min: 2, max: 5 }),
          async (content, duplicateCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create a message
            const originalMessage = await messagingService.createMessage(channelId, userId, content);

            // Simulate duplicate event processing by calling createMessageIdempotent
            const repository = messagingService.getRepository();
            const results: { message: Message; created: boolean }[] = [];
            
            for (let i = 0; i < duplicateCount; i++) {
              const result = await repository.createMessageIdempotent(
                originalMessage.id,
                channelId,
                userId,
                content,
                [],
                [],
                originalMessage.created_at
              );
              results.push(result);
            }

            // All results should return the same message
            for (const result of results) {
              expect(result.message.id).toBe(originalMessage.id);
              expect(result.message.content).toBe(content);
              // Only the first one should have created=true (but since original was already created, all should be false)
              expect(result.created).toBe(false);
            }

            // Verify only one message exists in the database
            const messages = await messagingService.getMessages(channelId, userId);
            expect(messages.length).toBe(1);
            expect(messages[0]!.id).toBe(originalMessage.id);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle concurrent duplicate message creation', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          async (content) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            const repository = messagingService.getRepository();
            const messageId = snowflakeGenerator.generate();
            const createdAt = new Date();

            // Simulate concurrent duplicate events
            const promises = Array.from({ length: 5 }, () =>
              repository.createMessageIdempotent(
                messageId,
                channelId,
                userId,
                content,
                [],
                [],
                createdAt
              )
            );

            const results = await Promise.all(promises);

            // Exactly one should have created=true
            const createdCount = results.filter(r => r.created).length;
            expect(createdCount).toBe(1);

            // All should return the same message
            const messageIds = new Set(results.map(r => r.message.id));
            expect(messageIds.size).toBe(1);

            // Verify only one message exists
            const messages = await messagingService.getMessages(channelId, userId);
            expect(messages.length).toBe(1);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle idempotent updates', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          messageContentGen,
          fc.integer({ min: 2, max: 5 }),
          async (originalContent, newContent, updateCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create a message
            const message = await messagingService.createMessage(channelId, userId, originalContent);

            // Update the message
            const updatedMessage = await messagingService.updateMessage(message.id, userId, newContent);
            expect(updatedMessage).toBeDefined();

            // Simulate duplicate update events with version check
            const repository = messagingService.getRepository();
            const results: { message: Message | null; updated: boolean }[] = [];
            
            for (let i = 0; i < updateCount; i++) {
              const result = await repository.updateMessageIdempotent(
                message.id,
                newContent,
                message.edited_at ?? null // Use original edited_at (null)
              );
              results.push(result);
            }

            // All results should return the current message state
            for (const result of results) {
              expect(result.message).not.toBeNull();
              expect(result.message!.content).toBe(newContent);
              // None should have updated=true since content is already newContent
              expect(result.updated).toBe(false);
            }

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should handle idempotent deletes', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          fc.integer({ min: 2, max: 5 }),
          async (content, deleteCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create a message
            const message = await messagingService.createMessage(channelId, userId, content);

            // Delete the message multiple times using idempotent method
            const repository = messagingService.getRepository();
            const results: { deleted: boolean; wasAlreadyDeleted: boolean }[] = [];
            
            for (let i = 0; i < deleteCount; i++) {
              const result = await repository.deleteMessageIdempotent(message.id);
              results.push(result);
            }

            // First delete should succeed, rest should indicate already deleted
            expect(results[0]!.deleted).toBe(true);
            expect(results[0]!.wasAlreadyDeleted).toBe(false);
            
            for (let i = 1; i < results.length; i++) {
              expect(results[i]!.deleted).toBe(true);
              expect(results[i]!.wasAlreadyDeleted).toBe(true);
            }

            // Message should not appear in fetch results
            const messages = await messagingService.getMessages(channelId, userId);
            expect(messages.length).toBe(0);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should converge to deleted state regardless of event order', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          messageContentGen,
          async (originalContent, editContent) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create a message
            const message = await messagingService.createMessage(channelId, userId, originalContent);

            // Delete the message
            await messagingService.deleteMessage(message.id, userId);

            // Simulate late-arriving edit event (should be ignored due to deletion dominance)
            const repository = messagingService.getRepository();
            const editResult = await repository.updateMessageIdempotent(
              message.id,
              editContent,
              null
            );

            // Edit should fail (message is null because it's deleted)
            expect(editResult.message).toBeNull();
            expect(editResult.updated).toBe(false);

            // Message should still be deleted
            const messages = await messagingService.getMessages(channelId, userId);
            expect(messages.length).toBe(0);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Property 19: Deletion Dominance
   *
   * *For any* message that has been deleted (deleted_at is set), the message
   * SHALL be treated as deleted regardless of any subsequent edit events received.
   * Deletion dominates edits in all conflict resolution.
   *
   * Feature: discord-clone-core, Property 19: Deletion Dominance
   * Validates: Requirements 11.2, 11.3
   */
  describe('Property 19: Deletion Dominance', () => {
    it('should reject edits on deleted messages', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          messageContentGen,
          async (originalContent, newContent) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create a message
            const message = await messagingService.createMessage(channelId, userId, originalContent);

            // Delete the message
            await messagingService.deleteMessage(message.id, userId);

            // Attempt to edit should fail
            let editRejected = false;
            try {
              await messagingService.updateMessage(message.id, userId, newContent);
            } catch (error) {
              if (error instanceof Error && error.message.includes('deleted')) {
                editRejected = true;
              }
            }

            expect(editRejected).toBe(true);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should not return deleted messages in fetch results', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 3, max: 10 }),
          fc.integer({ min: 1, max: 2 }),
          async (totalMessages, deleteCount) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create messages
            const createdMessages: Message[] = [];
            for (let i = 0; i < totalMessages; i++) {
              const message = await messagingService.createMessage(
                channelId,
                userId,
                `Message ${i + 1}`
              );
              createdMessages.push(message);
              await delay(5);
            }

            // Delete some messages
            const messagesToDelete = createdMessages.slice(0, deleteCount);
            for (const msg of messagesToDelete) {
              await messagingService.deleteMessage(msg.id, userId);
            }

            // Fetch messages
            const fetchedMessages = await messagingService.getMessages(channelId, userId);

            // Should not include deleted messages
            expect(fetchedMessages.length).toBe(totalMessages - deleteCount);

            // Verify none of the deleted message IDs are in the results
            const deletedIds = new Set(messagesToDelete.map((m) => m.id));
            for (const msg of fetchedMessages) {
              expect(deletedIds.has(msg.id)).toBe(false);
            }

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should treat getMessage as not found for deleted messages', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(messageContentGen, async (content) => {
          const userId = await createTestUser('testuser');
          const guildId = await createTestGuild(userId, 'Test Guild');
          const channelId = await createTestChannel(guildId, 'test-channel');

          // Create and delete a message
          const message = await messagingService.createMessage(channelId, userId, content);
          await messagingService.deleteMessage(message.id, userId);

          // getMessage should throw not found
          let notFound = false;
          try {
            await messagingService.getMessage(message.id);
          } catch (error) {
            if (error instanceof Error && error.message.includes('not found')) {
              notFound = true;
            }
          }

          expect(notFound).toBe(true);

          // Clean up
          await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
        }),
        { numRuns: 10 }
      );
    });

    it('should be idempotent for delete operations', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          messageContentGen,
          fc.integer({ min: 1, max: 5 }),
          async (content, deleteAttempts) => {
            const userId = await createTestUser('testuser');
            const guildId = await createTestGuild(userId, 'Test Guild');
            const channelId = await createTestChannel(guildId, 'test-channel');

            // Create a message
            const message = await messagingService.createMessage(channelId, userId, content);

            // Delete multiple times - should not throw
            for (let i = 0; i < deleteAttempts; i++) {
              await messagingService.deleteMessage(message.id, userId);
            }

            // Message should still be deleted
            let notFound = false;
            try {
              await messagingService.getMessage(message.id);
            } catch (error) {
              if (error instanceof Error && error.message.includes('not found')) {
                notFound = true;
              }
            }

            expect(notFound).toBe(true);

            // Clean up
            await pool.query('DELETE FROM messages WHERE channel_id = $1', [channelId]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
