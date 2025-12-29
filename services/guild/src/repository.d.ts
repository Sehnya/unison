/**
 * Guild Repository - Database operations for guilds, members, invites, and bans
 *
 * Requirements: 3.1-3.6, 4.1-4.6, 5.1-5.5
 */
import type { Pool, PoolClient } from 'pg';
import type { Snowflake, Guild, Member, Invite, Ban, Channel, Role } from '@discord-clone/types';
import { ChannelType } from '@discord-clone/types';
/**
 * Guild row from database
 */
export interface GuildRow {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    icon: string | null;
    banner: string | null;
    created_at: Date;
    deleted_at: Date | null;
}
/**
 * Member row from database
 */
export interface MemberRow {
    guild_id: string;
    user_id: string;
    nickname: string | null;
    joined_at: Date;
}
/**
 * Invite row from database
 */
export interface InviteRow {
    code: string;
    guild_id: string;
    creator_id: string;
    max_uses: number | null;
    uses: number;
    expires_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
}
/**
 * Ban row from database
 */
export interface BanRow {
    guild_id: string;
    user_id: string;
    reason: string | null;
    banned_by: string;
    created_at: Date;
}
/**
 * Channel row from database
 */
export interface ChannelRow {
    id: string;
    guild_id: string;
    type: number;
    name: string;
    topic: string | null;
    parent_id: string | null;
    position: number;
    created_at: Date;
    deleted_at: Date | null;
}
/**
 * Role row from database
 */
export interface RoleRow {
    id: string;
    guild_id: string;
    name: string;
    color: string | null;
    position: number;
    permissions: string;
    created_at: Date;
}
/**
 * Convert database row to Guild type
 */
export declare function rowToGuild(row: GuildRow): Guild;
/**
 * Convert database row to Member type
 */
export declare function rowToMember(row: MemberRow, roles?: Snowflake[]): Member;
/**
 * Convert database row to Invite type
 */
export declare function rowToInvite(row: InviteRow): Invite;
/**
 * Convert database row to Ban type
 */
export declare function rowToBan(row: BanRow): Ban;
/**
 * Convert database row to Channel type
 */
export declare function rowToChannel(row: ChannelRow): Channel;
/**
 * Convert database row to Role type
 */
export declare function rowToRole(row: RoleRow): Role;
/**
 * Guild Repository
 */
export declare class GuildRepository {
    private readonly pool;
    constructor(pool: Pool);
    /**
     * Create a new guild
     * Requirements: 3.1
     */
    createGuild(id: Snowflake, ownerId: Snowflake, name: string, options?: {
        description?: string;
        icon?: string;
        banner?: string;
    }, client?: PoolClient): Promise<Guild>;
    /**
     * Get all guilds for a user
     */
    getUserGuilds(userId: Snowflake): Promise<Guild[]>;
    /**
     * Get guild by ID
     */
    getGuildById(guildId: Snowflake): Promise<Guild | null>;
    /**
     * Update guild settings
     * Requirements: 3.4
     */
    updateGuild(guildId: Snowflake, updates: {
        name?: string;
        icon?: string | null;
    }, client?: PoolClient): Promise<Guild | null>;
    /**
     * Transfer guild ownership
     * Requirements: 3.5
     */
    transferOwnership(guildId: Snowflake, newOwnerId: Snowflake, client?: PoolClient): Promise<Guild | null>;
    /**
     * Soft-delete a guild
     * Requirements: 3.6
     */
    deleteGuild(guildId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Add a member to a guild
     * Requirements: 4.1
     */
    addMember(guildId: Snowflake, userId: Snowflake, client?: PoolClient): Promise<Member>;
    /**
     * Remove a member from a guild
     * Requirements: 4.3, 4.4
     */
    removeMember(guildId: Snowflake, userId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Get a member by guild and user ID
     */
    getMember(guildId: Snowflake, userId: Snowflake): Promise<Member | null>;
    /**
     * Check if a user is a member of a guild
     */
    isMember(guildId: Snowflake, userId: Snowflake): Promise<boolean>;
    /**
     * Get all members of a guild
     */
    getGuildMembers(guildId: Snowflake): Promise<Member[]>;
    /**
     * Get member role IDs
     */
    getMemberRoleIds(guildId: Snowflake, userId: Snowflake): Promise<Snowflake[]>;
    /**
     * Ban a user from a guild
     * Requirements: 4.5
     */
    createBan(guildId: Snowflake, userId: Snowflake, bannedBy: Snowflake, reason?: string, client?: PoolClient): Promise<Ban>;
    /**
     * Remove a ban
     */
    removeBan(guildId: Snowflake, userId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Check if a user is banned from a guild
     * Requirements: 4.6
     */
    isBanned(guildId: Snowflake, userId: Snowflake): Promise<boolean>;
    /**
     * Get a ban record
     */
    getBan(guildId: Snowflake, userId: Snowflake): Promise<Ban | null>;
    /**
     * Get all bans for a guild
     */
    getGuildBans(guildId: Snowflake): Promise<Ban[]>;
    /**
     * Create an invite
     * Requirements: 5.1
     */
    createInvite(code: string, guildId: Snowflake, creatorId: Snowflake, maxUses?: number, expiresAt?: Date, client?: PoolClient): Promise<Invite>;
    /**
     * Get an invite by code
     */
    getInviteByCode(code: string): Promise<Invite | null>;
    /**
     * Increment invite use count
     * Requirements: 5.2
     */
    incrementInviteUses(code: string, client?: PoolClient): Promise<Invite | null>;
    /**
     * Revoke an invite
     * Requirements: 5.5
     */
    revokeInvite(code: string, client?: PoolClient): Promise<boolean>;
    /**
     * Get all invites for a guild
     */
    getGuildInvites(guildId: Snowflake): Promise<Invite[]>;
    /**
     * Create a channel
     * Requirements: 3.2
     */
    createChannel(id: Snowflake, guildId: Snowflake, name: string, type?: ChannelType, position?: number, client?: PoolClient): Promise<Channel>;
    /**
     * Get channels for a guild
     */
    getGuildChannels(guildId: Snowflake): Promise<Channel[]>;
    /**
     * Create a role
     * Requirements: 3.3
     */
    createRole(id: Snowflake, guildId: Snowflake, name: string, permissions: bigint, position?: number, client?: PoolClient): Promise<Role>;
    /**
     * Get the @everyone role for a guild
     */
    getEveryoneRole(guildId: Snowflake): Promise<Role | null>;
    /**
     * Check if a user exists
     */
    userExists(userId: Snowflake): Promise<boolean>;
    /**
     * Get a database client for transactions
     */
    getClient(): Promise<PoolClient>;
}
//# sourceMappingURL=repository.d.ts.map