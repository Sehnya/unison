/**
 * Event Fanout
 * 
 * Consumes events from JetStream and fans them out to subscribed connections.
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6
 */

import type {
  DomainEvent,
  MessageCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  GuildCreatedEvent,
  GuildUpdatedEvent,
  GuildDeletedEvent,
  ChannelCreatedEvent,
  ChannelUpdatedEvent,
  ChannelDeletedEvent,
  MemberJoinedEvent,
  MemberLeftEvent,
  MemberRemovedEvent,
  MemberBannedEvent,
  MemberUnbannedEvent,
  MemberUpdatedEvent,
  RoleCreatedEvent,
  RoleUpdatedEvent,
  RoleDeletedEvent,
  SessionRevokedEvent,
  AllSessionsRevokedEvent,
  Snowflake,
  WebSocketEventType,
} from '@discord-clone/types';
import type { ConnectionManager } from './connection.js';
import type { SubscriptionManager } from './types.js';

/**
 * Map domain event types to WebSocket event types
 */
const EVENT_TYPE_MAP: Record<string, WebSocketEventType> = {
  'message.created': 'MESSAGE_CREATE',
  'message.updated': 'MESSAGE_UPDATE',
  'message.deleted': 'MESSAGE_DELETE',
  'guild.created': 'GUILD_CREATE',
  'guild.updated': 'GUILD_UPDATE',
  'guild.deleted': 'GUILD_DELETE',
  'channel.created': 'CHANNEL_CREATE',
  'channel.updated': 'CHANNEL_UPDATE',
  'channel.deleted': 'CHANNEL_DELETE',
  'member.joined': 'MEMBER_ADD',
  'member.left': 'MEMBER_REMOVE',
  'member.removed': 'MEMBER_REMOVE',
  'member.banned': 'MEMBER_REMOVE',
  'member.unbanned': 'MEMBER_UPDATE',
  'member.updated': 'MEMBER_UPDATE',
  'role.created': 'ROLE_CREATE',
  'role.updated': 'ROLE_UPDATE',
  'role.deleted': 'ROLE_DELETE',
};

/**
 * Event Fanout Handler
 * 
 * Handles routing events from the event bus to WebSocket connections.
 */
export class EventFanout {
  private readonly connectionManager: ConnectionManager;
  private readonly subscriptionManager: SubscriptionManager;

  constructor(
    connectionManager: ConnectionManager,
    subscriptionManager: SubscriptionManager
  ) {
    this.connectionManager = connectionManager;
    this.subscriptionManager = subscriptionManager;
  }

