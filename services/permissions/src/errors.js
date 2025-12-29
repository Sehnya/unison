/**
 * Permission Service Errors
 */
export class PermissionError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'PermissionError';
    }
}
export class MissingPermissionError extends PermissionError {
    constructor(permissionName) {
        super(`Missing permission: ${permissionName}`, 'MISSING_PERMISSION');
        this.name = 'MissingPermissionError';
    }
}
export class RoleNotFoundError extends PermissionError {
    constructor() {
        super('Role not found', 'ROLE_NOT_FOUND');
        this.name = 'RoleNotFoundError';
    }
}
export class RoleHierarchyViolationError extends PermissionError {
    constructor() {
        super('Cannot modify a role with higher or equal position', 'ROLE_HIERARCHY_VIOLATION');
        this.name = 'RoleHierarchyViolationError';
    }
}
export class CannotModifyEveryoneError extends PermissionError {
    constructor() {
        super('Cannot delete the @everyone role', 'CANNOT_MODIFY_EVERYONE');
        this.name = 'CannotModifyEveryoneError';
    }
}
export class GuildNotFoundError extends PermissionError {
    constructor() {
        super('Guild not found', 'GUILD_NOT_FOUND');
        this.name = 'GuildNotFoundError';
    }
}
export class MemberNotFoundError extends PermissionError {
    constructor() {
        super('Member not found', 'MEMBER_NOT_FOUND');
        this.name = 'MemberNotFoundError';
    }
}
export class ChannelNotFoundError extends PermissionError {
    constructor() {
        super('Channel not found', 'CHANNEL_NOT_FOUND');
        this.name = 'ChannelNotFoundError';
    }
}
export class RoleAlreadyAssignedError extends PermissionError {
    constructor() {
        super('Role is already assigned to this member', 'ROLE_ALREADY_ASSIGNED');
        this.name = 'RoleAlreadyAssignedError';
    }
}
export class RoleNotAssignedError extends PermissionError {
    constructor() {
        super('Role is not assigned to this member', 'ROLE_NOT_ASSIGNED');
        this.name = 'RoleNotAssignedError';
    }
}
//# sourceMappingURL=errors.js.map