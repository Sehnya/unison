import type { Snowflake } from './snowflake.js';

/**
 * User account
 */
export interface User {
  id: Snowflake;
  email: string;
  username: string;
  avatar?: string;
  bio?: string;
  created_at: Date;
  terms_accepted_at?: Date;
}

/**
 * Device information for session tracking
 */
export interface DeviceInfo {
  user_agent?: string;
  ip_address?: string;
  device_name?: string;
}

/**
 * User session
 */
export interface Session {
  id: string;
  user_id: Snowflake;
  refresh_token_hash: string;
  device_info: DeviceInfo;
  created_at: Date;
  last_active_at: Date;
}

/**
 * JWT and refresh token pair
 */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * JWT payload structure
 */
export interface TokenPayload {
  sub: Snowflake; // user_id
  session_id: string;
  iat: number;
  exp: number;
}
