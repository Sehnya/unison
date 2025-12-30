<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { User } from '../types';
  import Avatar from './Avatar.svelte';

  export let dmUser: { id: string; name: string; avatar: string; status?: string };
  export let currentUser: User | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    viewProfile: { userId: string };
  }>();

  interface Message {
    id: string;
    content: string;
    senderId: string;
    timestamp: Date;
    isOwn: boolean;
  }

  let messages: Message[] = [];
  let newMessage = '';
  let messagesContainer: HTMLElement;

  // Load mock messages
  onMount(() => {
    messages = [
      { id: '1', content: 'Hey! How are you?', senderId: dmUser.id, timestamp: new Date(Date.now() - 3600000), isOwn: false },
      { id: '2', content: "I'm good, thanks! Working on the new project.", senderId: 'me', timestamp: new Date(Date.now() - 3500000), isOwn: true },
      { id: '3', content: 'Nice! Need any help with it?', senderId: dmUser.id, timestamp: new Date(Date.now() - 3400000), isOwn: false },
      { id: '4', content: "That would be great! Let's sync up later today.", senderId: 'me', timestamp: new Date(Date.now() - 3300000), isOwn: true },
    ];
    scrollToBottom();
  });

  function scrollToBottom() {
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 0);
  }

  function sendMessage() {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `msg-${Date.now()}`,
      content: newMessage.trim(),
      senderId: 'me',
      timestamp: new Date(),
      isOwn: true,
    };

    messages = [...messages, message];
    newMessage = '';
    scrollToBottom();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
</script>

<div class="dm-chat">
  <!-- Header -->
  <header class="dm-header">
    <button class="back-btn" on:click={() => dispatch('close')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    </button>
    <button class="user-info" on:click={() => dispatch('viewProfile', { userId: dmUser.id })}>
      <div class="avatar-wrapper">
        <img src={dmUser.avatar} alt={dmUser.name} class="avatar" />
        <span class="status-dot {dmUser.status || 'online'}"></span>
      </div>
      <div class="user-details">
        <span class="username">{dmUser.name}</span>
        <span class="status-text">{dmUser.status === 'online' ? 'Online' : dmUser.status === 'idle' ? 'Idle' : dmUser.status === 'dnd' ? 'Do Not Disturb' : 'Offline'}</span>
      </div>
    </button>
    <div class="header-actions">
      <button class="action-btn" aria-label="Voice call">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </button>
      <button class="action-btn" aria-label="Video call">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      </button>
      <button class="action-btn" aria-label="More options">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Messages -->
  <div class="messages-container" bind:this={messagesContainer}>
    <div class="dm-start">
      <img src={dmUser.avatar} alt={dmUser.name} class="dm-start-avatar" />
      <h3>{dmUser.name}</h3>
      <p>This is the beginning of your direct message history with <strong>{dmUser.name}</strong>.</p>
    </div>

    {#each messages as message, i}
      {#if i === 0 || formatDate(messages[i-1].timestamp) !== formatDate(message.timestamp)}
        <div class="date-divider">
          <span>{formatDate(message.timestamp)}</span>
        </div>
      {/if}
      
      <div class="message" class:own={message.isOwn}>
        {#if !message.isOwn}
          <div class="message-avatar">
            <Avatar 
              src={dmUser.avatar}
              username={dmUser.name}
              userId={dmUser.id}
              size={36}
            />
          </div>
        {/if}
        <div class="message-content">
          <div class="message-bubble">
            <p>{message.content}</p>
          </div>
          <span class="message-time">{formatTime(message.timestamp)}</span>
        </div>
        {#if message.isOwn}
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
  </div>

  <!-- Input -->
  <div class="input-area">
    <button class="attach-btn" aria-label="Attach file">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
      </svg>
    </button>
    <div class="input-wrapper">
      <input
        type="text"
        bind:value={newMessage}
        on:keydown={handleKeydown}
        placeholder="Message {dmUser.name}"
      />
    </div>
    <button class="emoji-btn" aria-label="Add emoji">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    </button>
    <button class="send-btn" on:click={sendMessage} disabled={!newMessage.trim()}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>
</div>


<style>
  .dm-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1a1a2e;
    height: 100%;
  }

  /* Header */
  .dm-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(15, 15, 25, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .back-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 10px;
    transition: background 0.15s ease;
  }

  .user-info:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .avatar-wrapper {
    position: relative;
    width: 40px;
    height: 40px;
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .status-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #1a1a2e;
  }

  .status-dot.online { background: #22c55e; }
  .status-dot.idle { background: #eab308; }
  .status-dot.dnd { background: #ef4444; }
  .status-dot.offline { background: #6b7280; }

  .user-details {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .username {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }

  .status-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .header-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  /* Messages */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dm-start {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 20px;
    margin-bottom: 20px;
  }

  .dm-start-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin-bottom: 16px;
  }

  .dm-start h3 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .dm-start p {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
  }

  .date-divider {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 16px 0;
  }

  .date-divider span {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .message {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    max-width: 70%;
  }

  .message.own {
    align-self: flex-end;
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
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
    padding: 12px 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.08);
  }

  .message.own .message-bubble {
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
  }

  .message-bubble p {
    margin: 0;
    font-size: 14px;
    color: #fff;
    line-height: 1.5;
  }

  .message-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.4);
    padding: 0 4px;
  }

  /* Input */
  .input-area {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px;
    background: rgba(15, 15, 25, 0.95);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .attach-btn, .emoji-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .attach-btn:hover, .emoji-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .input-wrapper {
    flex: 1;
  }

  .input-wrapper input {
    width: 100%;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #fff;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .input-wrapper input:focus {
    border-color: rgba(49, 130, 206, 0.5);
  }

  .input-wrapper input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 15px rgba(26, 54, 93, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Scrollbar */
  .messages-container::-webkit-scrollbar {
    width: 6px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }
</style>