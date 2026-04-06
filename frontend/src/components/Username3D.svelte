<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { usernameRenderer, type UsernameEffect } from '../lib/usernameRenderer';

  export let text: string;
  export let effect: UsernameEffect = 'none';
  export let color: string = '#ffffff';
  export let font: string = 'Inter';
  export let height: number = 28;

  let container: HTMLElement;
  let renderedCanvas: HTMLCanvasElement | null = null;
  let instanceId = `u3d-${Math.random().toString(36).slice(2, 9)}`;

  // Measure text width using a hidden span
  function measureTextWidth(text: string, font: string, size: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `600 ${size}px '${font}', sans-serif`;
    return Math.ceil(ctx.measureText(text).width) + size * 0.3;
  }

  function mount() {
    if (!container) return;

    const width = measureTextWidth(text, font, Math.floor(height * 0.65));
    renderedCanvas = usernameRenderer.register(instanceId, text, effect, color, font, width, height);

    // Clear previous children
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderedCanvas);
  }

  function remount() {
    if (!container) return;
    usernameRenderer.unregister(instanceId);

    const width = measureTextWidth(text, font, Math.floor(height * 0.65));
    renderedCanvas = usernameRenderer.update(instanceId, text, effect, color, font, width, height);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderedCanvas);
  }

  onMount(() => {
    mount();
  });

  onDestroy(() => {
    usernameRenderer.unregister(instanceId);
  });

  // Re-render when props change
  $: if (container && (text || effect || color || font || height)) {
    remount();
  }
</script>

<span class="username-3d" bind:this={container} role="img" aria-label={text}></span>

<style>
  .username-3d {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    line-height: 1;
  }

  .username-3d :global(canvas) {
    display: block;
    image-rendering: auto;
  }
</style>
