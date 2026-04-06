<script lang="ts">
  /**
   * Inline username renderer that loads the user's layout config
   * and renders UsernameLayoutDisplay if they have one,
   * otherwise falls back to plain text or Username3D effect.
   */
  import { onMount } from 'svelte';
  import { getUsernameLayout } from '../lib/usernameLayoutCache';
  import type { UsernameLayoutConfig } from '../lib/usernameLayout';
  import UsernameLayoutDisplay from './UsernameLayoutDisplay.svelte';
  import Username3D from './Username3D.svelte';
  import type { UsernameEffect } from '../lib/usernameRenderer';

  export let userId: string;
  export let username: string;
  export let font: string = 'Inter';
  export let effect: UsernameEffect = 'none';
  export let color: string = '#ffffff';
  export let authToken: string;
  export let height: number = 20;
  /** Scale for the layout display (chat = smaller, profile = larger) */
  export let layoutScale: number = 0.5;

  let layout: UsernameLayoutConfig | null = null;
  let loaded = false;

  onMount(async () => {
    if (userId && authToken) {
      layout = await getUsernameLayout(userId, authToken);
    }
    loaded = true;
  });

  // Override layout font/color/effect with current props if they differ
  $: displayLayout = layout ? {
    ...layout,
    font: font || layout.font,
    color: color || layout.color,
    effect: effect || layout.effect,
  } : null;
</script>

<span class="username-animated">
  {#if displayLayout}
    <UsernameLayoutDisplay layout={displayLayout} scale={layoutScale} />
  {:else if loaded && effect && effect !== 'none'}
    <Username3D text={username} {effect} {color} {font} {height} />
  {:else}
    <span
      class="username-plain"
      style="font-family: '{font}', sans-serif; color: {color};"
    >{username}</span>
  {/if}
</span>

<style>
  .username-animated {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }

  .username-plain {
    font-weight: 600;
  }
</style>
