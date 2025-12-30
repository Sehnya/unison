import Ably from 'ably';
import type { RealtimeChannel, Message as AblyMessage, PresenceMessage, ConnectionStateChange } from 'ably';

// Ably configuration - Load from environment variables using dotenv
// dotenv is used in vite.config.ts to load .env file from project root
// Make sure you have VITE_ABLY_API_KEY in your .env file in the project root
function getAblyApiKey(): string {
  // Vite exposes env vars prefixed with VITE_ to the client
  // These are loaded by dotenv in vite.config.ts and exposed via define
  const key = import.meta.env.VITE_ABLY_API_KEY || '';
  
  // Debug logging - always log in dev mode
  console.log('🔍 Ably API Key Debug (loaded via dotenv):', {
    'import.meta.env.VITE_ABLY_API_KEY': import.meta.env.VITE_ABLY_API_KEY ? '✓ Found' : '✗ Not found',
    'Key length': key.length,
    'Key preview': key ? key.substring(0, 10) + '...' : 'empty',
    'All VITE_ env vars': Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')),
    'import.meta.env keys': Object.keys(import.meta.env),
  });
  
  if (!key) {
    console.error('❌ Ably API key not found.');
    console.error('   Please ensure VITE_ABLY_API_KEY is set in your .env file in the project root.');
    console.error('   The .env file is loaded by dotenv in vite.config.ts');
    console.error('   RESTART the dev server after adding/changing the .env file.');
    console.error('   Current import.meta.env keys:', Object.keys(import.meta.env));
    console.error('   VITE_ prefixed keys:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
  } else {
    console.log('✓ Ably API key loaded from environment (via dotenv) - length:', key.length);
  }
  
  return key;
}

// Get the API key at module load time
const ABLY_API_KEY = getAblyApiKey();

let ablyClient: Ably.Realtime | null = null;
let isConnected = false;

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorFont?: string;
  content: string;
  timestamp: number;
  channelId: string;
  attachments?: Array<{
    type: 'image' | 'audio' | 'video' | 'file';
    url: string;
    name?: string;
  }>;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  channelId: string;
  isTyping: boolean;
}

export interface PresenceData {
  odId: string;
  userName: string;
  status: 'online' | 'away' | 'offline';
  avatar?: string;
}

/**
 * Initialize Ably client
 */
export function initAbly(apiKey?: string): Ably.Realtime {
  if (ablyClient && isConnected) {
    return ablyClient;
  }

  // Try to get key from parameter, then from module-level constant, then from env at runtime
  let key = apiKey || ABLY_API_KEY;
  
  // If still no key, try reading from env at runtime (in case env was loaded after module init)
  if (!key || key === '') {
    key = import.meta.env.VITE_ABLY_API_KEY || '';
  }
  
  if (!key || key === '') {
    const errorMsg = 'Ably API key is required. Please set VITE_ABLY_API_KEY in your .env file or pass it as a parameter.';
    console.error('❌', errorMsg);
    console.error('   Debug info:', {
      'ABLY_API_KEY length': ABLY_API_KEY.length,
      'import.meta.env.VITE_ABLY_API_KEY': import.meta.env.VITE_ABLY_API_KEY ? 'exists' : 'missing',
      'All VITE_ vars': Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')),
    });
    console.error('   Create a .env file in the project root with:');
    console.error('   VITE_ABLY_API_KEY=your-ably-api-key-here');
    console.error('   Then RESTART the dev server for changes to take effect.');
    throw new Error(errorMsg);
  }

  try {
    ablyClient = new Ably.Realtime({
      key,
      clientId: `user-${Date.now()}`, // Will be replaced with actual user ID
      echoMessages: false,
    });

    ablyClient.connection.on('connected', () => {
      console.log('✓ Ably connected');
      isConnected = true;
    });

    ablyClient.connection.on('disconnected', () => {
      console.log('⚠️  Ably disconnected');
      isConnected = false;
    });

    ablyClient.connection.on('failed', (stateChange: ConnectionStateChange) => {
      console.error('❌ Ably connection failed:', stateChange.reason);
      isConnected = false;
    });

    ablyClient.connection.on('suspended', () => {
      console.warn('⚠️  Ably connection suspended');
      isConnected = false;
    });

    return ablyClient;
  } catch (error) {
    console.error('❌ Failed to initialize Ably:', error);
    throw error;
  }
}

