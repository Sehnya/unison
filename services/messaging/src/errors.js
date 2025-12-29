/**
 * Messaging Service Errors
 * Requirements: 9.1, 9.5, 10.1, 10.5, 11.1, 11.2, 11.3
 */
export class MessagingError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'MessagingError';
    }
}
export class MessageNotFoundError extends MessagingError {
    constructor() {
        super('Message not found', 'MESSAGE_NOT_FOUND');
    }
}
export class ChannelNotFoundError extends MessagingError {
    constructor() {
        super('Channel not found', 'CHANNEL_NOT_FOUND');
    }
}
export class MissingPermissionError extends MessagingError {
    constructor(permission) {
        super(`Missing permission: ${permission}`, 'MISSING_PERMISSION');
    }
}
export class NotMessageAuthorError extends MessagingError {
    constructor() {
        super('You are not the author of this message', 'NOT_MESSAGE_AUTHOR');
    }
}
export class MessageTooLongError extends MessagingError {
    constructor(maxLength) {
        super(`Message content exceeds maximum length of ${maxLength} characters`, 'MESSAGE_TOO_LONG');
    }
}
export class EmptyMessageError extends MessagingError {
    constructor() {
        super('Message content cannot be empty', 'EMPTY_MESSAGE');
    }
}
export class MessageDeletedError extends MessagingError {
    constructor() {
        super('Cannot modify a deleted message', 'MESSAGE_DELETED');
    }
}
//# sourceMappingURL=errors.js.map