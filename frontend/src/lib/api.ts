/**
 * API Client for backend communication
 */

const API_BASE = '/api';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface Guild {
  id: string;
  name: string;
  description?: string;
  icon: string | null;
  banner?: string;
  owner_id: string;
  member_count?: number;
  online_count?: number;
  created_at: string;
}

export interface GuildsResponse {
  guilds: Guild[];
}

export interface CreateGuildOptions {
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
}

/**
 * Fetch user's guilds
 */
export async function fetchUserGuilds(authToken: string): Promise<Guild[]> {
  try {
    const response = await fetch(`${API_BASE}/guilds`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error(`Failed to fetch guilds: ${response.status}`);
    }

    const data: GuildsResponse = await response.json();
    return data.guilds || [];
  } catch (error) {
    console.error('Error fetching guilds:', error);
    return [];
  }
}

/**
 * Create a new guild
 */
export async function createGuild(authToken: string, options: CreateGuildOptions): Promise<Guild | null> {
  try {
    const response = await fetch(`${API_BASE}/guilds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`Failed to create guild: ${response.status}`);
    }

    const data = await response.json();
    return data.guild;
  } catch (error) {
    console.error('Error creating guild:', error);
    return null;
  }
}

/**
 * Join a guild via invite code
 */
export async function joinGuild(authToken: string, inviteCode: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/guilds/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invite_code: inviteCode }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error joining guild:', error);
    return false;
  }
}

/**
 * Leave a guild
 */
export async function leaveGuild(authToken: string, guildId: string, userId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error leaving guild:', error);
    return false;
  }
}
