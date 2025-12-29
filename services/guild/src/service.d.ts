/**
 * Guild Service
 *
 * Handles guild CRUD, membership, invites, and bans.
 * Requirements: 3.1-3.6, 4.1-4.6, 5.1-5.5
 */
import type { Pool } from 'pg';
import type { Snowflake, Guild, Member, Invite, Ban, Channel, Role, InviteOptions } from '@discord-clone/types';
import { GuildRepository } from './repository.js';
/**
 * Guild Service Configuration
 */
export interface GuildServiceConfig {
    workerId?: number;
}
/**
 * Guild creation result
 */
export interface GuildCreationResult {
    guild: Guild;
    defaultChannel: Channel;
    everyoneRole: Role;
}
/**
 * Guild Service
 */
export declare class GuildService {
    private readonly repository;
    private readonly snowflake;
    constructor(pool: Pool, config?: GuildServiceConfig);
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
    createGuild(ownerId: Snowflake, name: string, options?: {
        description?: string;
        icon?: string;
        banner?: string;
    }): Promise<GuildCreationResult>;
    /**
     * Get all guilds for a user
     */
    getUserGuilds(userId: Snowflake): Promise<Guild[]>;
    /**
     * Get a guild by ID
     */
    getGuild(guildId: Snowflake): Promise<Guild>;
    /**
     * Update guild settings
     * Requirements: 3.4
     */
    updateGuild(guildId: Snowflake, requesterId: Snowflake, updates: {
        name?: string;
        description?: string | null;
        icon?: string | null;
        banner?: string | null;
    }): Promise<Guild>;
    /**
     * Transfer guild ownership
     * Requirements: 3.5
     */
    transferOwnership(guildId: Snowflake, currentOwnerId: Snowflake, newOwnerId: Snowflake): Promise<Guild>;
    /**
     * Delete a guild (soft-delete)
     * Requirements: 3.6
     */
    deleteGuild(guildId: Snowflake, requesterId: Snowflake): Promise<void>;
    /**
     * Join a guild via invite
     * Requirements: 4.1, 4.6
     */
    joinGuild(userId: Snowflake, inviteCode: string): Promise<Member>;
    /**
     * Leave a guild
     * Requirements: 4.3
     */
    leaveGuild(guildId: Snowflake, userId: Snowflake): Promise<void>;
    /**
     * Kick a member from a guild
     * Requirements: 4.4
     * Note: Permission check for KICK_MEMBERS will be added when integrating with permissions service
     */
    kickMember(guildId: Snowflake, _requesterId: Snowflake, targetUserId: Snowflake): Promise<void>;
    /**
     * Ban a member from a guild
     * Requirements: 4.5
     */
    banMember(guildId: Snowflake, requesterId: Snowflake, targetUserId: Snowflake, reason?: string): Promise<Ban>;
    /**
     * Unban a user from a guild
     */
    unbanMember(guildId: Snowflake, targetUserId: Snowflake): Promise<void>;
    /**
     * Get a member
     */
    getMember(guildId: Snowflake, userId: Snowflake): Promise<Member>;
    /**
     * Get all members of a guild
     */
    getGuildMembers(guildId: Snowflake): Promise<Member[]>;
    /**
     * Check if a user is banned
     */
    isBanned(guildId: Snowflake, userId: Snowflake): Promise<boolean>;
    /**
     * Get all bans for a guild
     */
    getGuildBans(guildId: Snowflake): Promise<Ban[]>;
    /**
     * Create an invite
     * Requirements: 5.1
     */
    createInvite(guildId: Snowflake, creatorId: Snowflake, options?: InviteOptions): Promise<Invite>;
    /**
     * Validate an invite
     * Requirements: 5.3, 5.4
     */
    validateInvite(code: string): Promise<Invite>;
    /**
     * Revoke an invite
     * Requirements: 5.5
     */
    revokeInvite(guildId: Snowflake, code: string): Promise<void>;
    /**
     * Get all invites for a guild
     */
    getGuildInvites(guildId: Snowflake): Promise<Invite[]>;
    /**
     * Get an invite by code
     */
    getInvite(code: string): Promise<Invite>;
    /**
     * Get the repository for direct access
     */
    getRepository(): GuildRepository;
}
//# sourceMappingURL=service.d.ts.map