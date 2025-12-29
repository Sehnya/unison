# Requirements Document

## Introduction

This document defines the requirements for the core text chat functionality of a Discord-like real-time communication platform. This covers Phase 1 of the build order: authentication, guilds/channels/membership, permissions, messaging, and WebSocket gateway for real-time message fanout.

## Glossary

- **Platform**: The Discord-like communication system being built
- **User**: A registered account holder who can join guilds and send messages
- **Guild**: A community server containing channels and members (equivalent to Discord "server")
- **Channel**: A communication space within a guild where messages are exchanged
- **Member**: A user who has joined a specific guild
- **Role**: A named permission set that can be assigned to members within a guild
- **Permission_Bitset**: A binary representation of permissions for efficient storage and computation
- **Snowflake_ID**: A time-sortable unique identifier (64-bit) used for users, guilds, channels, and messages
- **Session**: An authenticated connection instance tied to a user and device
- **JWT**: JSON Web Token used for stateless authentication
- **Refresh_Token**: A long-lived token used to obtain new JWTs
- **WebSocket_Gateway**: The real-time connection layer that maintains client subscriptions and fans out events
- **Event_Bus**: The message broker (NATS JetStream) that distributes events between services
- **Channel_Overwrite**: Permission modifications specific to a channel that override role permissions

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a new user, I want to create an account and authenticate, so that I can access the platform securely.

#### Acceptance Criteria

1. WHEN a user submits valid registration data (email, password) THEN THE Auth_Service SHALL create a new user with a Snowflake_ID and hashed password
2. WHEN a user submits invalid registration data THEN THE Auth_Service SHALL return descriptive validation errors
3. WHEN a user authenticates with valid credentials THEN THE Auth_Service SHALL issue a JWT and Refresh_Token
4. WHEN a user authenticates with invalid credentials THEN THE Auth_Service SHALL return an authentication error without revealing which field was incorrect
5. WHEN a JWT expires THEN THE Auth_Service SHALL allow token refresh using a valid Refresh_Token
6. WHEN a Refresh_Token is used THEN THE Auth_Service SHALL invalidate the old Refresh_Token and issue a new pair
7. IF a Refresh_Token is reused after invalidation THEN THE Auth_Service SHALL revoke all sessions for that user (rotation violation detection)

### Requirement 2: Session Management

**User Story:** As a user, I want to manage my active sessions across devices, so that I can maintain security and control over my account access.

#### Acceptance Criteria

1. WHEN a user authenticates THEN THE Auth_Service SHALL create a session record with device information
2. WHEN a user requests their active sessions THEN THE Auth_Service SHALL return a list of all sessions with device and last-active metadata
3. WHEN a user revokes a specific session THEN THE Auth_Service SHALL invalidate that session's tokens immediately
4. WHEN a user logs out THEN THE Auth_Service SHALL invalidate the current session
5. WHEN a session is invalidated THEN THE WebSocket_Gateway SHALL disconnect any active connections for that session

### Requirement 3: Guild Management

**User Story:** As a user, I want to create and manage guilds, so that I can build communities for communication.

#### Acceptance Criteria

1. WHEN a user creates a guild THEN THE Guild_Service SHALL create the guild with a Snowflake_ID and set the creator as owner
2. WHEN a guild is created THEN THE Guild_Service SHALL create a default "general" text channel
3. WHEN a guild is created THEN THE Permissions_Service SHALL create a default "@everyone" role with basic permissions
4. WHEN a guild owner updates guild settings THEN THE Guild_Service SHALL persist the changes and emit a guild.updated event
5. WHEN a guild owner transfers ownership THEN THE Guild_Service SHALL update the owner_id and emit a guild.updated event
6. WHEN a guild owner deletes a guild THEN THE Guild_Service SHALL soft-delete the guild and all associated data

### Requirement 4: Guild Membership

**User Story:** As a user, I want to join and leave guilds, so that I can participate in communities of my choice.

#### Acceptance Criteria

1. WHEN a user joins a guild via invite THEN THE Guild_Service SHALL create a membership record with joined_at timestamp
2. WHEN a user joins a guild THEN THE Guild_Service SHALL emit a member.joined event to the Event_Bus
3. WHEN a member leaves a guild THEN THE Guild_Service SHALL remove the membership and emit a member.left event
4. WHEN a member is kicked from a guild THEN THE Guild_Service SHALL remove the membership and emit a member.removed event
5. WHEN a member is banned from a guild THEN THE Guild_Service SHALL remove membership, record the ban, and emit a member.banned event
6. IF a banned user attempts to rejoin THEN THE Guild_Service SHALL reject the join request

