<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import MiniProfile from './MiniProfile.svelte';

  // Props
  export let userId: string;
  export let username: string;
  export let avatar: string | null = null;
  export let authToken: string;
  export let currentUserId: string;
  export let onViewProfile: (userId: string) => void = () => {};

  const dispatch = createEventDispatcher<{
    viewProfile: { userId: string };
  }>();

  // State
  let showMiniProfile = false;
  let triggerElement: HTMLElement;
  let showTimeout: ReturnType<typeof setTimeout> | null = null;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;
  let isMouseOverTrigger = false;
  let isMouseOverProfile = false;

  // Timing constants (Requirements 1.1, 1.2)
  const SHOW_DELAY_MS = 300;
  const HIDE_DELAY_MS = 200;

  function handleMouseEnter() {
    isMouseOverTrigger = true;
    
    // Clear any pending hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    
    // Start show timeout (300ms delay)
    if (!showMiniProfile && !showTimeout) {
      showTimeout = setTimeout(() => {
        if (isMouseOverTrigger) {
          showMiniProfile = true;
        }
        showTimeout = null;
      }, SHOW_DELAY_MS);
    }
  }

  function handleMouseLeave() {
    isMouseOverTrigger = false;
    
    // Clear any pending show timeout
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    
    // Start hide timeout (200ms delay)
    if (showMiniProfile && !hideTimeout) {
      hideTimeout = setTimeout(() => {
        if (!isMouseOverTrigger && !isMouseOverProfile) {
          showMiniProfile = false;
        }
        hideTimeout = null;
      }, HIDE_DELAY_MS);
    }
  }

  function handleProfileClose() {
    isMouseOverProfile = false;
    showMiniProfile = false;
  }

  function handleViewProfile(userId: string) {
    onViewProfile(userId);
    dispatch('viewProfile', { userId });
    showMiniProfile = false;
  }

  onDestroy(() => {
    if (showTimeout) clearTimeout(showTimeout);
    if (hideTimeout) clearTimeout(hideTimeout);
  });
</script>

<span
  bind:this={triggerElement}
  class="mini-profile-trigger"
  on:mouseenter={handleMouseEnter}
  on:mouseleave={handleMouseLeave}
  role="button"
  tabindex="0"
>
  <slot />
</span>

{#if showMiniProfile && triggerElement}
  <MiniProfile
    {userId}
    {username}
    {avatar}
    {triggerElement}
    {authToken}
    {currentUserId}
    onClose={handleProfileClose}
    onViewProfile={handleViewProfile}
  />
{/if}

<style>
  .mini-profile-trigger {
    cursor: pointer;
    display: inline;
  }
</style>
