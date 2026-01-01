<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { DMConversation } from '../types';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';

  export let isOpen = false;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    startConversation: { conversation: DMConversation };
  }>();

  interface SearchUser {
    id: string;
    username: string;
    avatar: string | null;
  }

  let searchQuery = '';
  let searchResults: SearchUser[] = [];
  let searching = false;
  let selectedUser: SearchUser | null = null;
  let starting = false;
  let error = '';

  $: if (!isOpen) {
    // Reset state when modal closes
    searchQuery = '';
    searchResults = [];
    selectedUser = null;
    error = '';
  }

  async function searchUsers() {
    if (searchQuery.length < 2) {
      searchResults = [];
      return;
    }

    searching = true;
    error = '';

    try {
      const response = await fetch(apiUrl(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (response.ok) {
        searchResults = await response.json();
      } else {
        error = 'Failed to search users';
      }
    } catch (err) {
      console.error('Search error:', err);
      error = 'Failed to search users';
    } finally {
      searching = false;
    }
  }

  function selectUser(user: SearchUser) {
    selectedUser = user;
    searchQuery = user.username;
    searchResults = [];
  }

  async function startConversation() {
    if (!selectedUser) return;

    starting = true;
    error = '';

    try {
      const response = await fetch(apiUrl('/api/friends/dm'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: selectedUser.id }),
      });

      if (response.ok) {
        const conversation = await response.json();
        dispatch('startConversation', { conversation });
        dispatch('close');
      } else {
        const data = await response.json();
        error = data.error?.message || 'Cannot start conversation with this user';
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
      error = 'Failed to start conversation';
    } finally {
      starting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    } else if (e.key === 'Enter' && selectedUser) {
      startConversation();
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout>;
  function handleInput() {
    selectedUser = null;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(searchUsers, 300);
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => dispatch('close')}></div>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="compose-title" on:keydown={handleKeydown}>
    <div class="modal-header">
      <h2 id="compose-title">new message</h2>
      <button class="close-btn" on:click={() => dispatch('close')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="modal-content">
      <div class="search-section">
        <label for="user-search">To:</label>
        <div class="search-input-wrapper">
          {#if selectedUser}
            <div class="selected-user-chip">
              <Avatar 
                src={selectedUser.avatar}
                username={selectedUser.username}
                userId={selectedUser.id}
                size={20}
              />
              <span>{selectedUser.username}</span>
              <button class="remove-chip" on:click={() => { selectedUser = null; searchQuery = ''; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          {:else}
            <input
              id="user-search"
              type="text"
              bind:value={searchQuery}
              on:input={handleInput}
              placeholder="Search for a user..."
              autocomplete="off"
            />
          {/if}
        </div>
      </div>

      {#if searchResults.length > 0 && !selectedUser}
        <div class="search-results">
          {#each searchResults as user}
            <button class="search-result" on:click={() => selectUser(user)}>
              <Avatar 
                src={user.avatar}
                username={user.username}
                userId={user.id}
                size={36}
              />
              <span class="result-username">{user.username}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if searching}
        <div class="searching">
          <span class="spinner"></span>
          <span>Searching...</span>
        </div>
      {/if}

      {#if error}
        <div class="error">{error}</div>
      {/if}

      {#if searchQuery.length > 0 && searchQuery.length < 2 && !selectedUser}
        <div class="hint">Type at least 2 characters to search</div>
      {/if}

      {#if searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedUser}
        <div class="no-results">No users found</div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="cancel-btn" on:click={() => dispatch('close')}>cancel</button>
      <button 
        class="start-btn" 
        on:click={startConversation}
        disabled={!selectedUser || starting}
      >
        {#if starting}
          <span class="spinner-small"></span>
        {:else}
          start conversation
        {/if}
      </button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 440px;
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    z-index: 1001;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .modal-content {
    padding: 20px 24px;
    min-height: 200px;
  }

  .search-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .search-section label {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  .search-input-wrapper {
    flex: 1;
  }

  .search-input-wrapper input {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .search-input-wrapper input:focus {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .search-input-wrapper input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .selected-user-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    color: #fff;
    font-size: 14px;
  }

  .remove-chip {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4px;
    transition: background 0.15s ease;
  }

  .remove-chip:hover {
    background: rgba(255, 71, 87, 0.5);
  }

  .search-results {
    margin-top: 16px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    color: #fff;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: left;
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .search-result:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .result-username {
    font-size: 14px;
    font-weight: 500;
  }

  .searching, .hint, .no-results, .error {
    margin-top: 16px;
    padding: 16px;
    text-align: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }

  .searching {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .error {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
    border-radius: 8px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .spinner-small {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(5, 5, 5, 0.2);
    border-top-color: #050505;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cancel-btn, .start-btn {
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }

  .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  .start-btn {
    background: #fff;
    border: none;
    color: #050505;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 140px;
  }

  .start-btn:hover:not(:disabled) {
    transform: scale(1.02);
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
  }

  .start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-results::-webkit-scrollbar {
    width: 6px;
  }

  .search-results::-webkit-scrollbar-track {
    background: transparent;
  }

  .search-results::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
</style>
