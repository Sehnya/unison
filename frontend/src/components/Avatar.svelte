<script lang="ts">
  import { getGradientForUser, getInitials, hasCustomAvatar } from '../lib/avatar';

  export let src: string | null | undefined = null;
  export let username: string = '';
  export let userId: string = '';
  export let size: number = 40;
  export let alt: string = '';

  $: showImage = hasCustomAvatar(src);
  $: gradient = getGradientForUser(userId || username || 'default');
  $: initials = getInitials(username);
  $: altText = alt || `${username}'s avatar`;
</script>

<div 
  class="avatar" 
  style="width: {size}px; height: {size}px; font-size: {size * 0.4}px;"
>
  {#if showImage && src}
    <img {src} alt={altText} />
  {:else}
    <div class="gradient-avatar" style="background: {gradient};">
      <span class="initials">{initials}</span>
    </div>
  {/if}
</div>

<style>
  .avatar {
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gradient-avatar {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .initials {
    color: white;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    user-select: none;
  }
</style>
