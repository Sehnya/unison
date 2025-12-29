import type { Snowflake } from './snowflake.js';
import type { User } from './user.js';
import type { Guild } from './guild.js';

/**
 * Client -> Server opcodes
 */
export type ClientOpcode = 'IDENTIFY' | 'HEARTBEAT' | 'SUBSCRIBE' | 'UNSUBSCRIBE' | 'RESUME';

/**
 * Server -> Client opcodes
 */
export type ServerOpcode =
  | 'HELLO'
  | 'HEARTBEAT_ACK'
  | 'DISPATCH'
  | 'INVALID_SESSION'
  | 'RECONNECT'
  | 'RESYNC_REQUIRED';

/**
 * Client -> Server message
 */
export interface ClientMessage<T = unknown> {
  op: ClientOpcode;
  d: T;
}

/**
 * Server -> Client message
 */
export interface ServerMessage<T = unknown> {
  op: ServerOpcode;
  t?: string; // event type for DISPATCH
  s?: number; // sequence number for ordering
  d: T;
}

// ============================================
// Client Payloads
// ============================================

export interface IdentifyPayload {
  token: string;
  last_event_id?: string; // For reconnection - replay events since this ID
}

export interface ResumePayload {
  token: string;
  session_id: string;
  last_event_id: string;
}

export interface SubscribePayload {
  channel_id: Snowflake;
}

export interface UnsubscribePayload {
  channel_id: Snowflake;
}

// ============================================
// Server Payloads
// ============================================

export interface HelloPayload {
  heartbeat_interval: number;
}

export interface ReadyPayload {
  user: User;
  guilds: Guild[];
  session_id: string;
}

export interface ResyncPayload {
  reason: 'replay_window_exceeded' | 'session_expired';
}

export interface InvalidSessionPayload {
  resumable: boolean;
}

// ============================================
// WebSocket Event Types (t field in DISPATCH)
// ============================================

export type WebSocketEventType =
  | 'READY'
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'GUILD_CREATE'
  | 'GUILD_UPDATE'
  | 'GUILD_DELETE'
  | 'CHANNEL_CREATE'
  | 'CHANNEL_UPDATE'
  | 'CHANNEL_DELETE'
  | 'MEMBER_ADD'
  | 'MEMBER_REMOVE'
  | 'MEMBER_UPDATE'
  | 'ROLE_CREATE'
  | 'ROLE_UPDATE'
  | 'ROLE_DELETE';

// ============================================
// WebSocket Close Codes
// ============================================

export const WebSocketCloseCodes = {
  AUTHENTICATION_FAILED: 4001,
  SESSION_INVALIDATED: 4002,
  HEARTBEAT_TIMEOUT: 4003,
  INVALID_PAYLOAD: 4004,
  RATE_LIMITED: 4005,
} as const;

export type WebSocketCloseCode = (typeof WebSocketCloseCodes)[keyof typeof WebSocketCloseCodes];
