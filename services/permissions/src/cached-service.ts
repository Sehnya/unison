/**
 * Cached Permissions Service
 *
 * Wraps the base PermissionsService with Redis caching.
 * Requirements: 7.3, 7.4, 7.5, 7.6
 */

import type { Pool } from 'pg';
import type { Snowflake, Role, ChannelOverwrite } from '@discord-clone/types';
import { PermissionsService, type PermissionsServiceConfig, type RolePositionUpdate } from './service.js';
import { PermissionCacheService, type RedisClient, type PermissionCacheConfig } from './cache.js';
import { hasPermission } from './bitset.js';

/**
 * Cached Permissions Service Configuration
 */
export interface CachedPermissionsServiceConfig extends PermissionsServiceConfig {
  cache?: PermissionCacheConfig;
}

/**
 * Cached Permissions Service
 *
 * Provides the same interface as PermissionsService but with Redis caching
 * for computed permissions.
 */
export class CachedPermissionsService {
  private readonly service: PermissionsService;
  private readonly cache: PermissionCacheService;

  constructor(pool: Pool, redis: RedisClient, config: CachedPermissionsServiceConfig = {}) {
    this.service = new PermissionsService(pool, config);
    this.cache = new PermissionCacheService(redis, config.cache);
  }

  // ============================================
  // Role CRUD Operations (with cache invalidation)
  // ============================================

  /**
   * Create a new role
   */
  async createRole(
    guildId: Snowflake,
    name: string,
    permissions: bigint,
    color?: string
  ): Promise<Role> {
    const role = await this.service.createRole(guildId, name, permissions, color);
    // Invalidate all permissions in the guild since a new role might affect them
    await this.cache.invalidateByEvent('role.created', guildId);
    return role;
  }

  /**
   * Get a role by ID
   */
  async getRole(roleId: Snowflake): Promise<Role> {
    return this.service.getRole(roleId);
  }

  /**
   * Get all roles for a guild
   */
  async getGuildRoles(guildId: Snowflake): Promise<Role[]> {
    return this.service.getGuildRoles(guildId);
  }

  /**
   * Update a role
   */
  async updateRole(
    roleId: Snowflake,
    updates: {
      name?: string;
      permissions?: bigint;
      color?: string | null;
    }
  ): Promise<Role> {
    const role = await this.service.updateRole(roleId, updates);
    // Invalidate all permissions in the guild
    await this.cache.invalidateByEvent('role.updated', role.guild_id);
    return role;
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: Snowflake): Promise<void> {
    // Get the role first to know the guild ID
    const role = await this.service.getRole(roleId);
    await this.service.deleteRole(roleId);
    // Invalidate all permissions in the guild
    await this.cache.invalidateByEvent('role.deleted', role.guild_id);
  }

  /**
   * Reorder roles
   */
  async reorderRoles(guildId: Snowflake, rolePositions: RolePositionUpdate[]): Promise<void> {
    await this.service.reorderRoles(guildId, rolePositions);
    // Role position changes can affect permission computation
    await this.cache.invalidateByEvent('role.updated', guildId);
  }

  // ============================================
  // Role Assignment Operations (with cache invalidation)
  // ============================================

  /**
   * Assign a role to a member
   */
  async assignRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<void> {
    await this.service.assignRole(guildId, userId, roleId);
    // Invalidate permissions for this user
    await this.cache.invalidateByEvent('member_roles.updated', guildId, undefined, userId);
  }

  /**
   * Remove a role from a member
   */
  async removeRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<void> {
    await this.service.removeRole(guildId, userId, roleId);
    // Invalidate permissions for this user
    await this.cache.invalidateByEvent('member_roles.updated', guildId, undefined, userId);
  }

  /**
   * Get all roles for a member
   */
  async getMemberRoles(guildId: Snowflake, userId: Snowflake): Promise<Role[]> {
    return this.service.getMemberRoles(guildId, userId);
  }

  // ============================================
  // Channel Overwrite Operations (with cache invalidation)
  // ============================================

  /**
   * Set a channel permission overwrite
   */
  async setChannelOverwrite(
    channelId: Snowflake,
    targetId: Snowflake,
    targetType: 'role' | 'member',
    allow: bigint,
    deny: bigint
  ): Promise<ChannelOverwrite> {
    const overwrite = await this.service.setChannelOverwrite(
      channelId,
      targetId,
      targetType,
      allow,
      deny
    );
    // Get the guild ID for cache invalidation
    const guildId = await this.service.getRepository().getChannelGuildId(channelId);
    if (guildId) {
      await this.cache.invalidateByEvent('channel_overwrite.updated', guildId, channelId);
    }
    return overwrite;
  }

  /**
   * Delete a channel permission overwrite
   */
  async deleteChannelOverwrite(channelId: Snowflake, targetId: Snowflake): Promise<void> {
    // Get the guild ID before deletion
    const guildId = await this.service.getRepository().getChannelGuildId(channelId);
    await this.service.deleteChannelOverwrite(channelId, targetId);
    if (guildId) {
      await this.cache.invalidateByEvent('channel_overwrite.deleted', guildId, channelId);
    }
  }

  /**
   * Get all overwrites for a channel
   */
  async getChannelOverwrites(channelId: Snowflake): Promise<ChannelOverwrite[]> {
    return this.service.getChannelOverwrites(channelId);
  }

  // ============================================
  // Permission Computation (with caching)
  // Requirements: 7.3, 7.4, 7.5
  // ============================================

  /**
   * Compute permissions for a user in a channel (with caching)
   * Requirements: 7.3, 7.4, 7.5
   */
  async computePermissions(userId: Snowflake, channelId: Snowflake): Promise<bigint> {
    // Get the guild ID for cache key
    const guildId = await this.service.getRepository().getChannelGuildId(channelId);
    if (!guildId) {
      // Channel not found, delegate to service which will throw
      return this.service.computePermissions(userId, channelId);
    }

    // Check cache first (Requirement 7.3)
    const cached = await this.cache.get(guildId, channelId, userId);
    if (cached !== null) {
      // Cache hit (Requirement 7.4)
      return cached;
    }

    // Cache miss - compute permissions (Requirement 7.5)
    const permissions = await this.service.computePermissions(userId, channelId);

    // Store in cache
    await this.cache.set(guildId, channelId, userId, permissions);

    return permissions;
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

  // ============================================
  // Cache Management
  // ============================================

  /**
   * Manually invalidate cache for a user
   */
  async invalidateUserCache(guildId: Snowflake, userId: Snowflake): Promise<void> {
    await this.cache.invalidateUser(guildId, userId);
  }

  /**
   * Manually invalidate cache for a guild
   */
  async invalidateGuildCache(guildId: Snowflake): Promise<void> {
    await this.cache.invalidateGuild(guildId);
  }

  /**
   * Manually invalidate cache for a channel
   */
  async invalidateChannelCache(guildId: Snowflake, channelId: Snowflake): Promise<void> {
    await this.cache.invalidateChannel(guildId, channelId);
  }

  /**
   * Handle cache invalidation based on event
   * Requirements: 7.6
   */
  async handleCacheInvalidation(
    eventType: string,
    guildId: Snowflake,
    channelId?: Snowflake,
    userId?: Snowflake
  ): Promise<void> {
    await this.cache.invalidateByEvent(eventType, guildId, channelId, userId);
  }

  /**
   * Get the underlying service for direct access
   */
  getService(): PermissionsService {
    return this.service;
  }

  /**
   * Get the cache service for direct access
   */
  getCacheService(): PermissionCacheService {
    return this.cache;
  }
}
