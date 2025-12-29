/**
 * Channel Service Errors
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export declare class ChannelError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class ChannelNotFoundError extends ChannelError {
    constructor();
}
export declare class GuildNotFoundError extends ChannelError {
    constructor();
}
export declare class InvalidChannelTypeError extends ChannelError {
    constructor();
}
export declare class InvalidParentChannelError extends ChannelError {
    constructor();
}
export declare class ParentChannelNotFoundError extends ChannelError {
    constructor();
}
export declare class CannotDeleteCategoryWithChildrenError extends ChannelError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map