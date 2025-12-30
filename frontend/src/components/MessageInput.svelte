<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Message, ApiError } from '../types';
  import { apiUrl } from '../lib/api';

  export let channelId: string;
  export let authToken: string;

  const dispatch = createEventDispatcher<{ messageSent: { message: Message } }>();

  let content: string = '';
  let error: string = '';
  let loading: boolean = false;

  async function handleSend() {
    if (!content.trim()) return;

    loading = true;
    error = '';

    try {
      const response = await fetch(apiUrl(`/channels/${channelId}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        const data: ApiError = await response.json().catch(() => ({ message: 'Failed to send message' }));
        throw new Error(data.message || 'Failed to send message');
      }

      const message: Message = await response.json();
      content = '';
      dispatch('messageSent', { message });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send message';
    } finally {
      loading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }
</script>

<div class="message-input">
  {#if error}
    <div class="error" role="alert">{error}</div>
  {/if}
  
  <div class="input-row">
    <input
      type="text"
      bind:value={content}
      on:keydown={handleKeydown}
      placeholder="Type a message..."
      disabled={loading}
      aria-label="Message content"
    />
    <button
      type="button"
      on:click={handleSend}
      disabled={loading || !content.trim()}
      aria-label="Send message"
    >
      {loading ? 'Sending...' : 'Send'}
    </button>
  </div>
</div>

<style>
  .message-input {
    padding: 1rem;
    border-top: 1px solid #e0e0e0;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  input:disabled {
    background-color: #f5f5f5;
  }

  .error {
    color: #dc3545;
    font-size: 0.875rem;
    padding: 0.5rem;
    background-color: #f8d7da;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    background-color: #5865f2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  button:disabled {
    background-color: #a0a0a0;
    cursor: not-allowed;
  }

  button:hover:not(:disabled) {
    background-color: #4752c4;
  }
</style>
