<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';

  export let editable: boolean = false;
  export let authToken: string = '';
  export let userId: string = ''; // The user whose profile we're viewing (empty = current user)

  interface Friend {
    id: string;
    user_id: string;
    friend_id: string;
    friend_username: string;
    friend_avatar: string | null;
    friend_bio: string | null;
    status: 'accepted';
  }

  const dispatch = createEventDispatcher<{
    viewFriend: { friendId: string };
    viewAllFriends: void;
  }>();

  let friends: Friend[] = [];
  let loading = true;

  onMount(() => {
    loadFriends();
  });

  async function loadFriends() {
    if (!authToken) {
      loading = false;
      return;
    }

    try {
      // For now, we only load the current user's friends
      // In the future, we could add an endpoint to get another user's friends
      const response = await fetch(apiUrl('/api/friends'), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      if (response.ok) {
        friends = await response.json();
      }
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      loading = false;
    }
  }

  $: displayedFriends = friends.slice(0, 4);
  $: remainingCount = Math.max(0, friends.length - 4);
  $: friendCount = friends.length;
</script>

<div class="friends-card">
  <div class="card-header">
    <span class="friend-count">{friendCount} friend{friendCount !== 1 ? 's' : ''}</span>
    <button class="view-all-btn" on:click={() => dispatch('viewAllFriends')}>
      View All
    </button>
  </div>

  {#if loading}
    <div class="loading-state">
      <span>Loading friends...</span>
    </div>
  {:else if friends.length === 0}
    <div class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
      <span>No friends yet</span>
    </div>
  {:else}
    <div class="friends-display">
      <div class="avatars-row">
        {#each displayedFriends as friend, i}
          <button 
            class="friend-avatar"
            style="z-index: {4 - i};"
            on:click={() => dispatch('viewFriend', { friendId: friend.friend_id })}
            title={friend.friend_username}
          >
            <Avatar 
              src={friend.friend_avatar}
              username={friend.friend_username}
              userId={friend.friend_id}
              size={48}
            />
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
            on:click={() => dispatch('viewFriend', { friendId: friend.friend_id })}
          >
            <div class="friend-avatar-small">
              <Avatar 
                src={friend.friend_avatar}
                username={friend.friend_username}
                userId={friend.friend_id}
                size={36}
              />
            </div>
            <div class="friend-info">
              <span class="friend-name">{friend.friend_username}</span>
              {#if friend.friend_bio}
                <span class="friend-bio">{friend.friend_bio}</span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
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

  .friend-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.08);
    padding: 3px 8px;
    border-radius: 10px;
  }

  .view-all-btn {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .view-all-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .friends-display {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
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
    overflow: hidden;
  }

  .friend-avatar:first-child {
    margin-left: 0;
  }

  .friend-avatar:hover {
    transform: scale(1.15) translateY(-4px);
    z-index: 10 !important;
  }

  .remaining-count {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 3px solid rgba(40, 40, 40, 0.9);
    background: rgba(255, 255, 255, 0.1);
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
    background: rgba(255, 255, 255, 0.2);
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
    border-radius: 50%;
    overflow: hidden;
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

  .friend-bio {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
