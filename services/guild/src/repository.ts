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
  is_owner?: boolean;
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
export function rowToGuild(row: GuildRow): Guild {
  const guild: Guild = {
    id: row.id as Snowflake,
    owner_id: row.owner_id as Snowflake,
    name: row.name,
    created_at: row.created_at,
  };
  if (row.description) {
    guild.description = row.description;
  }
  if (row.icon) {
    guild.icon = row.icon;
  }
  if (row.banner) {
    guild.banner = row.banner;
  }
  if (row.deleted_at) {
    guild.deleted_at = row.deleted_at;
  }
  return guild;
}

/**
 * Convert database row to Member type
 */
export function rowToMember(row: MemberRow, roles: Snowflake[] = []): Member {
  const member: Member = {
    guild_id: row.guild_id as Snowflake,
    user_id: row.user_id as Snowflake,
    joined_at: row.joined_at,
    roles,
  };
  if (row.nickname) {
    member.nickname = row.nickname;
  }
  if (row.is_owner !== undefined) {
    member.is_owner = row.is_owner;
  }
  return member;
}

/**
 * Convert database row to Invite type
 */
export function rowToInvite(row: InviteRow): Invite {
  const invite: Invite = {
    code: row.code,
    guild_id: row.guild_id as Snowflake,
    creator_id: row.creator_id as Snowflake,
    uses: row.uses,
    created_at: row.created_at,
  };
  if (row.max_uses !== null) {
    invite.max_uses = row.max_uses;
  }
  if (row.expires_at) {
    invite.expires_at = row.expires_at;
  }
  if (row.revoked_at) {
    invite.revoked_at = row.revoked_at;
  }
  return invite;
}

/**
 * Convert database row to Ban type
 */
export function rowToBan(row: BanRow): Ban {
  const ban: Ban = {
    guild_id: row.guild_id as Snowflake,
    user_id: row.user_id as Snowflake,
    banned_by: row.banned_by as Snowflake,
    created_at: row.created_at,
  };
  if (row.reason) {
    ban.reason = row.reason;
  }
  return ban;
}

/**
 * Convert database row to Channel type
 */
