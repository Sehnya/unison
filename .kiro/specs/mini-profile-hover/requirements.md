# Requirements Document

## Introduction

This feature adds a hover-triggered mini-profile tooltip that appears when users hover over usernames or avatars in chat. The mini-profile displays a condensed, customizable view of a user's profile including their avatar, username, bio, background image/GIF, and mutual friends. Users can customize their mini-profile appearance with custom fonts and text colors.

## Glossary

- **Mini_Profile**: A compact, hover-triggered tooltip displaying a user's profile information
- **Profile_Customization_System**: The backend and frontend system managing user profile appearance settings
- **Hover_Trigger**: The UI element (username or avatar) that activates the mini-profile display
- **Profile_Font**: A Google Font selected by the user for their mini-profile text display
- **Profile_Text_Color**: A hex color value chosen by the user for their mini-profile text
- **Mutual_Friends**: Friends that both the viewing user and the profile owner have in common

## Requirements

### Requirement 1: Mini-Profile Display

**User Story:** As a user, I want to see a mini-profile when I hover over someone's username or avatar in chat, so that I can quickly learn about them without leaving the conversation.

#### Acceptance Criteria

1. WHEN a user hovers over a username or avatar in the chat area, THE Mini_Profile SHALL appear after a 300ms delay
2. WHEN the mouse leaves both the trigger element and the mini-profile, THE Mini_Profile SHALL disappear after a 200ms delay
3. WHEN the mini-profile is displayed, THE Mini_Profile SHALL show the user's avatar, username, and bio
4. WHEN the mini-profile is displayed, THE Mini_Profile SHALL show the user's background image or GIF if configured
5. WHEN the mini-profile is displayed, THE Mini_Profile SHALL show up to 3 mutual friends with the viewing user
6. IF the mini-profile would extend beyond the viewport, THEN THE Mini_Profile SHALL reposition to remain fully visible

### Requirement 2: Profile Customization Settings

**User Story:** As a user, I want to customize how my mini-profile appears to others, so that I can express my personality.

#### Acceptance Criteria

1. THE Profile_Customization_System SHALL allow users to upload a background image (JPG, PNG, WebP) or GIF for their mini-profile
2. THE Profile_Customization_System SHALL allow users to select a font from a curated list of Google Fonts for their mini-profile username
3. THE Profile_Customization_System SHALL allow users to choose a text color using a color picker for their mini-profile
4. WHEN a user saves customization settings, THE Profile_Customization_System SHALL persist the settings to the database
5. WHEN a user views another user's mini-profile, THE Mini_Profile SHALL render using that user's customization settings

### Requirement 3: Mini-Profile Content

**User Story:** As a user, I want my mini-profile to display my key information attractively, so that others can get to know me at a glance.

#### Acceptance Criteria

1. THE Mini_Profile SHALL display the user's avatar at a prominent size (64x64 pixels minimum)
2. THE Mini_Profile SHALL display the username with the user's chosen font and color
3. THE Mini_Profile SHALL display a multi-line bio (up to 150 characters visible, truncated with ellipsis if longer)
4. WHEN a background image/GIF is configured, THE Mini_Profile SHALL display it behind the profile content with appropriate overlay for readability
5. THE Mini_Profile SHALL display a "View Full Profile" button that opens the user's complete profile

### Requirement 4: Mutual Friends Display

**User Story:** As a user, I want to see mutual friends on someone's mini-profile, so that I can understand our social connection.

#### Acceptance Criteria

1. WHEN viewing another user's mini-profile, THE Mini_Profile SHALL query and display mutual friends
2. THE Mini_Profile SHALL display up to 3 mutual friend avatars in a compact row
3. WHEN there are more than 3 mutual friends, THE Mini_Profile SHALL show "+N more" indicator
4. WHEN there are no mutual friends, THE Mini_Profile SHALL hide the mutual friends section entirely
5. IF the mutual friends query fails, THEN THE Mini_Profile SHALL gracefully hide the section without error display

### Requirement 5: Performance and Caching

**User Story:** As a user, I want mini-profiles to load quickly, so that the hover experience feels responsive.

#### Acceptance Criteria

1. WHEN a mini-profile is requested, THE Profile_Customization_System SHALL cache the profile data for 5 minutes
2. WHEN the same user's mini-profile is requested within the cache period, THE Mini_Profile SHALL use cached data
3. THE Mini_Profile SHALL display a loading skeleton while fetching profile data
4. IF profile data fails to load, THEN THE Mini_Profile SHALL display a minimal fallback with avatar and username only

### Requirement 6: Settings UI Integration

**User Story:** As a user, I want to access mini-profile customization from my settings, so that I can easily update my appearance.

#### Acceptance Criteria

1. THE Profile_Customization_System SHALL add a "Mini-Profile" section to the user settings panel
2. THE Settings_Panel SHALL provide a live preview of the mini-profile as users make changes
3. THE Settings_Panel SHALL validate uploaded images (max 5MB, valid image formats)
4. WHEN invalid input is provided, THE Settings_Panel SHALL display clear error messages
