import type { Snowflake } from './snowflake.js';
/**
 * Guild (server) entity
 */
export interface Guild {
    id: Snowflake;
    owner_id: Snowflake;
    name: string;
    icon?: string;
    created_at: Date;
    deleted_at?: Date;
}
/**
 * Guild member - a user's membership in a guild
 */
export interface Member {
    guild_id: Snowflake;
    user_id: Snowflake;
    nickname?: string;
    joined_at: Date;
    roles: Snowflake[];
}
/**
 * Guild invite
 */
export interface Invite {
    code: string;
    guild_id: Snowflake;
    creator_id: Snowflake;
    max_uses?: number;
    uses: number;
    expires_at?: Date;
    revoked_at?: Date;
    created_at: Date;
}
/**
 * Options for creating an invite
 */
export interface InviteOptions {
    max_uses?: number;
    expires_in?: number;
}
/**
 * Guild ban record
 */
export interface Ban {
    guild_id: Snowflake;
    user_id: Snowflake;
    reason?: string;
    banned_by: Snowflake;
    created_at: Date;
}
//# sourceMappingURL=guild.d.ts.map