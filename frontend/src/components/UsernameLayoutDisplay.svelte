<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { UsernameLayoutConfig, HoverAnimation, LetterPosition } from '../lib/usernameLayout';

  export let layout: UsernameLayoutConfig;
  export let scale: number = 1;

  let isHovered = false;
  let animFrame: number | null = null;
  let animTime = 0;

  // Force re-render by tracking a reactive tick
  let renderTick = 0;

  function startAnim() {
    if (animFrame !== null) return;
    const start = performance.now();
    const loop = (now: number) => {
      animTime = (now - start) / 1000;
      renderTick++;
      animFrame = requestAnimationFrame(loop);
    };
    animFrame = requestAnimationFrame(loop);
  }

  function stopAnim() {
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    renderTick++;
  }

  function handleEnter() {
    isHovered = true;
    if (layout.hoverAnimation !== 'none') startAnim();
  }

  function handleLeave() {
    isHovered = false;
    stopAnim();
  }

  onDestroy(() => stopAnim());

  function computeStyle(
    letter: LetterPosition,
    i: number,
    hovered: boolean,
    anim: HoverAnimation,
    t: number,
    total: number,
    _tick: number // referenced to trigger Svelte reactivity
  ): string {
    let x = letter.x;
    let y = letter.y;
    let rot = letter.rotation;
    let s = letter.scale;
    let transition = `transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.04}s;`;

    if (hovered && anim !== 'none') {
      const n = Math.max(total - 1, 1);
      const frac = letter.index / n;

      switch (anim) {
        case 'teleprompter':
          // Scroll all letters to the right with stagger
          x += 8 + i * 2;
          break;

        case 'zoom':
          s *= 1.4;
          break;

        case 'space-out': {
          // Spread letters evenly across full width, flatten to center Y
          const spread = 8 + frac * 84;
          x = spread;
          y = 50;
          rot = 0;
          break;
        }

        case 'space-in': {
          // Collapse all letters toward center
          const centerPull = 0.6;
          x = x + (50 - x) * centerPull;
          y = y + (50 - y) * centerPull;
          break;
        }

        case 'wave':
          // Continuous sine wave — needs animation loop
          y += Math.sin(t * 4 + i * 0.7) * 10;
          transition = 'transition: none;';
          break;

        case 'bounce':
          // Staggered bounce up and back
          y -= 12 * Math.abs(Math.sin(t * 5 + i * 0.5));
          transition = 'transition: none;';
          break;

        case 'spin':
          rot += 360;
          transition = `transition: all 0.6s ease ${i * 0.06}s;`;
          break;

        case 'float':
          y -= 12;
          s *= 1.08;
          // Gentle sway
          x += Math.sin(t * 2 + i * 0.9) * 2;
          transition = 'transition: none;';
          break;
      }
    }

    return [
      `left:${x}%`,
      `top:${y}%`,
      `transform:translate(-50%,-50%) rotate(${rot}deg) scale(${s})`,
      `font-family:'${layout.font}',sans-serif`,
      `font-size:${layout.fontSize * scale}px`,
      `color:${layout.color}`,
      transition,
    ].join(';');
  }
</script>

<div
  class="username-layout-display"
  style="width:{layout.canvasWidth * scale}px;height:{layout.canvasHeight * scale}px;"
  on:mouseenter={handleEnter}
  on:mouseleave={handleLeave}
  role="img"
  aria-label="Username display"
>
  {#each layout.letters as letter, i (letter.index)}
    <span
      class="layout-letter"
      style={computeStyle(letter, i, isHovered, layout.hoverAnimation, animTime, layout.letters.length, renderTick)}
    >{letter.char}</span>
  {/each}
</div>

<style>
  .username-layout-display {
    position: relative;
    overflow: visible;
  }

  .layout-letter {
    position: absolute;
    font-weight: 600;
    pointer-events: none;
    white-space: nowrap;
    will-change: transform;
    user-select: none;
  }
</style>
