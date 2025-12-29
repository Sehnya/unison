<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { Color } from '@tiptap/extension-color';
  import Image from '@tiptap/extension-image';
  import Underline from '@tiptap/extension-underline';
  import TextAlign from '@tiptap/extension-text-align';
  import Highlight from '@tiptap/extension-highlight';
  import Placeholder from '@tiptap/extension-placeholder';
  import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
  import { common, createLowlight } from 'lowlight';

  export let content: string = '';
  export let editable: boolean = true;
  export let placeholder: string = 'Write something creative...';

  const dispatch = createEventDispatcher<{
    update: { html: string; json: any };
  }>();

  let element: HTMLElement;
  let editor: Editor | null = null;
  let showToolbar = false;
  let showColorPicker = false;
  let currentColor = '#ffffff';
  let colorInput: HTMLInputElement;
  let showImageUpload = false;
  let imageFileInput: HTMLInputElement;

  const lowlight = createLowlight(common);

  const presetColors = [
    '#ffffff', '#f87171', '#fb923c', '#facc15', '#4ade80', 
    '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8'
  ];

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit.configure({
          codeBlock: false,
        }),
        TextStyle,
        Color,
        Underline,
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({ placeholder }),
        CodeBlockLowlight.configure({ lowlight }),
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: {
            class: 'tiptap-image',
          },
        }),
      ],
      content,
      editable,
      onUpdate: ({ editor }) => {
        dispatch('update', {
          html: editor.getHTML(),
          json: editor.getJSON(),
        });
      },
      onFocus: () => {
        if (editable) showToolbar = true;
      },
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  $: if (editor) {
    editor.setEditable(editable);
  }

  function setColor(color: string) {
    currentColor = color;
    editor?.chain().focus().setColor(color).run();
    showColorPicker = false;
  }

  function handleColorInput(e: Event) {
    const target = e.target as HTMLInputElement;
    setColor(target.value);
  }

  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      editor?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    showImageUpload = false;
  }

  function insertImageFromUrl() {
    const url = prompt('Enter image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }
</script>

<div class="tiptap-wrapper" class:editable>
  {#if editable && showToolbar}
    <div class="toolbar">
      <div class="toolbar-group">
        <button
          class:active={editor?.isActive('bold')}
          on:click={() => editor?.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          class:active={editor?.isActive('italic')}
          on:click={() => editor?.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          class:active={editor?.isActive('underline')}
          on:click={() => editor?.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          class:active={editor?.isActive('strike')}
          on:click={() => editor?.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class:active={editor?.isActive('heading', { level: 1 })}
          on:click={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          H1
        </button>
        <button
          class:active={editor?.isActive('heading', { level: 2 })}
          on:click={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          H2
        </button>
        <button
          class:active={editor?.isActive('heading', { level: 3 })}
          on:click={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <div class="color-picker-wrapper">
          <button
            class="color-btn"
            on:click={() => showColorPicker = !showColorPicker}
            title="Text Color"
          >
            <span class="color-preview" style="background: {currentColor}"></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5H7z"/>
            </svg>
          </button>
          {#if showColorPicker}
            <div class="color-dropdown">
              <div class="preset-colors">
                {#each presetColors as color}
                  <button
                    class="color-swatch"
                    style="background: {color}"
                    on:click={() => setColor(color)}
                  ></button>
                {/each}
              </div>
              <div class="custom-color">
                <input
                  type="color"
                  bind:this={colorInput}
                  value={currentColor}
                  on:input={handleColorInput}
                />
                <input
                  type="text"
                  value={currentColor}
                  on:change={(e) => setColor(e.currentTarget.value)}
                  placeholder="#ffffff"
                  class="hex-input"
                />
              </div>
            </div>
          {/if}
        </div>

        <button
          class:active={editor?.isActive('highlight')}
          on:click={() => editor?.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          title="Highlight"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          on:click={() => editor?.chain().focus().setTextAlign('left').run()}
          class:active={editor?.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <button
          on:click={() => editor?.chain().focus().setTextAlign('center').run()}
          class:active={editor?.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <button
          on:click={() => editor?.chain().focus().setTextAlign('right').run()}
          class:active={editor?.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class:active={editor?.isActive('bulletList')}
          on:click={() => editor?.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button
          class:active={editor?.isActive('orderedList')}
          on:click={() => editor?.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
            <text x="3" y="8" font-size="8" fill="currentColor">1</text>
            <text x="3" y="14" font-size="8" fill="currentColor">2</text>
            <text x="3" y="20" font-size="8" fill="currentColor">3</text>
          </svg>
        </button>
        <button
          class:active={editor?.isActive('blockquote')}
          on:click={() => editor?.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          class:active={editor?.isActive('codeBlock')}
          on:click={() => editor?.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>
          </svg>
        </button>
        <button
          class:active={editor?.isActive('code')}
          on:click={() => editor?.chain().focus().toggleCode().run()}
          title="Inline Code"
        >
          <code>&lt;/&gt;</code>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <div class="image-upload-wrapper">
          <button on:click={() => showImageUpload = !showImageUpload} title="Insert Image/GIF">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </button>
          {#if showImageUpload}
            <div class="image-dropdown">
              <button on:click={() => imageFileInput?.click()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                Upload File
              </button>
              <button on:click={insertImageFromUrl}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
                From URL
              </button>
            </div>
          {/if}
        </div>
        <input
          type="file"
          bind:this={imageFileInput}
          on:change={handleImageUpload}
          accept="image/*"
          class="hidden"
        />
      </div>

      <button class="close-toolbar" on:click={() => showToolbar = false}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/if}

  <div class="editor-content" bind:this={element}></div>

  {#if editable && !showToolbar}
    <button class="show-toolbar-btn" on:click={() => showToolbar = true}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    </button>
  {/if}
</div>


<style>
  .tiptap-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background: rgba(20, 20, 20, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    margin-bottom: 8px;
    position: relative;
    z-index: 100;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 4px;
  }

  .toolbar button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 4px 6px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toolbar button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .toolbar button.active {
    background: rgba(49, 130, 206, 0.3);
    color: #63b3ed;
  }

  .close-toolbar {
    margin-left: auto;
  }

  /* Color Picker */
  .color-picker-wrapper, .image-upload-wrapper {
    position: relative;
  }

  .color-btn {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .color-preview {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .color-dropdown, .image-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: rgba(25, 25, 25, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 10px;
    z-index: 200;
    min-width: 180px;
  }

  .preset-colors {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-bottom: 10px;
  }

  .color-swatch {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s ease;
  }

  .color-swatch:hover {
    transform: scale(1.15);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .custom-color {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .custom-color input[type="color"] {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
  }

  .hex-input {
    flex: 1;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    font-family: monospace;
  }

  .image-dropdown button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    cursor: pointer;
    text-align: left;
  }

  .image-dropdown button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .hidden {
    display: none;
  }

  .show-toolbar-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .tiptap-wrapper.editable:hover .show-toolbar-btn {
    opacity: 1;
  }

  .show-toolbar-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  /* Editor Content */
  .editor-content {
    height: 100%;
    overflow-y: auto;
  }

  .editor-content :global(.tiptap) {
    outline: none;
    min-height: 100px;
    color: #fff;
    font-size: 14px;
    line-height: 1.6;
  }

  .editor-content :global(.tiptap p) {
    margin: 0 0 0.5em 0;
  }

  .editor-content :global(.tiptap h1) {
    font-size: 2em;
    font-weight: 800;
    margin: 0 0 0.5em 0;
    line-height: 1.1;
  }

  .editor-content :global(.tiptap h2) {
    font-size: 1.5em;
    font-weight: 700;
    margin: 0 0 0.5em 0;
  }

  .editor-content :global(.tiptap h3) {
    font-size: 1.25em;
    font-weight: 600;
    margin: 0 0 0.5em 0;
  }

  .editor-content :global(.tiptap blockquote) {
    border-left: 3px solid #3182ce;
    padding-left: 1em;
    margin: 1em 0;
    color: rgba(255, 255, 255, 0.7);
    font-style: italic;
  }

  .editor-content :global(.tiptap code) {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', monospace;
    font-size: 0.9em;
  }

  .editor-content :global(.tiptap pre) {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    margin: 1em 0;
  }

  .editor-content :global(.tiptap pre code) {
    background: none;
    padding: 0;
    font-size: 13px;
  }

  .editor-content :global(.tiptap ul),
  .editor-content :global(.tiptap ol) {
    padding-left: 1.5em;
    margin: 0.5em 0;
  }

  .editor-content :global(.tiptap li) {
    margin: 0.25em 0;
  }

  .editor-content :global(.tiptap mark) {
    background: #fef08a;
    color: #000;
    padding: 1px 3px;
    border-radius: 2px;
  }

  .editor-content :global(.tiptap-image) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 0.5em 0;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .editor-content :global(.tiptap-image:hover) {
    transform: scale(1.02);
  }

  .editor-content :global(.tiptap-image.ProseMirror-selectednode) {
    outline: 2px solid #3182ce;
    outline-offset: 2px;
  }

  .editor-content :global(.tiptap p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.3);
    pointer-events: none;
    float: left;
    height: 0;
  }

  /* Syntax highlighting */
  .editor-content :global(.hljs-keyword) { color: #c678dd; }
  .editor-content :global(.hljs-string) { color: #98c379; }
  .editor-content :global(.hljs-number) { color: #d19a66; }
  .editor-content :global(.hljs-function) { color: #61afef; }
  .editor-content :global(.hljs-comment) { color: #5c6370; font-style: italic; }
  .editor-content :global(.hljs-variable) { color: #e06c75; }
  .editor-content :global(.hljs-attr) { color: #d19a66; }
  .editor-content :global(.hljs-tag) { color: #e06c75; }
</style>
