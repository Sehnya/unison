/**
 * API Configuration
 * 
 * Handles API base URL for different environments.
 * In development: uses /api/ (proxied by Vite)
 * In production: uses VITE_API_URL if set, otherwise /api/
 */

// Get API base URL from environment or default to relative path
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Build full API URL
 * @param path - API path starting with /api/
 * @returns Full URL for the API endpoint
 */
export function apiUrl(path: string): string {
  // If path doesn't start with /, add it
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // If we have a base URL, use it; otherwise use relative path
  if (API_BASE_URL) {
    // Remove trailing slash from base URL if present
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    // Remove /api prefix from path if base URL already includes it
    if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
      return `${base}${normalizedPath.slice(4)}`;
    }
    return `${base}${normalizedPath}`;
  }
  
  return normalizedPath;
}

/**
 * Fetch wrapper that uses the correct API base URL
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}
