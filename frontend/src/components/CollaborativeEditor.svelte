<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import TiptapCollabEditor from './TiptapCollabEditor';
  import './TiptapCollabEditor.css';
  import type { User } from '../types';

  export let channelId: string;
  export let channelName: string = 'Document';
  export let currentUser: User | null = null;
  export let authToken: string = ''; // Accept but not used yet - for future API calls

  let container: HTMLDivElement;
  let root: ReactDOM.Root | null = null;
  let mounted = false;
  let error: string | null = null;

  // TipTap Cloud App ID - set in .env as VITE_TIPTAP_APP_ID
  const appId = import.meta.env.VITE_TIPTAP_APP_ID || 'e97rj4qm';

  function renderEditor() {
    if (!container || !mounted) return;
    
    try {
      if (!root) {
        root = ReactDOM.createRoot(container);
      }
      
      root.render(
        React.createElement(TiptapCollabEditor, {
          channelId,
          channelName,
          userName: currentUser?.username || 'Anonymous',
          appId,
        })
      );
      error = null;
    } catch (e) {
      console.error('Failed to render TiptapCollabEditor:', e);
      error = e instanceof Error ? e.message : 'Failed to render editor';
    }
  }

  onMount(async () => {
    mounted = true;
    await tick(); // Wait for DOM to be ready
    renderEditor();
  });

  onDestroy(() => {
    mounted = false;
    if (root) {
      try {
        root.unmount();
      } catch (e) {
        console.warn('Error unmounting React root:', e);
      }
      root = null;
    }
  });

  // Re-render when props change
  $: if (mounted && channelId) {
    renderEditor();
  }
</script>

<div class="collaborative-editor-wrapper">
  {#if error}
    <div class="editor-error">
      <p>Failed to load editor: {error}</p>
      <button on:click={renderEditor}>Retry</button>
    </div>
  {/if}
  <div class="react-editor-container" bind:this={container}></div>
</div>

<style>
  .collaborative-editor-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #0f0f19;
  }

  .react-editor-container {
    width: 100%;
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .editor-error {
    padding: 20px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    margin: 20px;
    text-align: center;
  }

  .editor-error p {
    color: #ef4444;
    margin: 0 0 12px;
  }

  .editor-error button {
    padding: 8px 16px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .editor-error button:hover {
    background: #2563eb;
  }
</style>
