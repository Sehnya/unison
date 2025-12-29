/**
 * Guild Service
 *
 * Handles guild CRUD, membership, invites, and bans.
 * Requirements: 3.1-3.6, 4.1-4.6, 5.1-5.5
 */
import { ChannelType, Permissions } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { GuildRepository } from './repository.js';
import { GuildNotFoundError, NotGuildOwnerError, NotGuildMemberError, AlreadyMemberError, UserBannedError, InviteNotFoundError, InviteExpiredError, InviteRevokedError, InviteMaxUsesReachedError, CannotKickOwnerError, CannotBanOwnerError, UserNotBannedError, CannotLeaveAsOwnerError, } from './errors.js';
import { generateInviteCode } from './utils.js';
/**
 * Default permissions for @everyone role
 * VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY | CREATE_INVITES
 */
const DEFAULT_EVERYONE_PERMISSIONS = Permissions.VIEW_CHANNEL |
    Permissions.SEND_MESSAGES |
    Permissions.READ_MESSAGE_HISTORY |
    Permissions.CREATE_INVITES;
/**
 * Guild Service
 */
export class GuildService {
    repository;
    snowflake;
    constructor(pool, config = {}) {
        this.repository = new GuildRepository(pool);
        this.snowflake = new SnowflakeGenerator(config.workerId ?? 0);
    }
    // ============================================
    // Guild CRUD Operations
    // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
    // ============================================
    /**
     * Create a new guild
     * Requirements: 3.1, 3.2, 3.3
     *
     * Creates:
     * - Guild with Snowflake ID, creator as owner
     * - Default "general" text channel
     * - Default "@everyone" role with guild ID as role ID
     * - Creator as first member
     */
    async createGuild(ownerId, name, options) {
        const client = await this.repository.getClient();
        try {
            await client.query('BEGIN');
            // Generate Snowflake ID for guild
            const guildId = this.snowflake.generate();
            // Create guild
            const guild = await this.repository.createGuild(guildId, ownerId, name, options, client);
            // Create default @everyone role with guild ID as role ID
            // Requirements: 3.3
            const everyoneRole = await this.repository.createRole(guildId, // @everyone role ID = guild ID
            guildId, '@everyone', DEFAULT_EVERYONE_PERMISSIONS, 0, // position 0 (lowest)
            client);
            // Create default "general" channel
            // Requirements: 3.2
            const channelId = this.snowflake.generate();
            const defaultChannel = await this.repository.createChannel(channelId, guildId, 'general', ChannelType.TEXT, 0, client);
            // Add creator as first member
            await this.repository.addMember(guildId, ownerId, client);
            await client.query('COMMIT');
            return { guild, defaultChannel, everyoneRole };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get all guilds for a user
     */
    async getUserGuilds(userId) {
        return this.repository.getUserGuilds(userId);
    }
    /**
     * Get a guild by ID
     */
    async getGuild(guildId) {
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        return guild;
    }
    /**
     * Update guild settings
     * Requirements: 3.4
     */
    async updateGuild(guildId, requesterId, updates) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Verify requester is owner
        if (guild.owner_id !== requesterId) {
            throw new NotGuildOwnerError();
        }
        const updatedGuild = await this.repository.updateGuild(guildId, updates);
        if (!updatedGuild) {
            throw new GuildNotFoundError();
        }
        return updatedGuild;
    }
    /**
     * Transfer guild ownership
     * Requirements: 3.5
     */
    async transferOwnership(guildId, currentOwnerId, newOwnerId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Verify requester is current owner
        if (guild.owner_id !== currentOwnerId) {
            throw new NotGuildOwnerError();
        }
        // Verify new owner is a member
        const isMember = await this.repository.isMember(guildId, newOwnerId);
        if (!isMember) {
            throw new NotGuildMemberError();
        }
        const updatedGuild = await this.repository.transferOwnership(guildId, newOwnerId);
        if (!updatedGuild) {
            throw new GuildNotFoundError();
        }
        return updatedGuild;
    }
    /**
     * Delete a guild (soft-delete)
     * Requirements: 3.6
     */
    async deleteGuild(guildId, requesterId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Verify requester is owner
        if (guild.owner_id !== requesterId) {
            throw new NotGuildOwnerError();
        }
        const deleted = await this.repository.deleteGuild(guildId);
        if (!deleted) {
            throw new GuildNotFoundError();
        }
    }
    // ============================================
    // Membership Operations
    // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
    // ============================================
    /**
     * Join a guild via invite
     * Requirements: 4.1, 4.6
     */
    async joinGuild(userId, inviteCode) {
        // Validate invite
        const invite = await this.validateInvite(inviteCode);
        // Check if user is banned
        const isBanned = await this.repository.isBanned(invite.guild_id, userId);
        if (isBanned) {
            throw new UserBannedError();
        }
        // Check if already a member
        const isMember = await this.repository.isMember(invite.guild_id, userId);
        if (isMember) {
            throw new AlreadyMemberError();
        }
        const client = await this.repository.getClient();
        try {
            await client.query('BEGIN');
            // Add member
            const member = await this.repository.addMember(invite.guild_id, userId, client);
            // Increment invite uses
            await this.repository.incrementInviteUses(inviteCode, client);
            await client.query('COMMIT');
            return member;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Leave a guild
     * Requirements: 4.3
     */
    async leaveGuild(guildId, userId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Owner cannot leave (must transfer ownership or delete guild)
        if (guild.owner_id === userId) {
            throw new CannotLeaveAsOwnerError();
        }
        // Verify user is a member
        const isMember = await this.repository.isMember(guildId, userId);
        if (!isMember) {
            throw new NotGuildMemberError();
        }
        await this.repository.removeMember(guildId, userId);
    }
    /**
     * Kick a member from a guild
     * Requirements: 4.4
     * Note: Permission check for KICK_MEMBERS will be added when integrating with permissions service
     */
    async kickMember(guildId, _requesterId, targetUserId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Cannot kick the owner
        if (guild.owner_id === targetUserId) {
            throw new CannotKickOwnerError();
        }
        // Verify target is a member
        const isMember = await this.repository.isMember(guildId, targetUserId);
        if (!isMember) {
            throw new NotGuildMemberError();
        }
        await this.repository.removeMember(guildId, targetUserId);
    }
    /**
     * Ban a member from a guild
     * Requirements: 4.5
     */
    async banMember(guildId, requesterId, targetUserId, reason) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Cannot ban the owner
        if (guild.owner_id === targetUserId) {
            throw new CannotBanOwnerError();
        }
        const client = await this.repository.getClient();
        try {
            await client.query('BEGIN');
            // Remove membership if exists
            await this.repository.removeMember(guildId, targetUserId, client);
            // Create ban record
            const ban = await this.repository.createBan(guildId, targetUserId, requesterId, reason, client);
            await client.query('COMMIT');
            return ban;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Unban a user from a guild
     */
    async unbanMember(guildId, targetUserId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Verify user is banned
        const isBanned = await this.repository.isBanned(guildId, targetUserId);
        if (!isBanned) {
            throw new UserNotBannedError();
        }
        await this.repository.removeBan(guildId, targetUserId);
    }
    /**
     * Get a member
     */
    async getMember(guildId, userId) {
        const member = await this.repository.getMember(guildId, userId);
        if (!member) {
            throw new NotGuildMemberError();
        }
        return member;
    }
    /**
     * Get all members of a guild
     */
    async getGuildMembers(guildId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        return this.repository.getGuildMembers(guildId);
    }
    /**
     * Check if a user is banned
     */
    async isBanned(guildId, userId) {
        return this.repository.isBanned(guildId, userId);
    }
    /**
     * Get all bans for a guild
     */
    async getGuildBans(guildId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        return this.repository.getGuildBans(guildId);
    }
    // ============================================
    // Invite Operations
    // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
    // ============================================
    /**
     * Create an invite
     * Requirements: 5.1
     */
    async createInvite(guildId, creatorId, options = {}) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        // Verify creator is a member
        const isMember = await this.repository.isMember(guildId, creatorId);
        if (!isMember) {
            throw new NotGuildMemberError();
        }
        // Generate unique invite code
        const code = generateInviteCode();
        // Calculate expiration
        let expiresAt;
        if (options.expires_in) {
            expiresAt = new Date(Date.now() + options.expires_in * 1000);
        }
        return this.repository.createInvite(code, guildId, creatorId, options.max_uses, expiresAt);
    }
    /**
     * Validate an invite
     * Requirements: 5.3, 5.4
     */
    async validateInvite(code) {
        const invite = await this.repository.getInviteByCode(code);
        if (!invite) {
            throw new InviteNotFoundError();
        }
        // Check if revoked
        if (invite.revoked_at) {
            throw new InviteRevokedError();
        }
        // Check if expired by time
        if (invite.expires_at && invite.expires_at < new Date()) {
            throw new InviteExpiredError();
        }
        // Check if max uses reached
        if (invite.max_uses !== undefined && invite.uses >= invite.max_uses) {
            throw new InviteMaxUsesReachedError();
        }
        // Verify guild still exists
        const guild = await this.repository.getGuildById(invite.guild_id);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        return invite;
    }
    /**
     * Revoke an invite
     * Requirements: 5.5
     */
    async revokeInvite(guildId, code) {
        // Verify invite exists and belongs to guild
        const invite = await this.repository.getInviteByCode(code);
        if (!invite || invite.guild_id !== guildId) {
            throw new InviteNotFoundError();
        }
        const revoked = await this.repository.revokeInvite(code);
        if (!revoked) {
            throw new InviteNotFoundError();
        }
    }
    /**
     * Get all invites for a guild
     */
    async getGuildInvites(guildId) {
        // Verify guild exists
        const guild = await this.repository.getGuildById(guildId);
        if (!guild) {
            throw new GuildNotFoundError();
        }
        return this.repository.getGuildInvites(guildId);
    }
    /**
     * Get an invite by code
     */
    async getInvite(code) {
        const invite = await this.repository.getInviteByCode(code);
        if (!invite) {
            throw new InviteNotFoundError();
        }
        return invite;
    }
    /**
     * Get the repository for direct access
     */
    getRepository() {
        return this.repository;
    }
}
//# sourceMappingURL=service.js.map