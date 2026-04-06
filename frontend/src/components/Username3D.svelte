<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { usernameRenderer, type UsernameEffect } from '../lib/usernameRenderer';

  export let text: string;
  export let effect: UsernameEffect = 'none';
  export let color: string = '#ffffff';
  export let font: string = 'Inter';
  export let height: number = 28;

  let container: HTMLElement;
  let instanceId = `u3d-${Math.random().toString(36).slice(2, 9)}`;
  let mounted = false;

  // Track previous props to detect actual changes
  let prevText = '';
  let prevEffect: UsernameEffect = 'none';
  let prevColor = '';
  let prevFont = '';
  let prevHeight = 0;

  function measureTextWidth(t: string, f: string, size: number): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `600 ${size}px '${f}', sans-serif`;
    return Math.ceil(ctx.measureText(t).width) + size * 0.3;
  }

  function render() {
    if (!container) return;

    // Unregister previous
    usernameRenderer.unregister(instanceId);

    const width = measureTextWidth(text, font, Math.floor(height * 0.65));
    const canvas = usernameRenderer.register(instanceId, text, effect, color, font, width, height);

    // Replace canvas in DOM
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(canvas);

    // Track current props
    prevText = text;
    prevEffect = effect;
    prevColor = color;
    prevFont = font;
    prevHeight = height;
  }

  onMount(() => {
    mounted = true;
    render();
  });

  onDestroy(() => {
    mounted = false;
    usernameRenderer.unregister(instanceId);
  });

  afterUpdate(() => {
    if (!mounted) return;
    // Only re-render if props actually changed
    if (
      text !== prevText ||
      effect !== prevEffect ||
      color !== prevColor ||
      font !== prevFont ||
      height !== prevHeight
    ) {
      render();
    }
  });
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
