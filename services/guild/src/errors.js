/**
 * Guild Service Errors
 */
export class GuildError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'GuildError';
    }
}
export class GuildNotFoundError extends GuildError {
    constructor() {
        super('Guild not found', 'GUILD_NOT_FOUND');
    }
}
export class NotGuildOwnerError extends GuildError {
    constructor() {
        super('Only the guild owner can perform this action', 'NOT_GUILD_OWNER');
    }
}
export class NotGuildMemberError extends GuildError {
    constructor() {
        super('You are not a member of this guild', 'NOT_GUILD_MEMBER');
    }
}
export class AlreadyMemberError extends GuildError {
    constructor() {
        super('User is already a member of this guild', 'ALREADY_MEMBER');
    }
}
export class UserBannedError extends GuildError {
    constructor() {
        super('You are banned from this guild', 'USER_BANNED');
    }
}
export class InviteNotFoundError extends GuildError {
    constructor() {
        super('Invite not found', 'INVITE_INVALID');
    }
}
export class InviteExpiredError extends GuildError {
    constructor() {
        super('Invite has expired', 'INVITE_EXPIRED');
    }
}
export class InviteRevokedError extends GuildError {
    constructor() {
        super('Invite has been revoked', 'INVITE_REVOKED');
    }
}
export class InviteMaxUsesReachedError extends GuildError {
    constructor() {
        super('Invite has reached maximum uses', 'INVITE_MAX_USES');
    }
}
export class CannotKickOwnerError extends GuildError {
    constructor() {
        super('Cannot kick the guild owner', 'CANNOT_KICK_OWNER');
    }
}
export class CannotBanOwnerError extends GuildError {
    constructor() {
        super('Cannot ban the guild owner', 'CANNOT_BAN_OWNER');
    }
}
export class UserNotBannedError extends GuildError {
    constructor() {
        super('User is not banned from this guild', 'USER_NOT_BANNED');
    }
}
export class CannotLeaveAsOwnerError extends GuildError {
    constructor() {
        super('Guild owner cannot leave. Transfer ownership first or delete the guild.', 'CANNOT_LEAVE_AS_OWNER');
    }
}
//# sourceMappingURL=errors.js.map