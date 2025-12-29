<script lang="ts">
  import type { Message } from '../types';
  import MessageList from './MessageList.svelte';
  import MessageInput from './MessageInput.svelte';

  export let authToken: string;

  // Hardcoded for MVP - replace with actual channel ID from your backend
  const CHANNEL_ID = '123456789012345678';

  let messageListRef: MessageList;

  function handleMessageSent(event: CustomEvent<{ message: Message }>) {
    // Append the sent message to the list immediately
    messageListRef.appendMessage(event.detail.message);
  }
</script>

<div class="chat-view">
  <MessageList
    bind:this={messageListRef}
    channelId={CHANNEL_ID}
    {authToken}
  />
  <MessageInput
    channelId={CHANNEL_ID}
    {authToken}
    on:messageSent={handleMessageSent}
  />
</div>

<style>
  .chat-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: calc(100vh - 2rem);
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }
</style>
