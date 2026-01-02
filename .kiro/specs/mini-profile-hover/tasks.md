# Implementation Plan: Mini-Profile Hover

## Overview

This implementation adds a hover-triggered mini-profile tooltip to the chat interface. The work is organized into database schema updates, backend API endpoints, frontend components, and testing.

## Tasks

- [x] 1. Database schema and backend setup
  - [x] 1.1 Create migration for mini-profile columns
    - Add `mini_profile_background`, `mini_profile_font`, `mini_profile_text_color` columns to users table
    - _Requirements: 2.4_

  - [x] 1.2 Update auth repository to handle mini-profile fields
    - Extend `getUserById` to return mini-profile fields
    - Add `updateMiniProfileSettings` method
    - _Requirements: 2.4_

  - [x] 1.3 Add mini-profile API endpoint
    - Create `GET /api/auth/users/:userId/mini-profile` endpoint
    - Return userId, username, avatar, bio, and mini-profile customization fields
    - _Requirements: 1.3, 2.5_

  - [x] 1.4 Add mutual friends API endpoint
    - Create `GET /api/friends/mutual/:userId` endpoint
    - Query friends table to find mutual connections
    - Return array of mutual friends with totalCount
    - _Requirements: 4.1, 4.2_

- [x] 2. Core utility functions
  - [x] 2.1 Implement bio truncation utility
    - Create `truncateBio(bio: string, maxLength: number): string` function
    - Truncate at maxLength with "..." suffix when exceeded
    - _Requirements: 3.3_

  - [x] 2.2 Write property test for bio truncation
    - **Property 3: Bio Truncation Consistency**
    - **Validates: Requirements 3.3**

  - [x] 2.3 Implement viewport positioning utility
    - Create `calculateMiniProfilePosition(trigger: DOMRect, profile: {width, height}, viewport: {width, height}): {x, y}` function
    - Ensure returned position keeps profile within viewport bounds
    - _Requirements: 1.6_

  - [x] 2.4 Write property test for viewport positioning
    - **Property 1: Viewport Boundary Positioning**
    - **Validates: Requirements 1.6**

  - [x] 2.5 Implement validation utilities
    - Create `isValidImageFile(type: string, size: number): boolean` function
    - Create `isValidHexColor(color: string): boolean` function
    - _Requirements: 2.3, 6.3_

  - [x] 2.6 Write property tests for validation utilities
    - **Property 6: Image Validation**
    - **Property 7: Hex Color Validation**
    - **Validates: Requirements 2.3, 6.3**

- [x] 3. Mini-profile cache system
  - [x] 3.1 Implement mini-profile cache
    - Create `miniProfileCache.ts` with get/set/invalidate methods
    - Use 5-minute TTL for cached entries
    - Store in memory Map with timestamp tracking
    - _Requirements: 5.1, 5.2_

  - [x] 3.2 Write property test for cache validity
    - **Property 5: Cache Validity**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 4. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. MiniProfile component
  - [x] 5.1 Create MiniProfile.svelte component
    - Implement hover tooltip with positioning logic
    - Display avatar (64x64), username, bio, background
    - Apply custom font and text color from profile data
    - Include "View Full Profile" button
    - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Implement mutual friends display
    - Show up to 3 mutual friend avatars
    - Display "+N more" indicator when count > 3
    - Hide section when no mutual friends or on error
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 5.3 Write property test for mutual friends display logic
    - **Property 4: Mutual Friends Display Rules**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 5.4 Implement hover timing and loading states
    - 300ms delay before showing mini-profile
    - 200ms delay before hiding on mouse leave
    - Show loading skeleton during data fetch
    - Show fallback on fetch error
    - _Requirements: 1.1, 1.2, 5.3, 5.4_

- [x] 6. Integrate MiniProfile into ChatArea
  - [x] 6.1 Add hover triggers to chat messages
    - Wrap username and avatar elements with hover detection
    - Track hovered user and trigger element position
    - Render MiniProfile component when active
    - _Requirements: 1.1, 1.2_

- [x] 7. Settings panel integration
  - [x] 7.1 Create MiniProfileSettings.svelte component
    - Background image upload with drag-and-drop
    - Font selector dropdown with Google Fonts
    - Color picker for text color
    - Live preview of mini-profile
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 Integrate into SettingsPanel.svelte
    - Add "Mini-Profile" section to settings
    - Wire up save functionality to API
    - _Requirements: 6.1_

  - [x] 7.3 Write property test for customization round-trip
    - **Property 2: Customization Persistence Round-Trip**
    - **Validates: Requirements 2.4**

- [-] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All property tests use fast-check library with minimum 100 iterations
- The existing `profileStorage.ts` can be extended for mini-profile caching
- Google Fonts are already loaded dynamically in ChatArea.svelte - reuse that pattern
