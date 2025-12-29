# Implementation Plan: Svelte Frontend MVP

## Overview

This plan implements a minimal Svelte frontend for visual verification of the Discord-like messaging backend. The implementation follows a bottom-up approach: project setup → utility functions → individual components → composition → integration.

## Tasks

- [x] 1. Project Setup
  - [x] 1.1 Initialize Svelte project with Vite and TypeScript
    - Create frontend directory structure
    - Initialize package.json with Svelte, Vite, TypeScript dependencies
    - Create vite.config.ts with proxy configuration for /auth and /channels
    - Create tsconfig.json for TypeScript
    - Create svelte.config.js
    - Create index.html entry point
    - _Requirements: 6.1, 6.2_

  - [x] 1.2 Create shared types and utilities
    - Create src/types.ts with Message interface
    - Create src/utils.ts with sortBySnowflake function
    - _Requirements: 2.2_

  - [x] 1.3 Write property test for Snowflake sorting
    - **Property 1: Message Ordering by Snowflake ID**
    - **Validates: Requirements 2.2**

- [x] 2. Implement LoginForm Component
  - [x] 2.1 Create LoginForm.svelte
    - Render email and password inputs
    - Implement form submission handler
    - POST to /auth/login with credentials
    - Store and emit access_token on success
    - Display error inline on failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Write unit tests for LoginForm
    - Test form renders email and password inputs
    - Test successful login emits authenticated event
    - Test failed login displays error
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Implement MessageList Component
  - [x] 3.1 Create MessageList.svelte
    - Accept channelId and authToken props
    - Fetch messages on mount from GET /channels/{channelId}/messages
    - Sort messages by Snowflake ID (ascending)
    - Render author_id, content, timestamp for each message
    - Include Authorization header on requests
    - Display error inline on fetch failure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Implement polling in MessageList
    - Start polling interval (1.5 seconds) on mount
    - Use after={lastMessageId} query parameter
    - Append new messages to existing list
    - Stop polling on unmount (cleanup in onDestroy)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Add appendMessage export function
    - Export function to allow parent to append messages
    - Used by ChatView when MessageInput sends a message
    - _Requirements: 5.2_

  - [x] 3.4 Write property test for message append invariant
    - **Property 4: Message List Append Invariant**
    - **Validates: Requirements 3.3**

  - [x] 3.5 Write unit tests for MessageList
    - Test initial fetch on mount
    - Test message rendering includes all fields
    - Test error display on fetch failure
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 4. Implement MessageInput Component
  - [x] 4.1 Create MessageInput.svelte
    - Accept channelId and authToken props
    - Render text input and send button
    - Prevent empty message submission
    - POST to /channels/{channelId}/messages
    - Include Authorization header
    - Clear input on success
    - Emit messageSent event with message data
    - Display error inline on failure
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.2 Write unit tests for MessageInput
    - Test input and button render
    - Test empty message prevention
    - Test successful send clears input and emits event
    - Test failed send displays error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Implement ChatView Component
  - [x] 5.1 Create ChatView.svelte
    - Accept authToken prop
    - Define hardcoded CHANNEL_ID constant
    - Compose MessageList and MessageInput
    - Bind MessageList reference for appendMessage calls
    - Handle messageSent event from MessageInput
    - Call appendMessage on MessageList when message sent
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Write unit tests for ChatView
    - Test component composition
    - Test messageSent event handling
    - _Requirements: 5.1, 5.2_

- [x] 6. Implement App Component
  - [x] 6.1 Create App.svelte
    - Manage authToken state (initially null)
    - Manage isAuthenticated derived state
    - Handle authenticated event from LoginForm
    - Conditionally render LoginForm or ChatView
    - _Requirements: 1.5, 1.6, 5.4_

  - [x] 6.2 Create main.ts entry point
    - Import App.svelte
    - Mount to #app element
    - _Requirements: 6.1_

  - [x] 6.3 Write unit tests for App
    - Test unauthenticated state shows LoginForm
    - Test authenticated state shows ChatView
    - Test authenticated event updates state
    - _Requirements: 1.5, 1.6_

- [x] 7. Checkpoint - Verify all components work
  - Ensure all tests pass
  - Verify TypeScript compilation succeeds
  - Ask the user if questions arise

- [x] 8. Integration and Documentation
  - [x] 8.1 Add minimal styling
    - Basic layout CSS for readability
    - No polish, just functional spacing
    - _Requirements: 6.6_

  - [x] 8.2 Create README with run instructions
    - Document npm install, npm run dev
    - Document backend URL configuration
    - Document how to set CHANNEL_ID
    - Provide example test flow

- [x] 9. Final Checkpoint
  - Ensure all tests pass
  - Verify frontend can be started with npm run dev
  - Ask the user if questions arise

## Notes

- All tasks are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
