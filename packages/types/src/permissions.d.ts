import type { Snowflake } from './snowflake.js';
/**
 * Role entity
 */
export interface Role {
    id: Snowflake;
    guild_id: Snowflake;
    name: string;
    color?: string;
    position: number;
    permissions: bigint;
    created_at: Date;
}
/**
 * Channel permission overwrite
 */
export interface ChannelOverwrite {
    channel_id: Snowflake;
    target_id: Snowflake;
    target_type: 'role' | 'member';
    allow: bigint;
    deny: bigint;
}
/**
 * Permission bit flags
 */
export declare const Permissions: {
    readonly VIEW_CHANNEL: bigint;
    readonly SEND_MESSAGES: bigint;
    readonly READ_MESSAGE_HISTORY: bigint;
    readonly MANAGE_MESSAGES: bigint;
    readonly MANAGE_CHANNELS: bigint;
    readonly MANAGE_GUILD: bigint;
    readonly MANAGE_ROLES: bigint;
    readonly KICK_MEMBERS: bigint;
    readonly BAN_MEMBERS: bigint;
    readonly CREATE_INVITES: bigint;
    readonly ADMINISTRATOR: bigint;
};
export type PermissionFlag = (typeof Permissions)[keyof typeof Permissions];
/**
 * All permissions combined
 */
export declare const ALL_PERMISSIONS: bigint;
//# sourceMappingURL=permissions.d.ts.map