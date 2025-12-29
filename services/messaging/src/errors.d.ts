/**
 * Messaging Service Errors
 * Requirements: 9.1, 9.5, 10.1, 10.5, 11.1, 11.2, 11.3
 */
export declare class MessagingError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class MessageNotFoundError extends MessagingError {
    constructor();
}
export declare class ChannelNotFoundError extends MessagingError {
    constructor();
}
export declare class MissingPermissionError extends MessagingError {
    constructor(permission: string);
}
export declare class NotMessageAuthorError extends MessagingError {
    constructor();
}
export declare class MessageTooLongError extends MessagingError {
    constructor(maxLength: number);
}
export declare class EmptyMessageError extends MessagingError {
    constructor();
}
export declare class MessageDeletedError extends MessagingError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map