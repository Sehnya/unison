/**
 * Permissions Service
 *
 * Handles role management, permission evaluation, and caching.
 * Requirements: 6.1-6.6, 7.1-7.6, 8.5
 */
import type { Pool } from 'pg';
import type { Snowflake, Role, ChannelOverwrite } from '@discord-clone/types';
import { PermissionsRepository } from './repository.js';
/**
 * Permissions Service Configuration
 */
export interface PermissionsServiceConfig {
    workerId?: number;
}
/**
 * Role position update
 */
export interface RolePositionUpdate {
    roleId: Snowflake;
    position: number;
}
/**
 * Permissions Service
 */
export declare class PermissionsService {
    private readonly repository;
    private readonly snowflake;
    constructor(pool: Pool, config?: PermissionsServiceConfig);
    /**
     * Create a new role
     * Requirements: 6.1
     */
    createRole(guildId: Snowflake, name: string, permissions: bigint, color?: string): Promise<Role>;
    /**
     * Get a role by ID
     */
    getRole(roleId: Snowflake): Promise<Role>;
    /**
     * Get all roles for a guild
     */
    getGuildRoles(guildId: Snowflake): Promise<Role[]>;
    /**
     * Update a role
     * Requirements: 6.2
     */
    updateRole(roleId: Snowflake, updates: {
        name?: string;
        permissions?: bigint;
        color?: string | null;
    }): Promise<Role>;
    /**
     * Delete a role
     * Requirements: 6.4
     */
    deleteRole(roleId: Snowflake): Promise<void>;
    /**
     * Reorder roles
     * Requirements: 6.3
     */
    reorderRoles(guildId: Snowflake, rolePositions: RolePositionUpdate[]): Promise<void>;
    /**
     * Assign a role to a member
     * Requirements: 6.5
     */
    assignRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<void>;
    /**
     * Remove a role from a member
     * Requirements: 6.6
     */
    removeRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<void>;
    /**
     * Get all roles for a member
     */
    getMemberRoles(guildId: Snowflake, userId: Snowflake): Promise<Role[]>;
    /**
     * Set a channel permission overwrite
     * Requirements: 8.5
     */
    setChannelOverwrite(channelId: Snowflake, targetId: Snowflake, targetType: 'role' | 'member', allow: bigint, deny: bigint): Promise<ChannelOverwrite>;
    /**
     * Delete a channel permission overwrite
     * Requirements: 8.5
     */
    deleteChannelOverwrite(channelId: Snowflake, targetId: Snowflake): Promise<void>;
    /**
     * Get all overwrites for a channel
     */
    getChannelOverwrites(channelId: Snowflake): Promise<ChannelOverwrite[]>;
    /**
     * Compute permissions for a user in a channel
     * Requirements: 7.1, 7.2
     */
    computePermissions(userId: Snowflake, channelId: Snowflake): Promise<bigint>;
    /**
     * Check if a user has a specific permission in a channel
     */
    hasPermission(userId: Snowflake, channelId: Snowflake, permission: bigint): Promise<boolean>;
    /**
     * Get the repository for direct access (used by cache service)
     */
    getRepository(): PermissionsRepository;
}
//# sourceMappingURL=service.d.ts.map