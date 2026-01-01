<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { User, DMConversation, DMMessage } from '../types';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';
  import EmojiPicker from './EmojiPicker.svelte';
  import { getAblyClient, subscribeToChannel, unsubscribeFromChannel } from '../lib/ably';

  export let conversation: DMConversation;
  export let currentUser: User | null = null;
  export let authToken: string = '';

  const dispatch = createEventDispatcher<{
    close: void;
    viewProfile: { userId: string };
    messageReceived: void;
  }>();

  let messages: DMMessage[] = [];
  let newMessage = '';
  let messagesContainer: HTMLElement;
  let loading = true;
  let sending = false;
  let showEmojiPicker = false;
  let showGifPicker = false;
  let gifSearchQuery = '';
  let gifResults: any[] = [];
  let searchingGifs = false;
  let ablyChannel: ReturnType<typeof subscribeToChannel> = null;
  
  // Notification sound
  let notificationSound: HTMLAudioElement | null = null;

  onMount(async () => {
    // Initialize notification sound
    notificationSound = new Audio('/sounds/ping.wav');
    notificationSound.volume = 0.5;
    
    await loadMessages();
    subscribeToRealtime();
    markAsRead();
  });

  onDestroy(() => {
    if (ablyChannel) {
      unsubscribeFromChannel(`dm:${conversation.id}`);
    }
  });

  async function loadMessages() {
    loading = true;
    try {
      const response = await fetch(apiUrl(`/api/friends/dm/${conversation.id}/messages?limit=50`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        messages = (data || []).sort((a: DMMessage, b: DMMessage) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      loading = false;
    }
  }

  function subscribeToRealtime() {
    const channelName = `dm:${conversation.id}`;
    ablyChannel = subscribeToChannel(channelName, (message) => {
      if (message.authorId !== currentUser?.id) {
        const dmMessage: DMMessage = {
          id: message.id,
          conversation_id: conversation.id,
          author_id: message.authorId,
          content: message.content,
          created_at: new Date(message.timestamp).toISOString(),
          edited_at: null,
        };
        if (!messages.find(m => m.id === dmMessage.id)) {
          messages = [...messages, dmMessage];
          scrollToBottom();
          
          // Play notification sound
          playNotificationSound();
          
          // Mark as read immediately since user is viewing
          markAsRead();
          
          // Notify parent
          dispatch('messageReceived');
        }
      }
    });
  }

  function playNotificationSound() {
    if (notificationSound) {
      notificationSound.currentTime = 0;
      notificationSound.play().catch(() => {
        // Ignore autoplay errors
      });
    }
  }

  async function markAsRead() {
    try {
      await fetch(apiUrl(`/api/friends/dm/${conversation.id}/read`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);
  }

  async function sendMessage() {
    if (!newMessage.trim() || sending) return;

    const content = newMessage.trim();
    newMessage = '';
    sending = true;

    // Optimistic update
    const tempMessage: DMMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      author_id: currentUser?.id || '',
      content,
      created_at: new Date().toISOString(),
      edited_at: null,
    };
    messages = [...messages, tempMessage];
    scrollToBottom();

    try {
      const response = await fetch(apiUrl(`/api/friends/dm/${conversation.id}/messages`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        messages = messages.map(m => 
          m.id === tempMessage.id ? savedMessage : m
        );

        // Publish to Ably
        const ablyClient = getAblyClient();
        if (ablyClient) {
          const channel = ablyClient.channels.get(`dm:${conversation.id}`);
          await channel.publish('message', {
            id: savedMessage.id,
            authorId: currentUser?.id,
            authorName: currentUser?.username,
            content: savedMessage.content,
            timestamp: new Date(savedMessage.created_at).getTime(),
            conversationId: conversation.id,
          });
        }
      } else {
        messages = messages.filter(m => m.id !== tempMessage.id);
        newMessage = content;
        const error = await response.json();
        alert(error.error?.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      messages = messages.filter(m => m.id !== tempMessage.id);
      newMessage = content;
    } finally {
      sending = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleEmojiSelect(event: CustomEvent<{ emoji: string }>) {
    newMessage += event.detail.emoji;
    showEmojiPicker = false;
  }

  // GIF search using Giphy API
  let gifDebounceTimer: ReturnType<typeof setTimeout>;
  
  async function searchGifs() {
    if (gifSearchQuery.length < 2) {
      gifResults = [];
      return;
    }
    
    clearTimeout(gifDebounceTimer);
    gifDebounceTimer = setTimeout(async () => {
      searchingGifs = true;
      try {
        // Using Giphy's public beta key for demo
        const response = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(gifSearchQuery)}&limit=20&rating=pg-13`
        );
        if (response.ok) {
          const data = await response.json();
          gifResults = data.data || [];
        }
      } catch (err) {
        console.error('Failed to search GIFs:', err);
      } finally {
        searchingGifs = false;
      }
    }, 300);
  }

  async function selectGif(gif: any) {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
    if (!gifUrl) return;

    showGifPicker = false;
    gifSearchQuery = '';
    gifResults = [];
    sending = true;

    // Optimistic update
    const tempMessage: DMMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      author_id: currentUser?.id || '',
      content: gifUrl,
      created_at: new Date().toISOString(),
      edited_at: null,
    };
    messages = [...messages, tempMessage];
    scrollToBottom();

    try {
      const response = await fetch(apiUrl(`/api/friends/dm/${conversation.id}/messages`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: gifUrl }),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        messages = messages.map(m => 
          m.id === tempMessage.id ? savedMessage : m
        );

        // Publish to Ably
        const ablyClient = getAblyClient();
        if (ablyClient) {
          const channel = ablyClient.channels.get(`dm:${conversation.id}`);
          await channel.publish('message', {
            id: savedMessage.id,
            authorId: currentUser?.id,
            authorName: currentUser?.username,
            content: savedMessage.content,
            timestamp: new Date(savedMessage.created_at).getTime(),
            conversationId: conversation.id,
            large: true,
          });
        }
      } else {
        messages = messages.filter(m => m.id !== tempMessage.id);
      }
    } catch (err) {
      console.error('Failed to send GIF:', err);
      messages = messages.filter(m => m.id !== tempMessage.id);
    } finally {
      sending = false;
    }
  }

  function isImageContent(content: string): boolean {
    return content.startsWith('http') && (
      content.includes('.gif') || 
      content.includes('.png') || 
      content.includes('.jpg') || 
      content.includes('.jpeg') ||
      content.includes('.webp') ||
      content.includes('giphy.com') ||
      content.includes('tenor.com')
    );
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function shouldShowDate(index: number): boolean {
    if (index === 0) return true;
    const current = new Date(messages[index].created_at).toDateString();
    const previous = new Date(messages[index - 1].created_at).toDateString();
    return current !== previous;
  }

  function isOwnMessage(message: DMMessage): boolean {
    return message.author_id === currentUser?.id;
  }
</script>

<div class="dm-chat-fullscreen">
  <!-- Header -->
  <header class="dm-header">
    <button class="back-btn" on:click={() => dispatch('close')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <button class="user-info" on:click={() => dispatch('viewProfile', { userId: conversation.other_user_id })}>
      <Avatar 
        src={conversation.other_avatar}
        username={conversation.other_username}
        userId={conversation.other_user_id}
        size={40}
      />
      <div class="user-details">
        <span class="username">{conversation.other_username}</span>
        <span class="status-text">Direct Message</span>
      </div>
    </button>
    <div class="header-actions">
      <button class="action-btn" on:click={() => dispatch('viewProfile', { userId: conversation.other_user_id })} aria-label="View profile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Messages -->
  <div class="messages-container" bind:this={messagesContainer}>
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading messages...</span>
      </div>
    {:else}
      <div class="dm-start">
        <Avatar 
          src={conversation.other_avatar}
          username={conversation.other_username}
          userId={conversation.other_user_id}
          size={80}
        />
        <h3>{conversation.other_username}</h3>
        <p>This is the beginning of your direct message history with <strong>{conversation.other_username}</strong>.</p>
      </div>

      {#each messages as message, i}
        {#if shouldShowDate(i)}
          <div class="date-divider">
            <span>{formatDate(message.created_at)}</span>
          </div>
        {/if}
        
        <div class="message" class:own={isOwnMessage(message)}>
          {#if !isOwnMessage(message)}
            <div class="message-avatar">
              <Avatar 
                src={conversation.other_avatar}
                username={conversation.other_username}
                userId={conversation.other_user_id}
                size={36}
              />
            </div>
          {/if}
          <div class="message-content">
            <div class="message-bubble" class:image-bubble={isImageContent(message.content)}>
              {#if isImageContent(message.content)}
                <img src={message.content} alt="Shared image" class="message-image" loading="lazy" />
              {:else}
                <p>{message.content}</p>
              {/if}
            </div>
            <span class="message-time">{formatTime(message.created_at)}</span>
          </div>
          {#if isOwnMessage(message)}
            <div class="message-avatar">
              <Avatar 
                src={currentUser?.avatar}
                username={currentUser?.username || ''}
                userId={currentUser?.id || ''}
                size={36}
              />
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Input -->
  <div class="input-area">
    <button class="input-btn" on:click={() => { showGifPicker = !showGifPicker; showEmojiPicker = false; }} aria-label="Send GIF" title="GIF">
      <span class="gif-label">GIF</span>
    </button>
    <button class="input-btn" on:click={() => { showEmojiPicker = !showEmojiPicker; showGifPicker = false; }} aria-label="Add emoji">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    </button>
    
    {#if showEmojiPicker}
      <div class="picker-container emoji-picker-pos">
        <EmojiPicker on:select={handleEmojiSelect} on:close={() => showEmojiPicker = false} />
      </div>
    {/if}
    
    {#if showGifPicker}
      <div class="picker-container gif-picker-pos">
        <div class="gif-picker">
          <div class="gif-search">
            <input
              type="text"
              bind:value={gifSearchQuery}
              on:input={searchGifs}
              placeholder="Search GIFs..."
              autofocus
            />
          </div>
          <div class="gif-results">
            {#if searchingGifs}
              <div class="gif-loading">Searching...</div>
            {:else if gifResults.length === 0 && gifSearchQuery.length >= 2}
              <div class="gif-empty">No GIFs found</div>
            {:else if gifResults.length === 0}
              <div class="gif-hint">Type to search for GIFs</div>
            {:else}
              {#each gifResults as gif}
                <button class="gif-item" on:click={() => selectGif(gif)}>
                  <img src={gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url} alt={gif.title} loading="lazy" />
                </button>
              {/each}
            {/if}
          </div>
          <div class="gif-footer">
            <img src="/giphy-logo-1.svg" alt="Powered by GIPHY" class="giphy-logo" />
          </div>
        </div>
      </div>
    {/if}
    
    <div class="input-wrapper">
      <input
        type="text"
        bind:value={newMessage}
        on:keydown={handleKeydown}
        placeholder="Message {conversation.other_username}"
        disabled={sending}
      />
    </div>
    <button class="send-btn" on:click={sendMessage} disabled={!newMessage.trim() || sending}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>
</div>


<style>
  .dm-chat-fullscreen {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #050505;
    height: 100%;
    width: 100%;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .dm-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    background: rgba(10, 10, 15, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .back-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: none;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 10px;
    transition: background 0.15s ease;
  }

  .user-info:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .user-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .username {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .status-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .header-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .action-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
    color: rgba(255, 255, 255, 0.4);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .dm-start {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 60px 20px;
    margin-bottom: 20px;
  }

  .dm-start h3 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 20px 0 12px 0;
  }

  .dm-start p {
    font-size: 15px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
    max-width: 400px;
  }

  .date-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 24px 0;
  }

  .date-divider span {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 12px;
  }

  .message {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    max-width: 65%;
  }

  .message.own {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-avatar {
    flex-shrink: 0;
  }

  .message-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .message.own .message-content {
    align-items: flex-end;
  }

  .message-bubble {
    padding: 14px 18px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.06);
  }

  .message.own .message-bubble {
    background: rgba(255, 255, 255, 0.12);
  }

  .message-bubble.image-bubble {
    padding: 4px;
    background: transparent;
  }

  .message-bubble p {
    margin: 0;
    font-size: 15px;
    color: #fff;
    line-height: 1.5;
    word-break: break-word;
  }

  .message-image {
    max-width: 300px;
    max-height: 300px;
    border-radius: 16px;
    display: block;
  }

  .message-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    padding: 0 6px;
  }

  .input-area {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    background: rgba(10, 10, 15, 0.95);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
  }

  .input-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .input-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .gif-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .picker-container {
    position: absolute;
    bottom: 80px;
    z-index: 100;
  }

  .emoji-picker-pos {
    left: 70px;
  }

  .gif-picker-pos {
    left: 24px;
  }

  .gif-picker {
    width: 340px;
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .gif-search {
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .gif-search input {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    outline: none;
  }

  .gif-search input:focus {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .gif-search input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .gif-results {
    height: 280px;
    overflow-y: auto;
    padding: 8px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    align-content: start;
  }

  .gif-results::-webkit-scrollbar {
    width: 6px;
  }

  .gif-results::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .gif-loading, .gif-empty, .gif-hint {
    grid-column: span 2;
    text-align: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
  }

  .gif-item {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.15s ease;
  }

  .gif-item:hover {
    transform: scale(1.05);
  }

  .gif-item img {
    width: 100%;
    height: 100px;
    object-fit: cover;
    display: block;
  }

  .gif-footer {
    padding: 8px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: flex-end;
  }

  .giphy-logo {
    height: 16px;
    opacity: 0.5;
  }

  .input-wrapper {
    flex: 1;
  }

  .input-wrapper input {
    width: 100%;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    color: #fff;
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .input-wrapper input:focus {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .input-wrapper input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .input-wrapper input:disabled {
    opacity: 0.5;
  }

  .send-btn {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: none;
    background: #fff;
    color: #050505;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 15px rgba(255, 255, 255, 0.2);
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .messages-container::-webkit-scrollbar {
    width: 6px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
</style>
