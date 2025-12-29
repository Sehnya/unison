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
export type ServerOpcode = 'HELLO' | 'HEARTBEAT_ACK' | 'DISPATCH' | 'INVALID_SESSION' | 'RECONNECT' | 'RESYNC_REQUIRED';
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
    t?: string;
    s?: number;
    d: T;
}
export interface IdentifyPayload {
    token: string;
    last_event_id?: string;
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
export type WebSocketEventType = 'READY' | 'MESSAGE_CREATE' | 'MESSAGE_UPDATE' | 'MESSAGE_DELETE' | 'GUILD_CREATE' | 'GUILD_UPDATE' | 'GUILD_DELETE' | 'CHANNEL_CREATE' | 'CHANNEL_UPDATE' | 'CHANNEL_DELETE' | 'MEMBER_ADD' | 'MEMBER_REMOVE' | 'MEMBER_UPDATE' | 'ROLE_CREATE' | 'ROLE_UPDATE' | 'ROLE_DELETE';
export declare const WebSocketCloseCodes: {
    readonly AUTHENTICATION_FAILED: 4001;
    readonly SESSION_INVALIDATED: 4002;
    readonly HEARTBEAT_TIMEOUT: 4003;
    readonly INVALID_PAYLOAD: 4004;
    readonly RATE_LIMITED: 4005;
};
export type WebSocketCloseCode = (typeof WebSocketCloseCodes)[keyof typeof WebSocketCloseCodes];
//# sourceMappingURL=websocket.d.ts.map