### Requirement 5: Guild Invites

**User Story:** As a guild member with invite permissions, I want to create invite links, so that I can invite others to join the guild.

#### Acceptance Criteria

1. WHEN a member with invite permission creates an invite THEN THE Guild_Service SHALL generate a unique invite code with optional expiration and use limit
2. WHEN an invite is used THEN THE Guild_Service SHALL increment the use count
3. WHEN an invite reaches its use limit THEN THE Guild_Service SHALL mark it as expired
4. WHEN an invite expires by time THEN THE Guild_Service SHALL reject subsequent join attempts using that invite
5. WHEN a member with manage-invites permission revokes an invite THEN THE Guild_Service SHALL invalidate the invite immediately

### Requirement 6: Role Management

**User Story:** As a guild administrator, I want to create and manage roles, so that I can organize permissions for members.

#### Acceptance Criteria

1. WHEN an administrator creates a role THEN THE Permissions_Service SHALL create the role with a Snowflake_ID, name, position, and Permission_Bitset
2. WHEN an administrator updates a role's permissions THEN THE Permissions_Service SHALL update the Permission_Bitset and emit a role.updated event
3. WHEN an administrator changes a role's position THEN THE Permissions_Service SHALL reorder affected roles and emit role.updated events
4. WHEN an administrator deletes a role THEN THE Permissions_Service SHALL remove the role and all member assignments, emitting a role.deleted event
5. WHEN a role is assigned to a member THEN THE Permissions_Service SHALL create the member_role association and invalidate cached permissions
6. WHEN a role is removed from a member THEN THE Permissions_Service SHALL delete the member_role association and invalidate cached permissions

### Requirement 7: Permission Evaluation

**User Story:** As the platform, I want to evaluate permissions efficiently, so that access control is enforced consistently and quickly.

#### Acceptance Criteria

1. THE Permissions_Service SHALL evaluate permissions by combining: base @everyone role, member's roles (by position), and channel overwrites
2. WHEN evaluating channel overwrites THEN THE Permissions_Service SHALL apply deny bits before allow bits
3. WHEN a permission check is requested THEN THE Permissions_Service SHALL first check Redis cache for computed permissions
4. IF cached permissions exist and are valid THEN THE Permissions_Service SHALL return the cached result
5. IF cached permissions are missing or expired THEN THE Permissions_Service SHALL compute permissions, cache the result, and return it
6. WHEN any permission-affecting change occurs THEN THE Permissions_Service SHALL invalidate relevant cache entries

### Requirement 8: Channel Management

**User Story:** As a guild administrator, I want to create and organize channels, so that members have structured spaces for communication.

#### Acceptance Criteria

1. WHEN an administrator creates a channel THEN THE Channel_Service SHALL create the channel with a Snowflake_ID, type, name, and optional parent category
2. WHEN an administrator updates channel settings THEN THE Channel_Service SHALL persist changes and emit a channel.updated event
3. WHEN an administrator reorders channels THEN THE Channel_Service SHALL update position values and emit channel.updated events
4. WHEN an administrator deletes a channel THEN THE Channel_Service SHALL soft-delete the channel and emit a channel.deleted event
5. WHEN an administrator sets channel permission overwrites THEN THE Permissions_Service SHALL store the overwrites and invalidate affected permission caches

### Requirement 9: Message Sending

**User Story:** As a guild member, I want to send messages in channels, so that I can communicate with other members.

#### Acceptance Criteria

1. WHEN a member sends a message THEN THE Messaging_Service SHALL validate the member has send_message permission in that channel
2. WHEN a valid message is submitted THEN THE Messaging_Service SHALL persist the message with a Snowflake_ID and emit a message.created event
3. WHEN a message contains mentions THEN THE Messaging_Service SHALL parse and validate mentioned users/roles
4. WHEN a message is persisted THEN THE Event_Bus SHALL deliver the message.created event to the WebSocket_Gateway
5. IF a member lacks send_message permission THEN THE Messaging_Service SHALL reject the message with a permission error

