/**
 * Permissions Repository - Database operations for roles and permissions
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 8.5
 */
/**
 * Convert database row to Role type
 */
export function rowToRole(row) {
    const role = {
        id: row.id,
        guild_id: row.guild_id,
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
export function rowToChannelOverwrite(row) {
    return {
        channel_id: row.channel_id,
        target_id: row.target_id,
        target_type: row.target_type,
        allow: BigInt(row.allow_bits),
        deny: BigInt(row.deny_bits),
    };
}
/**
 * Permissions Repository
 */
export class PermissionsRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    // ============================================
    // Role Operations
    // ============================================
    /**
     * Create a new role
     * Requirements: 6.1
     */
    async createRole(id, guildId, name, permissions, position, color, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`INSERT INTO roles (id, guild_id, name, color, position, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, guild_id, name, color, position, permissions, created_at`, [id, guildId, name, color ?? null, position, permissions.toString()]);
        const row = result.rows[0];
        if (!row) {
            throw new Error('Failed to create role');
        }
        return rowToRole(row);
    }
    /**
     * Get role by ID
     */
    async getRoleById(roleId) {
        const result = await this.pool.query(`SELECT id, guild_id, name, color, position, permissions, created_at
       FROM roles WHERE id = $1`, [roleId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToRole(row);
    }
    /**
     * Get all roles for a guild
     */
    async getRolesByGuildId(guildId) {
        const result = await this.pool.query(`SELECT id, guild_id, name, color, position, permissions, created_at
       FROM roles WHERE guild_id = $1
       ORDER BY position ASC`, [guildId]);
        return result.rows.map(rowToRole);
    }
    /**
     * Update a role
     * Requirements: 6.2
     */
    async updateRole(roleId, updates, client) {
        const conn = client ?? this.pool;
        const setClauses = [];
        const values = [];
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
        const result = await conn.query(`UPDATE roles SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, guild_id, name, color, position, permissions, created_at`, values);
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
    async deleteRole(roleId, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`DELETE FROM roles WHERE id = $1`, [roleId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Get the highest position for roles in a guild
     */
    async getMaxRolePosition(guildId) {
        const result = await this.pool.query(`SELECT MAX(position) as max FROM roles WHERE guild_id = $1`, [guildId]);
        return result.rows[0]?.max ?? -1;
    }
    /**
     * Reorder roles by updating positions
     * Requirements: 6.3
     */
    async reorderRoles(guildId, rolePositions, client) {
        const conn = client ?? this.pool;
        for (const { roleId, position } of rolePositions) {
            await conn.query(`UPDATE roles SET position = $1 WHERE id = $2 AND guild_id = $3`, [position, roleId, guildId]);
        }
    }
    // ============================================
    // Member Role Operations
    // ============================================
    /**
     * Assign a role to a member
     * Requirements: 6.5
     */
    async assignRole(guildId, userId, roleId, client) {
        const conn = client ?? this.pool;
        await conn.query(`INSERT INTO member_roles (guild_id, user_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id, role_id) DO NOTHING`, [guildId, userId, roleId]);
    }
    /**
     * Remove a role from a member
     * Requirements: 6.6
     */
    async removeRole(guildId, userId, roleId, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`DELETE FROM member_roles WHERE guild_id = $1 AND user_id = $2 AND role_id = $3`, [guildId, userId, roleId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Get all roles for a member
     */
    async getMemberRoles(guildId, userId) {
        const result = await this.pool.query(`SELECT r.id, r.guild_id, r.name, r.color, r.position, r.permissions, r.created_at
       FROM roles r
       INNER JOIN member_roles mr ON r.id = mr.role_id
       WHERE mr.guild_id = $1 AND mr.user_id = $2
       ORDER BY r.position ASC`, [guildId, userId]);
        return result.rows.map(rowToRole);
    }
    /**
     * Check if a member has a specific role
     */
    async memberHasRole(guildId, userId, roleId) {
        const result = await this.pool.query(`SELECT 1 FROM member_roles WHERE guild_id = $1 AND user_id = $2 AND role_id = $3`, [guildId, userId, roleId]);
        return result.rows.length > 0;
    }
    // ============================================
    // Channel Overwrite Operations
    // ============================================
    /**
     * Set a channel overwrite
     * Requirements: 8.5
     */
    async setChannelOverwrite(channelId, targetId, targetType, allow, deny, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`INSERT INTO channel_overwrites (channel_id, target_id, target_type, allow_bits, deny_bits)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (channel_id, target_id) DO UPDATE SET
         target_type = EXCLUDED.target_type,
         allow_bits = EXCLUDED.allow_bits,
         deny_bits = EXCLUDED.deny_bits
       RETURNING channel_id, target_id, target_type, allow_bits, deny_bits`, [channelId, targetId, targetType, allow.toString(), deny.toString()]);
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
    async deleteChannelOverwrite(channelId, targetId, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`DELETE FROM channel_overwrites WHERE channel_id = $1 AND target_id = $2`, [channelId, targetId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Get all overwrites for a channel
     */
    async getChannelOverwrites(channelId) {
        const result = await this.pool.query(`SELECT channel_id, target_id, target_type, allow_bits, deny_bits
       FROM channel_overwrites WHERE channel_id = $1`, [channelId]);
        return result.rows.map(rowToChannelOverwrite);
    }
    /**
     * Get a specific channel overwrite
     */
    async getChannelOverwrite(channelId, targetId) {
        const result = await this.pool.query(`SELECT channel_id, target_id, target_type, allow_bits, deny_bits
       FROM channel_overwrites WHERE channel_id = $1 AND target_id = $2`, [channelId, targetId]);
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
    async getGuildById(guildId) {
        const result = await this.pool.query(`SELECT id, owner_id FROM guilds WHERE id = $1 AND deleted_at IS NULL`, [guildId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return {
            id: row.id,
            owner_id: row.owner_id,
        };
    }
    /**
     * Check if a user is a member of a guild
     */
    async isMember(guildId, userId) {
        const result = await this.pool.query(`SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
        return result.rows.length > 0;
    }
    /**
     * Get channel guild ID
     */
    async getChannelGuildId(channelId) {
        const result = await this.pool.query(`SELECT guild_id FROM channels WHERE id = $1 AND deleted_at IS NULL`, [channelId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return row.guild_id;
    }
    /**
     * Check if a channel exists
     */
    async channelExists(channelId) {
        const result = await this.pool.query(`SELECT 1 FROM channels WHERE id = $1 AND deleted_at IS NULL`, [channelId]);
        return result.rows.length > 0;
    }
}
//# sourceMappingURL=repository.js.map