/**
 * Initialize Ably with a specific user (user ID, username, avatar)
 * This ties the Ably client instance to a specific user account
 */
export function initAblyWithUser(
  userId: string, 
  userName: string, 
  avatar?: string | null,
  apiKey?: string
): Ably.Realtime {
  // Close existing connection if it exists and is for a different user
  if (ablyClient) {
    const currentClientId = (ablyClient as any).clientId;
    if (currentClientId && currentClientId !== userId) {
      console.log('Switching Ably user from', currentClientId, 'to', userId);
      ablyClient.close();
      ablyClient = null;
      isConnected = false;
    } else if (currentClientId === userId && isConnected) {
      // Already connected as this user, return existing client
      return ablyClient;
    }
  }

  const key = apiKey || ABLY_API_KEY;
  
  if (!key || key === '') {
    const errorMsg = 'Ably API key is required. Please set VITE_ABLY_API_KEY in your .env file.';
    console.error('❌', errorMsg);
    throw new Error(errorMsg);
  }

  if (!userId) {
    throw new Error('User ID is required to initialize Ably');
  }

  try {
    // Initialize Ably with user ID as clientId
    // This ensures all messages, presence, and typing indicators are tied to this user
    ablyClient = new Ably.Realtime({
      key,
      clientId: userId, // User ID is used as Ably clientId
      echoMessages: false,
      // Store user metadata for reference
      clientData: {
        userId,
        userName,
        avatar: avatar || null,
      },
    });

    ablyClient.connection.on('connected', () => {
      console.log('✓ Ably connected as user:', userName, `(${userId})`);
      isConnected = true;
    });

    ablyClient.connection.on('disconnected', () => {
      console.log('⚠️  Ably disconnected');
      isConnected = false;
    });

    ablyClient.connection.on('failed', (stateChange: ConnectionStateChange) => {
      console.error('❌ Ably connection failed:', stateChange.reason);
      isConnected = false;
    });

    ablyClient.connection.on('suspended', () => {
      console.warn('⚠️  Ably connection suspended');
      isConnected = false;
    });

    return ablyClient;
  } catch (error) {
    console.error('❌ Failed to initialize Ably with user:', error);
    throw error;
  }
}

/**
 * Get the Ably client instance
 */
export function getAblyClient(): Ably.Realtime | null {
  return ablyClient;
}

/**
 * Subscribe to a channel for messages
 */
export function subscribeToChannel(
  channelName: string,
  onMessage: (message: ChatMessage) => void
): RealtimeChannel | null {
  if (!ablyClient) {
    console.error('Ably client not initialized');
    return null;
  }

  const channel = ablyClient.channels.get(channelName);

  channel.subscribe('message', (msg: AblyMessage) => {
    const chatMessage: ChatMessage = msg.data as ChatMessage;
    onMessage(chatMessage);
  });

  return channel;
}

/**
 * Unsubscribe from a channel
 */
export function unsubscribeFromChannel(channelName: string): void {
  if (!ablyClient) return;
  
  try {
    const channel = ablyClient.channels.get(channelName);
    channel.unsubscribe();
    // Also unsubscribe from typing channel
    const typingChannel = ablyClient.channels.get(`${channelName}:typing`);
    typingChannel.unsubscribe();
  } catch (error) {
    console.warn('Failed to unsubscribe from channel:', error);
  }
}

/**
 * Publish a message to a channel
 */
