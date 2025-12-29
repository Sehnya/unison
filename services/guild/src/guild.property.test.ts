/**
 * Property-Based Tests for Guild Service
 *
 * Feature: discord-clone-core
 * Properties: 5, 6, 7, 8
 * Validates: Requirements 3.1-3.3, 4.1-4.6, 5.1-5.5
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { GuildService } from './service.js';
import { ChannelType, Permissions } from '@discord-clone/types';
import type { Snowflake, Member } from '@discord-clone/types';
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

const guildNameGen = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/**
 * Default permissions for @everyone role
 * VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | CREATE_INVITES
 */
const DEFAULT_EVERYONE_PERMISSIONS =
  Permissions.VIEW_CHANNEL |
  Permissions.SEND_MESSAGES |
  Permissions.READ_MESSAGE_HISTORY |
  Permissions.CREATE_INVITES;

describe('Property Tests: Guild Service', () => {
  let pool: Pool;
  let guildService: GuildService;
  let testUserIds: Snowflake[] = [];
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

    guildService = new GuildService(pool, { workerId: 1 });
  });

  afterAll(async () => {
    if (pool) {
      // Clean up test data
      for (const userId of testUserIds) {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
      }
      await pool.end();
    }
  });

  beforeEach(async () => {
    if (!dbAvailable) return;

    // Clean up guilds created in previous tests
    await pool.query(`
      DELETE FROM guilds WHERE name LIKE 'Test Guild%' OR name LIKE '%test%'
    `).catch(() => {});
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
   * Property 5: Guild Creation Invariants
   *
   * *For any* newly created guild, the following invariants SHALL hold:
   * - The guild has a valid Snowflake_ID
   * - The creator is set as owner_id
   * - A default "general" text channel exists
   * - A default "@everyone" role exists with the guild's ID as its role ID
   *
   * Feature: discord-clone-core, Property 5: Guild Creation Invariants
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  describe('Property 5: Guild Creation Invariants', () => {
    it('should create guild with valid Snowflake ID and correct owner', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('testowner');
          const result = await guildService.createGuild(ownerId, guildName);

          // Invariant 1: Guild has a valid Snowflake ID
          expect(result.guild.id).toBeDefined();
          expect(typeof result.guild.id).toBe('string');
          expect(result.guild.id.length).toBeGreaterThan(0);

          // Invariant 2: Creator is set as owner_id
          expect(result.guild.owner_id).toBe(ownerId);

          // Invariant 3: Guild name matches input
          expect(result.guild.name).toBe(guildName.trim());

          await pool.query('DELETE FROM guilds WHERE id = $1', [result.guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should create default general channel on guild creation', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('testowner');
          const result = await guildService.createGuild(ownerId, guildName);

          expect(result.defaultChannel).toBeDefined();
          expect(result.defaultChannel.name).toBe('general');
          expect(result.defaultChannel.type).toBe(ChannelType.TEXT);
          expect(result.defaultChannel.guild_id).toBe(result.guild.id);
          expect(result.defaultChannel.position).toBe(0);

          await pool.query('DELETE FROM guilds WHERE id = $1', [result.guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should create default @everyone role with guild ID as role ID', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('testowner');
          const result = await guildService.createGuild(ownerId, guildName);

          expect(result.everyoneRole).toBeDefined();
          expect(result.everyoneRole.id).toBe(result.guild.id);
          expect(result.everyoneRole.name).toBe('@everyone');
          expect(result.everyoneRole.guild_id).toBe(result.guild.id);
          expect(result.everyoneRole.position).toBe(0);
          expect(result.everyoneRole.permissions).toBe(DEFAULT_EVERYONE_PERMISSIONS);

          await pool.query('DELETE FROM guilds WHERE id = $1', [result.guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should add creator as first member of the guild', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('testowner');
          const result = await guildService.createGuild(ownerId, guildName);

          const memberResult = await pool.query(
            'SELECT * FROM guild_members WHERE guild_id = $1 AND user_id = $2',
            [result.guild.id, ownerId]
          );
          expect(memberResult.rows.length).toBe(1);

          await pool.query('DELETE FROM guilds WHERE id = $1', [result.guild.id]);
        }),
        { numRuns: 10 }
      );
    });
  });


  /**
   * Property 6: Membership State Consistency
   *
   * *For any* guild and user, the membership state SHALL be consistent:
   * - After joining: user appears in member list with joined_at timestamp
   * - After leaving/kick/ban: user no longer appears in member list
   *
   * Feature: discord-clone-core, Property 6: Membership State Consistency
   * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
   */
  describe('Property 6: Membership State Consistency', () => {
    it('should add user to member list after joining via invite', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const joinerId = await createTestUser('joiner');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId);
          const member = await guildService.joinGuild(joinerId, invite.code);

          expect(member.guild_id).toBe(guild.id);
          expect(member.user_id).toBe(joinerId);
          expect(member.joined_at).toBeDefined();
          expect(member.joined_at instanceof Date).toBe(true);

          const members = await guildService.getGuildMembers(guild.id);
          const foundMember = members.find((m: Member) => m.user_id === joinerId);
          expect(foundMember).toBeDefined();

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should remove user from member list after leaving', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const joinerId = await createTestUser('joiner');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId);
          await guildService.joinGuild(joinerId, invite.code);
          await guildService.leaveGuild(guild.id, joinerId);

          const members = await guildService.getGuildMembers(guild.id);
          const foundMember = members.find((m: Member) => m.user_id === joinerId);
          expect(foundMember).toBeUndefined();

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should remove user from member list after being kicked', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const targetId = await createTestUser('target');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId);
          await guildService.joinGuild(targetId, invite.code);
          await guildService.kickMember(guild.id, ownerId, targetId);

          const members = await guildService.getGuildMembers(guild.id);
          const foundMember = members.find((m: Member) => m.user_id === targetId);
          expect(foundMember).toBeUndefined();

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should remove user from member list and create ban record after being banned', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const targetId = await createTestUser('target');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId);
          await guildService.joinGuild(targetId, invite.code);
          const ban = await guildService.banMember(guild.id, ownerId, targetId, 'Test ban');

          const members = await guildService.getGuildMembers(guild.id);
          const foundMember = members.find((m: Member) => m.user_id === targetId);
          expect(foundMember).toBeUndefined();

          expect(ban.guild_id).toBe(guild.id);
          expect(ban.user_id).toBe(targetId);
          expect(ban.banned_by).toBe(ownerId);
          expect(ban.reason).toBe('Test ban');

          const isBanned = await guildService.isBanned(guild.id, targetId);
          expect(isBanned).toBe(true);

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 7: Ban Enforcement
   *
   * *For any* banned user attempting to rejoin a guild, the join request
   * SHALL be rejected regardless of invite validity.
   *
   * Feature: discord-clone-core, Property 7: Ban Enforcement
   * Validates: Requirements 4.6
   */
  describe('Property 7: Ban Enforcement', () => {
    it('should reject join attempts from banned users', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const bannedUserId = await createTestUser('banned');

          // Create guild
          const { guild } = await guildService.createGuild(ownerId, guildName);

          // Create invite
          const invite = await guildService.createInvite(guild.id, ownerId);

          // Join and then get banned
          await guildService.joinGuild(bannedUserId, invite.code);
          await guildService.banMember(guild.id, ownerId, bannedUserId, 'Test ban');

          // Create a new invite
          const newInvite = await guildService.createInvite(guild.id, ownerId);

          // Attempt to rejoin should fail
          let rejoinFailed = false;
          try {
            await guildService.joinGuild(bannedUserId, newInvite.code);
          } catch (error) {
            if (error instanceof Error && error.message === 'You are banned from this guild') {
              rejoinFailed = true;
            }
          }

          expect(rejoinFailed).toBe(true);

          // Verify user is still banned
          const isBanned = await guildService.isBanned(guild.id, bannedUserId);
          expect(isBanned).toBe(true);

          // Verify user is not in member list
          const members = await guildService.getGuildMembers(guild.id);
          const foundMember = members.find((m: Member) => m.user_id === bannedUserId);
          expect(foundMember).toBeUndefined();

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should allow rejoining after unban', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const userId = await createTestUser('user');

          // Create guild
          const { guild } = await guildService.createGuild(ownerId, guildName);

          // Create invite, join, ban
          const invite = await guildService.createInvite(guild.id, ownerId);
          await guildService.joinGuild(userId, invite.code);
          await guildService.banMember(guild.id, ownerId, userId, 'Test ban');

          // Unban
          await guildService.unbanMember(guild.id, userId);

          // Verify user is no longer banned
          const isBanned = await guildService.isBanned(guild.id, userId);
          expect(isBanned).toBe(false);

          // Create new invite and rejoin
          const newInvite = await guildService.createInvite(guild.id, ownerId);
          const member = await guildService.joinGuild(userId, newInvite.code);

          expect(member.guild_id).toBe(guild.id);
          expect(member.user_id).toBe(userId);

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 8: Invite Lifecycle
   *
   * *For any* invite:
   * - Use count increments on each successful use
   * - Invite becomes invalid when use count reaches max_uses
   * - Invite becomes invalid after expires_at timestamp
   * - Revoked invites are immediately invalid
   * - Each invite code is unique
   *
   * Feature: discord-clone-core, Property 8: Invite Lifecycle
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
   */
  describe('Property 8: Invite Lifecycle', () => {
    it('should increment use count on each successful use', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const user1Id = await createTestUser('user1');
          const user2Id = await createTestUser('user2');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId);

          expect(invite.uses).toBe(0);

          // First use
          await guildService.joinGuild(user1Id, invite.code);
          const inviteAfterFirst = await guildService.getInvite(invite.code);
          expect(inviteAfterFirst.uses).toBe(1);

          // Second use
          await guildService.joinGuild(user2Id, invite.code);
          const inviteAfterSecond = await guildService.getInvite(invite.code);
          expect(inviteAfterSecond.uses).toBe(2);

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject invite when max_uses is reached', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const user1Id = await createTestUser('user1');
          const user2Id = await createTestUser('user2');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId, { max_uses: 1 });

          // First use should succeed
          await guildService.joinGuild(user1Id, invite.code);

          // Second use should fail
          let maxUsesReached = false;
          try {
            await guildService.joinGuild(user2Id, invite.code);
          } catch (error) {
            if (error instanceof Error && error.message === 'Invite has reached maximum uses') {
              maxUsesReached = true;
            }
          }

          expect(maxUsesReached).toBe(true);

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject revoked invites', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(guildNameGen, async (guildName) => {
          const ownerId = await createTestUser('owner');
          const userId = await createTestUser('user');

          const { guild } = await guildService.createGuild(ownerId, guildName);
          const invite = await guildService.createInvite(guild.id, ownerId);

          // Revoke the invite
          await guildService.revokeInvite(guild.id, invite.code);

          // Attempt to use should fail
          let inviteRevoked = false;
          try {
            await guildService.joinGuild(userId, invite.code);
          } catch (error) {
            if (error instanceof Error && error.message === 'Invite has been revoked') {
              inviteRevoked = true;
            }
          }

          expect(inviteRevoked).toBe(true);

          await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
        }),
        { numRuns: 10 }
      );
    });

    it('should generate unique invite codes', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (count) => {
            const ownerId = await createTestUser('owner');
            const { guild } = await guildService.createGuild(ownerId, 'Test Guild');

            const codes = new Set<string>();
            for (let i = 0; i < count; i++) {
              const invite = await guildService.createInvite(guild.id, ownerId);
              codes.add(invite.code);
            }

            // All codes should be unique
            expect(codes.size).toBe(count);

            await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should list all guild invites', async () => {
      if (!dbAvailable) {
        console.log('Skipping test: database not available');
        return;
      }

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (count) => {
            const ownerId = await createTestUser('owner');
            const { guild } = await guildService.createGuild(ownerId, 'Test Guild');

            const createdCodes: string[] = [];
            for (let i = 0; i < count; i++) {
              const invite = await guildService.createInvite(guild.id, ownerId);
              createdCodes.push(invite.code);
            }

            const invites = await guildService.getGuildInvites(guild.id);
            expect(invites.length).toBe(count);

            // All created codes should be in the list
            for (const code of createdCodes) {
              const found = invites.find((i) => i.code === code);
              expect(found).toBeDefined();
            }

            await pool.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
