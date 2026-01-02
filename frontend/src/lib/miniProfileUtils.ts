/**
 * Mini-Profile Utility Functions
 * Provides utilities for the mini-profile hover feature including
 * bio truncation, viewport positioning, and validation.
 */

/**
 * Mutual friend data structure
 */
export interface MutualFriend {
  id: string;
  username: string;
  avatar: string | null;
}

/**
 * Truncates a bio string to a maximum length with ellipsis.
 * 
 * @param bio - The bio string to truncate
 * @param maxLength - Maximum length before truncation (default: 150)
 * @returns The original string if length <= maxLength, otherwise truncated with "..."
 * 
 * Requirements: 3.3
 */
export function truncateBio(bio: string, maxLength: number = 150): string {
  if (bio.length <= maxLength) {
    return bio;
  }
  return bio.slice(0, maxLength) + '...';
}

/**
 * Position calculation result for mini-profile placement
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Profile dimensions for positioning calculations
 */
export interface ProfileDimensions {
  width: number;
  height: number;
}

/**
 * Viewport dimensions for boundary calculations
 */
export interface ViewportDimensions {
  width: number;
  height: number;
}

/**
 * Calculates the position for a mini-profile tooltip ensuring it stays within viewport bounds.
 * 
 * The function attempts to position the profile below and to the right of the trigger element,
 * but will adjust if the profile would extend beyond the viewport boundaries.
 * 
 * @param trigger - DOMRect of the trigger element (username/avatar)
 * @param profile - Dimensions of the mini-profile tooltip
 * @param viewport - Dimensions of the viewport
 * @returns Position {x, y} that keeps the profile fully within the viewport
 * 
 * Requirements: 1.6
 */
export function calculateMiniProfilePosition(
  trigger: DOMRect,
  profile: ProfileDimensions,
  viewport: ViewportDimensions
): Position {
  // Default position: below and aligned with the left edge of trigger
  let x = trigger.left;
  let y = trigger.bottom + 8; // 8px gap below trigger

  // Adjust horizontal position if profile would extend beyond right edge
  if (x + profile.width > viewport.width) {
    x = viewport.width - profile.width;
  }

  // Ensure x doesn't go negative
  if (x < 0) {
    x = 0;
  }

  // Adjust vertical position if profile would extend beyond bottom edge
  if (y + profile.height > viewport.height) {
    // Try positioning above the trigger instead
    y = trigger.top - profile.height - 8;
  }

  // If still outside viewport (above top edge or still beyond bottom), clamp to viewport
  if (y < 0) {
    y = 0;
  }
  
  // Final clamp to ensure profile fits within viewport height
  if (y + profile.height > viewport.height) {
    y = viewport.height - profile.height;
  }

  return { x, y };
}

/**
 * Valid image MIME types for mini-profile backgrounds
 */
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Maximum file size for mini-profile background images (5MB)
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * Validates if a file is a valid image for mini-profile background.
 * 
 * @param type - MIME type of the file
 * @param size - Size of the file in bytes
 * @returns true if the file is a valid image type AND size <= 5MB
 * 
 * Requirements: 6.3
 */
export function isValidImageFile(type: string, size: number): boolean {
  return VALID_IMAGE_TYPES.includes(type) && size <= MAX_IMAGE_SIZE;
}

/**
 * Hex color validation regex pattern
 */
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/**
 * Validates if a string is a valid hex color.
 * 
 * @param color - The color string to validate
 * @returns true if the string matches the pattern #RRGGBB (case-insensitive)
 * 
 * Requirements: 2.3
 */
export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_PATTERN.test(color);
}

/**
 * Result of computing mutual friends display
 */
export interface MutualFriendsDisplayResult {
  /** Whether to show the mutual friends section */
  showSection: boolean;
  /** The friends to display (max 3) */
  displayedFriends: MutualFriend[];
  /** Number of additional friends beyond the displayed ones */
  extraCount: number;
  /** The "+N more" indicator text, or null if not needed */
  moreIndicator: string | null;
}

/**
 * Computes the mutual friends display based on the array of mutual friends.
 * 
 * Rules:
 * - If N = 0: section is hidden (showSection = false)
 * - If 1 ≤ N ≤ 3: exactly N avatars are displayed
 * - If N > 3: exactly 3 avatars are displayed plus a "+{N-3} more" indicator
 * 
 * @param mutualFriends - Array of mutual friends
 * @returns Display configuration for mutual friends section
 * 
 * Requirements: 4.2, 4.3, 4.4
 */
export function computeMutualFriendsDisplay(
  mutualFriends: MutualFriend[]
): MutualFriendsDisplayResult {
  const count = mutualFriends.length;
  
  // If no mutual friends, hide the section
  if (count === 0) {
    return {
      showSection: false,
      displayedFriends: [],
      extraCount: 0,
      moreIndicator: null,
    };
  }
  
  // Display up to 3 friends
  const displayedFriends = mutualFriends.slice(0, 3);
  const extraCount = count > 3 ? count - 3 : 0;
  
  // Generate the "+N more" indicator if needed
  const moreIndicator = extraCount > 0 
    ? `+${extraCount} more` 
    : null;
  
  return {
    showSection: true,
    displayedFriends,
    extraCount,
    moreIndicator,
  };
}