export async function publishMessage(
  channelName: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<ChatMessage | null> {
  if (!ablyClient) {
    console.error('Ably client not initialized');
    return null;
  }

  const channel = ablyClient.channels.get(channelName);
  
  const fullMessage: ChatMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  try {
    await channel.publish('message', fullMessage);
    return fullMessage;
  } catch (error) {
    console.error('Failed to publish message:', error);
    return null;
  }
}

/**
 * Subscribe to typing indicators
 */
export function subscribeToTyping(
  channelName: string,
  onTypingStart: (indicator: TypingIndicator) => void,
  onTypingEnd: (indicator: TypingIndicator) => void
): void {
  if (!ablyClient) return;

  const channel = ablyClient.channels.get(`${channelName}:typing`);

  channel.subscribe('start', (msg: AblyMessage) => {
    onTypingStart(msg.data as TypingIndicator);
  });

  channel.subscribe('end', (msg: AblyMessage) => {
    onTypingEnd(msg.data as TypingIndicator);
  });
}

/**
 * Publish typing indicator
 */
export async function publishTyping(
  channelName: string,
  userId: string,
  userName: string,
  isTyping: boolean
): Promise<void> {
  if (!ablyClient) return;

  const channel = ablyClient.channels.get(`${channelName}:typing`);
  const indicator: TypingIndicator = {
    userId,
    userName,
    channelId: channelName,
    isTyping,
  };

  await channel.publish(isTyping ? 'start' : 'end', indicator);
}

/**
 * Enter presence on a channel
 */
export async function enterPresence(
  channelName: string,
  data: PresenceData
): Promise<void> {
  if (!ablyClient) return;

  const channel = ablyClient.channels.get(channelName);
  await channel.presence.enter(data);
}

/**
 * Leave presence on a channel
 */
export async function leavePresence(channelName: string): Promise<void> {
  if (!ablyClient) return;

  const channel = ablyClient.channels.get(channelName);
  await channel.presence.leave();
}

/**
 * Get current presence members
 */
export async function getPresenceMembers(channelName: string): Promise<PresenceData[]> {
  if (!ablyClient) return [];

  const channel = ablyClient.channels.get(channelName);
  const members = await channel.presence.get();
  
  return members.map((m: PresenceMessage) => m.data as PresenceData);
}

/**
 * Subscribe to presence changes
 */
export function subscribeToPresence(
  channelName: string,
  onEnter: (data: PresenceData) => void,
  onLeave: (data: PresenceData) => void,
  onUpdate?: (data: PresenceData) => void
): void {
  if (!ablyClient) return;

  const channel = ablyClient.channels.get(channelName);

  channel.presence.subscribe('enter', (msg: PresenceMessage) => {
    onEnter(msg.data as PresenceData);
  });

  channel.presence.subscribe('leave', (msg: PresenceMessage) => {
    onLeave(msg.data as PresenceData);
  });

  if (onUpdate) {
    channel.presence.subscribe('update', (msg: PresenceMessage) => {
      onUpdate(msg.data as PresenceData);
    });
  }
}

/**
 * Get message history for a channel
 */
export async function getMessageHistory(
  channelName: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  if (!ablyClient) return [];

  const channel = ablyClient.channels.get(channelName);
  
  try {
    const history = await channel.history({ limit });
    const messages: ChatMessage[] = [];
    
    history.items.forEach((item: AblyMessage) => {
      if (item.name === 'message' && item.data) {
        messages.push(item.data as ChatMessage);
      }
    });

    // Return in chronological order (oldest first)
    return messages.reverse();
  } catch (error) {
    console.error('Failed to fetch message history:', error);
    return [];
  }
}

/**
 * Close Ably connection
 */
export function closeAbly(): void {
  if (ablyClient) {
    ablyClient.close();
    ablyClient = null;
    isConnected = false;
  }
}

/**
 * Check if Ably is connected
 */
export function isAblyConnected(): boolean {
  return isConnected && ablyClient?.connection.state === 'connected';
}

export { Ably };
