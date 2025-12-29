/**
 * Permissions Repository - Database operations for roles and permissions
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 8.5
 */
import type { Pool, PoolClient } from 'pg';
import type { Snowflake, Role, ChannelOverwrite, Guild } from '@discord-clone/types';
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
 * Channel overwrite row from database
 */
export interface ChannelOverwriteRow {
    channel_id: string;
    target_id: string;
    target_type: 'role' | 'member';
    allow_bits: string;
    deny_bits: string;
}
/**
 * Member role row from database
 */
export interface MemberRoleRow {
    guild_id: string;
    user_id: string;
    role_id: string;
}
/**
 * Guild row from database (minimal for permission checks)
 */
export interface GuildRow {
    id: string;
    owner_id: string;
}
/**
 * Convert database row to Role type
 */
export declare function rowToRole(row: RoleRow): Role;
/**
 * Convert database row to ChannelOverwrite type
 */
export declare function rowToChannelOverwrite(row: ChannelOverwriteRow): ChannelOverwrite;
/**
 * Permissions Repository
 */
export declare class PermissionsRepository {
    private readonly pool;
    constructor(pool: Pool);
    /**
     * Create a new role
     * Requirements: 6.1
     */
    createRole(id: Snowflake, guildId: Snowflake, name: string, permissions: bigint, position: number, color?: string, client?: PoolClient): Promise<Role>;
    /**
     * Get role by ID
     */
    getRoleById(roleId: Snowflake): Promise<Role | null>;
    /**
     * Get all roles for a guild
     */
    getRolesByGuildId(guildId: Snowflake): Promise<Role[]>;
    /**
     * Update a role
     * Requirements: 6.2
     */
    updateRole(roleId: Snowflake, updates: {
        name?: string;
        permissions?: bigint;
        position?: number;
        color?: string | null;
    }, client?: PoolClient): Promise<Role | null>;
    /**
     * Delete a role
     * Requirements: 6.4
     */
    deleteRole(roleId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Get the highest position for roles in a guild
     */
    getMaxRolePosition(guildId: Snowflake): Promise<number>;
    /**
     * Reorder roles by updating positions
     * Requirements: 6.3
     */
    reorderRoles(guildId: Snowflake, rolePositions: {
        roleId: Snowflake;
        position: number;
    }[], client?: PoolClient): Promise<void>;
    /**
     * Assign a role to a member
     * Requirements: 6.5
     */
    assignRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake, client?: PoolClient): Promise<void>;
    /**
     * Remove a role from a member
     * Requirements: 6.6
     */
    removeRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Get all roles for a member
     */
    getMemberRoles(guildId: Snowflake, userId: Snowflake): Promise<Role[]>;
    /**
     * Check if a member has a specific role
     */
    memberHasRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<boolean>;
    /**
     * Set a channel overwrite
     * Requirements: 8.5
     */
    setChannelOverwrite(channelId: Snowflake, targetId: Snowflake, targetType: 'role' | 'member', allow: bigint, deny: bigint, client?: PoolClient): Promise<ChannelOverwrite>;
    /**
     * Delete a channel overwrite
     * Requirements: 8.5
     */
    deleteChannelOverwrite(channelId: Snowflake, targetId: Snowflake, client?: PoolClient): Promise<boolean>;
    /**
     * Get all overwrites for a channel
     */
    getChannelOverwrites(channelId: Snowflake): Promise<ChannelOverwrite[]>;
    /**
     * Get a specific channel overwrite
     */
    getChannelOverwrite(channelId: Snowflake, targetId: Snowflake): Promise<ChannelOverwrite | null>;
    /**
     * Get guild by ID (minimal for permission checks)
     */
    getGuildById(guildId: Snowflake): Promise<Pick<Guild, 'id' | 'owner_id'> | null>;
    /**
     * Check if a user is a member of a guild
     */
    isMember(guildId: Snowflake, userId: Snowflake): Promise<boolean>;
    /**
     * Get channel guild ID
     */
    getChannelGuildId(channelId: Snowflake): Promise<Snowflake | null>;
    /**
     * Check if a channel exists
     */
    channelExists(channelId: Snowflake): Promise<boolean>;
}
//# sourceMappingURL=repository.d.ts.map