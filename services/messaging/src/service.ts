/**
 * Messaging Service
 *
 * Handles message creation, retrieval, editing, and deletion with permission validation.
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3
 */

import type { Pool } from 'pg';
import type { Snowflake, Message, PaginationOptions } from '@discord-clone/types';
import { Permissions } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { createEvent } from '@discord-clone/events';
import type {
  MessageCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
} from '@discord-clone/types';
import { MessagingRepository, MAX_MESSAGE_LENGTH } from './repository.js';
import {
  MessageNotFoundError,
  ChannelNotFoundError,
  MissingPermissionError,
  NotMessageAuthorError,
  MessageTooLongError,
  EmptyMessageError,
  MessageDeletedError,
} from './errors.js';

/**
 * Permission checker interface
 * This allows the service to be decoupled from the permissions service
 */
export interface PermissionChecker {
  hasPermission(userId: Snowflake, channelId: Snowflake, permission: bigint): Promise<boolean>;
}

/**
 * Event emitter interface
 * This allows the service to emit events without being coupled to a specific implementation
 */
export interface EventEmitter {
  emit(event: MessageCreatedEvent | MessageUpdatedEvent | MessageDeletedEvent): Promise<void>;
}

/**
 * Messaging Service Configuration
 */
export interface MessagingServiceConfig {
  workerId?: number;
  permissionChecker: PermissionChecker;
  eventEmitter?: EventEmitter;
}


/**
 * Parse mentions from message content
 * Extracts user mentions (<@userId>) and role mentions (<@&roleId>)
 */
export function parseMentions(content: string): { users: Snowflake[]; roles: Snowflake[] } {
  const users: Snowflake[] = [];
  const roles: Snowflake[] = [];

  // Match user mentions: <@userId>
  const userMentionRegex = /<@(\d+)>/g;
  let match: RegExpExecArray | null;
  while ((match = userMentionRegex.exec(content)) !== null) {
    const userId = match[1] as Snowflake;
    if (!users.includes(userId)) {
      users.push(userId);
    }
  }

  // Match role mentions: <@&roleId>
  const roleMentionRegex = /<@&(\d+)>/g;
  while ((match = roleMentionRegex.exec(content)) !== null) {
    const roleId = match[1] as Snowflake;
    if (!roles.includes(roleId)) {
      roles.push(roleId);
    }
  }

  return { users, roles };
}

/**
 * Messaging Service
 */
export class MessagingService {
  private readonly repository: MessagingRepository;
  private readonly snowflake: SnowflakeGenerator;
  private readonly permissionChecker: PermissionChecker;
  private readonly eventEmitter: EventEmitter | undefined;

  constructor(pool: Pool, config: MessagingServiceConfig) {
    this.repository = new MessagingRepository(pool);
    this.snowflake = new SnowflakeGenerator(config.workerId ?? 0);
    this.permissionChecker = config.permissionChecker;
    this.eventEmitter = config.eventEmitter;
  }

  // ============================================
  // Message Creation
  // Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
  // ============================================