  /**
   * Handle an incoming domain event
   * Routes the event to appropriate subscribers based on event type.
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    const eventType = event.type;

    // Handle session events specially
    if (eventType === 'session.revoked') {
      await this.handleSessionRevoked(event as SessionRevokedEvent);
      return;
    }
    if (eventType === 'sessions.revoked_all') {
      await this.handleAllSessionsRevoked(event as AllSessionsRevokedEvent);
      return;
    }

    // Route based on event type
    if (eventType.startsWith('message.')) {
      await this.handleMessageEvent(event as MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent);
    } else if (eventType.startsWith('guild.')) {
      await this.handleGuildEvent(event as GuildCreatedEvent | GuildUpdatedEvent | GuildDeletedEvent);
    } else if (eventType.startsWith('channel.')) {
      await this.handleChannelEvent(event as ChannelCreatedEvent | ChannelUpdatedEvent | ChannelDeletedEvent);
    } else if (eventType.startsWith('member.')) {
      await this.handleMemberEvent(event as MemberJoinedEvent | MemberLeftEvent | MemberRemovedEvent | MemberBannedEvent | MemberUnbannedEvent | MemberUpdatedEvent);
    } else if (eventType.startsWith('role.')) {
      await this.handleRoleEvent(event as RoleCreatedEvent | RoleUpdatedEvent | RoleDeletedEvent);
    }
  }

  /**
   * Handle message events
   * Requirements: 13.1
   * Fan out to connections subscribed to the channel
   */
  private async handleMessageEvent(
    event: MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent
  ): Promise<void> {
    const channelId = event.data.channel_id;
    const wsEventType = EVENT_TYPE_MAP[event.type];
    if (!wsEventType) return;

    // Get connections subscribed to this channel
    const subscriberIds = await this.subscriptionManager.getChannelSubscribers(channelId);

    // Fan out to all subscribers
    for (const connectionId of subscriberIds) {
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        this.connectionManager.dispatchEvent(connection, wsEventType, event.data, event.id);
      }
    }
  }

  /**
   * Handle guild events
   * Requirements: 13.2
   * Fan out to connections subscribed to the guild
   */
  private async handleGuildEvent(
    event: GuildCreatedEvent | GuildUpdatedEvent | GuildDeletedEvent
  ): Promise<void> {
    const wsEventType = EVENT_TYPE_MAP[event.type];
    if (!wsEventType) return;

    let guildId: Snowflake;
    if (event.type === 'guild.deleted') {
      guildId = (event as GuildDeletedEvent).data.guild_id;
    } else {
      guildId = (event as GuildCreatedEvent | GuildUpdatedEvent).data.guild.id;
    }

    // Get connections subscribed to this guild
    const subscriberIds = await this.subscriptionManager.getGuildSubscribers(guildId);

    // Fan out to all subscribers
    for (const connectionId of subscriberIds) {
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        this.connectionManager.dispatchEvent(connection, wsEventType, event.data, event.id);
      }
    }
  }

  /**
   * Handle channel events
   * Requirements: 13.5
   * Fan out to connections subscribed to the guild
   */
  private async handleChannelEvent(
    event: ChannelCreatedEvent | ChannelUpdatedEvent | ChannelDeletedEvent
  ): Promise<void> {
    const guildId = event.data.guild_id;
    const wsEventType = EVENT_TYPE_MAP[event.type];
    if (!wsEventType) return;

    // Get connections subscribed to this guild
    const subscriberIds = await this.subscriptionManager.getGuildSubscribers(guildId);

    // Fan out to all subscribers
    for (const connectionId of subscriberIds) {
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        this.connectionManager.dispatchEvent(connection, wsEventType, event.data, event.id);
      }
    }
  }

  /**
   * Handle member events
   * Requirements: 13.3, 13.4
   * Fan out to connections subscribed to the guild
   * Also handle subscription updates for the affected member
   */
  private async handleMemberEvent(
    event: MemberJoinedEvent | MemberLeftEvent | MemberRemovedEvent | MemberBannedEvent | MemberUnbannedEvent | MemberUpdatedEvent
  ): Promise<void> {
    const guildId = event.data.guild_id;
    const wsEventType = EVENT_TYPE_MAP[event.type];
    if (!wsEventType) return;

    // Get connections subscribed to this guild
    const subscriberIds = await this.subscriptionManager.getGuildSubscribers(guildId);

    // Fan out to all subscribers
    for (const connectionId of subscriberIds) {
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        this.connectionManager.dispatchEvent(connection, wsEventType, event.data, event.id);
      }
    }

    // Handle subscription updates for the affected member
    if (event.type === 'member.joined') {
      // Add subscriptions for the new member's connections
      const joinedEvent = event as MemberJoinedEvent;
      const userId = joinedEvent.data.user.id;
      const userConnections = this.connectionManager.getUserConnections(userId);
      for (const connection of userConnections) {
        await this.subscriptionManager.subscribeToGuild(connection.id, guildId);
      }
    } else if (event.type === 'member.left' || event.type === 'member.removed' || event.type === 'member.banned') {
      // Remove subscriptions for the removed member's connections
      let userId: Snowflake;
      if (event.type === 'member.left') {
        userId = (event as MemberLeftEvent).data.user_id;
      } else if (event.type === 'member.removed') {
        userId = (event as MemberRemovedEvent).data.user_id;
      } else {
        userId = (event as MemberBannedEvent).data.user_id;
      }
      
      const userConnections = this.connectionManager.getUserConnections(userId);
      for (const connection of userConnections) {
        await this.subscriptionManager.unsubscribeFromGuild(connection.id, guildId);
      }
    }
  }

  /**
   * Handle role events
   * Requirements: 13.6
   * Fan out to connections subscribed to the guild
   */
  private async handleRoleEvent(
    event: RoleCreatedEvent | RoleUpdatedEvent | RoleDeletedEvent
  ): Promise<void> {
    const guildId = event.data.guild_id;
    const wsEventType = EVENT_TYPE_MAP[event.type];
    if (!wsEventType) return;

    // Get connections subscribed to this guild
    const subscriberIds = await this.subscriptionManager.getGuildSubscribers(guildId);

    // Fan out to all subscribers
    for (const connectionId of subscriberIds) {
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        this.connectionManager.dispatchEvent(connection, wsEventType, event.data, event.id);
      }
    }
  }

  /**
   * Handle session revoked event
   * Requirements: 2.5
   * Disconnect the affected session
   */
  private async handleSessionRevoked(event: SessionRevokedEvent): Promise<void> {
    await this.connectionManager.disconnectSession(event.data.session_id);
  }

  /**
   * Handle all sessions revoked event
   * Requirements: 2.5
   * Disconnect all connections for the user
   */
  private async handleAllSessionsRevoked(event: AllSessionsRevokedEvent): Promise<void> {
    await this.connectionManager.disconnectUser(event.data.user_id);
  }
}
