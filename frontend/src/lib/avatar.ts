/**
 * Avatar Utility
 * Generates gradient avatars for users without custom avatars
 */

// Logo colors for gradients
const GRADIENT_COLORS = [
  ['#667eea', '#764ba2'], // Purple to violet
  ['#f093fb', '#f5576c'], // Pink to red
  ['#4facfe', '#00f2fe'], // Blue to cyan
  ['#43e97b', '#38f9d7'], // Green to teal
  ['#fa709a', '#fee140'], // Pink to yellow
  ['#a8edea', '#fed6e3'], // Teal to pink
  ['#ff9a9e', '#fecfef'], // Coral to pink
  ['#ffecd2', '#fcb69f'], // Peach gradient
  ['#667eea', '#43e97b'], // Purple to green
  ['#f5576c', '#4facfe'], // Red to blue
];

/**
 * Generate a consistent gradient based on user ID or username
 * @param identifier - User ID or username to generate gradient from
 * @returns CSS gradient string
 */
export function getGradientForUser(identifier: string): string {
  // Generate a hash from the identifier
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use absolute value and mod to get index
  const index = Math.abs(hash) % GRADIENT_COLORS.length;
  const [color1, color2] = GRADIENT_COLORS[index];
  
  // Vary the angle based on hash for more variety
  const angle = (Math.abs(hash) % 360);
  
  return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
}

/**
 * Get initials from username
 * @param username - Username to get initials from
 * @returns 1-2 character initials
 */
export function getInitials(username: string): string {
  if (!username) return '?';
  
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

/**
 * Check if a URL is a valid avatar (not a placeholder)
 * @param url - Avatar URL to check
 * @returns true if it's a real avatar, false if placeholder or empty
 */
export function hasCustomAvatar(url: string | null | undefined): boolean {
  if (!url) return false;
  // Check for placeholder URLs
  if (url.includes('pravatar.cc')) return false;
  if (url.includes('placeholder')) return false;
  return true;
}
