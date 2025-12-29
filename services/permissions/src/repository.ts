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
  permissions: string; // bigint as string
  created_at: Date;
}

/**
 * Channel overwrite row from database
 */
export interface ChannelOverwriteRow {
  channel_id: string;
  target_id: string;
  target_type: 'role' | 'member';
  allow_bits: string; // bigint as string
  deny_bits: string; // bigint as string
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
export function rowToRole(row: RoleRow): Role {
  const role: Role = {
    id: row.id as Snowflake,
    guild_id: row.guild_id as Snowflake,
    name: row.name,
    position: row.position,
    permissions: BigInt(row.permissions),
    created_at: row.created_at,
  };
  if (row.color) {
    role.color = row.color;
  }
  return role;
}

/**
 * Convert database row to ChannelOverwrite type
 */
export function rowToChannelOverwrite(row: ChannelOverwriteRow): ChannelOverwrite {
  return {
    channel_id: row.channel_id as Snowflake,
    target_id: row.target_id as Snowflake,
    target_type: row.target_type,
    allow: BigInt(row.allow_bits),
    deny: BigInt(row.deny_bits),
  };
}

/**
 * Permissions Repository
 */
export class PermissionsRepository {
  constructor(private readonly pool: Pool) {}

  // ============================================
  // Role Operations
  // ============================================

