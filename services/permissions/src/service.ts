/**
 * Permissions Service
 *
 * Handles role management, permission evaluation, and caching.
 * Requirements: 6.1-6.6, 7.1-7.6, 8.5
 */

import type { Pool } from 'pg';
import type { Snowflake, Role, ChannelOverwrite } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { PermissionsRepository } from './repository.js';
import { computePermissions, type ComputePermissionsInput } from './compute.js';
import { hasPermission } from './bitset.js';
import {
  RoleNotFoundError,
  CannotModifyEveryoneError,
  GuildNotFoundError,
  MemberNotFoundError,
  ChannelNotFoundError,
  RoleAlreadyAssignedError,
  RoleNotAssignedError,
} from './errors.js';

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
export class PermissionsService {
  private readonly repository: PermissionsRepository;
  private readonly snowflake: SnowflakeGenerator;

  constructor(pool: Pool, config: PermissionsServiceConfig = {}) {
    this.repository = new PermissionsRepository(pool);
    this.snowflake = new SnowflakeGenerator(config.workerId ?? 0);
  }

  // ============================================
  // Role CRUD Operations
  // Requirements: 6.1, 6.2, 6.3, 6.4
  // ============================================

  /**
   * Create a new role
   * Requirements: 6.1
   */
  async createRole(
    guildId: Snowflake,
    name: string,
    permissions: bigint,
    color?: string
  ): Promise<Role> {
    // Verify guild exists
    const guild = await this.repository.getGuildById(guildId);
    if (!guild) {
      throw new GuildNotFoundError();
    }

    // Get the next position (after all existing roles)
    const maxPosition = await this.repository.getMaxRolePosition(guildId);
    const position = maxPosition + 1;

    // Generate Snowflake ID
    const roleId = this.snowflake.generate();

    // Create the role
    return this.repository.createRole(roleId, guildId, name, permissions, position, color);
  }

  /**
   * Get a role by ID
   */
  async getRole(roleId: Snowflake): Promise<Role> {
    const role = await this.repository.getRoleById(roleId);
    if (!role) {
      throw new RoleNotFoundError();
    }
    return role;
  }

  /**
   * Get all roles for a guild
   */
  async getGuildRoles(guildId: Snowflake): Promise<Role[]> {
    return this.repository.getRolesByGuildId(guildId);
  }

  /**
   * Update a role
   * Requirements: 6.2
   */
  async updateRole(
    roleId: Snowflake,
    updates: {
      name?: string;
      permissions?: bigint;
      color?: string | null;
    }
  ): Promise<Role> {
    const role = await this.repository.getRoleById(roleId);
    if (!role) {
      throw new RoleNotFoundError();
    }

    const updatedRole = await this.repository.updateRole(roleId, updates);
    if (!updatedRole) {
      throw new RoleNotFoundError();
    }

    return updatedRole;
  }

  /**
   * Delete a role
   * Requirements: 6.4
   */
  async deleteRole(roleId: Snowflake): Promise<void> {
    const role = await this.repository.getRoleById(roleId);
    if (!role) {
      throw new RoleNotFoundError();
    }

    // Cannot delete @everyone role (role.id === guild.id)
    if (role.id === role.guild_id) {
      throw new CannotModifyEveryoneError();
    }

    const deleted = await this.repository.deleteRole(roleId);
    if (!deleted) {
      throw new RoleNotFoundError();
    }
  }

  /**
   * Reorder roles
   * Requirements: 6.3
   */
  async reorderRoles(guildId: Snowflake, rolePositions: RolePositionUpdate[]): Promise<void> {
    // Verify guild exists
    const guild = await this.repository.getGuildById(guildId);
    if (!guild) {
      throw new GuildNotFoundError();
    }

    // Verify all roles exist and belong to the guild
    for (const { roleId } of rolePositions) {
      const role = await this.repository.getRoleById(roleId);
      if (!role || role.guild_id !== guildId) {
        throw new RoleNotFoundError();
      }
    }

    await this.repository.reorderRoles(guildId, rolePositions);
  }

  // ============================================
  // Role Assignment Operations
  // Requirements: 6.5, 6.6
  // ============================================

