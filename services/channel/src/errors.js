/**
 * Channel Service Errors
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */
export class ChannelError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'ChannelError';
    }
}
export class ChannelNotFoundError extends ChannelError {
    constructor() {
        super('Channel not found', 'CHANNEL_NOT_FOUND');
    }
}
export class GuildNotFoundError extends ChannelError {
    constructor() {
        super('Guild not found', 'GUILD_NOT_FOUND');
    }
}
export class InvalidChannelTypeError extends ChannelError {
    constructor() {
        super('Invalid channel type', 'INVALID_CHANNEL_TYPE');
    }
}
export class InvalidParentChannelError extends ChannelError {
    constructor() {
        super('Parent channel must be a category', 'INVALID_PARENT_CHANNEL');
    }
}
export class ParentChannelNotFoundError extends ChannelError {
    constructor() {
        super('Parent channel not found', 'PARENT_CHANNEL_NOT_FOUND');
    }
}
export class CannotDeleteCategoryWithChildrenError extends ChannelError {
    constructor() {
        super('Cannot delete category with child channels', 'CANNOT_DELETE_CATEGORY_WITH_CHILDREN');
    }
}
//# sourceMappingURL=errors.js.map