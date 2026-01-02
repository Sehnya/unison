/**
 * Message type representing a chat message from the backend API
 */
export interface Message {
  id: string;           // Snowflake ID
  author_id: string;    // Snowflake ID of message author
  author_name?: string; // Display name of author
  author_avatar?: string; // Avatar URL
  content: string;      // Message text content
  created_at: string;   // ISO 8601 timestamp
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  duration?: number; // For audio/video
}

/**
 * Login/Register response from POST /auth/login and POST /auth/register
 */
export interface LoginResponse {
  user: {
    id: string;
    email: string;
    username: string;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
  };
  session_id?: string;
}

/**
 * API error response structure
 */
export interface ApiError {
  message: string;
  code?: string;
}

/**
 * Guild/Server type
 */
export interface Guild {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
  owner_id: string;
  member_count?: number;
  online_count?: number;
}

/**
 * Channel type
 */
export interface Channel {
  id: string;
  guild_id: string;
  name: string;
  type: 'text' | 'voice' | 'document';
  position?: number;
  topic?: string;
}

/**
 * User/Member type
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  bio?: string;
  bio_font?: string;
  description?: string;
  age?: number;
  location?: string;
  mood?: string;
  mood_emoji?: string;
  background_image?: string;
  username_font?: string;
  status?: 'online' | 'offline' | 'idle' | 'dnd';
  role?: string;
  terms_accepted_at?: Date | string;
  last_active?: string;
}

/**
 * Direct Message conversation
 */
export interface DirectMessage {
  id: string;
  participants: User[];
  last_message?: Message;
  unread_count?: number;
}

/**
 * DM Privacy setting
 */
export type DMPrivacy = 'open' | 'friends' | 'closed';

/**
 * Friend request status
 */
export type FriendStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

/**
 * Friend with user info
 */
export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendStatus;
  created_at: string;
  updated_at: string;
  friend_username: string;
  friend_avatar: string | null;
  friend_bio: string | null;
}

/**
 * DM Conversation with participant info
 */
export interface DMConversation {
  id: string;
  other_user_id: string;
  other_username: string;
  other_avatar: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  unread_count: number;
}

/**
 * Direct Message
 */
export interface DMMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
}