  /**
   * Assign a role to a member
   * Requirements: 6.5
   */
  async assignRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<void> {
    // Verify role exists and belongs to guild
    const role = await this.repository.getRoleById(roleId);
    if (!role || role.guild_id !== guildId) {
      throw new RoleNotFoundError();
    }

    // Verify user is a member of the guild
    const isMember = await this.repository.isMember(guildId, userId);
    if (!isMember) {
      throw new MemberNotFoundError();
    }

    // Check if already assigned
    const hasRole = await this.repository.memberHasRole(guildId, userId, roleId);
    if (hasRole) {
      throw new RoleAlreadyAssignedError();
    }

    await this.repository.assignRole(guildId, userId, roleId);
  }

  /**
   * Remove a role from a member
   * Requirements: 6.6
   */
  async removeRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<void> {
    // Verify role exists and belongs to guild
    const role = await this.repository.getRoleById(roleId);
    if (!role || role.guild_id !== guildId) {
      throw new RoleNotFoundError();
    }

    // Cannot remove @everyone role
    if (role.id === role.guild_id) {
      throw new CannotModifyEveryoneError();
    }

    const removed = await this.repository.removeRole(guildId, userId, roleId);
    if (!removed) {
      throw new RoleNotAssignedError();
    }
  }

  /**
   * Get all roles for a member
   */
  async getMemberRoles(guildId: Snowflake, userId: Snowflake): Promise<Role[]> {
    // Get explicitly assigned roles
    const assignedRoles = await this.repository.getMemberRoles(guildId, userId);

    // Always include @everyone role
    const everyoneRole = await this.repository.getRoleById(guildId);
    if (everyoneRole) {
      // Check if @everyone is already in the list
      const hasEveryone = assignedRoles.some((r) => r.id === guildId);
      if (!hasEveryone) {
        assignedRoles.unshift(everyoneRole);
      }
    }

    return assignedRoles;
  }

  // ============================================
  // Channel Overwrite Operations
  // Requirements: 8.5
  // ============================================

  /**
   * Set a channel permission overwrite
   * Requirements: 8.5
   */
  async setChannelOverwrite(
    channelId: Snowflake,
    targetId: Snowflake,
    targetType: 'role' | 'member',
    allow: bigint,
    deny: bigint
  ): Promise<ChannelOverwrite> {
    // Verify channel exists
    const exists = await this.repository.channelExists(channelId);
    if (!exists) {
      throw new ChannelNotFoundError();
    }

    return this.repository.setChannelOverwrite(channelId, targetId, targetType, allow, deny);
  }

  /**
   * Delete a channel permission overwrite
   * Requirements: 8.5
   */
  async deleteChannelOverwrite(channelId: Snowflake, targetId: Snowflake): Promise<void> {
    const deleted = await this.repository.deleteChannelOverwrite(channelId, targetId);
    if (!deleted) {
      // Overwrite didn't exist, but that's okay
    }
  }

  /**
   * Get all overwrites for a channel
   */
  async getChannelOverwrites(channelId: Snowflake): Promise<ChannelOverwrite[]> {
    return this.repository.getChannelOverwrites(channelId);
  }

  // ============================================
  // Permission Computation
  // Requirements: 7.1, 7.2
  // ============================================

  /**
   * Compute permissions for a user in a channel
   * Requirements: 7.1, 7.2
   */
  async computePermissions(userId: Snowflake, channelId: Snowflake): Promise<bigint> {
    // Get channel's guild
    const guildId = await this.repository.getChannelGuildId(channelId);
    if (!guildId) {
      throw new ChannelNotFoundError();
    }

    // Get guild
    const guild = await this.repository.getGuildById(guildId);
    if (!guild) {
      throw new GuildNotFoundError();
    }

    // Get member's roles (including @everyone)
    const memberRoles = await this.getMemberRoles(guildId, userId);

    // Get channel overwrites
    const channelOverwrites = await this.repository.getChannelOverwrites(channelId);

    // Compute permissions
    const input: ComputePermissionsInput = {
      userId,
      guild,
      memberRoles,
      channelOverwrites,
    };

    return computePermissions(input);
  }

  /**
   * Check if a user has a specific permission in a channel
   */
  async hasPermission(
    userId: Snowflake,
    channelId: Snowflake,
    permission: bigint
  ): Promise<boolean> {
    const permissions = await this.computePermissions(userId, channelId);
    return hasPermission(permissions, permission);
  }

  /**
   * Get the repository for direct access (used by cache service)
   */
  getRepository(): PermissionsRepository {
    return this.repository;
  }
}
