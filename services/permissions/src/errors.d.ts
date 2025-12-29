/**
 * Permission Service Errors
 */
export declare class PermissionError extends Error {
    readonly code: string;
    constructor(message: string, code: string);
}
export declare class MissingPermissionError extends PermissionError {
    constructor(permissionName: string);
}
export declare class RoleNotFoundError extends PermissionError {
    constructor();
}
export declare class RoleHierarchyViolationError extends PermissionError {
    constructor();
}
export declare class CannotModifyEveryoneError extends PermissionError {
    constructor();
}
export declare class GuildNotFoundError extends PermissionError {
    constructor();
}
export declare class MemberNotFoundError extends PermissionError {
    constructor();
}
export declare class ChannelNotFoundError extends PermissionError {
    constructor();
}
export declare class RoleAlreadyAssignedError extends PermissionError {
    constructor();
}
export declare class RoleNotAssignedError extends PermissionError {
    constructor();
}
//# sourceMappingURL=errors.d.ts.map