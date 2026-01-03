<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  import TaskList from '@tiptap/extension-task-list';
  import TaskItem from '@tiptap/extension-task-item';
  import Highlight from '@tiptap/extension-highlight';
  import Typography from '@tiptap/extension-typography';
  import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { Color } from '@tiptap/extension-color';
  import Underline from '@tiptap/extension-underline';
  import Link from '@tiptap/extension-link';
  import Image from '@tiptap/extension-image';
  import Collaboration from '@tiptap/extension-collaboration';
  import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
  import { HocuspocusProvider } from '@hocuspocus/provider';
  import * as Y from 'yjs';
  import { common, createLowlight } from 'lowlight';
  import type { User, Channel } from '../types';
  import { apiUrl } from '../lib/api';

  export let channelId: string;
  export let guildId: string | null = null;
  export let authToken: string = '';
  export let currentUser: User | null = null;

  const dispatch = createEventDispatcher<{
    viewUserProfile: { userId: string; username: string; avatar?: string };
  }>();

  // Hocuspocus configuration (optional - works without collab server)
  const HOCUSPOCUS_URL = import.meta.env.VITE_HOCUSPOCUS_URL || '';

  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  let channel: Channel | null = null;
  let loading = true;
  let provider: HocuspocusProvider | null = null;
  let ydoc: Y.Doc | null = null;
  let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  let collaborators: { clientId: number; user: { name: string; color: string } }[] = [];
  let initialized = false;
  let isCollabEnabled = false;

  // Slash command menu state
  let showSlashMenu = false;
  let slashMenuPosition = { x: 0, y: 0 };
  let slashMenuFilter = '';
  let selectedSlashIndex = 0;

  const lowlight = createLowlight(common);

  // Generate a random color for the user cursor
  function getRandomColor(): string {
    const colors = [
      '#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8',
      '#94FADB', '#B9F18D', '#C3E2C2', '#EAECCC', '#AFC8AD',
      '#EEC759', '#9BB8CD', '#FF6B6B', '#4ECDC4', '#45B7D1',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Slash command items
  const slashCommands = [
    { id: 'heading1', label: 'Heading 1', icon: 'H1', description: 'Large section heading', action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: 'heading2', label: 'Heading 2', icon: 'H2', description: 'Medium section heading', action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: 'heading3', label: 'Heading 3', icon: 'H3', description: 'Small section heading', action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: 'paragraph', label: 'Paragraph', icon: '¶', description: 'Normal text', action: () => editor?.chain().focus().setParagraph().run() },
    { id: 'bulletList', label: 'Bullet List', icon: '•', description: 'Create a bullet list', action: () => editor?.chain().focus().toggleBulletList().run() },
    { id: 'orderedList', label: 'Numbered List', icon: '1.', description: 'Create a numbered list', action: () => editor?.chain().focus().toggleOrderedList().run() },
    { id: 'taskList', label: 'Task List', icon: '☐', description: 'Create a to-do list', action: () => editor?.chain().focus().toggleTaskList().run() },
    { id: 'blockquote', label: 'Quote', icon: '"', description: 'Capture a quote', action: () => editor?.chain().focus().toggleBlockquote().run() },
    { id: 'codeBlock', label: 'Code Block', icon: '</>', description: 'Code with syntax highlighting', action: () => editor?.chain().focus().toggleCodeBlock().run() },
    { id: 'horizontalRule', label: 'Divider', icon: '—', description: 'Visual divider', action: () => editor?.chain().focus().setHorizontalRule().run() },
    { id: 'image', label: 'Image', icon: '🖼', description: 'Insert an image from URL', action: () => insertImage() },
  ];

  $: filteredSlashCommands = slashCommands.filter(cmd => 
    cmd.label.toLowerCase().includes(slashMenuFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(slashMenuFilter.toLowerCase())
  );

  function insertImage() {
    const url = prompt('Enter image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }

  function executeSlashCommand(command: typeof slashCommands[0]) {
    const { from, to } = editor?.state.selection || { from: 0, to: 0 };
    const slashStart = from - slashMenuFilter.length - 1;
    editor?.chain().focus().deleteRange({ from: slashStart, to }).run();
    
    command.action();
    showSlashMenu = false;
    slashMenuFilter = '';
    selectedSlashIndex = 0;
  }

  async function loadChannel() {
    if (!channelId || !authToken) {
      loading = false;
      return;
    }

    try {
      const channelResponse = await fetch(apiUrl(`/api/channels/${channelId}`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      
      if (channelResponse.ok) {
        const data = await channelResponse.json();
        channel = data.channel;
      }
    } catch (err) {
      console.error('Failed to load channel:', err);
    }
  }

  function initializeEditor() {
    console.log('Initializing document editor for channel:', channelId);
    console.log('Tiptap App ID:', TIPTAP_APP_ID);
    console.log('Tiptap Token present:', !!TIPTAP_COLLAB_TOKEN);
    console.log('Tiptap Token value (first 20 chars):', TIPTAP_COLLAB_TOKEN?.substring(0, 20));
    
    if (!editorElement) {
      console.error('Editor element not ready');
      return;
    }
    
    // Check for required config
    if (!TIPTAP_APP_ID || !TIPTAP_COLLAB_TOKEN) {
      console.error('Missing Tiptap Cloud config. Set VITE_TIPTAP_APP_ID and VITE_TIPTAP_COLLAB_TOKEN in .env');
      connectionStatus = 'disconnected';
      loading = false;
      return;
    }
    
    const userColor = getRandomColor();
    const documentName = `channel-${channelId}`;
    
    // Create Yjs document for local state
    const doc = new Y.Doc();
    ydoc = doc;
    
    // Check if Hocuspocus collaboration server is configured
    if (HOCUSPOCUS_URL) {
      connectionStatus = 'connecting';
      isCollabEnabled = true;
      
      console.log('Connecting to Hocuspocus at:', HOCUSPOCUS_URL);
      console.log('Document name:', documentName);
      
      // Initialize Hocuspocus provider for real-time collaboration
      const prov = new HocuspocusProvider({
        url: HOCUSPOCUS_URL,
        name: documentName,
        document: doc,
        token: authToken,
        onConnect: () => {
          console.log('Connected to collaboration server');
          connectionStatus = 'connected';
        },
        onDisconnect: () => {
          console.log('Disconnected from collaboration server');
          connectionStatus = 'disconnected';
        },
        onSynced: () => {
          console.log('Document synced');
          if (!editor) {
            createEditor(userColor, doc, prov);
          }
          loading = false;
        },
        onAwarenessUpdate: ({ states }) => {
          collaborators = Array.from(states.entries())
            .filter(([clientId]) => clientId !== prov?.awareness?.clientID)
            .map(([clientId, state]: [number, any]) => ({
              clientId,
              user: state.user || { name: 'Anonymous', color: '#888' },
            }));
        },
      });
      provider = prov;
    } else {
      // No collaboration server - work locally
      console.log('No collaboration server configured, running in local mode');
      connectionStatus = 'disconnected';
      isCollabEnabled = false;
      createEditor(userColor, doc, null);
      loading = false;
    }
  }

  function createEditor(userColor: string, doc: Y.Doc, prov: HocuspocusProvider | null) {
    if (!editorElement) {
      console.error('Editor element not ready in createEditor');
      return;
    }

    if (!doc) {
      console.error('Yjs document is undefined');
      return;
    }
    
    console.log('Creating editor, collaboration enabled:', !!prov);
    if (prov) {
      console.log('Provider awareness:', !!prov.awareness);
    }

    // Build base extensions
    const extensions: any[] = [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        history: !prov, // Use built-in history if no collab, Yjs handles undo/redo otherwise
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') return 'Heading...';
          return "Type '/' for commands...";
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Typography,
      CodeBlockLowlight.configure({ lowlight }),
      TextStyle,
      Color,
      Underline,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'document-image' },
      }),
    ];

    // Add collaboration extensions only if provider is available
    if (prov) {
      extensions.push(
        // Collaboration uses the Y.Doc
        Collaboration.configure({
          document: doc,
        }),
        // CollaborationCursor with custom rendering for avatars
        CollaborationCursor.configure({
          provider: prov,
          user: {
            name: currentUser?.username || 'Anonymous',
            color: userColor,
            avatar: currentUser?.avatar || null,
          },
          render: (user) => {
            const cursor = document.createElement('span');
            cursor.classList.add('collaboration-cursor');
            cursor.setAttribute('style', `--cursor-color: ${user.color}`);

            // Cursor caret line
            const caret = document.createElement('span');
            caret.classList.add('collaboration-cursor__caret');
            cursor.appendChild(caret);

            // User label container (avatar + name)
            const label = document.createElement('div');
            label.classList.add('collaboration-cursor__label');
            
            // Avatar circle
            const avatar = document.createElement('div');
            avatar.classList.add('collaboration-cursor__avatar');
            if (user.avatar) {
              avatar.style.backgroundImage = `url(${user.avatar})`;
            } else {
              avatar.textContent = (user.name || 'A').charAt(0).toUpperCase();
            }
            label.appendChild(avatar);

            // User name
            const name = document.createElement('span');
            name.classList.add('collaboration-cursor__name');
            name.textContent = user.name || 'Anonymous';
            label.appendChild(name);

            cursor.appendChild(label);
            return cursor;
          },
          selectionRender: (user) => {
            return {
              style: `background-color: ${user.color}20; border-left: 2px solid ${user.color}`,
              class: 'collaboration-cursor-selection',
            };
          },
        })
      );
    }

    try {
      editor = new Editor({
        element: editorElement,
        extensions,
        editorProps: {
          attributes: { class: 'document-content' },
          handleKeyDown: (view, event) => {
            // Guard against early lifecycle calls before view.state is ready
            if (!view?.state) return false;
            
            const { state } = view;
            const { from } = state.selection;
            const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '\n', '\0');
            const lastSlash = textBefore.lastIndexOf('/');
            
            if (lastSlash !== -1 && event.key !== 'Backspace') {
              const textAfterSlash = textBefore.slice(lastSlash + 1);
              if (!/\s/.test(textAfterSlash)) {
                slashMenuFilter = textAfterSlash;
                const coords = view.coordsAtPos(from - textAfterSlash.length - 1);
                slashMenuPosition = { x: coords.left, y: coords.bottom + 5 };
                showSlashMenu = true;
                selectedSlashIndex = 0;
              }
            } else if (event.key === '/') {
              const coords = view.coordsAtPos(from);
              slashMenuPosition = { x: coords.left, y: coords.bottom + 5 };
              showSlashMenu = true;
              slashMenuFilter = '';
              selectedSlashIndex = 0;
            } else if (event.key === 'Backspace' && showSlashMenu) {
              if (slashMenuFilter.length === 0) {
                showSlashMenu = false;
              } else {
                slashMenuFilter = slashMenuFilter.slice(0, -1);
              }
            } else if (event.key === 'Escape' || event.key === ' ') {
              showSlashMenu = false;
              slashMenuFilter = '';
            }
            
            return false;
          },
        },
      });
      console.log('Editor created with Tiptap Cloud collaboration');
    } catch (err) {
      console.error('Failed to create editor:', err);
      connectionStatus = 'disconnected';
      loading = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (showSlashMenu) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedSlashIndex = (selectedSlashIndex + 1) % filteredSlashCommands.length;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedSlashIndex = selectedSlashIndex === 0 ? filteredSlashCommands.length - 1 : selectedSlashIndex - 1;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (filteredSlashCommands[selectedSlashIndex]) {
          executeSlashCommand(filteredSlashCommands[selectedSlashIndex]);
        }
      } else if (event.key === 'Escape') {
        showSlashMenu = false;
        slashMenuFilter = '';
        selectedSlashIndex = 0;
      }
    }
  }

  function cleanup() {
    if (provider) {
      provider.destroy();
      provider = null;
    }
    if (ydoc) {
      ydoc.destroy();
      ydoc = null;
    }
    if (editor) {
      editor.destroy();
      editor = null;
    }
  }

  onMount(async () => {
    await loadChannel();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (editorElement && !initialized) {
      previousChannelId = channelId; // Set before initializing to prevent reactive trigger
      initializeEditor();
      initialized = true;
    }
  });

  onDestroy(() => {
    cleanup();
  });

  // Track previous channelId to detect changes
  let previousChannelId: string | null = null;
  
  // Reinitialize when channel changes (but not on first load)
  // Only run if we've already initialized AND the channel actually changed
  $: if (channelId && editorElement && initialized && previousChannelId !== null && channelId !== previousChannelId) {
    const newChannelId = channelId;
    previousChannelId = newChannelId;
    cleanup();
    initialized = false;
    loadChannel().then(() => {
      initializeEditor();
      initialized = true;
    });
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="document-editor">
  <!-- Header -->
  <header class="editor-header">
    <div class="channel-info">
      <div class="channel-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
      </div>
      <div class="channel-details">
        <h1 class="channel-name">{channel?.name || 'document'}</h1>
        {#if channel?.topic}
          <span class="channel-topic">{channel.topic}</span>
        {/if}
      </div>
    </div>
    
    <div class="editor-status">
      <span class="status" class:connected={connectionStatus === 'connected'} class:connecting={connectionStatus === 'connecting'}>
        {#if connectionStatus === 'connecting'}
          <svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.364-6.364l-2.828 2.828M8.464 15.536l-2.828 2.828m12.728 0l-2.828-2.828M8.464 8.464L5.636 5.636"/>
          </svg>
          connecting...
        {:else if connectionStatus === 'connected'}
          <span class="status-dot"></span>
          live
        {:else}
          <span class="status-dot offline"></span>
          offline
        {/if}
      </span>

      <!-- Collaborators -->
      {#if collaborators.length > 0}
        <div class="collaborators">
          <span class="collaborators-label">{collaborators.length} editing</span>
          <div class="collaborators-avatars">
            {#each collaborators.slice(0, 5) as collab, i}
              <div 
                class="collaborator-avatar" 
                style="background-color: {collab.user.color}; z-index: {5 - i}; border-color: {collab.user.color}"
                title={collab.user.name}
              >
                {#if collab.user.avatar}
                  <img src={collab.user.avatar} alt={collab.user.name} />
                {:else}
                  {(collab.user.name || 'A').charAt(0).toUpperCase()}
                {/if}
              </div>
            {/each}
            {#if collaborators.length > 5}
              <div class="collaborator-more">+{collaborators.length - 5}</div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </header>

  <!-- Toolbar -->
  <div class="editor-toolbar" class:disabled={!editor}>
    <div class="toolbar-group">
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('bold')}
        on:click={() => editor?.chain().focus().toggleBold().run()}
        disabled={!editor}
        title="Bold (Cmd+B)"
      >
        <strong>B</strong>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('italic')}
        on:click={() => editor?.chain().focus().toggleItalic().run()}
        disabled={!editor}
        title="Italic (Cmd+I)"
      >
        <em>I</em>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('underline')}
        on:click={() => editor?.chain().focus().toggleUnderline().run()}
        disabled={!editor}
        title="Underline (Cmd+U)"
      >
        <u>U</u>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('strike')}
        on:click={() => editor?.chain().focus().toggleStrike().run()}
        disabled={!editor}
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('code')}
        on:click={() => editor?.chain().focus().toggleCode().run()}
        disabled={!editor}
        title="Inline Code"
      >
        <code>&lt;/&gt;</code>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('heading', { level: 1 })}
        on:click={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={!editor}
        title="Heading 1"
      >
        H1
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('heading', { level: 2 })}
        on:click={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={!editor}
        title="Heading 2"
      >
        H2
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('heading', { level: 3 })}
        on:click={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={!editor}
        title="Heading 3"
      >
        H3
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('bulletList')}
        on:click={() => editor?.chain().focus().toggleBulletList().run()}
        disabled={!editor}
        title="Bullet List"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="4" cy="6" r="1" fill="currentColor"/>
          <circle cx="4" cy="12" r="1" fill="currentColor"/>
          <circle cx="4" cy="18" r="1" fill="currentColor"/>
        </svg>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('orderedList')}
        on:click={() => editor?.chain().focus().toggleOrderedList().run()}
        disabled={!editor}
        title="Numbered List"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="10" y1="6" x2="21" y2="6"/>
          <line x1="10" y1="12" x2="21" y2="12"/>
          <line x1="10" y1="18" x2="21" y2="18"/>
          <text x="3" y="8" font-size="6" fill="currentColor">1</text>
          <text x="3" y="14" font-size="6" fill="currentColor">2</text>
          <text x="3" y="20" font-size="6" fill="currentColor">3</text>
        </svg>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('taskList')}
        on:click={() => editor?.chain().focus().toggleTaskList().run()}
        disabled={!editor}
        title="Task List"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="5" width="6" height="6" rx="1"/>
          <path d="M12 7h8"/>
          <rect x="3" y="13" width="6" height="6" rx="1"/>
          <path d="M12 15h8"/>
          <path d="M5 8l1.5 1.5L9 6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('blockquote')}
        on:click={() => editor?.chain().focus().toggleBlockquote().run()}
        disabled={!editor}
        title="Quote"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 8c-2.2 0-4 1.8-4 4v6h6v-6H8c0-1.1.9-2 2-2V8zm8 0c-2.2 0-4 1.8-4 4v6h6v-6h-4c0-1.1.9-2 2-2V8z"/>
        </svg>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('codeBlock')}
        on:click={() => editor?.chain().focus().toggleCodeBlock().run()}
        disabled={!editor}
        title="Code Block"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9l-2 3 2 3"/>
          <path d="M15 9l2 3-2 3"/>
        </svg>
      </button>
      <button 
        class="toolbar-btn"
        on:click={() => editor?.chain().focus().setHorizontalRule().run()}
        disabled={!editor}
        title="Divider"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button 
        class="toolbar-btn"
        on:click={insertImage}
        disabled={!editor}
        title="Insert Image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21,15 16,10 5,21"/>
        </svg>
      </button>
      <button 
        class="toolbar-btn" 
        class:active={editor?.isActive('highlight')}
        on:click={() => editor?.chain().focus().toggleHighlight().run()}
        disabled={!editor}
        title="Highlight"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Editor Content -->
  <div class="editor-container">
    {#if loading}
      <div class="loading-state">
        <div class="spinner-large"></div>
        <p>connecting to document...</p>
      </div>
    {/if}
    <div 
      bind:this={editorElement} 
      class="editor-content-wrapper"
      class:hidden={loading}
    ></div>
  </div>

  <!-- Slash Command Menu -->
  {#if showSlashMenu && filteredSlashCommands.length > 0}
    <div 
      class="slash-menu" 
      style="left: {slashMenuPosition.x}px; top: {slashMenuPosition.y}px;"
    >
      <div class="slash-menu-header">commands</div>
      {#each filteredSlashCommands as command, i}
        <button 
          class="slash-menu-item"
          class:selected={i === selectedSlashIndex}
          on:click={() => executeSlashCommand(command)}
          on:mouseenter={() => selectedSlashIndex = i}
        >
          <span class="slash-icon">{command.icon}</span>
          <div class="slash-text">
            <span class="slash-label">{command.label}</span>
            <span class="slash-description">{command.description}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .document-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex: 1;
    background: #fafafa;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }

  /* Header */
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background: #fff;
    border-bottom: 1px solid #e5e5e5;
    min-height: 48px;
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .channel-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
  }

  .channel-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .channel-name {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #1a1a1a;
    text-transform: lowercase;
  }

  .channel-topic {
    font-size: 12px;
    color: #888;
  }

  .editor-status {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #888;
    padding: 4px 10px;
    background: #f5f5f5;
    border-radius: 12px;
  }

  .status.connected {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
  }

  .status.connecting {
    color: #666;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #22c55e;
  }

  .status-dot.offline {
    background: #ef4444;
  }

  .status .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Collaborators */
  .collaborators {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
    border-radius: 20px;
    border: 1px solid #e5e5e5;
  }

  .collaborators-label {
    font-size: 11px;
    font-weight: 500;
    color: #666;
    white-space: nowrap;
  }

  .collaborators-avatars {
    display: flex;
    align-items: center;
  }

  .collaborator-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    margin-left: -8px;
    border: 2px solid #fff;
    cursor: default;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.15s ease, z-index 0.15s ease;
    position: relative;
    text-transform: uppercase;
  }

  .collaborator-avatar:first-child {
    margin-left: 0;
  }

  .collaborator-avatar:hover {
    transform: scale(1.15);
    z-index: 10 !important;
  }

  .collaborator-avatar img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .collaborator-more {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667 0%, #555 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    margin-left: -8px;
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Toolbar */
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 24px;
    background: #fff;
    border-bottom: 1px solid #e5e5e5;
    flex-wrap: wrap;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: #e5e5e5;
    margin: 0 8px;
  }

  .toolbar-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: none;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
  }

  .toolbar-btn:hover:not(:disabled) {
    background: #f0f0f0;
    color: #1a1a1a;
  }

  .toolbar-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .editor-toolbar.disabled {
    opacity: 0.6;
  }

  .toolbar-btn.active {
    background: #1a1a1a;
    color: #fff;
  }

  .toolbar-btn strong {
    font-weight: 700;
  }

  .toolbar-btn em {
    font-style: italic;
  }

  .toolbar-btn u {
    text-decoration: underline;
  }

  .toolbar-btn s {
    text-decoration: line-through;
  }

  .toolbar-btn code {
    font-family: 'Monaco', monospace;
    font-size: 10px;
  }

  /* Editor Container */
  .editor-container {
    flex: 1;
    overflow-y: auto;
    padding: 40px 80px;
    position: relative;
  }

  .editor-content-wrapper {
    max-width: 800px;
    margin: 0 auto;
    min-height: calc(100vh - 200px);
    padding-bottom: 50vh; /* Allow scrolling past end for infinite feel */
  }

  .editor-content-wrapper.hidden {
    visibility: hidden;
  }

  .loading-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #888;
    font-size: 14px;
    background: #fafafa;
  }

  .spinner-large {
    width: 32px;
    height: 32px;
    border: 3px solid #e5e5e5;
    border-top-color: #1a1a1a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Editor Content Styles */
  :global(.document-content) {
    outline: none;
    font-size: 16px;
    line-height: 1.7;
    color: #1a1a1a;
  }

  :global(.document-content > * + *) {
    margin-top: 0.75em;
  }

  :global(.document-content h1) {
    font-size: 2.25em;
    font-weight: 700;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    color: #000;
  }

  :global(.document-content h2) {
    font-size: 1.75em;
    font-weight: 600;
    line-height: 1.35;
    margin-top: 1.25em;
    margin-bottom: 0.5em;
    color: #000;
  }

  :global(.document-content h3) {
    font-size: 1.375em;
    font-weight: 600;
    line-height: 1.4;
    margin-top: 1em;
    margin-bottom: 0.5em;
    color: #000;
  }

  :global(.document-content p) {
    margin: 0;
  }

  :global(.document-content strong) {
    font-weight: 600;
  }

  :global(.document-content em) {
    font-style: italic;
  }

  :global(.document-content u) {
    text-decoration: underline;
  }

  :global(.document-content s) {
    text-decoration: line-through;
    color: #888;
  }

  :global(.document-content code) {
    background: #f0f0f0;
    border-radius: 4px;
    padding: 0.2em 0.4em;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.9em;
    color: #e11d48;
  }

  :global(.document-content pre) {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    margin: 1em 0;
  }

  :global(.document-content pre code) {
    background: none;
    color: #e5e5e5;
    padding: 0;
    font-size: 14px;
  }

  :global(.document-content blockquote) {
    border-left: 3px solid #1a1a1a;
    padding-left: 16px;
    margin-left: 0;
    font-style: italic;
    color: #666;
  }

  :global(.document-content ul),
  :global(.document-content ol) {
    padding-left: 24px;
    margin: 0.5em 0;
  }

  :global(.document-content li) {
    margin: 0.25em 0;
  }

  :global(.document-content ul[data-type="taskList"]) {
    list-style: none;
    padding-left: 0;
  }

  :global(.document-content ul[data-type="taskList"] li) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  :global(.document-content ul[data-type="taskList"] li label) {
    display: flex;
    align-items: center;
    margin-top: 2px;
  }

  :global(.document-content ul[data-type="taskList"] li input[type="checkbox"]) {
    width: 16px;
    height: 16px;
    border: 2px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    accent-color: #1a1a1a;
  }

  :global(.document-content ul[data-type="taskList"] li[data-checked="true"] > div > p) {
    text-decoration: line-through;
    color: #888;
  }

  :global(.document-content hr) {
    border: none;
    border-top: 1px solid #e5e5e5;
    margin: 2em 0;
  }

  :global(.document-content a) {
    color: #1a1a1a;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :global(.document-content a:hover) {
    color: #000;
  }

  :global(.document-content mark) {
    background: #fef08a;
    padding: 0.1em 0.2em;
    border-radius: 2px;
  }

  :global(.document-content .document-image) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 1em 0;
  }

  /* Table styles */
  :global(.document-content table) {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }

  :global(.document-content th),
  :global(.document-content td) {
    border: 1px solid #e5e5e5;
    padding: 8px 12px;
    text-align: left;
  }

  :global(.document-content th) {
    background: #f5f5f5;
    font-weight: 600;
  }

  :global(.document-content tr:hover td) {
    background: #fafafa;
  }

  /* Collaboration cursor styles - Modern design with avatars */
  :global(.collaboration-cursor) {
    position: relative;
    pointer-events: none;
  }

  :global(.collaboration-cursor__caret) {
    position: relative;
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background-color: var(--cursor-color, #000);
    margin-left: -1px;
    margin-right: -1px;
    word-break: normal;
    pointer-events: none;
    animation: cursor-blink 1.2s ease-in-out infinite;
    border-radius: 1px;
    box-shadow: 0 0 8px var(--cursor-color, #000);
  }

  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  :global(.collaboration-cursor__label) {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--cursor-color, #000);
    padding: 4px 10px 4px 4px;
    border-radius: 16px;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.15),
      0 1px 3px rgba(0, 0, 0, 0.1);
    white-space: nowrap;
    user-select: none;
    pointer-events: none;
    z-index: 100;
    animation: cursor-label-fade-in 0.2s ease-out;
  }

  @keyframes cursor-label-fade-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  :global(.collaboration-cursor__avatar) {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.3);
    background-size: cover;
    background-position: center;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    text-transform: uppercase;
    flex-shrink: 0;
    border: 1.5px solid rgba(255, 255, 255, 0.5);
  }

  :global(.collaboration-cursor__name) {
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.02em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* Selection highlight for other users */
  :global(.collaboration-cursor-selection) {
    background-color: var(--cursor-color, rgba(0, 0, 0, 0.1));
    opacity: 0.3;
  }

  /* Placeholder styles */
  :global(.document-content p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #aaa;
    pointer-events: none;
    height: 0;
  }

  :global(.document-content h1.is-empty::before),
  :global(.document-content h2.is-empty::before),
  :global(.document-content h3.is-empty::before) {
    content: attr(data-placeholder);
    float: left;
    color: #aaa;
    pointer-events: none;
    height: 0;
  }

  /* Slash Command Menu */
  .slash-menu {
    position: fixed;
    z-index: 1000;
    min-width: 280px;
    max-width: 320px;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    padding: 8px;
    max-height: 320px;
    overflow-y: auto;
  }

  .slash-menu-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .slash-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s ease;
  }

  .slash-menu-item:hover,
  .slash-menu-item.selected {
    background: #f5f5f5;
  }

  .slash-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: #666;
    flex-shrink: 0;
  }

  .slash-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .slash-label {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
  }

  .slash-description {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Scrollbar */
  .editor-container::-webkit-scrollbar,
  .slash-menu::-webkit-scrollbar {
    width: 6px;
  }

  .editor-container::-webkit-scrollbar-track,
  .slash-menu::-webkit-scrollbar-track {
    background: transparent;
  }

  .editor-container::-webkit-scrollbar-thumb,
  .slash-menu::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 3px;
  }

  .editor-container::-webkit-scrollbar-thumb:hover,
  .slash-menu::-webkit-scrollbar-thumb:hover {
    background: #ccc;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .editor-container {
      padding: 20px 16px;
    }

    .editor-header {
      padding: 12px 16px;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .editor-toolbar {
      padding: 8px 16px;
      overflow-x: auto;
    }

    .toolbar-group {
      flex-shrink: 0;
    }
  }
</style>
