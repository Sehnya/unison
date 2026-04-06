/**
 * Client-side cache for username layout configs.
 * Fetches from profile-data API and caches per userId.
 */

import type { UsernameLayoutConfig } from './usernameLayout';
import { apiUrl } from './api';

interface CacheEntry {
  layout: UsernameLayoutConfig | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<UsernameLayoutConfig | null>>();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function getUsernameLayout(
  userId: string,
  authToken: string
): Promise<UsernameLayoutConfig | null> {
  // Check cache
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < TTL) {
    return cached.layout;
  }

  // Deduplicate in-flight requests
  if (pending.has(userId)) {
    return pending.get(userId)!;
  }

  const promise = fetchLayout(userId, authToken);
  pending.set(userId, promise);

  try {
    const layout = await promise;
    cache.set(userId, { layout, fetchedAt: Date.now() });
    return layout;
  } finally {
    pending.delete(userId);
  }
}

async function fetchLayout(
  userId: string,
  authToken: string
): Promise<UsernameLayoutConfig | null> {
  try {
    const response = await fetch(apiUrl(`/api/auth/users/${userId}/profile-data`), {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const pd = data.profileData?.profile_data || data.profileData;
    return pd?.usernameLayout || null;
  } catch {
    return null;
  }
}

export function invalidateLayoutCache(userId: string) {
  cache.delete(userId);
}

export function setLayoutCache(userId: string, layout: UsernameLayoutConfig | null) {
  cache.set(userId, { layout, fetchedAt: Date.now() });
}
