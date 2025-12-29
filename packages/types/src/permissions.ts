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
export const Permissions = {
  VIEW_CHANNEL: 1n << 0n,
  SEND_MESSAGES: 1n << 1n,
  READ_MESSAGE_HISTORY: 1n << 2n,
  MANAGE_MESSAGES: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 6n,
  KICK_MEMBERS: 1n << 7n,
  BAN_MEMBERS: 1n << 8n,
  CREATE_INVITES: 1n << 9n,
  ADMINISTRATOR: 1n << 10n,
} as const;

export type PermissionFlag = (typeof Permissions)[keyof typeof Permissions];

/**
 * All permissions combined
 */
export const ALL_PERMISSIONS = Object.values(Permissions).reduce((acc, p) => acc | p, 0n);
