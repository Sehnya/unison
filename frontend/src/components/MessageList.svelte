<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Message } from '../types';
  import { sortBySnowflake } from '../utils';
  import { apiUrl } from '../lib/api';

  export let channelId: string;
  export let authToken: string;

  let messages: Message[] = [];
  let error: string = '';
  let loading: boolean = true;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchMessages(after?: string): Promise<Message[]> {
    const url = after
      ? apiUrl(`/channels/${channelId}/messages?after=${after}`)
      : apiUrl(`/channels/${channelId}/messages`);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Failed to fetch messages' }));
      throw new Error(data.message || 'Failed to fetch messages');
    }

    return response.json() as Promise<Message[]>;
  }

  export async function loadInitialMessages() {
    loading = true;
    error = '';
    try {
      const fetched = await fetchMessages();
      messages = sortBySnowflake(fetched);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load messages';
    } finally {
      loading = false;
    }
  }

  async function pollNewMessages() {
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : undefined;
    try {
      const newMessages = await fetchMessages(lastId);
      if (newMessages.length > 0) {
        messages = [...messages, ...sortBySnowflake(newMessages)];
      }
    } catch {
      // Silent fail on poll - don't overwrite existing error
    }
  }

  export function appendMessage(message: Message) {
    messages = [...messages, message];
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  onMount(() => {
    loadInitialMessages();
    pollInterval = setInterval(pollNewMessages, 1500);
  });

  onDestroy(() => {
    if (pollInterval) {
      clearInterval(pollInterval);
    }
  });
</script>

<div class="message-list">
  {#if loading}
    <div class="loading">Loading messages...</div>
  {:else if error}
    <div class="error" role="alert">{error}</div>
  {:else if messages.length === 0}
    <div class="empty">No messages yet</div>
  {:else}
    <ul class="messages">
      {#each messages as message (message.id)}
        <li class="message">
          <span class="author">{message.author_id}</span>
          <span class="timestamp">{formatTimestamp(message.created_at)}</span>
          <p class="content">{message.content}</p>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .loading, .empty {
    color: #666;
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: #dc3545;
    background-color: #f8d7da;
    padding: 0.75rem;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .messages {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .message {
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-radius: 4px;
  }

  .author {
    font-weight: 600;
    color: #5865f2;
    margin-right: 0.5rem;
  }

  .timestamp {
    font-size: 0.75rem;
    color: #999;
  }

  .content {
    margin: 0.25rem 0 0 0;
    word-wrap: break-word;
  }
</style>
