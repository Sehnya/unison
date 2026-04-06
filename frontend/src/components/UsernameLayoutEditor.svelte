<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import {
    type LetterPosition,
    type ShapePreset,
    type HoverAnimation,
    type UsernameLayoutConfig,
    SHAPE_PRESETS,
    HOVER_ANIMATIONS,
    generateShape,
    snapToGuides,
  } from '../lib/usernameLayout';
  import { EFFECT_LABELS, type UsernameEffect } from '../lib/usernameRenderer';
  import UsernameLayoutDisplay from './UsernameLayoutDisplay.svelte';

  export let username: string;
  export let initialLayout: UsernameLayoutConfig | null = null;
  export let font: string = 'Inter';
  export let color: string = '#ffffff';
  export let effect: string = 'none';

  const dispatch = createEventDispatcher<{
    save: { layout: UsernameLayoutConfig };
    cancel: void;
  }>();

  const CANVAS_W = 400;
  const CANVAS_H = 200;

  // Editor state
  let letters: LetterPosition[] = [];
  let selectedIndex: number | null = null;
  let dragIndex: number | null = null;
  let isDragging = false;
  let guidesH: number[] = [];
  let guidesV: number[] = [];
  let hoverAnimation: HoverAnimation = 'none';
  let activeShape: ShapePreset | null = 'line';
  let showPreview = false;

  // Canvas element ref
  let canvasEl: HTMLElement;

  // Initialize
  onMount(() => {
    if (initialLayout && initialLayout.letters.length > 0) {
      letters = [...initialLayout.letters];
      hoverAnimation = initialLayout.hoverAnimation;
      activeShape = null;
    } else {
      applyShape('line');
    }
  });

  function applyShape(shape: ShapePreset) {
    activeShape = shape;
    letters = generateShape(username, shape, CANVAS_W, CANVAS_H);
    selectedIndex = null;
    guidesH = [];
    guidesV = [];
  }

  // Drag handling
  function handlePointerDown(e: PointerEvent, index: number) {
    e.preventDefault();
    dragIndex = index;
    selectedIndex = index;
    isDragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (dragIndex === null || !canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp to canvas bounds
    const clampedX = Math.max(5, Math.min(95, rawX));
    const clampedY = Math.max(5, Math.min(95, rawY));

    // Snap to guides
    const snap = snapToGuides({ x: clampedX, y: clampedY }, letters, dragIndex);

    letters = letters.map((l, i) =>
      i === dragIndex ? { ...l, x: snap.x, y: snap.y } : l
    );
    guidesH = snap.guidesH;
    guidesV = snap.guidesV;
    activeShape = null; // Custom arrangement
  }

  function handlePointerUp() {
    dragIndex = null;
    isDragging = false;
    guidesH = [];
    guidesV = [];
  }

  // Rotation/scale for selected letter
  function adjustRotation(delta: number) {
    if (selectedIndex === null) return;
    letters = letters.map((l, i) =>
      i === selectedIndex ? { ...l, rotation: l.rotation + delta } : l
    );
    activeShape = null;
  }

  function adjustScale(delta: number) {
    if (selectedIndex === null) return;
    letters = letters.map((l, i) =>
      i === selectedIndex ? { ...l, scale: Math.max(0.3, Math.min(3, l.scale + delta)) } : l
    );
    activeShape = null;
  }

  function resetSelected() {
    if (selectedIndex === null) return;
    letters = letters.map((l, i) =>
      i === selectedIndex ? { ...l, rotation: 0, scale: 1 } : l
    );
  }

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (selectedIndex === null) return;
    const step = e.shiftKey ? 5 : 1;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        letters = letters.map((l, i) => i === selectedIndex ? { ...l, x: Math.max(5, l.x - step) } : l);
        activeShape = null;
        break;
      case 'ArrowRight':
        e.preventDefault();
        letters = letters.map((l, i) => i === selectedIndex ? { ...l, x: Math.min(95, l.x + step) } : l);
        activeShape = null;
        break;
      case 'ArrowUp':
        e.preventDefault();
        letters = letters.map((l, i) => i === selectedIndex ? { ...l, y: Math.max(5, l.y - step) } : l);
        activeShape = null;
        break;
      case 'ArrowDown':
        e.preventDefault();
        letters = letters.map((l, i) => i === selectedIndex ? { ...l, y: Math.min(95, l.y + step) } : l);
        activeShape = null;
        break;
      case 'Escape':
        selectedIndex = null;
        break;
    }
  }

  function getLayout(): UsernameLayoutConfig {
    return {
      letters,
      font,
      fontSize: 24,
      color,
      effect,
      hoverAnimation,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
    };
  }

  function handleSave() {
    dispatch('save', { layout: getLayout() });
  }

  function handleCancel() {
    dispatch('cancel');
  }

  // Deselect when clicking canvas background
  function handleCanvasClick(e: MouseEvent) {
    if (e.target === canvasEl) {
      selectedIndex = null;
    }
  }
