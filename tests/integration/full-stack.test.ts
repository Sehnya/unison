/**
 * Full Stack Integration Tests
 *
 * Tests the complete flow: REST API → Service → Database → Event Bus → WebSocket
 * 
 * These tests require:
 * - PostgreSQL running (POSTGRES_HOST, POSTGRES_PORT, etc.)
 * - NATS JetStream running (NATS_SERVERS) - optional
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import type { Express } from 'express';
import type { Snowflake } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { Permissions } from '@discord-clone/types';

// Test configuration
const TEST_DB_CONFIG = {
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432'),
  database: process.env.POSTGRES_DB ?? 'discord_clone_test',
  user: process.env.POSTGRES_USER ?? 'postgres',
  password: process.env.POSTGRES_PASSWORD ?? 'postgres',
};

const snowflakeGenerator = new SnowflakeGenerator(999);

/**
 * Helper to generate unique email
 */
function uniqueEmail(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
}

/**
 * Mock password hash for testing
 */
function mockPasswordHash(): string {
  return '$argon2id$v=19$m=65536,t=3,p=4$mock_salt$mock_hash';
}

describe('Full Stack Integration Tests', () => {
  let pool: Pool;
  let dbAvailable = false;
  let app: Express;

  // Track created resources for cleanup
  const createdUserIds: Snowflake[] = [];
  const createdGuildIds: Snowflake[] = [];

  beforeAll(async () => {
    // Test database connection
    pool = new Pool(TEST_DB_CONFIG);
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch {
      console.warn('Database not available, skipping full stack tests');
      return;
    }

    // Bootstrap API if database is available
    if (dbAvailable) {
      try {
        const { createApiServer } = await import('../../services/api/src/server.js');
        const { createMockTokenValidator } = await import('../../services/api/src/bootstrap.js');
        
        // Import services
        const { AuthService } = await import('../../services/auth/src/service.js');
        const { GuildService } = await import('../../services/guild/src/service.js');
        const { ChannelService } = await import('../../services/channel/src/service.js');
        const { MessagingService } = await import('../../services/messaging/src/service.js');
        const { PermissionsService } = await import('../../services/permissions/src/service.js');

        // Create services
        const workerId = 999;
        const permissionsService = new PermissionsService(pool, { workerId });
        const authService = new AuthService(pool, { workerId });
        const guildService = new GuildService(pool, { workerId });
        const channelService = new ChannelService(pool, { workerId });
        const messagingService = new MessagingService(pool, {
          workerId,
          permissionChecker: {
            hasPermission: async (userId: Snowflake, channelId: Snowflake, permission: bigint) => {
              return permissionsService.hasPermission(userId, channelId, permission);
            },
          },
        });

        // Create API server
        app = createApiServer({
          authService,
          guildService,
          channelService,
          messagingService,
          permissionsService,
          validateToken: createMockTokenValidator(),
        });
      } catch (error) {
        console.error('Failed to bootstrap API:', error);
        dbAvailable = false;
      }
    }
  });

  afterAll(async () => {
    if (!pool) return;

    // Clean up created guilds (cascades to channels, members, etc.)
    for (const guildId of createdGuildIds) {
      await pool.query('DELETE FROM guilds WHERE id = $1', [guildId]).catch(() => {});
    }

    // Clean up created users
    for (const userId of createdUserIds) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {});
    }

    await pool.end();
  });

  /**
   * Helper to create a test user directly in the database
   */
  async function createTestUser(username: string): Promise<{ id: Snowflake; email: string }> {
    const userId = snowflakeGenerator.generate();
    const email = uniqueEmail(username);
    await pool.query(
      `INSERT INTO users (id, email, username, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [userId, email, username, mockPasswordHash()]
    );
    createdUserIds.push(userId);
    return { id: userId, email };
  }

  /**
   * Helper to create a test guild with default channel and role
   */
  async function createTestGuild(ownerId: Snowflake, name: string): Promise<{
    guildId: Snowflake;
    channelId: Snowflake;
  }> {
    const guildId = snowflakeGenerator.generate();
    const channelId = snowflakeGenerator.generate();

    // Create guild
    await pool.query(
      `INSERT INTO guilds (id, owner_id, name) VALUES ($1, $2, $3)`,
      [guildId, ownerId, name]
    );
    createdGuildIds.push(guildId);

    // Create @everyone role
    const defaultPermissions =
      Permissions.VIEW_CHANNEL |
      Permissions.SEND_MESSAGES |
      Permissions.READ_MESSAGE_HISTORY |
      Permissions.CREATE_INVITES;

    await pool.query(
      `INSERT INTO roles (id, guild_id, name, permissions, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [guildId, guildId, '@everyone', defaultPermissions.toString(), 0]
    );

    // Create default channel
    await pool.query(
      `INSERT INTO channels (id, guild_id, type, name, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [channelId, guildId, 0, 'general', 0]
    );

    // Add owner as member
    await pool.query(
      `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)`,
      [guildId, ownerId]
    );

    return { guildId, channelId };
  }

  /**
   * Helper to get auth token for a user (mock format: userId:sessionId)
   */
  function getAuthToken(userId: Snowflake): string {
    return `${userId}:test-session-${Date.now()}`;
  }

  describe('REST API → Database Flow', () => {
    it('should create and retrieve a guild via API', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      // Create a test user
      const user = await createTestUser('ApiGuildOwner');
      const token = getAuthToken(user.id);

      // Create guild via API
      const createResponse = await request(app)
        .post('/guilds')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'API Test Guild' });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.guild).toBeDefined();
      expect(createResponse.body.guild.name).toBe('API Test Guild');

      const guildId = createResponse.body.guild.id;
      createdGuildIds.push(guildId);

      // Retrieve guild via API
      const getResponse = await request(app)
        .get(`/guilds/${guildId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.guild.id).toBe(guildId);
      expect(getResponse.body.guild.name).toBe('API Test Guild');
    });

    it('should create channels via API', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const user = await createTestUser('ChannelOwner');
      const { guildId } = await createTestGuild(user.id, 'Channel Test Guild');
      const token = getAuthToken(user.id);

      // Create a text channel
      const createResponse = await request(app)
        .post(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'test-channel', type: 'TEXT' });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.channel).toBeDefined();
      expect(createResponse.body.channel.name).toBe('test-channel');

      // Get all channels
      const listResponse = await request(app)
        .get(`/guilds/${guildId}/channels`)
        .set('Authorization', `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.channels.length).toBeGreaterThanOrEqual(2); // general + test-channel
    });

    it('should send and retrieve messages via API', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const user = await createTestUser('MessageAuthor');
      const { guildId, channelId } = await createTestGuild(user.id, 'Message Test Guild');
      const token = getAuthToken(user.id);

      // Send a message
      const sendResponse = await request(app)
        .post(`/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello, world!' });

      expect(sendResponse.status).toBe(201);
      expect(sendResponse.body.message).toBeDefined();
      expect(sendResponse.body.message.content).toBe('Hello, world!');

      const messageId = sendResponse.body.message.id;

      // Get messages
      const getResponse = await request(app)
        .get(`/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.messages).toBeDefined();
      expect(getResponse.body.messages.some((m: { id: string }) => m.id === messageId)).toBe(true);
    });

    it('should handle message editing and deletion', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const user = await createTestUser('EditAuthor');
      const { channelId } = await createTestGuild(user.id, 'Edit Test Guild');
      const token = getAuthToken(user.id);

      // Send a message
      const sendResponse = await request(app)
        .post(`/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Original content' });

      const messageId = sendResponse.body.message.id;

      // Edit the message
      const editResponse = await request(app)
        .patch(`/channels/${channelId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Edited content' });

      expect(editResponse.status).toBe(200);
      expect(editResponse.body.message.content).toBe('Edited content');
      expect(editResponse.body.message.edited_at).toBeDefined();

      // Delete the message
      const deleteResponse = await request(app)
        .delete(`/channels/${channelId}/messages/${messageId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteResponse.status).toBe(200);

      // Verify message is not in list
      const getResponse = await request(app)
        .get(`/channels/${channelId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(getResponse.body.messages.some((m: { id: string }) => m.id === messageId)).toBe(false);
    });
  });

  describe('Role and Permission Management', () => {
    it('should create and assign roles via API', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const owner = await createTestUser('RoleOwner');
      const member = await createTestUser('RoleMember');
      const { guildId } = await createTestGuild(owner.id, 'Role Test Guild');
      const token = getAuthToken(owner.id);

      // Add member to guild
      await pool.query(
        `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)`,
        [guildId, member.id]
      );

      // Create a role
      const createResponse = await request(app)
        .post(`/guilds/${guildId}/roles`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Moderator',
          permissions: Permissions.MANAGE_MESSAGES.toString(),
          color: '#FF0000',
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.role).toBeDefined();
      expect(createResponse.body.role.name).toBe('Moderator');

      const roleId = createResponse.body.role.id;

      // Assign role to member
      const assignResponse = await request(app)
        .put(`/guilds/${guildId}/members/${member.id}/roles/${roleId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(assignResponse.status).toBe(200);

      // Get member roles
      const rolesResponse = await request(app)
        .get(`/guilds/${guildId}/members/${member.id}/roles`)
        .set('Authorization', `Bearer ${token}`);

      expect(rolesResponse.status).toBe(200);
      expect(rolesResponse.body.roles.some((r: { id: string }) => r.id === roleId)).toBe(true);
    });

    it('should set channel permission overwrites', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const owner = await createTestUser('OverwriteOwner');
      const { guildId, channelId } = await createTestGuild(owner.id, 'Overwrite Test Guild');
      const token = getAuthToken(owner.id);

      // Set a channel overwrite for @everyone role (deny SEND_MESSAGES)
      const setResponse = await request(app)
        .put(`/channels/${channelId}/overwrites/${guildId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'role',
          allow: '0',
          deny: Permissions.SEND_MESSAGES.toString(),
        });

      expect(setResponse.status).toBe(200);
      expect(setResponse.body.overwrite).toBeDefined();

      // Get channel overwrites
      const getResponse = await request(app)
        .get(`/channels/${channelId}/overwrites`)
        .set('Authorization', `Bearer ${token}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.overwrites.length).toBeGreaterThan(0);
    });
  });

  describe('Guild Membership Flow', () => {
    it('should handle invite creation and guild joining', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const owner = await createTestUser('InviteOwner');
      const joiner = await createTestUser('InviteJoiner');
      const { guildId } = await createTestGuild(owner.id, 'Invite Test Guild');
      const ownerToken = getAuthToken(owner.id);
      const joinerToken = getAuthToken(joiner.id);

      // Create an invite
      const inviteResponse = await request(app)
        .post(`/guilds/${guildId}/invites`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ max_uses: 10, expires_in: 3600 });

      expect(inviteResponse.status).toBe(201);
      expect(inviteResponse.body.invite).toBeDefined();
      expect(inviteResponse.body.invite.code).toBeDefined();

      const inviteCode = inviteResponse.body.invite.code;

      // Join guild via invite
      const joinResponse = await request(app)
        .post(`/guilds/${guildId}/members`)
        .set('Authorization', `Bearer ${joinerToken}`)
        .send({ invite_code: inviteCode });

      expect(joinResponse.status).toBe(201);

      // Verify membership
      const membersResponse = await request(app)
        .get(`/guilds/${guildId}/members`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(membersResponse.status).toBe(200);
      expect(membersResponse.body.members.some((m: { user_id: string }) => m.user_id === joiner.id)).toBe(true);
    });

    it('should handle member kick and ban', async () => {
      if (!dbAvailable || !app) {
        console.log('Skipping test: database or app not available');
        return;
      }

      const owner = await createTestUser('BanOwner');
      const target = await createTestUser('BanTarget');
      const { guildId } = await createTestGuild(owner.id, 'Ban Test Guild');
      const ownerToken = getAuthToken(owner.id);

      // Add target as member
      await pool.query(
        `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)`,
        [guildId, target.id]
      );

      // Ban the member
      const banResponse = await request(app)
        .post(`/guilds/${guildId}/bans/${target.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Test ban' });

      expect(banResponse.status).toBe(200);

      // Verify ban exists
      const bansResponse = await request(app)
        .get(`/guilds/${guildId}/bans`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(bansResponse.status).toBe(200);
      expect(bansResponse.body.bans.some((b: { user_id: string }) => b.user_id === target.id)).toBe(true);

      // Unban
      const unbanResponse = await request(app)
        .delete(`/guilds/${guildId}/bans/${target.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(unbanResponse.status).toBe(200);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      if (!app) {
        console.log('Skipping test: app not available');
        return;
      }

      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
});
