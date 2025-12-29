/**
 * Channel Repository - Database operations for channels
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
/**
 * Convert database row to Channel type
 */
export function rowToChannel(row) {
    const channel = {
        id: row.id,
        guild_id: row.guild_id,
        type: row.type,
        name: row.name,
        position: row.position,
        created_at: row.created_at,
    };
    if (row.topic) {
        channel.topic = row.topic;
    }
    if (row.parent_id) {
        channel.parent_id = row.parent_id;
    }
    if (row.deleted_at) {
        channel.deleted_at = row.deleted_at;
    }
    return channel;
}
/**
 * Channel Repository
 */
export class ChannelRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    // ============================================
    // Channel CRUD Operations
    // Requirements: 8.1, 8.2, 8.3, 8.4
    // ============================================
    /**
     * Create a new channel
     * Requirements: 8.1
     */
    async createChannel(id, guildId, name, type, position, parentId, topic, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`INSERT INTO channels (id, guild_id, type, name, topic, parent_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at`, [id, guildId, type, name.trim(), topic ?? null, parentId ?? null, position]);
        const row = result.rows[0];
        if (!row) {
            throw new Error('Failed to create channel');
        }
        return rowToChannel(row);
    }
    /**
     * Get channel by ID
     */
    async getChannelById(channelId) {
        const result = await this.pool.query(`SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE id = $1 AND deleted_at IS NULL`, [channelId]);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToChannel(row);
    }
    /**
     * Get all channels for a guild (ordered by position)
     */
    async getGuildChannels(guildId) {
        const result = await this.pool.query(`SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE guild_id = $1 AND deleted_at IS NULL
       ORDER BY position ASC`, [guildId]);
        return result.rows.map(rowToChannel);
    }
    /**
     * Update channel settings
     * Requirements: 8.2
     */
    async updateChannel(channelId, updates, client) {
        const conn = client ?? this.pool;
        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        if (updates.name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            values.push(updates.name.trim());
        }
        if (updates.topic !== undefined) {
            setClauses.push(`topic = $${paramIndex++}`);
            values.push(updates.topic);
        }
        if (updates.position !== undefined) {
            setClauses.push(`position = $${paramIndex++}`);
            values.push(updates.position);
        }
        if (updates.parentId !== undefined) {
            setClauses.push(`parent_id = $${paramIndex++}`);
            values.push(updates.parentId);
        }
        if (setClauses.length === 0) {
            return this.getChannelById(channelId);
        }
        values.push(channelId);
        const result = await conn.query(`UPDATE channels SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at`, values);
        const row = result.rows[0];
        if (!row) {
            return null;
        }
        return rowToChannel(row);
    }
    /**
     * Soft-delete a channel
     * Requirements: 8.4
     */
    async deleteChannel(channelId, client) {
        const conn = client ?? this.pool;
        const result = await conn.query(`UPDATE channels SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`, [channelId]);
        return (result.rowCount ?? 0) > 0;
    }
    /**
     * Get the highest position for channels in a guild
     */
    async getMaxChannelPosition(guildId) {
        const result = await this.pool.query(`SELECT MAX(position) as max FROM channels WHERE guild_id = $1 AND deleted_at IS NULL`, [guildId]);
        return result.rows[0]?.max ?? -1;
    }
    /**
     * Reorder channels by updating positions
     * Requirements: 8.3
     */
    async reorderChannels(guildId, channelPositions, client) {
        const conn = client ?? this.pool;
        for (const { channelId, position, parentId } of channelPositions) {
            if (parentId !== undefined) {
                await conn.query(`UPDATE channels SET position = $1, parent_id = $2 WHERE id = $3 AND guild_id = $4 AND deleted_at IS NULL`, [position, parentId, channelId, guildId]);
            }
            else {
                await conn.query(`UPDATE channels SET position = $1 WHERE id = $2 AND guild_id = $3 AND deleted_at IS NULL`, [position, channelId, guildId]);
            }
        }
    }
    /**
     * Get child channels of a category
     */
    async getChildChannels(parentId) {
        const result = await this.pool.query(`SELECT id, guild_id, type, name, topic, parent_id, position, created_at, deleted_at
       FROM channels WHERE parent_id = $1 AND deleted_at IS NULL
       ORDER BY position ASC`, [parentId]);
        return result.rows.map(rowToChannel);
    }
    /**
     * Check if a channel has children
     */
    async hasChildChannels(channelId) {
        const result = await this.pool.query(`SELECT 1 FROM channels WHERE parent_id = $1 AND deleted_at IS NULL LIMIT 1`, [channelId]);
        return result.rows.length > 0;
    }
    // ============================================
    // Guild Operations (for channel validation)
    // ============================================
    /**
     * Check if a guild exists
     */
    async guildExists(guildId) {
        const result = await this.pool.query(`SELECT 1 FROM guilds WHERE id = $1 AND deleted_at IS NULL`, [guildId]);
        return result.rows.length > 0;
    }
    /**
     * Get a database client for transactions
     */
    async getClient() {
        return this.pool.connect();
    }
}
//# sourceMappingURL=repository.js.map