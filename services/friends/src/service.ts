/**
 * Friends Service
 *
 * Handles friend requests, DM privacy, and direct messaging
 */

import type { Pool } from 'pg';
import type { Snowflake } from '@discord-clone/types';
import { SnowflakeGenerator } from '@discord-clone/snowflake';
import { FriendsRepository, type DMPrivacy, type FriendWithUser, type DMConversationWithParticipant, type DMMessageRow } from './repository.js';
import {
  UserNotFoundError,
  AlreadyFriendsError,
  FriendRequestExistsError,
  FriendRequestNotFoundError,
  CannotFriendSelfError,
  UserBlockedError,
  DMPrivacyBlockedError,
  NotFriendsError,
  ConversationNotFoundError,
  NotParticipantError,
} from './errors.js';

/**
 * Friends Service Configuration
 */
export interface FriendsServiceConfig {
  workerId?: number;
}

/**
 * Friends Service
 */
export class FriendsService {
  private readonly repository: FriendsRepository;
  private readonly snowflake: SnowflakeGenerator;

  constructor(pool: Pool, config: FriendsServiceConfig = {}) {
    this.repository = new FriendsRepository(pool);
    this.snowflake = new SnowflakeGenerator(config.workerId ?? 0);
  }

  // ============================================
  // DM Privacy Settings
  // ============================================

  /**
   * Get user's DM privacy setting
   */
  async getDMPrivacy(userId: Snowflake): Promise<DMPrivacy> {
    return this.repository.getDMPrivacy(userId);
  }

  /**
   * Update user's DM privacy setting
   */
  async setDMPrivacy(userId: Snowflake, privacy: DMPrivacy): Promise<void> {
    if (!['open', 'friends', 'closed'].includes(privacy)) {
      throw new Error('Invalid privacy setting');
    }
    await this.repository.setDMPrivacy(userId, privacy);
  }

  // ============================================
  // Friend Requests
  // ============================================

  /**
   * Send a friend request
   */
  async sendFriendRequest(userId: Snowflake, friendId: Snowflake): Promise<FriendWithUser> {
    // Can't friend yourself
    if (userId === friendId) {
      throw new CannotFriendSelfError();
    }

    // Check if target user exists
    const targetUser = await this.repository.getUserById(friendId);
    if (!targetUser) {
      throw new UserNotFoundError();
    }

    // Check if already friends
    const areFriends = await this.repository.areFriends(userId, friendId);
    if (areFriends) {
      throw new AlreadyFriendsError();
    }

    // Check if blocked
    const isBlocked = await this.repository.isBlocked(friendId, userId);
    if (isBlocked) {
      throw new UserBlockedError();
    }

    // Check if request already exists
    const hasPending = await this.repository.hasPendingRequest(userId, friendId);
    if (hasPending) {
      throw new FriendRequestExistsError();
    }

    // Create friend request
    const id = this.snowflake.generate();
    const request = await this.repository.sendFriendRequest(id, userId, friendId);

    return {
      ...request,
      id: request.id as Snowflake,
      user_id: request.user_id as Snowflake,
      friend_id: request.friend_id as Snowflake,
      friend_username: targetUser.username,
      friend_avatar: targetUser.avatar,
      friend_bio: null,
    };
  }

  /**
   * Get incoming friend requests
   */
  async getIncomingFriendRequests(userId: Snowflake): Promise<FriendWithUser[]> {
    return this.repository.getIncomingFriendRequests(userId);
  }

  /**
   * Get outgoing friend requests
   */
  async getOutgoingFriendRequests(userId: Snowflake): Promise<FriendWithUser[]> {
    return this.repository.getOutgoingFriendRequests(userId);
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: Snowflake, userId: Snowflake): Promise<void> {
    const accepted = await this.repository.acceptFriendRequest(requestId, userId);
    if (!accepted) {
      throw new FriendRequestNotFoundError();
    }
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: Snowflake, userId: Snowflake): Promise<void> {
    const declined = await this.repository.declineFriendRequest(requestId, userId);
    if (!declined) {
      throw new FriendRequestNotFoundError();
    }
  }

  /**
   * Get all friends
   */
  async getFriends(userId: Snowflake): Promise<FriendWithUser[]> {
    return this.repository.getFriends(userId);
  }

  /**
   * Remove a friend
   */
  async removeFriend(userId: Snowflake, friendId: Snowflake): Promise<void> {
    const removed = await this.repository.removeFriend(userId, friendId);
    if (!removed) {
      throw new NotFriendsError();
    }
  }

  /**
   * Block a user
   */
  async blockUser(userId: Snowflake, blockedUserId: Snowflake): Promise<void> {
    if (userId === blockedUserId) {
      throw new Error('Cannot block yourself');
    }

    const targetUser = await this.repository.getUserById(blockedUserId);
    if (!targetUser) {
      throw new UserNotFoundError();
    }

    const id = this.snowflake.generate();
    await this.repository.blockUser(id, userId, blockedUserId);
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: Snowflake, blockedUserId: Snowflake): Promise<void> {
    const unblocked = await this.repository.unblockUser(userId, blockedUserId);
    if (!unblocked) {
      throw new Error('User is not blocked');
    }
  }

