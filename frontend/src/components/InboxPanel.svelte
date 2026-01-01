<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User, Friend, DMConversation } from '../types';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';

  export let currentUser: User | null = null;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    openConversation: { conversation: DMConversation };
    viewProfile: { userId: string; username: string; avatar?: string };
    composeMessage: void;
  }>();

  type Tab = 'conversations' | 'friends' | 'requests' | 'blocked';
  let activeTab: Tab = 'conversations';

  let conversations: DMConversation[] = [];
  let friends: Friend[] = [];
  let incomingRequests: Friend[] = [];
  let outgoingRequests: Friend[] = [];
  let blockedUsers: Friend[] = [];
  let searchQuery = '';
  let searchResults: { id: string; username: string; avatar: string | null }[] = [];
  let searching = false;
  let loading = false;
  let loadError = '';

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    loadError = '';
    try {
      await Promise.all([
        loadConversations(),
        loadFriends(),
        loadRequests(),
        loadBlocked(),
      ]);
    } catch (err) {
      loadError = 'Failed to load data';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function loadConversations() {
    const response = await fetch(apiUrl('/api/friends/dm'), {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (response.ok) {
      conversations = await response.json();
    }
  }

  async function loadFriends() {
    const response = await fetch(apiUrl('/api/friends'), {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (response.ok) {
      friends = await response.json();
    }
  }

  async function loadRequests() {
    const [incoming, outgoing] = await Promise.all([
      fetch(apiUrl('/api/friends/requests/incoming'), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      }),
      fetch(apiUrl('/api/friends/requests/outgoing'), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      }),
    ]);
    if (incoming.ok) incomingRequests = await incoming.json();
    if (outgoing.ok) outgoingRequests = await outgoing.json();
  }

  async function loadBlocked() {
    const response = await fetch(apiUrl('/api/friends/blocked'), {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    if (response.ok) {
      blockedUsers = await response.json();
    }
  }

  async function searchUsers() {
    if (searchQuery.length < 2) {
      searchResults = [];
      return;
    }
    searching = true;
    try {
      const response = await fetch(apiUrl(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        searchResults = await response.json();
      }
    } finally {
      searching = false;
    }
  }

  async function sendFriendRequest(userId: string) {
    try {
      const response = await fetch(apiUrl('/api/friends/requests'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ friend_id: userId }),
      });
      if (response.ok) {
        searchQuery = '';
        searchResults = [];
        await loadRequests();
      } else {
        const data = await response.json();
        alert(data.error?.message || 'Failed to send request');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function acceptRequest(requestId: string) {
    try {
      const response = await fetch(apiUrl(`/api/friends/requests/${requestId}/accept`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        await Promise.all([loadFriends(), loadRequests()]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function declineRequest(requestId: string) {
    try {
      const response = await fetch(apiUrl(`/api/friends/requests/${requestId}/decline`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        await loadRequests();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function removeFriend(friendId: string) {
    if (!confirm('Remove this friend?')) return;
    try {
      const response = await fetch(apiUrl(`/api/friends/${friendId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        await loadFriends();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function unblockUser(userId: string) {
    try {
      const response = await fetch(apiUrl(`/api/friends/block/${userId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        await loadBlocked();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function startConversation(userId: string) {
    try {
      const response = await fetch(apiUrl('/api/friends/dm'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
      if (response.ok) {
        const conversation = await response.json();
        dispatch('openConversation', { conversation });
      } else {
        const data = await response.json();
        alert(data.error?.message || 'Cannot start conversation');
      }
    } catch (err) {
      console.error(err);
    }
  }

  function formatTime(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    return date.toLocaleDateString();
  }

  $: totalRequests = incomingRequests.length;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="inbox-backdrop" on:click={() => dispatch('close')}></div>
<div class="inbox-panel">
  <div class="header">
    <h2>messages</h2>
    <div class="header-actions">
      <button class="compose-btn" on:click={() => dispatch('composeMessage')} title="New message">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </button>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Search -->
  <div class="search-section">
    <input
      type="text"
      placeholder="search users to add..."
      bind:value={searchQuery}
      on:input={searchUsers}
    />
    {#if searchResults.length > 0}
      <div class="search-results">
        {#each searchResults as user}
          <div class="search-result">
            <Avatar src={user.avatar} username={user.username} userId={user.id} size={32} />
            <span class="username">{user.username}</span>
            <button class="add-btn" on:click={() => sendFriendRequest(user.id)}>
              add friend
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class:active={activeTab === 'conversations'} on:click={() => activeTab = 'conversations'}>
      chats
    </button>
    <button class:active={activeTab === 'friends'} on:click={() => activeTab = 'friends'}>
      friends ({friends.length})
    </button>
    <button class:active={activeTab === 'requests'} on:click={() => activeTab = 'requests'}>
      requests {#if totalRequests > 0}<span class="badge">{totalRequests}</span>{/if}
    </button>
    <button class:active={activeTab === 'blocked'} on:click={() => activeTab = 'blocked'}>
      blocked
    </button>
  </div>

  <!-- Content -->
  <div class="content">
    {#if loading}
      <div class="loading">loading...</div>
    {:else if activeTab === 'conversations'}
      {#if conversations.length === 0}
        <div class="empty">no conversations yet</div>
      {:else}
        {#each conversations as conv}
          <button class="conversation-item" on:click={() => dispatch('openConversation', { conversation: conv })}>
            <Avatar src={conv.other_avatar} username={conv.other_username} userId={conv.other_user_id} size={40} />
            <div class="conv-info">
              <span class="conv-name">{conv.other_username}</span>
              {#if conv.last_message_content}
                <span class="conv-preview">{conv.last_message_content}</span>
              {/if}
            </div>
            <div class="conv-meta">
              {#if conv.last_message_at}
                <span class="conv-time">{formatTime(conv.last_message_at)}</span>
              {/if}
              {#if conv.unread_count > 0}
                <span class="unread">{conv.unread_count}</span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    {:else if activeTab === 'friends'}
      {#if friends.length === 0}
        <div class="empty">no friends yet. search for users above!</div>
      {:else}
        {#each friends as friend}
          <div class="friend-item">
            <Avatar src={friend.friend_avatar} username={friend.friend_username} userId={friend.friend_id} size={40} />
            <div class="friend-info">
              <span class="friend-name">{friend.friend_username}</span>
              {#if friend.friend_bio}
                <span class="friend-bio">{friend.friend_bio}</span>
              {/if}
            </div>
            <div class="friend-actions">
              <button class="action-btn" on:click={() => startConversation(friend.user_id === currentUser?.id ? friend.friend_id : friend.user_id)} title="Message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
              <button class="action-btn danger" on:click={() => removeFriend(friend.user_id === currentUser?.id ? friend.friend_id : friend.user_id)} title="Remove">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    {:else if activeTab === 'requests'}
      {#if incomingRequests.length === 0 && outgoingRequests.length === 0}
        <div class="empty">no pending requests</div>
      {:else}
        {#if incomingRequests.length > 0}
          <div class="request-section">
            <span class="section-label">incoming</span>
            {#each incomingRequests as request}
              <div class="request-item">
                <Avatar src={request.friend_avatar} username={request.friend_username} userId={request.user_id} size={40} />
                <span class="request-name">{request.friend_username}</span>
                <div class="request-actions">
                  <button class="accept-btn" on:click={() => acceptRequest(request.id)}>accept</button>
                  <button class="decline-btn" on:click={() => declineRequest(request.id)}>decline</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if outgoingRequests.length > 0}
          <div class="request-section">
            <span class="section-label">sent</span>
            {#each outgoingRequests as request}
              <div class="request-item">
                <Avatar src={request.friend_avatar} username={request.friend_username} userId={request.friend_id} size={40} />
                <span class="request-name">{request.friend_username}</span>
                <span class="pending-label">pending</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {:else if activeTab === 'blocked'}
      {#if blockedUsers.length === 0}
        <div class="empty">no blocked users</div>
      {:else}
        {#each blockedUsers as blocked}
          <div class="blocked-item">
            <Avatar src={blocked.friend_avatar} username={blocked.friend_username} userId={blocked.friend_id} size={40} />
            <span class="blocked-name">{blocked.friend_username}</span>
            <button class="unblock-btn" on:click={() => unblockUser(blocked.friend_id)}>unblock</button>
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  .inbox-backdrop {
    position: fixed;
    top: 0;
    left: 72px;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 199;
  }

  .inbox-panel {
    position: fixed;
    top: 0;
    left: 72px; /* After sidebar */
    width: 380px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #050505;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    z-index: 200;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .compose-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: #fff;
    color: #050505;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .compose-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
  }

  .search-section {
    padding: 16px 24px;
    position: relative;
  }

  .search-section input {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
  }

  .search-section input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .search-section input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.3);
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 24px;
    right: 24px;
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .search-result .username {
    flex: 1;
    color: #fff;
    font-size: 14px;
  }

  .search-result .add-btn {
    padding: 6px 12px;
    background: #fff;
    color: #050505;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .search-result .add-btn:hover {
    opacity: 0.9;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 0 24px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .tabs button {
    padding: 8px 12px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tabs button:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.04);
  }

  .tabs button.active {
    color: #050505;
    background: #fff;
    font-weight: 600;
  }

  .tabs .badge {
    background: #fff;
    color: #050505;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 600;
  }

  .tabs button.active .badge {
    background: #050505;
    color: #fff;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
  }

  .content::-webkit-scrollbar {
    width: 6px;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .loading, .empty {
    text-align: center;
    color: rgba(255, 255, 255, 0.3);
    font-size: 14px;
    padding: 40px 0;
  }

  .conversation-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    background: none;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .conversation-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .conv-info {
    flex: 1;
    min-width: 0;
  }

  .conv-name {
    display: block;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
  }

  .conv-preview {
    display: block;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conv-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .conv-time {
    color: rgba(255, 255, 255, 0.3);
    font-size: 11px;
  }

  .unread {
    background: #fff;
    color: #050505;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 10px;
  }

  .friend-item, .request-item, .blocked-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    transition: all 0.2s;
  }

  .friend-item:hover, .request-item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .friend-info {
    flex: 1;
    min-width: 0;
  }

  .friend-name, .request-name, .blocked-name {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
  }

  .friend-bio {
    display: block;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .friend-actions, .request-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.06);
    border: none;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .action-btn.danger:hover {
    background: rgba(255, 71, 87, 0.2);
    color: #ff4757;
  }

  .request-section {
    margin-bottom: 24px;
  }

  .section-label {
    display: block;
    color: rgba(255, 255, 255, 0.3);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .request-name, .blocked-name {
    flex: 1;
  }

  .accept-btn, .decline-btn, .unblock-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .accept-btn {
    background: #fff;
    color: #050505;
  }

  .accept-btn:hover {
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);
  }

  .decline-btn {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
  }

  .decline-btn:hover {
    background: rgba(255, 71, 87, 0.2);
    color: #ff4757;
  }

  .unblock-btn {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
  }

  .unblock-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .pending-label {
    color: rgba(255, 255, 255, 0.3);
    font-size: 12px;
  }
</style>
