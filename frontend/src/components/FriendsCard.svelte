<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';

  export let editable: boolean = false;
  export let authToken: string = '';
  export let userId: string = '';

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
  let hoveredIndex: number | null = null;

  onMount(() => {
    loadFriends();
  });

  async function loadFriends() {
    if (!authToken) {
      loading = false;
      return;
    }

    try {
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

  $: displayedFriends = friends.slice(0, 8);
  $: remainingCount = Math.max(0, friends.length - 8);
  $: friendCount = friends.length;
</script>

<div class="friends-card">
  <!-- Header -->
  <div class="card-header">
    <div class="header-left">
      <div class="header-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <span class="header-title">friends</span>
      {#if friendCount > 0}
        <span class="friend-count">{friendCount}</span>
      {/if}
    </div>
    {#if editable}
      <button class="view-all-btn" on:click={() => dispatch('viewAllFriends')}>
        view all
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    {/if}
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="skeleton-row">
        {#each [0, 1, 2, 3] as i}
          <div class="skeleton-avatar" style="--delay: {i * 0.1}s;"></div>
        {/each}
      </div>
    </div>
  {:else if friends.length === 0}
    <div class="empty-state">
      <div class="empty-visual">
        <div class="empty-circle c1"></div>
        <div class="empty-circle c2"></div>
        <div class="empty-circle c3"></div>
      </div>
      <p class="empty-text">no friends yet</p>
      <span class="empty-hint">add friends to see them here</span>
    </div>
  {:else}
    <!-- Horizontal Scroll Friends -->
    <div class="friends-scroll">
      {#each displayedFriends as friend, i}
        <button 
          class="friend-item"
          class:hovered={hoveredIndex === i}
          style="--index: {i};"
          on:click={() => dispatch('viewFriend', { friendId: friend.friend_id })}
          on:mouseenter={() => hoveredIndex = i}
          on:mouseleave={() => hoveredIndex = null}
        >
          <div class="avatar-ring">
            <div class="avatar-wrapper">
              <Avatar 
                src={friend.friend_avatar}
                username={friend.friend_username}
                userId={friend.friend_id}
                size={44}
              />
            </div>
            <div class="online-dot"></div>
          </div>
          <span class="friend-name">{friend.friend_username}</span>
        </button>
      {/each}
      
      {#if remainingCount > 0}
        <button class="friend-item more-item" on:click={() => dispatch('viewAllFriends')}>
          <div class="avatar-ring more-ring">
            <div class="more-content">
              <span>+{remainingCount}</span>
            </div>
          </div>
          <span class="friend-name">more</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .friends-card {
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    gap: 16px;
  }

  /* Header */
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
  }

  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: -0.02em;
    text-transform: lowercase;
  }

  .friend-count {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .view-all-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: lowercase;
  }

  .view-all-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  /* Friends Scroll Container */
  .friends-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 4px 12px;
    margin: 0 -4px;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  .friends-scroll::-webkit-scrollbar {
    height: 0;
    display: none;
  }

  /* Friend Item */
  .friend-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    animation: revealItem 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    animation-delay: calc(var(--index) * 0.04s);
  }

  @keyframes revealItem {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .avatar-ring {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.12) 0%, 
      rgba(255, 255, 255, 0.04) 100%
    );
    padding: 3px;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .friend-item:hover .avatar-ring {
    transform: translateY(-4px) scale(1.05);
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.2) 0%, 
      rgba(255, 255, 255, 0.08) 100%
    );
    box-shadow: 
      0 12px 28px rgba(0, 0, 0, 0.25),
      0 0 0 1px rgba(255, 255, 255, 0.1);
  }

  .avatar-wrapper {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
  }

  .avatar-wrapper :global(img),
  .avatar-wrapper :global(.avatar),
  .avatar-wrapper :global(div) {
    width: 100% !important;
    height: 100% !important;
    border-radius: 50% !important;
    object-fit: cover;
  }

  .online-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    background: #22c55e;
    border: 2px solid #0a0a0a;
    border-radius: 50%;
    opacity: 0;
    transform: scale(0);
    transition: all 0.2s ease;
  }

  .friend-item:hover .online-dot {
    opacity: 1;
    transform: scale(1);
  }

  .friend-name {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    max-width: 60px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.2s ease;
    letter-spacing: -0.01em;
  }

  .friend-item:hover .friend-name {
    color: #fff;
  }

  /* More Item */
  .more-item .more-ring {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.08) 0%, 
      rgba(255, 255, 255, 0.03) 100%
    );
    border: 1px dashed rgba(255, 255, 255, 0.2);
  }

  .more-content {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.03);
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
  }

  .more-item:hover .more-ring {
    border-color: rgba(255, 255, 255, 0.4);
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.15) 0%, 
      rgba(255, 255, 255, 0.06) 100%
    );
  }

  .more-item:hover .more-content {
    color: #fff;
  }

  /* Loading State */
  .loading-state {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 8px 4px;
  }

  .skeleton-row {
    display: flex;
    gap: 12px;
  }

  .skeleton-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(
      110deg,
      rgba(255, 255, 255, 0.06) 8%,
      rgba(255, 255, 255, 0.12) 18%,
      rgba(255, 255, 255, 0.06) 33%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    animation-delay: var(--delay);
  }

  @keyframes shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }

  /* Empty State */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px 16px;
  }

  .empty-visual {
    position: relative;
    width: 80px;
    height: 40px;
    margin-bottom: 8px;
  }

  .empty-circle {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px dashed rgba(255, 255, 255, 0.15);
    animation: gentlePulse 3s ease-in-out infinite;
  }

  .empty-circle.c1 {
    left: 0;
    animation-delay: 0s;
    background: rgba(255, 255, 255, 0.03);
  }

  .empty-circle.c2 {
    left: 20px;
    animation-delay: 0.3s;
    background: rgba(255, 255, 255, 0.04);
  }

  .empty-circle.c3 {
    left: 40px;
    animation-delay: 0.6s;
    background: rgba(255, 255, 255, 0.05);
  }

  @keyframes gentlePulse {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: -0.01em;
  }

  .empty-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
  }
</style>
