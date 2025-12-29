<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export let editable: boolean = false;

  interface Friend {
    id: string;
    name: string;
    avatar: string;
    status: 'online' | 'idle' | 'dnd' | 'offline';
  }

  const dispatch = createEventDispatcher<{
    viewFriend: { friendId: string };
    viewAllFriends: void;
  }>();

  // Mock friends data
  let friends: Friend[] = [
    { id: '1', name: 'Alex', avatar: 'https://i.pravatar.cc/100?img=1', status: 'online' },
    { id: '2', name: 'Sarah', avatar: 'https://i.pravatar.cc/100?img=2', status: 'online' },
    { id: '3', name: 'Mike', avatar: 'https://i.pravatar.cc/100?img=3', status: 'idle' },
    { id: '4', name: 'Emma', avatar: 'https://i.pravatar.cc/100?img=4', status: 'dnd' },
    { id: '5', name: 'John', avatar: 'https://i.pravatar.cc/100?img=5', status: 'online' },
    { id: '6', name: 'Lisa', avatar: 'https://i.pravatar.cc/100?img=6', status: 'offline' },
    { id: '7', name: 'David', avatar: 'https://i.pravatar.cc/100?img=7', status: 'online' },
    { id: '8', name: 'Amy', avatar: 'https://i.pravatar.cc/100?img=8', status: 'idle' },
    { id: '9', name: 'Chris', avatar: 'https://i.pravatar.cc/100?img=9', status: 'online' },
    { id: '10', name: 'Kate', avatar: 'https://i.pravatar.cc/100?img=10', status: 'offline' },
  ];

  $: displayedFriends = friends.slice(0, 4);
  $: remainingCount = Math.max(0, friends.length - 4);
  $: onlineCount = friends.filter(f => f.status === 'online').length;

  function getStatusColor(status: Friend['status']): string {
    switch (status) {
      case 'online': return '#22c55e';
      case 'idle': return '#eab308';
      case 'dnd': return '#ef4444';
      default: return '#6b7280';
    }
  }
</script>

<div class="friends-card">
  <div class="card-header">
    <span class="online-count">{onlineCount} online</span>
    <button class="view-all-btn" on:click={() => dispatch('viewAllFriends')}>
      View All
    </button>
  </div>

  <div class="friends-display">
    <div class="avatars-row">
      {#each displayedFriends as friend, i}
        <button 
          class="friend-avatar"
          style="z-index: {4 - i};"
          on:click={() => dispatch('viewFriend', { friendId: friend.id })}
          title={friend.name}
        >
          <img src={friend.avatar} alt={friend.name} />
          <span class="status-dot" style="background: {getStatusColor(friend.status)}"></span>
        </button>
      {/each}
      
      {#if remainingCount > 0}
        <button class="remaining-count" on:click={() => dispatch('viewAllFriends')}>
          +{remainingCount}
        </button>
      {/if}
    </div>

    <div class="friends-list">
      {#each displayedFriends as friend}
        <button 
          class="friend-item"
          on:click={() => dispatch('viewFriend', { friendId: friend.id })}
        >
          <div class="friend-avatar-small">
            <img src={friend.avatar} alt={friend.name} />
            <span class="status-indicator" style="background: {getStatusColor(friend.status)}"></span>
          </div>
          <div class="friend-info">
            <span class="friend-name">{friend.name}</span>
            <span class="friend-status">{friend.status === 'dnd' ? 'Do Not Disturb' : friend.status}</span>
          </div>
        </button>
      {/each}
    </div>
  </div>

  {#if friends.length === 0}
    <div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
      <span>No friends yet</span>
    </div>
  {/if}
</div>


<style>
  .friends-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .online-count {
    font-size: 11px;
    color: #22c55e;
    background: rgba(34, 197, 94, 0.15);
    padding: 3px 8px;
    border-radius: 10px;
  }

  .view-all-btn {
    padding: 6px 12px;
    background: rgba(49, 130, 206, 0.15);
    border: none;
    border-radius: 8px;
    color: #63b3ed;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .view-all-btn:hover {
    background: rgba(49, 130, 206, 0.25);
  }

  .friends-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Stacked Avatars Row */
  .avatars-row {
    display: flex;
    align-items: center;
    padding: 8px 0;
  }

  .friend-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 3px solid rgba(40, 40, 40, 0.9);
    background: none;
    padding: 0;
    cursor: pointer;
    position: relative;
    margin-left: -12px;
    transition: all 0.2s ease;
  }

  .friend-avatar:first-child {
    margin-left: 0;
  }

  .friend-avatar:hover {
    transform: scale(1.15) translateY(-4px);
    z-index: 10 !important;
  }

  .friend-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .status-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(40, 40, 40, 0.9);
  }

  .remaining-count {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 3px solid rgba(40, 40, 40, 0.9);
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-left: -12px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .remaining-count:hover {
    transform: scale(1.15) translateY(-4px);
    box-shadow: 0 4px 15px rgba(26, 54, 93, 0.4);
  }

  /* Friends List */
  .friends-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .friend-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .friend-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .friend-avatar-small {
    position: relative;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .friend-avatar-small img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .status-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid rgba(40, 40, 40, 0.9);
  }

  .friend-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .friend-name {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friend-status {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    text-transform: capitalize;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
  }
</style>