import type {
  DomainEvent,
  GuildEvent,
  MemberEvent,
  ChannelEvent,
  MessageEvent,
  RoleEvent,
  EventTopic,
} from '@discord-clone/types';

/**
 * Get the NATS topic for an event type
 */
export function getEventTopic(eventType: DomainEvent['type']): EventTopic {
  if (eventType.startsWith('guild.')) {
    return 'guild.events';
  }
  if (eventType.startsWith('member.') || eventType.startsWith('member_roles.')) {
    return 'member.events';
  }
  if (eventType.startsWith('channel.') || eventType.startsWith('channel_overwrite.')) {
    return 'channel.events';
  }
  if (eventType.startsWith('message.')) {
    return 'message.events';
  }
  if (eventType.startsWith('role.')) {
    return 'role.events';
  }
  // Default to guild events for session events
  return 'guild.events';
}

/**
 * Type guard for guild events
 */
export function isGuildEvent(event: DomainEvent): event is GuildEvent {
  return event.type.startsWith('guild.');
}

/**
 * Type guard for member events
 */
export function isMemberEvent(event: DomainEvent): event is MemberEvent {
  return event.type.startsWith('member.');
}

/**
 * Type guard for channel events
 */
export function isChannelEvent(event: DomainEvent): event is ChannelEvent {
  return event.type.startsWith('channel.');
}

/**
 * Type guard for message events
 */
export function isMessageEvent(event: DomainEvent): event is MessageEvent {
  return event.type.startsWith('message.');
}

/**
 * Type guard for role events
 */
export function isRoleEvent(event: DomainEvent): event is RoleEvent {
  return event.type.startsWith('role.');
}