### Requirement 10: Message Reading

**User Story:** As a guild member, I want to read message history in channels, so that I can catch up on conversations.

#### Acceptance Criteria

1. WHEN a member requests message history THEN THE Messaging_Service SHALL validate the member has read_message permission
2. WHEN fetching messages THEN THE Messaging_Service SHALL return paginated results ordered by Snowflake_ID (time-sorted)
3. WHEN a member specifies a before/after cursor THEN THE Messaging_Service SHALL return messages relative to that cursor
4. THE Messaging_Service SHALL limit page size to a maximum of 100 messages per request
5. IF a member lacks read_message permission THEN THE Messaging_Service SHALL return a permission error

### Requirement 11: Message Editing and Deletion

**User Story:** As a message author, I want to edit or delete my messages, so that I can correct mistakes or remove content.

#### Acceptance Criteria

1. WHEN an author edits their message THEN THE Messaging_Service SHALL update the content, set edited_at timestamp, and emit a message.updated event
2. WHEN an author deletes their message THEN THE Messaging_Service SHALL soft-delete the message and emit a message.deleted event
3. WHEN a moderator with manage_messages permission deletes a message THEN THE Messaging_Service SHALL soft-delete and emit a message.deleted event
4. WHEN a message is edited THEN THE Messaging_Service SHALL preserve the original content in an edit history (optional for MVP)

### Requirement 12: WebSocket Gateway Connection

**User Story:** As a user, I want to establish a real-time connection, so that I can receive instant updates.

#### Acceptance Criteria

1. WHEN a client connects to the WebSocket_Gateway THEN THE Gateway SHALL require JWT authentication
2. WHEN authentication succeeds THEN THE Gateway SHALL subscribe the connection to the user's guilds and relevant channels
3. WHEN authentication fails THEN THE Gateway SHALL close the connection with an appropriate error code
4. WHILE a connection is active THEN THE Gateway SHALL send heartbeat pings and expect pongs within a timeout
5. IF a client fails to respond to heartbeats THEN THE Gateway SHALL close the connection and clean up subscriptions

### Requirement 13: Real-time Event Fanout

**User Story:** As a connected user, I want to receive real-time events, so that my client stays synchronized with server state.

#### Acceptance Criteria

1. WHEN a message.created event is received from the Event_Bus THEN THE WebSocket_Gateway SHALL fan out to all connections subscribed to that channel
2. WHEN a guild.updated event is received THEN THE WebSocket_Gateway SHALL fan out to all connections subscribed to that guild
3. WHEN a member.joined event is received THEN THE WebSocket_Gateway SHALL fan out to guild subscribers and add subscriptions for the new member's connection
4. WHEN a member.left/removed/banned event is received THEN THE WebSocket_Gateway SHALL fan out to guild subscribers and remove subscriptions for the affected member
5. WHEN a channel is created/updated/deleted THEN THE WebSocket_Gateway SHALL fan out to guild subscribers
6. WHEN a role is updated/deleted THEN THE WebSocket_Gateway SHALL fan out to guild subscribers

### Requirement 14: Snowflake ID Generation

**User Story:** As the platform, I want time-sortable unique identifiers, so that entities can be ordered chronologically and distributed ID generation is possible.

#### Acceptance Criteria

1. THE ID_Generator SHALL produce 64-bit Snowflake IDs containing timestamp, worker ID, and sequence components
2. THE ID_Generator SHALL guarantee uniqueness across distributed workers
3. THE ID_Generator SHALL produce IDs that sort chronologically when compared numerically
4. WHEN multiple IDs are generated in the same millisecond THEN THE ID_Generator SHALL increment the sequence component

### Requirement 15: Event Bus Integration

**User Story:** As the platform, I want reliable event distribution, so that services can communicate asynchronously and scale independently.

#### Acceptance Criteria

1. THE Event_Bus SHALL use NATS JetStream for durable message delivery
2. WHEN a service publishes an event THEN THE Event_Bus SHALL deliver it to all subscribed consumers
3. THE Event_Bus SHALL support the following topics: guild.events, channel.events, message.events, member.events, role.events
4. WHEN a consumer fails to process an event THEN THE Event_Bus SHALL support retry with backoff
5. THE Event_Bus SHALL preserve event ordering within a single entity (e.g., all events for one channel maintain order)
