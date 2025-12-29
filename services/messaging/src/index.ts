/**
 * Messaging Service
 *
 * Handles message creation, retrieval, editing, and deletion.
 * Requirements: 9.1-9.5, 10.1-10.5, 11.1-11.3
 */

export {
  MessagingService,
  parseMentions,
  type MessagingServiceConfig,
  type PermissionChecker,
  type EventEmitter,
} from './service.js';

export {
  MessagingRepository,
  rowToMessage,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_MESSAGE_LENGTH,
  type MessageRow,
} from './repository.js';

export {
  MessagingError,
  MessageNotFoundError,
  ChannelNotFoundError,
  MissingPermissionError,
  NotMessageAuthorError,
  MessageTooLongError,
  EmptyMessageError,
  MessageDeletedError,
} from './errors.js';
