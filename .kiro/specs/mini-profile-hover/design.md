# Design Document: Mini-Profile Hover

## Overview

This feature implements a hover-triggered mini-profile tooltip that displays when users hover over usernames or avatars in chat. The mini-profile shows a condensed view of a user's profile with customizable appearance including background images/GIFs, custom fonts, and text colors. It also displays mutual friends between the viewer and the profile owner.

The implementation extends the existing profile system by adding mini-profile specific customization fields and a new frontend component that handles hover interactions with smart positioning.

## Architecture

```mermaid
graph TB
    subgraph Frontend
        CA[ChatArea.svelte] --> MP[MiniProfile.svelte]
        MP --> PS[profileStorage.ts]
        SP[SettingsPanel.svelte] --> MPS[MiniProfileSettings.svelte]
        MPS --> PS
    end
    
    subgraph API Layer
        AR[/api/auth/routes] --> AS[Auth Service]
        FR[/api/friends/routes] --> FS[Friends Service]
    end
    
    subgraph Database
        UP[(user_profiles)]
        U[(users)]
        F[(friends)]
    end
    
    PS --> AR
    MP --> AR
    MP --> FR
    AS --> UP
    AS --> U
    FS --> F
```

## Components and Interfaces

### Frontend Components

#### MiniProfile.svelte
The main hover tooltip component that displays user profile information.

```typescript
interface MiniProfileProps {
  userId: string;
  username: string;
  avatar?: string;
  triggerElement: HTMLElement;
  authToken: string;
  currentUserId: string;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
}

interface MiniProfileData {
  userId: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  backgroundImage: string | null;
  usernameFont: string | null;
  textColor: string | null;
  mutualFriends: MutualFriend[];
}

interface MutualFriend {
  id: string;
  username: string;
  avatar: string | null;
}
```

#### MiniProfileSettings.svelte
Settings panel section for customizing mini-profile appearance.

```typescript
interface MiniProfileSettingsProps {
  authToken: string;
  currentSettings: MiniProfileCustomization;
  onSave: (settings: MiniProfileCustomization) => void;
}

interface MiniProfileCustomization {
  backgroundImage: string | null;  // URL or base64
  usernameFont: string;            // Google Font name
  textColor: string;               // Hex color
}
```

### API Endpoints

#### GET /api/auth/users/:userId/mini-profile
Fetches mini-profile data for a specific user.

Response:
```typescript
{
  userId: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  backgroundImage: string | null;
  usernameFont: string | null;
  textColor: string | null;
}
```

#### GET /api/friends/mutual/:userId
Fetches mutual friends between the authenticated user and the target user.

Response:
```typescript
{
  mutualFriends: Array<{
    id: string;
    username: string;
    avatar: string | null;
  }>;
  totalCount: number;
}
```

#### PATCH /api/auth/profile
Extended to support mini-profile customization fields.

Request body additions:
```typescript
{
  mini_profile_background?: string | null;
  mini_profile_font?: string;
  mini_profile_text_color?: string;
}
```

## Data Models

### Database Schema Extension

```sql
-- Migration: 015_mini_profile_customization.sql
-- Add mini-profile customization columns to users table

ALTER TABLE users ADD COLUMN IF NOT EXISTS mini_profile_background TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mini_profile_font VARCHAR(100) DEFAULT 'Inter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mini_profile_text_color VARCHAR(7) DEFAULT '#ffffff';
```

### TypeScript Types

```typescript
// Extended User type
interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  bio: string | null;
  background_image: string | null;
  username_font: string | null;
  // New mini-profile fields
  mini_profile_background: string | null;
  mini_profile_font: string;
  mini_profile_text_color: string;
}

// Cache entry for mini-profile data
interface CachedMiniProfile {
  data: MiniProfileData;
  timestamp: number;
  expiresAt: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Viewport Boundary Positioning
*For any* trigger element position, mini-profile dimensions, and viewport dimensions, the calculated mini-profile position SHALL result in the mini-profile being fully contained within the visible viewport boundaries.
**Validates: Requirements 1.6**

### Property 2: Customization Persistence Round-Trip
*For any* valid mini-profile customization settings (background URL, font name, hex color), serializing to JSON then deserializing SHALL produce an equivalent settings object.
**Validates: Requirements 2.4**

### Property 3: Bio Truncation Consistency
*For any* bio string, the truncateBio function SHALL return the original string if length ≤ 150, otherwise return the first 150 characters followed by "...".
**Validates: Requirements 3.3**

### Property 4: Mutual Friends Display Rules
*For any* array of mutual friends with length N: if N = 0, the section is hidden; if 1 ≤ N ≤ 3, exactly N avatars are displayed; if N > 3, exactly 3 avatars are displayed plus a "+{N-3} more" indicator.
**Validates: Requirements 4.2, 4.3, 4.4**

### Property 5: Cache Validity
*For any* cached mini-profile entry with timestamp T and cache duration D (5 minutes), a request at time R SHALL return cached data if R < T + D, otherwise SHALL indicate cache miss.
**Validates: Requirements 5.1, 5.2**

### Property 6: Image Validation
*For any* file with MIME type M and size S bytes, the validation function SHALL return true if and only if M is in ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] AND S ≤ 5,242,880 (5MB).
**Validates: Requirements 6.3**

### Property 7: Hex Color Validation
*For any* string input, the color validation function SHALL return true if and only if the string matches the pattern /^#[0-9A-Fa-f]{6}$/.
**Validates: Requirements 2.3**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| Profile fetch fails | Display minimal fallback (avatar + username only) |
| Mutual friends query fails | Hide mutual friends section silently |
| Invalid image upload | Display validation error, prevent save |
| Cache miss | Fetch from API, show loading skeleton |
| Network timeout | Show cached data if available, else fallback |

### Error Response Format

```typescript
interface MiniProfileError {
  code: 'PROFILE_NOT_FOUND' | 'UNAUTHORIZED' | 'NETWORK_ERROR' | 'INVALID_IMAGE';
  message: string;
}
```

## Testing Strategy

### Unit Tests
- Bio truncation logic with various string lengths
- Viewport boundary calculation for positioning
- Cache expiration logic
- Image validation (format, size)
- Mutual friends display logic (0, 1-3, >3 cases)

### Property-Based Tests
- **Property 3**: Round-trip test for customization settings
- **Property 4**: Bio truncation for arbitrary string inputs
- **Property 5**: Mutual friends display for arbitrary friend counts
- **Property 7**: Image validation for arbitrary file inputs

### Integration Tests
- Mini-profile fetch and display flow
- Settings save and reload
- Hover interaction timing
- Cache behavior across multiple requests

### Testing Framework
- Vitest for unit and property tests
- fast-check for property-based testing
- Svelte Testing Library for component tests