export function rowToChannel(row: ChannelRow): Channel {
  const channel: Channel = {
    id: row.id as Snowflake,
    guild_id: row.guild_id as Snowflake,
    type: row.type as ChannelType,
    name: row.name,
    position: row.position,
    created_at: row.created_at,
  };
  if (row.topic) {
    channel.topic = row.topic;
  }
  if (row.parent_id) {
    channel.parent_id = row.parent_id as Snowflake;
  }
  if (row.deleted_at) {
    channel.deleted_at = row.deleted_at;
  }
  return channel;
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
 * Guild Repository
 */
export class GuildRepository {
  constructor(private readonly pool: Pool) {}

  // ============================================
  // Guild Operations
  // Requirements: 3.1, 3.4, 3.5, 3.6
  // ============================================

  /**
   * Create a new guild
   * Requirements: 3.1
   */
  async createGuild(
    id: Snowflake,
    ownerId: Snowflake,
    name: string,
    options?: { description?: string; icon?: string; banner?: string },
    client?: PoolClient
  ): Promise<Guild> {
    const conn = client ?? this.pool;
    const result = await conn.query<GuildRow>(
      `INSERT INTO guilds (id, owner_id, name, description, icon, banner)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, owner_id, name, description, icon, banner, created_at, deleted_at`,
      [id, ownerId, name.trim(), options?.description ?? null, options?.icon ?? null, options?.banner ?? null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create guild');
    }
    return rowToGuild(row);
  }

  /**
   * Get all guilds for a user with member counts
   */
  async getUserGuilds(userId: Snowflake): Promise<Guild[]> {
    const result = await this.pool.query<GuildRow & { member_count: string }>(
      `SELECT g.id, g.owner_id, g.name, g.description, g.icon, g.banner, g.created_at, g.deleted_at,
              (SELECT COUNT(*) FROM guild_members WHERE guild_id = g.id) as member_count
       FROM guilds g
       JOIN guild_members gm ON g.id = gm.guild_id
       WHERE gm.user_id = $1 AND g.deleted_at IS NULL
       ORDER BY g.name ASC`,
      [userId]
    );
    return result.rows.map(row => {
      const guild = rowToGuild(row);
      (guild as Guild & { member_count?: number }).member_count = parseInt(row.member_count, 10);
      return guild;
    });
  }

  /**
   * Get guild by ID with member count
   */
  async getGuildById(guildId: Snowflake): Promise<Guild | null> {
    const result = await this.pool.query<GuildRow & { member_count: string }>(
      `SELECT id, owner_id, name, description, icon, banner, created_at, deleted_at,
              (SELECT COUNT(*) FROM guild_members WHERE guild_id = $1) as member_count
       FROM guilds WHERE id = $1 AND deleted_at IS NULL`,
      [guildId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const guild = rowToGuild(row);
    (guild as Guild & { member_count?: number }).member_count = parseInt(row.member_count, 10);
    return guild;
  }

  /**
   * Get a guild by name
   * Used for finding default guilds like BETA1
   */
  async getGuildByName(name: string): Promise<Guild | null> {
    const result = await this.pool.query<GuildRow>(
      `SELECT id, owner_id, name, description, icon, banner, created_at, deleted_at
       FROM guilds
       WHERE name = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [name]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return rowToGuild(row);
  }

  /**
   * Update guild settings
   * Requirements: 3.4
   */
  async updateGuild(
    guildId: Snowflake,
    updates: { name?: string; icon?: string | null },
    client?: PoolClient
  ): Promise<Guild | null> {
    const conn = client ?? this.pool;
    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name.trim());
    }
    if (updates.icon !== undefined) {
      setClauses.push(`icon = $${paramIndex++}`);
      values.push(updates.icon);
    }

    if (setClauses.length === 0) {
      return this.getGuildById(guildId);
    }

    values.push(guildId);
    const result = await conn.query<GuildRow>(
      `UPDATE guilds SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, owner_id, name, icon, created_at, deleted_at`,
      values
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToGuild(row);
  }

  /**
   * Transfer guild ownership
   * Requirements: 3.5
   */
  async transferOwnership(
    guildId: Snowflake,
    newOwnerId: Snowflake,
    client?: PoolClient
  ): Promise<Guild | null> {
    const conn = client ?? this.pool;
    const result = await conn.query<GuildRow>(
      `UPDATE guilds SET owner_id = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, owner_id, name, icon, created_at, deleted_at`,
      [newOwnerId, guildId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToGuild(row);
  }

  /**
   * Soft-delete a guild
   * Requirements: 3.6
   */
  async deleteGuild(guildId: Snowflake, client?: PoolClient): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `UPDATE guilds SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [guildId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================
  // Member Operations
  // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
  // ============================================

  /**
   * Add a member to a guild
   * Requirements: 4.1
   */
  async addMember(
    guildId: Snowflake,
    userId: Snowflake,
    isOwner: boolean = false,
    client?: PoolClient
  ): Promise<Member> {
    const conn = client ?? this.pool;
    const result = await conn.query<MemberRow>(
      `INSERT INTO guild_members (guild_id, user_id, is_owner)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id) 
       DO UPDATE SET is_owner = $3
       RETURNING guild_id, user_id, nickname, joined_at, is_owner`,
      [guildId, userId, isOwner]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to add member');
    }
    return rowToMember(row);
  }

  /**
   * Remove a member from a guild
   * Requirements: 4.3, 4.4
   */
  async removeMember(
    guildId: Snowflake,
    userId: Snowflake,
    client?: PoolClient
  ): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get a member by guild and user ID
   */
  async getMember(guildId: Snowflake, userId: Snowflake): Promise<Member | null> {
    const result = await this.pool.query<MemberRow>(
      `SELECT guild_id, user_id, nickname, joined_at, is_owner
       FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    // Get member roles
    const roles = await this.getMemberRoleIds(guildId, userId);
    return rowToMember(row, roles);
  }

  /**
   * Check if a user is the owner of a guild
   */
  async isOwner(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query<{ is_owner: boolean }>(
      `SELECT is_owner FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result.rows[0]?.is_owner === true;
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
   * Get all members of a guild
   */
  async getGuildMembers(guildId: Snowflake): Promise<Member[]> {
    const result = await this.pool.query<MemberRow>(
      `SELECT guild_id, user_id, nickname, joined_at, is_owner
       FROM guild_members WHERE guild_id = $1
       ORDER BY joined_at ASC`,
      [guildId]
    );
    return Promise.all(
      result.rows.map(async (row) => {
        const roles = await this.getMemberRoleIds(row.guild_id as Snowflake, row.user_id as Snowflake);
        return rowToMember(row, roles);
      })
    );
  }

  /**
   * Get member role IDs
   */
  async getMemberRoleIds(guildId: Snowflake, userId: Snowflake): Promise<Snowflake[]> {
    const result = await this.pool.query<{ role_id: string }>(
      `SELECT role_id FROM member_roles WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result.rows.map((row) => row.role_id as Snowflake);
  }


  // ============================================
  // Ban Operations
  // Requirements: 4.5, 4.6
  // ============================================

  /**
   * Ban a user from a guild
   * Requirements: 4.5
   */
  async createBan(
    guildId: Snowflake,
    userId: Snowflake,
    bannedBy: Snowflake,
    reason?: string,
    client?: PoolClient
  ): Promise<Ban> {
    const conn = client ?? this.pool;
    const result = await conn.query<BanRow>(
      `INSERT INTO guild_bans (guild_id, user_id, banned_by, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING guild_id, user_id, reason, banned_by, created_at`,
      [guildId, userId, bannedBy, reason ?? null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create ban');
    }
    return rowToBan(row);
  }

  /**
   * Remove a ban
   */
  async removeBan(
    guildId: Snowflake,
    userId: Snowflake,
    client?: PoolClient
  ): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `DELETE FROM guild_bans WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a user is banned from a guild
   * Requirements: 4.6
   */
  async isBanned(guildId: Snowflake, userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM guild_bans WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get a ban record
   */
  async getBan(guildId: Snowflake, userId: Snowflake): Promise<Ban | null> {
    const result = await this.pool.query<BanRow>(
      `SELECT guild_id, user_id, reason, banned_by, created_at
       FROM guild_bans WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToBan(row);
  }

  /**
   * Get all bans for a guild
   */
  async getGuildBans(guildId: Snowflake): Promise<Ban[]> {
    const result = await this.pool.query<BanRow>(
      `SELECT guild_id, user_id, reason, banned_by, created_at
       FROM guild_bans WHERE guild_id = $1
       ORDER BY created_at DESC`,
      [guildId]
    );
    return result.rows.map(rowToBan);
  }

  // ============================================
  // Invite Operations
  // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
  // ============================================

  /**
   * Create an invite
   * Requirements: 5.1
   */
  async createInvite(
    code: string,
    guildId: Snowflake,
    creatorId: Snowflake,
    maxUses?: number,
    expiresAt?: Date,
    client?: PoolClient
  ): Promise<Invite> {
    const conn = client ?? this.pool;
    const result = await conn.query<InviteRow>(
      `INSERT INTO invites (code, guild_id, creator_id, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING code, guild_id, creator_id, max_uses, uses, expires_at, revoked_at, created_at`,
      [code, guildId, creatorId, maxUses ?? null, expiresAt ?? null]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create invite');
    }
    return rowToInvite(row);
  }

  /**
   * Get an invite by code
   */
  async getInviteByCode(code: string): Promise<Invite | null> {
    const result = await this.pool.query<InviteRow>(
      `SELECT code, guild_id, creator_id, max_uses, uses, expires_at, revoked_at, created_at
       FROM invites WHERE code = $1`,
      [code]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToInvite(row);
  }

  /**
   * Increment invite use count
   * Requirements: 5.2
   */
  async incrementInviteUses(code: string, client?: PoolClient): Promise<Invite | null> {
    const conn = client ?? this.pool;
    const result = await conn.query<InviteRow>(
      `UPDATE invites SET uses = uses + 1
       WHERE code = $1
       RETURNING code, guild_id, creator_id, max_uses, uses, expires_at, revoked_at, created_at`,
      [code]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToInvite(row);
  }

  /**
   * Revoke an invite
   * Requirements: 5.5
   */
  async revokeInvite(code: string, client?: PoolClient): Promise<boolean> {
    const conn = client ?? this.pool;
    const result = await conn.query(
      `UPDATE invites SET revoked_at = NOW()
       WHERE code = $1 AND revoked_at IS NULL`,
      [code]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all invites for a guild
   */
  async getGuildInvites(guildId: Snowflake): Promise<Invite[]> {
    const result = await this.pool.query<InviteRow>(
      `SELECT code, guild_id, creator_id, max_uses, uses, expires_at, revoked_at, created_at
       FROM invites WHERE guild_id = $1
       ORDER BY created_at DESC`,
      [guildId]
    );
    return result.rows.map(rowToInvite);
  }

  // ============================================
  // Channel Operations (for guild creation)
  // Requirements: 3.2
  // ============================================

  /**
   * Create a channel
   * Requirements: 3.2
   */
  async createChannel(
    id: Snowflake,
    guildId: Snowflake,
    name: string,
    type: ChannelType = ChannelType.TEXT,
    position: number = 0,
    client?: PoolClient
  ): Promise<Channel> {
    const conn = client ?? this.pool;
    const result = await conn.query<ChannelRow>(
      `INSERT INTO channels (id, guild_id, type, name, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at`,
      [id, guildId, type, name, position]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create channel');
    }
    return rowToChannel(row);
  }

  /**
   * Get channels for a guild
   */
  async getGuildChannels(guildId: Snowflake): Promise<Channel[]> {
    const result = await this.pool.query<ChannelRow>(
      `SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE guild_id = $1 AND deleted_at IS NULL
       ORDER BY position ASC`,
      [guildId]
    );
    return result.rows.map(rowToChannel);
  }

  // ============================================
  // Role Operations (for guild creation)
  // Requirements: 3.3
  // ============================================

  /**
   * Create a role
   * Requirements: 3.3
   */
  async createRole(
    id: Snowflake,
    guildId: Snowflake,
    name: string,
    permissions: bigint,
    position: number = 0,
    client?: PoolClient
  ): Promise<Role> {
    const conn = client ?? this.pool;
    const result = await conn.query<RoleRow>(
      `INSERT INTO roles (id, guild_id, name, permissions, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, guild_id, name, color, position, permissions, created_at`,
      [id, guildId, name, permissions.toString(), position]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create role');
    }
    return rowToRole(row);
  }

  /**
   * Get the @everyone role for a guild
   */
  async getEveryoneRole(guildId: Snowflake): Promise<Role | null> {
    const result = await this.pool.query<RoleRow>(
      `SELECT id, guild_id, name, color, position, permissions, created_at
       FROM roles WHERE id = $1`,
      [guildId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return rowToRole(row);
  }

  /**
   * Check if a user exists
   */
  async userExists(userId: Snowflake): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT 1 FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Get a database client for transactions
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