  /**
   * Get blocked users
   */
  async getBlockedUsers(userId: Snowflake): Promise<FriendWithUser[]> {
    return this.repository.getBlockedUsers(userId);
  }

  // ============================================
  // Direct Messages
  // ============================================

  /**
   * Check if user can send DM to another user
   */
  async canSendDM(senderId: Snowflake, recipientId: Snowflake): Promise<{ allowed: boolean; reason?: string }> {
    // Check if sender is blocked by recipient
    const isBlocked = await this.repository.isBlocked(recipientId, senderId);
    if (isBlocked) {
      return { allowed: false, reason: 'You are blocked by this user' };
    }

    // Check recipient's DM privacy setting
    const privacy = await this.repository.getDMPrivacy(recipientId);

    switch (privacy) {
      case 'open':
        return { allowed: true };
      case 'friends':
        const areFriends = await this.repository.areFriends(senderId, recipientId);
        if (!areFriends) {
          return { allowed: false, reason: 'This user only accepts messages from friends' };
        }
        return { allowed: true };
      case 'closed':
        return { allowed: false, reason: 'This user has disabled direct messages' };
      default:
        return { allowed: false, reason: 'Unknown privacy setting' };
    }
  }

  /**
   * Start or get a DM conversation
   */
  async startDMConversation(userId: Snowflake, otherUserId: Snowflake): Promise<DMConversationWithParticipant> {
    // Check if can send DM
    const canSend = await this.canSendDM(userId, otherUserId);
    if (!canSend.allowed) {
      throw new DMPrivacyBlockedError(canSend.reason ?? 'Cannot send DM');
    }

    // Get or create conversation
    const conversationId = this.snowflake.generate();
    const actualId = await this.repository.getOrCreateDMConversation(conversationId, userId, otherUserId);

    // Get conversation details
    const conversation = await this.repository.getDMConversation(actualId, userId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    return conversation;
  }

  /**
   * Get all DM conversations
   */
  async getDMConversations(userId: Snowflake): Promise<DMConversationWithParticipant[]> {
    return this.repository.getDMConversations(userId);
  }

  /**
   * Get a specific DM conversation
   */
  async getDMConversation(conversationId: Snowflake, userId: Snowflake): Promise<DMConversationWithParticipant> {
    // Check if user is participant
    const isParticipant = await this.repository.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new NotParticipantError();
    }

    const conversation = await this.repository.getDMConversation(conversationId, userId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    return conversation;
  }

  /**
   * Send a direct message
   */
  async sendDM(
    conversationId: Snowflake,
    authorId: Snowflake,
    content: string
  ): Promise<DMMessageRow> {
    // Check if user is participant
    const isParticipant = await this.repository.isParticipant(conversationId, authorId);
    if (!isParticipant) {
      throw new NotParticipantError();
    }

    // Get conversation to check DM permissions with other user
    const conversation = await this.repository.getDMConversation(conversationId, authorId);
    if (!conversation) {
      throw new ConversationNotFoundError();
    }

    // Check if can still send DM (in case privacy changed)
    const canSend = await this.canSendDM(authorId, conversation.other_user_id);
    if (!canSend.allowed) {
      throw new DMPrivacyBlockedError(canSend.reason ?? 'Cannot send DM');
    }

    // Validate content
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error('Message cannot be empty');
    }
    if (trimmedContent.length > 4000) {
      throw new Error('Message too long');
    }

    // Create message
    const messageId = this.snowflake.generate();
    return this.repository.createDM(messageId, conversationId, authorId, trimmedContent);
  }

  /**
   * Get messages in a conversation
   */
  async getDMMessages(
    conversationId: Snowflake,
    userId: Snowflake,
    limit: number = 50,
    before?: Snowflake
  ): Promise<DMMessageRow[]> {
    // Check if user is participant
    const isParticipant = await this.repository.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new NotParticipantError();
    }

    return this.repository.getDMMessages(conversationId, limit, before);
  }

  /**
   * Mark conversation as read
   */
  async markConversationRead(conversationId: Snowflake, userId: Snowflake): Promise<void> {
    const isParticipant = await this.repository.isParticipant(conversationId, userId);
    if (!isParticipant) {
      throw new NotParticipantError();
    }

    await this.repository.markConversationRead(conversationId, userId);
  }

  /**
   * Search users by username
   */
  async searchUsers(query: string, currentUserId: Snowflake): Promise<{ id: string; username: string; avatar: string | null }[]> {
    if (!query || query.length < 2) {
      return [];
    }
    return this.repository.searchUsers(query, currentUserId);
  }

  /**
   * Get mutual friends between the current user and another user
   */
  async getMutualFriends(userId: Snowflake, otherUserId: Snowflake): Promise<{
    mutualFriends: { id: string; username: string; avatar: string | null }[];
    totalCount: number;
  }> {
    const mutualFriends = await this.repository.getMutualFriends(userId, otherUserId);
    return {
      mutualFriends,
      totalCount: mutualFriends.length,
    };
  }

  /**
   * Get repository for direct access
   */
  getRepository(): FriendsRepository {
    return this.repository;
  }
}
