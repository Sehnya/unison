/**
 * Channel Service
 *
 * Handles channel CRUD, category management, and channel ordering.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

export {
  ChannelService,
  type ChannelServiceConfig,
  type CreateChannelOptions,
  type UpdateChannelOptions,
} from './service.js';
export { ChannelRepository, type ChannelPositionUpdate, rowToChannel } from './repository.js';
export * from './errors.js';