  /**
   * Create a new role
   * Requirements: 6.1
   */
  async createRole(
    id: Snowflake,
    guildId: Snowflake,
    name: string,
    permissions: bigint,
    position: number,
    color?: string,
    client?: PoolClient
  ): Promise<Role> {
    const conn = client ?? this.pool;
    const result = await conn.query<RoleRow>(
      `INSERT INTO roles (id, guild_id, name, color, position, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, guild_id, name, color, position, permissions, created_at`,
      [id, guildId, name, color ?? null, position, permissions.toString()]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create role');
    }
    return rowToRole(row);
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: Snowflake): Promise<Role | null> {
    const result = await this.pool.query<RoleRow>(
      `SELECT id, guild_id, name, color, position, permissions, created_at
       FROM roles WHERE id = $1`,
      [roleId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToRole(row);
  }

  /**
   * Get all roles for a guild
   */
  async getRolesByGuildId(guildId: Snowflake): Promise<Role[]> {
    const result = await this.pool.query<RoleRow>(
      `SELECT id, guild_id, name, color, position, permissions, created_at
       FROM roles WHERE guild_id = $1
       ORDER BY position ASC`,
      [guildId]
    );
    return result.rows.map(rowToRole);
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
      position?: number;
      color?: string | null;
    },
    client?: PoolClient
  ): Promise<Role | null> {
    const conn = client ?? this.pool;
    const setClauses: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.permissions !== undefined) {
      setClauses.push(`permissions = $${paramIndex++}`);
      values.push(updates.permissions.toString());
    }
    if (updates.position !== undefined) {
      setClauses.push(`position = $${paramIndex++}`);
      values.push(updates.position);
    }
    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIndex++}`);
      values.push(updates.color);
    }

    if (setClauses.length === 0) {
      return this.getRoleById(roleId);
    }

    values.push(roleId);
    const result = await conn.query<RoleRow>(
      `UPDATE roles SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, guild_id, name, color, position, permissions, created_at`,
      values
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToRole(row);
  }

  /**
   * Delete a role
   * Requirements: 6.4
   */
  async deleteRole(roleId: Snowflake, client?: PoolClient): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(`DELETE FROM roles WHERE id = $1`, [roleId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get the highest position for roles in a guild
   */
  async getMaxRolePosition(guildId: Snowflake): Promise<number> {
    const result = await this.pool.query<{ max: number | null }>(
      `SELECT MAX(position) as max FROM roles WHERE guild_id = $1`,
      [guildId]
    );
    return result.rows[0]?.max ?? -1;
  }

  /**
   * Reorder roles by updating positions
   * Requirements: 6.3
   */
  async reorderRoles(
    guildId: Snowflake,
    rolePositions: { roleId: Snowflake; position: number }[],
    client?: PoolClient
  ): Promise<void> {
    const conn = client ?? this.pool;
    for (const { roleId, position } of rolePositions) {
      await conn.query(
        `UPDATE roles SET position = $1 WHERE id = $2 AND guild_id = $3`,
        [position, roleId, guildId]
      );
    }
  }

  // ============================================
  // Member Role Operations
  // ============================================

  /**
   * Assign a role to a member
   * Requirements: 6.5
   */
  async assignRole(
    guildId: Snowflake,
    userId: Snowflake,
    roleId: Snowflake,
    client?: PoolClient
  ): Promise<void> {
    const conn = client ?? this.pool;
    await conn.query(
      `INSERT INTO member_roles (guild_id, user_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id, role_id) DO NOTHING`,
      [guildId, userId, roleId]
    );
  }

  /**
   * Remove a role from a member
   * Requirements: 6.6
   */
  async removeRole(
    guildId: Snowflake,
    userId: Snowflake,
    roleId: Snowflake,
    client?: PoolClient
  ): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `DELETE FROM member_roles WHERE guild_id = $1 AND user_id = $2 AND role_id = $3`,
      [guildId, userId, roleId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all roles for a member
   */
  async getMemberRoles(guildId: Snowflake, userId: Snowflake): Promise<Role[]> {
    const result = await this.pool.query<RoleRow>(
      `SELECT r.id, r.guild_id, r.name, r.color, r.position, r.permissions, r.created_at
       FROM roles r
       INNER JOIN member_roles mr ON r.id = mr.role_id
       WHERE mr.guild_id = $1 AND mr.user_id = $2
       ORDER BY r.position ASC`,
      [guildId, userId]
    );
    return result.rows.map(rowToRole);
  }

  /**
   * Check if a member has a specific role
   */
  async memberHasRole(guildId: Snowflake, userId: Snowflake, roleId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM member_roles WHERE guild_id = $1 AND user_id = $2 AND role_id = $3`,
      [guildId, userId, roleId]
    );
    return result.rows.length > 0;
  }

  // ============================================
  // Channel Overwrite Operations
  // ============================================

  /**
   * Set a channel overwrite
   * Requirements: 8.5
   */
  async setChannelOverwrite(
    channelId: Snowflake,
    targetId: Snowflake,
    targetType: 'role' | 'member',
    allow: bigint,
    deny: bigint,
    client?: PoolClient
  ): Promise<ChannelOverwrite> {
    const conn = client ?? this.pool;
    const result = await conn.query<ChannelOverwriteRow>(
      `INSERT INTO channel_overwrites (channel_id, target_id, target_type, allow_bits, deny_bits)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (channel_id, target_id) DO UPDATE SET
         target_type = EXCLUDED.target_type,
         allow_bits = EXCLUDED.allow_bits,
         deny_bits = EXCLUDED.deny_bits
       RETURNING channel_id, target_id, target_type, allow_bits, deny_bits`,
      [channelId, targetId, targetType, allow.toString(), deny.toString()]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to set channel overwrite');
    }
    return rowToChannelOverwrite(row);
  }

  /**
   * Delete a channel overwrite
   * Requirements: 8.5
   */
  async deleteChannelOverwrite(
    channelId: Snowflake,
    targetId: Snowflake,
    client?: PoolClient
  ): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `DELETE FROM channel_overwrites WHERE channel_id = $1 AND target_id = $2`,
      [channelId, targetId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all overwrites for a channel
   */
  async getChannelOverwrites(channelId: Snowflake): Promise<ChannelOverwrite[]> {
    const result = await this.pool.query<ChannelOverwriteRow>(
      `SELECT channel_id, target_id, target_type, allow_bits, deny_bits
       FROM channel_overwrites WHERE channel_id = $1`,
      [channelId]
    );
    return result.rows.map(rowToChannelOverwrite);
  }

  /**
   * Get a specific channel overwrite
   */
  async getChannelOverwrite(
    channelId: Snowflake,
    targetId: Snowflake
  ): Promise<ChannelOverwrite | null> {
    const result = await this.pool.query<ChannelOverwriteRow>(
      `SELECT channel_id, target_id, target_type, allow_bits, deny_bits
       FROM channel_overwrites WHERE channel_id = $1 AND target_id = $2`,
      [channelId, targetId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToChannelOverwrite(row);
  }

  // ============================================
  // Guild Operations (for permission checks)
  // ============================================

  /**
   * Get guild by ID (minimal for permission checks)
   */
  async getGuildById(guildId: Snowflake): Promise<Pick<Guild, 'id' | 'owner_id'> | null> {
    const result = await this.pool.query<GuildRow>(
      `SELECT id, owner_id FROM guilds WHERE id = $1 AND deleted_at IS NULL`,
      [guildId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id as Snowflake,
      owner_id: row.owner_id as Snowflake,
    };
  }

  /**
   * Check if a user is a member of a guild
   */
  async isMember(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get channel guild ID
   */
  async getChannelGuildId(channelId: Snowflake): Promise<Snowflake | null> {
    const result = await this.pool.query<{ guild_id: string }>(
      `SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`,
      [channelId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return row.guild_id as Snowflake;
  }

  /**
   * Check if a channel exists
   */
  async channelExists(channelId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM channels WHERE id = $1 AND deleted_at IS NULL`,
      [channelId]
    );
    return result.rows.length > 0;
  }
}
