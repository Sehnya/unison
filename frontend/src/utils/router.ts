/**
 * Simple client-side router for URL-based navigation
 */

export interface RouteParams {
  guildId?: string;
  channelId?: string;
  section?: string;
}

/**
 * Parse current URL and extract route parameters
 */
export function parseRoute(): RouteParams {
  const path = window.location.pathname;
  const params: RouteParams = {};

  // Match patterns like /guild/:guildId/channel/:channelId
  const guildMatch = path.match(/^\/guild\/([^\/]+)/);
  if (guildMatch) {
    params.guildId = guildMatch[1];
    
    const channelMatch = path.match(/^\/guild\/[^\/]+\/channel\/([^\/]+)/);
    if (channelMatch) {
      params.channelId = channelMatch[1];
    }
  }

  // Match patterns like /dashboard, /myspace, etc.
  if (path === '/dashboard' || path === '/') {
    params.section = 'main';
  } else if (path === '/myspace') {
    params.section = 'myspace';
  } else if (path.startsWith('/settings')) {
    params.section = 'settings';
  }

  return params;
}

/**
 * Navigate to a guild
 */
export function navigateToGuild(guildId: string) {
  window.history.pushState({ guildId }, '', `/guild/${guildId}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Navigate to a channel within a guild
 */
export function navigateToChannel(guildId: string, channelId: string) {
  window.history.pushState({ guildId, channelId }, '', `/guild/${guildId}/channel/${channelId}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Navigate to dashboard
 */
export function navigateToDashboard() {
  window.history.pushState({ section: 'main' }, '', '/dashboard');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Navigate to myspace
 */
export function navigateToMyspace() {
  window.history.pushState({ section: 'myspace' }, '', '/myspace');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Navigate to settings
 */
export function navigateToSettings() {
  window.history.pushState({ section: 'settings' }, '', '/settings');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Navigate to home (root)
 */
export function navigateToHome() {
  window.history.pushState({ section: 'main' }, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

