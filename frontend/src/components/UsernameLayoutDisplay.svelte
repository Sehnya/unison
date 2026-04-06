<script lang="ts">
  import type { UsernameLayoutConfig, HoverAnimation } from '../lib/usernameLayout';

  export let layout: UsernameLayoutConfig;
  export let scale: number = 1;

  let isHovered = false;

  function getLetterStyle(letter: typeof layout.letters[0], i: number, hovered: boolean, anim: HoverAnimation): string {
    let x = letter.x;
    let y = letter.y;
    let rot = letter.rotation;
    let s = letter.scale;
    let extra = '';

    if (hovered && anim !== 'none') {
      const delay = i * 0.05;
      extra = `transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s;`;

      switch (anim) {
        case 'teleprompter':
          x += 3;
          break;
        case 'zoom':
          s *= 1.3;
          break;
        case 'space-out':
          x = 10 + (letter.index / Math.max(layout.letters.length - 1, 1)) * 80;
          y = 50;
          break;
        case 'space-in':
          x = 40 + (letter.index / Math.max(layout.letters.length - 1, 1)) * 20;
          break;
        case 'wave':
          y += Math.sin((Date.now() / 200) + i * 0.8) * 8;
          extra = `transition: none;`;
          break;
        case 'bounce':
          y -= 10;
          break;
        case 'spin':
          rot += 360;
          extra = `transition: transform 0.6s ease ${delay}s;`;
          break;
        case 'float':
          y -= 15;
          s *= 1.05;
          break;
      }
    } else {
      extra = `transition: transform 0.3s ease ${i * 0.02}s;`;
    }

    return `
      left: ${x}%;
      top: ${y}%;
      transform: translate(-50%, -50%) rotate(${rot}deg) scale(${s});
      font-family: '${layout.font}', sans-serif;
      font-size: ${layout.fontSize * scale}px;
      color: ${layout.color};
      ${extra}
    `;
  }

  // For wave animation, we need continuous updates
  let waveFrame: number | null = null;
  let tick = 0;

  $: if (isHovered && layout.hoverAnimation === 'wave') {
    startWave();
  } else {
    stopWave();
  }

  function startWave() {
    if (waveFrame !== null) return;
    const loop = () => {
      tick++;
      waveFrame = requestAnimationFrame(loop);
    };
    waveFrame = requestAnimationFrame(loop);
  }

  function stopWave() {
    if (waveFrame !== null) {
      cancelAnimationFrame(waveFrame);
      waveFrame = null;
    }
  }
</script>

<div
  class="username-layout-display"
  style="width: {layout.canvasWidth * scale}px; height: {layout.canvasHeight * scale}px;"
  on:mouseenter={() => isHovered = true}
  on:mouseleave={() => isHovered = false}
  role="img"
  aria-label="Username display"
>
  {#each layout.letters as letter, i (letter.index)}
    <span
      class="layout-letter"
      style={getLetterStyle(letter, i, isHovered, layout.hoverAnimation)}
    >{letter.char}</span>
  {/each}
</div>

<style>
  .username-layout-display {
    position: relative;
    overflow: hidden;
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
