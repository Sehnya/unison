/**
 * Friends Service Errors
 */

export class FriendsError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'FriendsError';
  }
}

export class UserNotFoundError extends FriendsError {
  constructor() {
    super('User not found', 'USER_NOT_FOUND');
  }
}

export class AlreadyFriendsError extends FriendsError {
  constructor() {
    super('You are already friends with this user', 'ALREADY_FRIENDS');
  }
}

export class FriendRequestExistsError extends FriendsError {
  constructor() {
    super('A friend request already exists', 'FRIEND_REQUEST_EXISTS');
  }
}

export class FriendRequestNotFoundError extends FriendsError {
  constructor() {
    super('Friend request not found', 'FRIEND_REQUEST_NOT_FOUND');
  }
}

export class CannotFriendSelfError extends FriendsError {
  constructor() {
    super('You cannot send a friend request to yourself', 'CANNOT_FRIEND_SELF');
  }
}

export class UserBlockedError extends FriendsError {
  constructor() {
    super('You cannot send a friend request to this user', 'USER_BLOCKED');
  }
}

export class DMPrivacyBlockedError extends FriendsError {
  constructor(reason: string) {
    super(reason, 'DM_PRIVACY_BLOCKED');
  }
}

export class NotFriendsError extends FriendsError {
  constructor() {
    super('You are not friends with this user', 'NOT_FRIENDS');
  }
}

export class ConversationNotFoundError extends FriendsError {
  constructor() {
    super('Conversation not found', 'CONVERSATION_NOT_FOUND');
  }
}

export class NotParticipantError extends FriendsError {
  constructor() {
    super('You are not a participant in this conversation', 'NOT_PARTICIPANT');
  }
}