  /**
   * Create a new message
   * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
   *
   * - Validates send_message permission
   * - Creates message with Snowflake ID
   * - Parses mentions (users and roles)
   * - Emits message.created event
   */
  async createMessage(
    channelId: Snowflake,
    authorId: Snowflake,
    content: string
  ): Promise<Message> {
    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new EmptyMessageError();
    }
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      throw new MessageTooLongError(MAX_MESSAGE_LENGTH);
    }

    // Get channel info
    const channelInfo = await this.repository.getChannelInfo(channelId);
    if (!channelInfo) {
      throw new ChannelNotFoundError();
    }

    // Validate send_message permission
    // Requirements: 9.1, 9.5
    const canSend = await this.permissionChecker.hasPermission(
      authorId,
      channelId,
      Permissions.SEND_MESSAGES
    );
    if (!canSend) {
      throw new MissingPermissionError('SEND_MESSAGES');
    }

    // Parse mentions from content
    // Requirements: 9.3
    const { users: mentionedUsers, roles: mentionedRoles } = parseMentions(trimmedContent);

    // Validate mentioned users exist
    const validMentions: Snowflake[] = [];
    for (const userId of mentionedUsers) {
      const exists = await this.repository.userExists(userId);
      if (exists) {
        validMentions.push(userId);
      }
    }

    // Validate mentioned roles exist in the guild
    const validRoleMentions: Snowflake[] = [];
    for (const roleId of mentionedRoles) {
      const exists = await this.repository.roleExistsInGuild(roleId, channelInfo.guild_id);
      if (exists) {
        validRoleMentions.push(roleId);
      }
    }

    // Generate Snowflake ID
    const messageId = this.snowflake.generate();
    const createdAt = new Date();

    // Create the message
    // Requirements: 9.2
    const message = await this.repository.createMessage(
      messageId,
      channelId,
      authorId,
      trimmedContent,
      validMentions,
      validRoleMentions,
      createdAt
    );

    // Emit message.created event
    // Requirements: 9.4
    if (this.eventEmitter) {
      const event = createEvent('message.created', {
        message,
        channel_id: channelId,
        guild_id: channelInfo.guild_id,
      }) as MessageCreatedEvent;
      await this.eventEmitter.emit(event);
    }

    return message;
  }


  // ============================================
  // Message Retrieval
  // Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
  // ============================================

  /**
   * Get a message by ID
   */
  async getMessage(messageId: Snowflake): Promise<Message> {
    const message = await this.repository.getMessageById(messageId);
    if (!message || message.deleted_at) {
      throw new MessageNotFoundError();
    }
    return message;
  }

  /**
   * Get messages for a channel with pagination
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
   *
   * - Validates read_message permission
   * - Cursor-based pagination (before/after)
   * - Limits page size to 100
   * - Orders by Snowflake ID (chronological)
   */
  async getMessages(
    channelId: Snowflake,
    userId: Snowflake,
    options: PaginationOptions = {}
  ): Promise<Message[]> {
    // Get channel info
    const channelInfo = await this.repository.getChannelInfo(channelId);
    if (!channelInfo) {
      throw new ChannelNotFoundError();
    }

    // Validate read_message permission
    // Requirements: 10.1, 10.5
    const canRead = await this.permissionChecker.hasPermission(
      userId,
      channelId,
      Permissions.READ_MESSAGE_HISTORY
    );
    if (!canRead) {
      throw new MissingPermissionError('READ_MESSAGE_HISTORY');
    }

    // Get messages with pagination
    // Requirements: 10.2, 10.3, 10.4
    return this.repository.getMessages(channelId, options);
  }

  // ============================================
  // Message Editing
  // Requirements: 11.1
  // ============================================

  /**
   * Update a message
   * Requirements: 11.1
   *
   * - Validates author or manage_messages permission
   * - Updates content, sets edited_at
   * - Emits message.updated event
   */
  async updateMessage(
    messageId: Snowflake,
    userId: Snowflake,
    content: string
  ): Promise<Message> {
    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new EmptyMessageError();
    }
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      throw new MessageTooLongError(MAX_MESSAGE_LENGTH);
    }

    // Get the message
    const message = await this.repository.getMessageById(messageId);
    if (!message) {
      throw new MessageNotFoundError();
    }

    // Check if message is deleted (deletion dominance)
    if (message.deleted_at) {
      throw new MessageDeletedError();
    }

    // Get channel info for permission check and event
    const channelInfo = await this.repository.getChannelInfo(message.channel_id);
    if (!channelInfo) {
      throw new ChannelNotFoundError();
    }

    // Check if user is author or has manage_messages permission
    const isAuthor = message.author_id === userId;
    if (!isAuthor) {
      const canManage = await this.permissionChecker.hasPermission(
        userId,
        message.channel_id,
        Permissions.MANAGE_MESSAGES
      );
      if (!canManage) {
        throw new NotMessageAuthorError();
      }
    }

    // Update the message
    const updatedMessage = await this.repository.updateMessage(messageId, trimmedContent);
    if (!updatedMessage) {
      throw new MessageNotFoundError();
    }

    // Emit message.updated event
    if (this.eventEmitter) {
      const event = createEvent('message.updated', {
        message: updatedMessage,
        channel_id: message.channel_id,
        guild_id: channelInfo.guild_id,
      }) as MessageUpdatedEvent;
      await this.eventEmitter.emit(event);
    }

    return updatedMessage;
  }


  // ============================================
  // Message Deletion
  // Requirements: 11.2, 11.3
  // ============================================

  /**
   * Delete a message
   * Requirements: 11.2, 11.3
   *
   * - Validates author or manage_messages permission
   * - Soft-deletes (sets deleted_at)
   * - Emits message.deleted event
   * - Implements deletion dominance (deleted messages ignore edits)
   */
  async deleteMessage(messageId: Snowflake, userId: Snowflake): Promise<void> {
    // Get the message
    const message = await this.repository.getMessageById(messageId);
    if (!message) {
      throw new MessageNotFoundError();
    }

    // If already deleted, just return (idempotent)
    if (message.deleted_at) {
      return;
    }

    // Get channel info for permission check and event
    const channelInfo = await this.repository.getChannelInfo(message.channel_id);
    if (!channelInfo) {
      throw new ChannelNotFoundError();
    }

    // Check if user is author or has manage_messages permission
    // Requirements: 11.2, 11.3
    const isAuthor = message.author_id === userId;
    if (!isAuthor) {
      const canManage = await this.permissionChecker.hasPermission(
        userId,
        message.channel_id,
        Permissions.MANAGE_MESSAGES
      );
      if (!canManage) {
        throw new NotMessageAuthorError();
      }
    }

    // Soft-delete the message
    const deleted = await this.repository.deleteMessage(messageId);
    if (!deleted) {
      // Message was already deleted (race condition), that's fine
      return;
    }

    // Emit message.deleted event
    if (this.eventEmitter) {
      const event = createEvent('message.deleted', {
        message_id: messageId,
        channel_id: message.channel_id,
        guild_id: channelInfo.guild_id,
      }) as MessageDeletedEvent;
      await this.eventEmitter.emit(event);
    }
  }

  /**
   * Get the repository for direct access (used for testing)
   */
  getRepository(): MessagingRepository {
    return this.repository;
  }
}
