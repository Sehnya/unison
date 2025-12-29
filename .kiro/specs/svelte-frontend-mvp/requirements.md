# Requirements Document

## Introduction

This document defines the requirements for a minimal standalone Svelte frontend that enables visual verification of the Discord-like messaging system. The frontend is NOT production-ready and focuses solely on demonstrating that real users can send and receive messages through the existing backend APIs.

## Glossary

- **Frontend**: The Svelte-based client application running in the browser
- **Auth_Token**: JWT access token obtained from login, used for API authorization
- **Channel_ID**: Snowflake identifier for a message channel
- **Message**: A text communication containing id, author_id, content, and created_at
- **Polling**: Periodic HTTP requests to fetch new messages
- **Login_Form**: Component for user authentication
- **Message_List**: Component displaying channel messages
- **Message_Input**: Component for composing and sending messages
- **Chat_View**: Composite component combining message list and input
- **App**: Top-level component managing authentication state

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in with my credentials, so that I can access the messaging system.

#### Acceptance Criteria

1. WHEN the Login_Form is displayed THEN THE Frontend SHALL render email and password input fields
2. WHEN a user submits valid credentials THEN THE Frontend SHALL POST to /auth/login and store the returned access_token
3. WHEN authentication succeeds THEN THE Frontend SHALL emit an authenticated state change to the parent component
4. WHEN authentication fails THEN THE Frontend SHALL display the error message inline
5. WHILE the user is not authenticated THEN THE App SHALL display the Login_Form
6. WHILE the user is authenticated THEN THE App SHALL display the Chat_View

### Requirement 2: Message Display

**User Story:** As an authenticated user, I want to view messages in a channel, so that I can read the conversation.

#### Acceptance Criteria

1. WHEN the Message_List mounts THEN THE Frontend SHALL fetch messages from GET /channels/{channelId}/messages
2. WHEN messages are fetched THEN THE Frontend SHALL order them by Snowflake ID (oldest to newest)
3. WHEN rendering a message THEN THE Frontend SHALL display author_id, content, and timestamp
4. WHEN the API returns an error THEN THE Frontend SHALL display the error message inline
5. THE Frontend SHALL include the Authorization header with Bearer token on all API requests

### Requirement 3: Message Polling

**User Story:** As an authenticated user, I want to see new messages appear automatically, so that I can follow the conversation in near real-time.

#### Acceptance Criteria

1. WHILE the Message_List is mounted THEN THE Frontend SHALL poll for new messages every 1-2 seconds
2. WHEN polling THEN THE Frontend SHALL use the after={lastMessageId} query parameter to fetch only new messages
3. WHEN new messages are received THEN THE Frontend SHALL append them to the existing message list
4. WHEN the Message_List unmounts THEN THE Frontend SHALL stop the polling interval

### Requirement 4: Message Sending

**User Story:** As an authenticated user, I want to send messages to a channel, so that I can participate in the conversation.

#### Acceptance Criteria

1. WHEN the Message_Input is displayed THEN THE Frontend SHALL render a text input and send button
2. WHEN a user submits a non-empty message THEN THE Frontend SHALL POST to /channels/{channelId}/messages
3. WHEN message sending succeeds THEN THE Frontend SHALL clear the input field
4. WHEN message sending succeeds THEN THE Frontend SHALL emit an event to notify the parent component
5. WHEN message sending fails THEN THE Frontend SHALL display the error message inline
6. THE Frontend SHALL include the Authorization header with Bearer token on the POST request

### Requirement 5: Component Composition

**User Story:** As a developer, I want the components to be composed correctly, so that the application functions as a cohesive unit.

#### Acceptance Criteria

1. THE Chat_View SHALL compose Message_List and Message_Input components
2. WHEN Message_Input emits a sent message event THEN THE Chat_View SHALL update the message list
3. WHEN polling returns new messages THEN THE Chat_View SHALL update the shared message state
4. THE App SHALL manage the authentication state and conditionally render Login_Form or Chat_View
5. THE App MAY use a hardcoded Channel_ID for MVP purposes

### Requirement 6: Architecture Constraints

**User Story:** As a developer, I want the codebase to follow specific architectural patterns, so that it remains maintainable and readable.

#### Acceptance Criteria

1. THE Frontend SHALL use Svelte (not SvelteKit) with TypeScript
2. THE Frontend SHALL use the fetch API directly for HTTP requests
3. THE Frontend SHALL NOT use external state management libraries
4. THE Frontend SHALL NOT use shared global mutable state
5. THE Frontend SHALL communicate between components via props and events only
6. EACH component SHALL be standalone and readable

### Requirement 7: Non-Functional Constraints

**User Story:** As a developer, I want clear boundaries on what is NOT implemented, so that scope remains focused.

#### Acceptance Criteria

1. THE Frontend SHALL NOT implement WebSocket connections
2. THE Frontend SHALL NOT implement real-time subscriptions
3. THE Frontend SHALL NOT implement permissions UI
4. THE Frontend SHALL NOT implement guild/channel browser
5. THE Frontend SHALL NOT implement message editing or deletion
6. THE Frontend SHALL NOT implement routing
7. THE Frontend SHALL NOT implement animations
8. THE Frontend SHALL NOT implement retry logic for failed requests
