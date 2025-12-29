import type { Snowflake } from './snowflake.js';

/**
 * Message entity
 */
export interface Message {
  id: Snowflake;
  channel_id: Snowflake;
  author_id: Snowflake;
  content: string;
  mentions: Snowflake[];
  mention_roles: Snowflake[];
  created_at: Date;
  edited_at?: Date;
  deleted_at?: Date;
}

/**
 * Pagination options for message retrieval
 */
export interface PaginationOptions {
  before?: Snowflake;
  after?: Snowflake;
  limit?: number; // max 100
}
