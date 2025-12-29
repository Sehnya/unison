# Implementation Plan: Discord Clone Core

## Overview

This implementation plan covers Phase 1 of the Discord-like platform: core text chat functionality including authentication, guilds, channels, permissions, messaging, and real-time WebSocket gateway. The implementation uses TypeScript with Node.js, PostgreSQL, Redis, and NATS JetStream.

## Tasks

- [x] 1. Project setup and infrastructure
  - [x] 1.1 Initialize monorepo structure with shared packages
    - Create workspace with `packages/` for shared code and `services/` for microservices
    - Set up TypeScript configuration with strict mode
    - Configure ESLint, Prettier, and testing framework (Vitest + fast-check)
    - _Requirements: N/A (infrastructure)_

  - [x] 1.2 Set up database schemas and migrations
    - Create PostgreSQL migration files for all tables (users, sessions, guilds, channels, messages, roles, etc.)
    - Set up message table partitioning by month
    - Create indexes as specified in design
    - _Requirements: All data model requirements_

  - [x] 1.3 Set up shared packages
    - Create `@discord-clone/types` package with all TypeScript interfaces
    - Create `@discord-clone/snowflake` package for ID generation
    - Create `@discord-clone/events` package for event schemas
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 2. Snowflake ID Generator
  - [x] 2.1 Implement Snowflake generator
    - Implement 64-bit ID generation with timestamp, worker ID, sequence
    - Implement parse function to extract components
    - Implement getTimestamp function
    - Handle sequence overflow (wait for next millisecond)
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 2.2 Write property test for Snowflake uniqueness
    - **Property 13: Snowflake Uniqueness**
    - Generate many IDs across simulated workers, verify no duplicates
    - **Validates: Requirements 14.2**

  - [x] 2.3 Write property test for Snowflake chronological ordering
    - **Property 14: Snowflake Chronological Ordering**
    - Generate IDs at different times, verify later IDs are numerically greater
    - **Validates: Requirements 14.3**

- [x] 3. Auth Service
  - [x] 3.1 Implement user registration
    - Email validation, password hashing (bcrypt/argon2)
    - Create user with Snowflake ID
    - Return user and token pair
    - _Requirements: 1.1, 1.2_

  - [x] 3.2 Implement login and token issuance
    - Credential validation
    - JWT generation with user ID and session ID
    - Refresh token generation and hashing
    - Session creation with device info
    - _Requirements: 1.3, 1.4, 2.1_

  - [x] 3.3 Implement token refresh with rotation
    - Validate refresh token
    - Invalidate old refresh token
    - Issue new token pair
    - Detect rotation violations (reused tokens)
    - _Requirements: 1.5, 1.6, 1.7_

  - [x] 3.4 Write property tests for authentication
    - **Property 1: Authentication Token Issuance**
    - **Property 2: Token Refresh Round-Trip**
    - **Property 3: Token Rotation Security**
    - **Validates: Requirements 1.3, 1.5, 1.6, 1.7**

  - [x] 3.5 Implement session management
    - List sessions for user
    - Revoke specific session
    - Revoke all sessions
    - Logout (invalidate current session)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Write property test for session lifecycle
    - **Property 4: Session Lifecycle Consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 4. Checkpoint - Auth Service complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Permissions Service - Core
  - [x] 5.1 Implement permission bitset utilities
    - Define permission constants
    - Implement bitwise operations (has, add, remove)
    - Implement permission computation algorithm
    - _Requirements: 7.1, 7.2_

  - [x] 5.2 Write property test for permission computation
    - **Property 9: Permission Computation Correctness**
    - Generate roles, overwrites, users; verify computed permissions match algorithm
    - **Validates: Requirements 7.1, 7.2**

  - [x] 5.3 Implement role CRUD operations
    - Create role with Snowflake ID, name, position, permissions
    - Update role (name, permissions, position)
    - Delete role (cascade to member_roles)
    - Reorder roles
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.4 Implement role assignment
    - Assign role to member
    - Remove role from member
    - Get member roles
    - _Requirements: 6.5, 6.6_

  - [x] 5.5 Implement channel overwrites
    - Set channel overwrite (role or member)
    - Delete channel overwrite
    - _Requirements: 8.5_

  - [x] 5.6 Implement permission caching with Redis
    - Cache computed permissions with TTL
    - Implement cache invalidation by event type
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

  - [x] 5.7 Write property test for cache consistency
    - **Property 10: Permission Cache Consistency**
    - **Validates: Requirements 7.6**

- [x] 6. Guild Service
  - [x] 6.1 Implement guild CRUD
    - Create guild with Snowflake ID, set creator as owner
    - Create default "general" channel on guild creation
    - Create default "@everyone" role on guild creation
    - Update guild settings
    - Transfer ownership
    - Soft-delete guild
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.2 Write property test for guild creation invariants
    - **Property 5: Guild Creation Invariants**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 6.3 Implement membership management
    - Join guild via invite
    - Leave guild
    - Kick member
    - Ban member (remove membership, record ban)
    - Unban member
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.4 Write property test for membership state
    - **Property 6: Membership State Consistency**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [x] 6.5 Write property test for ban enforcement
    - **Property 7: Ban Enforcement**
    - **Validates: Requirements 4.6**

  - [x] 6.6 Implement invite system
    - Create invite with optional max_uses and expiration
    - Validate invite (check expiration, use count, revocation)
    - Use invite (increment count, check limits)
    - Revoke invite
    - List guild invites
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.7 Write property test for invite lifecycle
    - **Property 8: Invite Lifecycle**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 7. Checkpoint - Guild and Permissions complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Channel Service
  - [x] 8.1 Implement channel CRUD
    - Create channel with Snowflake ID, type, name, optional parent
    - Update channel settings
    - Reorder channels
    - Soft-delete channel
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.2 Implement channel queries
    - Get channel by ID
    - Get guild channels (ordered by position)
    - _Requirements: 8.1_

