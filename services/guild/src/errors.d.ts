/**
 * Guild Service Errors
 */
export declare class GuildError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class GuildNotFoundError extends GuildError {
    constructor();
}
export declare class NotGuildOwnerError extends GuildError {
    constructor();
}
export declare class NotGuildMemberError extends GuildError {
    constructor();
}
export declare class AlreadyMemberError extends GuildError {
    constructor();
}
export declare class UserBannedError extends GuildError {
    constructor();
}
export declare class InviteNotFoundError extends GuildError {
    constructor();
}
export declare class InviteExpiredError extends GuildError {
    constructor();
}
export declare class InviteRevokedError extends GuildError {
    constructor();
}
export declare class InviteMaxUsesReachedError extends GuildError {
    constructor();
}
export declare class CannotKickOwnerError extends GuildError {
    constructor();
}
export declare class CannotBanOwnerError extends GuildError {
    constructor();
}
export declare class UserNotBannedError extends GuildError {
    constructor();
}
export declare class CannotLeaveAsOwnerError extends GuildError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map