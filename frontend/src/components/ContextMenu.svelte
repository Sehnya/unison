<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let x: number = 0;
  export let y: number = 0;
  export let items: { label: string; icon?: string; action: string; danger?: boolean }[] = [];

  const dispatch = createEventDispatcher<{
    select: { action: string };
    close: void;
  }>();

  let menuElement: HTMLElement;

  function handleClick(action: string) {
    dispatch('select', { action });
    dispatch('close');
  }

  function handleClickOutside(e: MouseEvent) {
    if (menuElement && !menuElement.contains(e.target as Node)) {
      dispatch('close');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }

  // Adjust position to keep menu in viewport
  function adjustPosition() {
    if (!menuElement) return;
    
    const rect = menuElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (rect.right > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }
    if (rect.bottom > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    requestAnimationFrame(adjustPosition);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div 
  class="context-menu" 
  bind:this={menuElement}
  style="left: {x}px; top: {y}px;"
  role="menu"
>
  {#each items as item}
    <button 
      class="menu-item" 
      class:danger={item.danger}
      on:click={() => handleClick(item.action)}
      role="menuitem"
    >
      {#if item.icon}
        <span class="icon">{@html item.icon}</span>
      {/if}
      <span class="label">{item.label}</span>
    </button>
  {/each}
</div>

<style>
  .context-menu {
    position: fixed;
    z-index: 10000;
    min-width: 160px;
    padding: 6px;
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .menu-item.danger {
    color: #ef4444;
  }

  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .menu-item:hover .icon {
    opacity: 1;
  }

  .label {
    flex: 1;
  }
</style>
