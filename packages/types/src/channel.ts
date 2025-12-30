import type { Snowflake } from './snowflake.js';

/**
 * Channel types
 */
export enum ChannelType {
  TEXT = 0,
  CATEGORY = 1,
  VOICE = 2,
}

/**
 * Channel entity
 */
export interface Channel {
  id: Snowflake;
  guild_id: Snowflake;
  type: ChannelType;
  name: string;
  topic?: string;
  parent_id?: Snowflake; // category
  position: number;
  created_at: Date;
  deleted_at?: Date;
}