- [x] 9. Messaging Service
  - [x] 9.1 Implement message creation
    - Validate send_message permission
    - Create message with Snowflake ID
    - Parse mentions (users and roles)
    - Emit message.created event
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 9.2 Implement message retrieval with pagination
    - Validate read_message permission
    - Cursor-based pagination (before/after)
    - Limit page size to 100
    - Order by Snowflake ID
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 9.3 Write property test for pagination ordering
    - **Property 11: Message Pagination Ordering**
    - **Validates: Requirements 10.2, 10.3, 10.4**

  - [x] 9.4 Write property test for permission enforcement
    - **Property 12: Permission Enforcement Symmetry**
    - **Validates: Requirements 9.1, 9.5, 10.1, 10.5**

  - [x] 9.5 Implement message editing
    - Validate author or manage_messages permission
    - Update content, set edited_at
    - Emit message.updated event
    - _Requirements: 11.1_

  - [x] 9.6 Implement message deletion
    - Validate author or manage_messages permission
    - Soft-delete (set deleted_at)
    - Emit message.deleted event
    - Implement deletion dominance (deleted messages ignore edits)
    - _Requirements: 11.2, 11.3_

  - [x] 9.7 Write property test for deletion dominance
    - **Property 19: Deletion Dominance**
    - **Validates: Requirements 11.2, 11.3**

- [x] 10. Checkpoint - Messaging complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Event Bus Integration
  - [x] 11.1 Set up NATS JetStream client
    - Configure streams for each topic (guild, channel, message, member, role events)
    - Implement event publishing with proper subjects
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 11.2 Implement event consumers
    - Consumer groups for each service
    - Retry with backoff on failure
    - Acknowledge after processing
    - _Requirements: 15.4_

  - [x] 11.3 Write property test for event ordering
    - **Property 15: Entity-Local Event Ordering**
    - **Validates: Requirements 15.5**

  - [x] 11.4 Implement message idempotency
    - Deduplicate by message ID on create
    - Idempotent updates and deletes
    - _Requirements: 9.2_

  - [x] 11.5 Write property test for message idempotency
    - **Property 17: Message Idempotency**
    - **Validates: Requirements 9.2, 15.2**

- [x] 12. WebSocket Gateway
  - [x] 12.1 Implement WebSocket server and connection handling
    - Accept connections
    - Send HELLO with heartbeat interval
    - Handle IDENTIFY with JWT validation
    - Handle HEARTBEAT/HEARTBEAT_ACK
    - Disconnect on heartbeat timeout
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 12.2 Implement subscription management
    - Subscribe to user's guilds on IDENTIFY
    - Handle SUBSCRIBE for channel-level events
    - Handle UNSUBSCRIBE
    - Track subscriptions in Redis
    - _Requirements: 12.2, 13.1_

  - [x] 12.3 Implement event fanout
    - Consume events from JetStream
    - Fan out to subscribed connections
    - Include sequence numbers
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 12.4 Write property test for event fanout
    - **Property 16: Event Fanout with Idempotent Delivery**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6**

  - [x] 12.5 Implement reconnection and resume
    - Handle last_event_id in IDENTIFY
    - Replay events from JetStream within window
    - Send RESYNC_REQUIRED if window exceeded
    - _Requirements: 12.2_

  - [x] 12.6 Implement backpressure and slow consumer handling
    - Bounded per-connection send buffer
    - Disconnect slow consumers
    - Rate limiting
    - _Requirements: 12.4, 12.5_

  - [x] 12.7 Implement session invalidation handling
    - Listen for session revocation events
    - Disconnect affected connections
    - _Requirements: 2.5_

  - [x] 12.8 Write property test for permission snapshot consistency
    - **Property 18: Permission Snapshot Consistency**
    - **Validates: Requirements 9.1, 13.1**

- [x] 13. API Gateway Layer
  - [x] 13.1 Implement REST API routes
    - Auth routes (register, login, refresh, logout, sessions)
    - Guild routes (CRUD, members, invites, bans)
    - Channel routes (CRUD, overwrites)
    - Message routes (CRUD)
    - Role routes (CRUD, assignments)
    - _Requirements: All API requirements_

  - [x] 13.2 Implement authentication middleware
    - JWT validation
    - Attach user context to requests
    - _Requirements: 1.3, 12.1_

  - [x] 13.3 Implement error handling
    - Map service errors to HTTP responses
    - Consistent error format
    - _Requirements: All error handling requirements_

- [x] 14. Final Checkpoint - All services integrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Integration tests
  - [x] 15.1 Write end-to-end flow tests
    - User registration → login → create guild → invite user → send message
    - Permission changes → cache invalidation → correct enforcement
    - _Requirements: All_

  - [x] 15.2 Write WebSocket integration tests
    - Connection lifecycle
    - Event fanout verification
    - Reconnection and resume
    - _Requirements: 12.1-12.5, 13.1-13.6_

## Notes

- All tasks are required for comprehensive test coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (19 properties total)
- Unit tests validate specific examples and edge cases
- Use fast-check for property-based testing with minimum 100 iterations
