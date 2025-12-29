import type { Snowflake } from './snowflake.js';
import type { User } from './user.js';
import type { Guild, Member } from './guild.js';
import type { Channel } from './channel.js';
import type { Message } from './message.js';
import type { Role, ChannelOverwrite } from './permissions.js';
/**
 * Base event structure
 */
export interface BaseEvent<T extends string, D> {
    id: string;
    type: T;
    timestamp: number;
    data: D;
}
export interface GuildCreatedData {
    guild: Guild;
}
export interface GuildUpdatedData {
    guild: Guild;
}
export interface GuildDeletedData {
    guild_id: Snowflake;
}
export type GuildCreatedEvent = BaseEvent<'guild.created', GuildCreatedData>;
export type GuildUpdatedEvent = BaseEvent<'guild.updated', GuildUpdatedData>;
export type GuildDeletedEvent = BaseEvent<'guild.deleted', GuildDeletedData>;
export type GuildEvent = GuildCreatedEvent | GuildUpdatedEvent | GuildDeletedEvent;
export interface MemberJoinedData {
    guild_id: Snowflake;
    user: User;
    joined_at: string;
}
export interface MemberLeftData {
    guild_id: Snowflake;
    user_id: Snowflake;
}
export interface MemberRemovedData {
    guild_id: Snowflake;
    user_id: Snowflake;
    removed_by: Snowflake;
}
export interface MemberBannedData {
    guild_id: Snowflake;
    user_id: Snowflake;
    banned_by: Snowflake;
    reason?: string;
}
export interface MemberUnbannedData {
    guild_id: Snowflake;
    user_id: Snowflake;
}
export interface MemberUpdatedData {
    guild_id: Snowflake;
    user_id: Snowflake;
    member: Member;
}
export type MemberJoinedEvent = BaseEvent<'member.joined', MemberJoinedData>;
export type MemberLeftEvent = BaseEvent<'member.left', MemberLeftData>;
export type MemberRemovedEvent = BaseEvent<'member.removed', MemberRemovedData>;
export type MemberBannedEvent = BaseEvent<'member.banned', MemberBannedData>;
export type MemberUnbannedEvent = BaseEvent<'member.unbanned', MemberUnbannedData>;
export type MemberUpdatedEvent = BaseEvent<'member.updated', MemberUpdatedData>;
export type MemberEvent = MemberJoinedEvent | MemberLeftEvent | MemberRemovedEvent | MemberBannedEvent | MemberUnbannedEvent | MemberUpdatedEvent;
export interface ChannelCreatedData {
    channel: Channel;
    guild_id: Snowflake;
}
export interface ChannelUpdatedData {
    channel: Channel;
    guild_id: Snowflake;
}
export interface ChannelDeletedData {
    channel_id: Snowflake;
    guild_id: Snowflake;
}
export type ChannelCreatedEvent = BaseEvent<'channel.created', ChannelCreatedData>;
export type ChannelUpdatedEvent = BaseEvent<'channel.updated', ChannelUpdatedData>;
export type ChannelDeletedEvent = BaseEvent<'channel.deleted', ChannelDeletedData>;
export type ChannelEvent = ChannelCreatedEvent | ChannelUpdatedEvent | ChannelDeletedEvent;
export interface MessageCreatedData {
    message: Message;
    channel_id: Snowflake;
    guild_id: Snowflake;
}
export interface MessageUpdatedData {
    message: Message;
    channel_id: Snowflake;
    guild_id: Snowflake;
}
export interface MessageDeletedData {
    message_id: Snowflake;
    channel_id: Snowflake;
    guild_id: Snowflake;
}
export type MessageCreatedEvent = BaseEvent<'message.created', MessageCreatedData>;
export type MessageUpdatedEvent = BaseEvent<'message.updated', MessageUpdatedData>;
export type MessageDeletedEvent = BaseEvent<'message.deleted', MessageDeletedData>;
export type MessageEvent = MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent;
export interface RoleCreatedData {
    role: Role;
    guild_id: Snowflake;
}
export interface RoleUpdatedData {
    role: Role;
    guild_id: Snowflake;
}
export interface RoleDeletedData {
    role_id: Snowflake;
    guild_id: Snowflake;
}
export interface MemberRolesUpdatedData {
    guild_id: Snowflake;
    user_id: Snowflake;
    role_ids: Snowflake[];
}
export type RoleCreatedEvent = BaseEvent<'role.created', RoleCreatedData>;
export type RoleUpdatedEvent = BaseEvent<'role.updated', RoleUpdatedData>;
export type RoleDeletedEvent = BaseEvent<'role.deleted', RoleDeletedData>;
export type MemberRolesUpdatedEvent = BaseEvent<'member_roles.updated', MemberRolesUpdatedData>;
export type RoleEvent = RoleCreatedEvent | RoleUpdatedEvent | RoleDeletedEvent | MemberRolesUpdatedEvent;
export interface ChannelOverwriteUpdatedData {
    overwrite: ChannelOverwrite;
    channel_id: Snowflake;
    guild_id: Snowflake;
}
export interface ChannelOverwriteDeletedData {
    channel_id: Snowflake;
    target_id: Snowflake;
    guild_id: Snowflake;
}
export type ChannelOverwriteUpdatedEvent = BaseEvent<'channel_overwrite.updated', ChannelOverwriteUpdatedData>;
export type ChannelOverwriteDeletedEvent = BaseEvent<'channel_overwrite.deleted', ChannelOverwriteDeletedData>;
export type ChannelOverwriteEvent = ChannelOverwriteUpdatedEvent | ChannelOverwriteDeletedEvent;
export interface SessionRevokedData {
    user_id: Snowflake;
    session_id: string;
}
export interface AllSessionsRevokedData {
    user_id: Snowflake;
}
export type SessionRevokedEvent = BaseEvent<'session.revoked', SessionRevokedData>;
export type AllSessionsRevokedEvent = BaseEvent<'sessions.revoked_all', AllSessionsRevokedData>;
export type SessionEvent = SessionRevokedEvent | AllSessionsRevokedEvent;
export type DomainEvent = GuildEvent | MemberEvent | ChannelEvent | MessageEvent | RoleEvent | ChannelOverwriteEvent | SessionEvent;
/**
 * Event topic names for NATS JetStream
 */
export declare const EventTopics: {
    readonly GUILD: "guild.events";
    readonly CHANNEL: "channel.events";
    readonly MESSAGE: "message.events";
    readonly MEMBER: "member.events";
    readonly ROLE: "role.events";
};
export type EventTopic = (typeof EventTopics)[keyof typeof EventTopics];
//# sourceMappingURL=events.d.ts.map