</script>

<div class="layout-editor" on:keydown={handleKeydown} tabindex="-1">
  <!-- Canvas area -->
  <div class="editor-canvas-wrapper">
    <div
      bind:this={canvasEl}
      class="editor-canvas"
      class:dragging={isDragging}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      on:pointerleave={handlePointerUp}
      on:click={handleCanvasClick}
      role="application"
      aria-label="Letter arrangement canvas"
    >
      <!-- Grid lines -->
      <div class="grid-overlay"></div>

      <!-- Center crosshair -->
      <div class="center-guide-h"></div>
      <div class="center-guide-v"></div>

      <!-- Snap guides -->
      {#each guidesH as gy}
        <div class="snap-guide-h" style="top: {gy}%"></div>
      {/each}
      {#each guidesV as gx}
        <div class="snap-guide-v" style="left: {gx}%"></div>
      {/each}

      <!-- Letters -->
      {#each letters as letter, i (letter.index)}
        <div
          class="editor-letter"
          class:selected={selectedIndex === i}
          class:dragging={dragIndex === i}
          style="
            left: {letter.x}%;
            top: {letter.y}%;
            transform: translate(-50%, -50%) rotate({letter.rotation}deg) scale({letter.scale});
            font-family: '{font}', sans-serif;
            color: {color};
          "
          on:pointerdown={(e) => handlePointerDown(e, i)}
          role="button"
          tabindex="0"
          aria-label="Letter {letter.char}"
        >
          {letter.char}
        </div>
      {/each}
    </div>
  </div>

  <!-- Controls panel -->
  <div class="editor-controls">
    <!-- Shape presets -->
    <div class="control-section">
      <div class="control-label">shape</div>
      <div class="shape-grid">
        {#each SHAPE_PRESETS as shape}
          <button
            class="shape-btn"
            class:active={activeShape === shape.id}
            on:click={() => applyShape(shape.id)}
            title={shape.label}
          >
            <span class="shape-icon">{shape.icon}</span>
            <span class="shape-name">{shape.label.toLowerCase()}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Hover animation -->
    <div class="control-section">
      <div class="control-label">hover animation</div>
      <div class="anim-grid">
        {#each HOVER_ANIMATIONS as anim}
          <button
            class="anim-btn"
            class:active={hoverAnimation === anim.id}
            on:click={() => hoverAnimation = anim.id}
          >
            {anim.label.toLowerCase()}
          </button>
        {/each}
      </div>
    </div>

    <!-- Selected letter controls -->
    {#if selectedIndex !== null}
      <div class="control-section">
        <div class="control-label">letter: "{letters[selectedIndex]?.char}"</div>
        <div class="letter-controls">
          <div class="control-row">
            <span class="control-row-label">rotate</span>
            <button class="adj-btn" on:click={() => adjustRotation(-15)}>-15°</button>
            <button class="adj-btn" on:click={() => adjustRotation(-5)}>-5°</button>
            <button class="adj-btn" on:click={() => adjustRotation(5)}>+5°</button>
            <button class="adj-btn" on:click={() => adjustRotation(15)}>+15°</button>
          </div>
          <div class="control-row">
            <span class="control-row-label">scale</span>
            <button class="adj-btn" on:click={() => adjustScale(-0.2)}>−</button>
            <span class="scale-value">{letters[selectedIndex]?.scale.toFixed(1)}×</span>
            <button class="adj-btn" on:click={() => adjustScale(0.2)}>+</button>
          </div>
          <button class="reset-btn" on:click={resetSelected}>reset letter</button>
        </div>
      </div>
    {:else}
      <div class="control-section">
        <div class="control-hint">click a letter to select it. drag to move. arrow keys for fine control.</div>
      </div>
    {/if}

    <!-- Preview toggle -->
    <div class="control-section">
      <button class="preview-btn" on:click={() => showPreview = !showPreview}>
        {showPreview ? 'hide preview' : 'hover preview'}
      </button>
      {#if showPreview}
        <div class="preview-area">
          <UsernameLayoutDisplay layout={getLayout()} scale={0.8} />
          <div class="preview-hint">hover to see animation</div>
        </div>
      {/if}
    </div>

    <!-- Actions -->
    <div class="editor-actions">
      <button class="cancel-btn" on:click={handleCancel}>cancel</button>
      <button class="save-btn" on:click={handleSave}>save layout</button>
    </div>
  </div>
</div>

<style>
  .layout-editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: #1a1a1a;
    border-radius: 12px;
    padding: 16px;
    outline: none;
  }

  .editor-canvas-wrapper {
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
  }

  .editor-canvas {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 1;
    background: #111;
    cursor: default;
    touch-action: none;
    user-select: none;
  }

  .editor-canvas.dragging {
    cursor: grabbing;
  }

  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 10% 10%;
    pointer-events: none;
  }

  .center-guide-h, .center-guide-v {
    position: absolute;
    pointer-events: none;
    opacity: 0.15;
  }
  .center-guide-h {
    left: 0; right: 0; top: 50%;
    height: 1px;
    background: rgba(99, 102, 241, 0.5);
  }
  .center-guide-v {
    top: 0; bottom: 0; left: 50%;
    width: 1px;
    background: rgba(99, 102, 241, 0.5);
  }

  .snap-guide-h {
    position: absolute;
    left: 0; right: 0;
    height: 1px;
    background: rgba(99, 102, 241, 0.8);
    pointer-events: none;
    z-index: 5;
  }
  .snap-guide-v {
    position: absolute;
    top: 0; bottom: 0;
    width: 1px;
    background: rgba(99, 102, 241, 0.8);
    pointer-events: none;
    z-index: 5;
  }

  .editor-letter {
    position: absolute;
    font-size: 24px;
    font-weight: 600;
    cursor: grab;
    padding: 4px;
    border-radius: 4px;
    border: 2px solid transparent;
    transition: border-color 0.15s ease;
    z-index: 10;
    touch-action: none;
  }

  .editor-letter:hover {
    border-color: rgba(99, 102, 241, 0.4);
  }

  .editor-letter.selected {
    border-color: rgba(99, 102, 241, 0.8);
    background: rgba(99, 102, 241, 0.1);
  }

  .editor-letter.dragging {
    cursor: grabbing;
    z-index: 20;
    border-color: rgba(99, 102, 241, 1);
  }

  .editor-controls {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255,255,255,0.4);
    font-weight: 600;
  }

  .control-hint {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    font-style: italic;
  }

  .shape-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }

  .shape-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 4px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.5);
    transition: all 0.15s ease;
  }

  .shape-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
  }

  .shape-btn.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
    color: #fff;
  }

  .shape-icon { font-size: 16px; }
  .shape-name { font-size: 9px; }

  .anim-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .anim-btn {
    padding: 7px 6px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px;
    cursor: pointer;
    color: rgba(255,255,255,0.5);
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .anim-btn:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
  }

  .anim-btn.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.4);
    color: #fff;
  }

  .letter-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .control-row-label {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    width: 44px;
  }

  .adj-btn {
    padding: 4px 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s ease;
  }

  .adj-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }

  .scale-value {
    font-size: 12px;
    color: rgba(255,255,255,0.6);
    min-width: 32px;
    text-align: center;
  }

  .reset-btn {
    padding: 5px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    font-size: 11px;
    align-self: flex-start;
  }

  .reset-btn:hover {
    color: #fff;
    background: rgba(255,255,255,0.06);
  }

  .preview-btn {
    padding: 8px 14px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: rgba(255,255,255,0.6);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
  }

  .preview-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
  }

  .preview-area {
    background: rgba(0,0,0,0.3);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .preview-hint {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
  }

  .editor-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .cancel-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    font-size: 13px;
  }

  .cancel-btn:hover {
    color: #fff;
    border-color: rgba(255,255,255,0.2);
  }

  .save-btn {
    padding: 8px 20px;
    background: rgba(99, 102, 241, 0.8);
    border: none;
    border-radius: 8px;
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s ease;
  }

  .save-btn:hover {
    background: rgba(99, 102, 241, 1);
  }
</style>
