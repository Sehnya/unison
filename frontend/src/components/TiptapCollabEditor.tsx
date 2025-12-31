import React, { useEffect, useState, useRef, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

// User colors for collaboration cursors
const colors = [
  '#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8',
  '#94FADB', '#B9F18D', '#C3E2C2', '#EAECCC', '#AFC8AD',
  '#EEC759', '#9BB8CD', '#FF90BC', '#FFC0D9', '#DC8686',
];

const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

interface TiptapCollabEditorProps {
  channelId: string;
  channelName: string;
  userName: string;
  appId?: string;
}

// Inner editor component that only renders when provider is ready
const EditorWithProvider: React.FC<{
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  channelName: string;
  userName: string;
  status: string;
}> = ({ ydoc, provider, channelName, userName, status }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  
  const currentUser = useMemo(() => ({
    name: userName || 'Anonymous',
    color: getRandomColor(),
  }), [userName]);

  // Wait for document to sync before creating editor
  useEffect(() => {
    if (!provider || !ydoc) {
      console.warn('[EditorWithProvider] Missing provider or ydoc:', {
        hasProvider: !!provider,
        hasYdoc: !!ydoc,
        providerStatus: provider?.status,
        providerIsSynced: provider?.isSynced,
      });
      return;
    }

    console.log('[EditorWithProvider] Setting up sync listeners:', {
      providerStatus: provider.status,
      isSynced: provider.isSynced,
      hasYdoc: !!ydoc,
    });

    const handleSync = (isSyncedValue: boolean) => {
      console.log('[EditorWithProvider] Document sync event:', {
        isSynced: isSyncedValue,
        providerStatus: provider.status,
        providerIsSynced: provider.isSynced,
      });
      if (isSyncedValue && provider.status === 'connected') {
        console.log('[EditorWithProvider] Document is synced, enabling editor');
        setIsSynced(true);
      }
    };

    const handleConnect = () => {
      console.log('[EditorWithProvider] Provider connected, checking sync status');
      // Wait a bit for initial sync
      setTimeout(() => {
        const isActuallySynced = provider.isSynced;
        console.log('[EditorWithProvider] Post-connect sync check:', {
          isSynced: isActuallySynced,
          providerStatus: provider.status,
        });
        if (isActuallySynced && provider.status === 'connected') {
          setIsSynced(true);
        }
      }, 200);
    };

    // Check if already synced
    if (provider.isSynced && provider.status === 'connected') {
      console.log('[EditorWithProvider] Already synced, enabling editor immediately');
      setIsSynced(true);
    } else {
      console.log('[EditorWithProvider] Not yet synced, waiting for sync event');
    }

    provider.on('synced', handleSync);
    provider.on('connect', handleConnect);
    
    // Fallback: set synced after a delay if provider is connected
    const timeout = setTimeout(() => {
      if (provider.status === 'connected') {
        console.warn('[EditorWithProvider] Fallback timeout: forcing sync state', {
          providerStatus: provider.status,
          providerIsSynced: provider.isSynced,
        });
        setIsSynced(true);
      } else {
        console.warn('[EditorWithProvider] Fallback timeout: provider not connected', {
          providerStatus: provider.status,
        });
      }
    }, 1500);

    return () => {
      console.log('[EditorWithProvider] Cleaning up sync listeners');
      clearTimeout(timeout);
      provider.off('synced', handleSync);
      provider.off('connect', handleConnect);
    };
  }, [provider, ydoc]);

  // Stabilize currentUser to prevent unnecessary re-renders
  const stableCurrentUser = useMemo(() => currentUser, [currentUser.name, currentUser.color]);

  // Build extensions array - conditionally include CollaborationCursor
  // Use ref to track if we've already built extensions to prevent loops
  const extensionsRef = useRef<any[] | null>(null);
  const lastSyncStateRef = useRef<{ isSynced: boolean; providerStatus: string | undefined } | null>(null);

  const extensions = useMemo(() => {
    const currentSyncState = {
      isSynced,
      providerStatus: provider?.status,
    };

    // Only rebuild if sync state actually changed
    if (
      extensionsRef.current &&
      lastSyncStateRef.current &&
      lastSyncStateRef.current.isSynced === currentSyncState.isSynced &&
      lastSyncStateRef.current.providerStatus === currentSyncState.providerStatus
    ) {
      console.log('[EditorWithProvider] Extensions unchanged, reusing previous array');
      return extensionsRef.current;
    }

    console.log('[EditorWithProvider] Building extensions array:', {
      isSynced,
      hasProvider: !!provider,
      providerStatus: provider?.status,
      hasYdoc: !!ydoc,
      userName: stableCurrentUser.name,
    });

    try {
      // StarterKit without History extension (Collaboration has its own history)
      const starterKitWithoutHistory = StarterKit.configure({
        history: false, // Disable history since Collaboration provides its own
      });

      const baseExtensions = [
        starterKitWithoutHistory,
        Highlight,
        TaskList,
        TaskItem.configure({ nested: true }),
        CharacterCount.configure({ limit: 50000 }),
        Placeholder.configure({ placeholder: 'Start writing your document...' }),
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({ openOnClick: false }),
        Image,
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Collaboration.configure({ document: ydoc }),
      ];

      // Only add CollaborationCursor if provider is ready and synced
      if (isSynced && provider && provider.status === 'connected') {
        console.log('[EditorWithProvider] Adding CollaborationCursor extension');
        try {
          baseExtensions.push(
            CollaborationCursor.configure({
              provider,
              user: stableCurrentUser,
            })
          );
          console.log('[EditorWithProvider] CollaborationCursor extension added successfully');
        } catch (error) {
          console.error('[EditorWithProvider] Failed to configure CollaborationCursor:', {
            error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            providerStatus: provider.status,
            isSynced,
          });
          // Continue without cursor extension rather than failing completely
        }
      } else {
        console.log('[EditorWithProvider] Skipping CollaborationCursor:', {
          isSynced,
          hasProvider: !!provider,
          providerStatus: provider?.status,
        });
      }

      console.log('[EditorWithProvider] Extensions array built:', {
        totalExtensions: baseExtensions.length,
        hasCollaborationCursor: baseExtensions.some(ext => 
          ext.name === 'collaborationCursor' || 
          (ext as any).constructor?.name === 'CollaborationCursor'
        ),
      });

      // Cache the extensions and sync state
      extensionsRef.current = baseExtensions;
      lastSyncStateRef.current = currentSyncState;

      return baseExtensions;
    } catch (error) {
      console.error('[EditorWithProvider] Error building extensions:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }, [ydoc, isSynced, provider?.status, stableCurrentUser]);

  // Only create editor when synced - use stable key based on sync state only
  // Don't include extensions in dependencies to prevent recreation loops
  const editorKey = isSynced ? 'synced' : 'not-synced';
  const editor = useEditor({
    extensions,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none',
      },
    },
    onCreate: ({ editor }) => {
      console.log('[EditorWithProvider] Editor created successfully:', {
        hasEditor: !!editor,
        extensionsCount: editor.extensionManager.extensions.length,
        extensionNames: editor.extensionManager.extensions.map(ext => ext.name),
      });
    },
    onUpdate: () => {
      // Silent update logging - only log if there's an issue
    },
    onDestroy: () => {
      console.log('[EditorWithProvider] Editor destroyed');
    },
    onError: ({ editor, error }) => {
      console.error('[EditorWithProvider] Editor error:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        hasEditor: !!editor,
      });
    },
  }, [editorKey]); // Only depend on sync state, not extensions array

  // Get online users
  const users = useMemo(() => {
    if (!editor?.storage) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = editor.storage as any;
    return storage?.collaborationCursor?.users || [];
  }, [editor?.storage]);

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    title, 
    children 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    title: string; 
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`toolbar-btn ${isActive ? 'active' : ''}`}
      title={title}
    >
      {children}
    </button>
  );


  if (!isSynced || !editor) {
    const debugInfo = {
      isSynced,
      hasEditor: !!editor,
      hasProvider: !!provider,
      providerStatus: provider?.status,
      providerIsSynced: provider?.isSynced,
      hasYdoc: !!ydoc,
    };
    console.log('[EditorWithProvider] Waiting for editor to be ready:', debugInfo);
    
    return (
      <div className="collab-editor loading">
        <div className="spinner" />
        <p>Syncing document...</p>
        <p className="status-hint">{status}</p>
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
            <summary>Debug Info</summary>
            <pre style={{ textAlign: 'left', marginTop: '5px' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="collab-editor">
      <div className="editor-layout">
        <div className="editor-section">
          <header className="editor-header">
            <div className="header-left">
              <svg className="doc-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <h2 className="channel-name">{channelName}</h2>
              <div className={`connection-status ${status}`}>
                <span className="status-dot" />
                <span className="status-text">
                  {status === 'connected' ? `${(users?.length || 0) + 1} online` : status === 'connecting' ? 'Connecting...' : 'Offline'}
                </span>
              </div>
            </div>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {(users?.length || 0) > 0 && <span className="user-badge">{users?.length}</span>}
            </button>
          </header>

          <div className="toolbar">
            <div className="toolbar-group">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strike">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
              </ToolbarButton>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="H1">H1</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="H3">H3</ToolbarButton>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Task List">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/></svg>
              </ToolbarButton>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Highlight">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.24 2c.41 0 .82.16 1.12.46l3.18 3.18c.62.62.62 1.62 0 2.24l-9.9 9.9-5.66 1.42 1.42-5.66 9.9-9.9c.3-.3.71-.46 1.12-.46zm-1.41 4.24l-8.49 8.49-.71 2.83 2.83-.71 8.49-8.49-2.12-2.12z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 11h16v2H4z"/></svg>
              </ToolbarButton>
            </div>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
              </ToolbarButton>
            </div>
          </div>

          <div className="editor-wrapper">
            <EditorContent editor={editor} className="editor-content" />
          </div>

          <footer className="editor-footer">
            <span className="word-count">
              {editor.storage.characterCount?.words?.() ?? 0} words · {editor.storage.characterCount?.characters?.() ?? 0} characters
            </span>
          </footer>
        </div>

        {sidebarOpen && (
          <aside className="users-sidebar">
            <div className="sidebar-header">
              <h3>Collaborators</h3>
              <span className="online-count">{(users?.length || 0) + 1} online</span>
            </div>
            <div className="users-list">
              <div className="user-item current">
                <div className="user-avatar" style={{ backgroundColor: currentUser.color }}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <span className="user-name">{currentUser.name}</span>
                  <span className="user-status">You</span>
                </div>
                <div className="user-indicator" style={{ backgroundColor: currentUser.color }} />
              </div>
              {users?.map((user: { name?: string; color?: string }, index: number) => (
                <div key={index} className="user-item">
                  <div className="user-avatar" style={{ backgroundColor: user.color || '#888' }}>
                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{user.name || 'Anonymous'}</span>
                    <span className="user-status">Editing</span>
                  </div>
                  <div className="user-indicator" style={{ backgroundColor: user.color || '#888' }} />
                </div>
              ))}
              {(!users || users.length === 0) && (
                <div className="no-users">
                  <p>No other collaborators</p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

// Main component that handles provider lifecycle
const TiptapCollabEditor: React.FC<TiptapCollabEditorProps> = ({
  channelId,
  channelName,
  userName,
  appId = 'e97rj4qm',
}) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isReady, setIsReady] = useState(false);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  // Create stable ydoc
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }

  useEffect(() => {
    const ydoc = ydocRef.current!;
    const documentName = `document-${channelId}`;
    const wsUrl = `wss://${appId}.collab.tiptap.cloud`;
    
    console.log('[TiptapCollabEditor] Initializing provider:', {
      channelId,
      documentName,
      wsUrl,
      appId,
      hasYdoc: !!ydoc,
    });
    
    let errorOccurred = false;
    
    try {
      const newProvider = new HocuspocusProvider({
        url: wsUrl,
        name: documentName,
        document: ydoc,
      });

      const handleStatus = (event: { status: string }) => {
        console.log('[TiptapCollabEditor] Provider status changed:', {
          status: event.status,
          channelId,
          documentName,
        });
        setStatus(event.status as 'connecting' | 'connected' | 'disconnected');
      };

      const handleConnect = () => {
        console.log('[TiptapCollabEditor] Provider connected:', {
          channelId,
          documentName,
          isSynced: newProvider.isSynced,
        });
        setProvider(newProvider);
        setIsReady(true);
      };

      const handleSync = (isSynced: boolean) => {
        console.log('[TiptapCollabEditor] Document sync status:', {
          isSynced,
          channelId,
          documentName,
          providerStatus: newProvider.status,
        });
        if (isSynced) {
          setProvider(newProvider);
          setIsReady(true);
        }
      };

      const handleDisconnect = (event: any) => {
        console.warn('[TiptapCollabEditor] Provider disconnected:', {
          channelId,
          documentName,
          reason: event?.reason,
          event,
        });
        setStatus('disconnected');
      };

      const handleError = (event: any) => {
        errorOccurred = true;
        console.error('[TiptapCollabEditor] Provider error:', {
          channelId,
          documentName,
          error: event,
          message: event?.message,
          stack: event?.stack,
        });
        setStatus('disconnected');
      };

      newProvider.on('status', handleStatus);
      newProvider.on('connect', handleConnect);
      newProvider.on('synced', handleSync);
      newProvider.on('disconnect', handleDisconnect);
      newProvider.on('connectionError', handleError);
      newProvider.on('connectionLost', handleError);

      // Fallback timeout with detailed logging
      const timeout = setTimeout(() => {
        if (!isReady && !errorOccurred) {
          console.warn('[TiptapCollabEditor] Timeout reached - forcing ready state:', {
            channelId,
            documentName,
            providerStatus: newProvider.status,
            isSynced: newProvider.isSynced,
            hasProvider: !!newProvider,
          });
          setProvider(newProvider);
          setIsReady(true);
        }
      }, 2000);

      return () => {
        console.log('[TiptapCollabEditor] Cleaning up provider:', { channelId, documentName });
        initializingRef.current = false;
        clearTimeout(timeout);
        try {
          newProvider.destroy();
        } catch (e) {
          console.error('[TiptapCollabEditor] Error destroying provider:', e);
        }
        setProvider(null);
        setIsReady(false);
      };
    } catch (error) {
      errorOccurred = true;
      initializingRef.current = false;
      console.error('[TiptapCollabEditor] Failed to create provider:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        channelId,
        documentName,
        wsUrl,
        appId,
      });
      setStatus('disconnected');
    }
  }, [channelId, appId]); // Remove isReady from dependencies to prevent loops

  if (!isReady || !provider || !ydocRef.current) {
    const debugInfo = {
      isReady,
      hasProvider: !!provider,
      hasYdoc: !!ydocRef.current,
      status,
      channelId,
      appId,
      wsUrl: `wss://${appId}.collab.tiptap.cloud`,
      documentName: `document-${channelId}`,
    };
    console.log('[TiptapCollabEditor] Waiting for provider to be ready:', debugInfo);
    
    return (
      <div className="collab-editor loading">
        <div className="spinner" />
        <p>Connecting to document...</p>
        <p className="status-hint">{status}</p>
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '10px', fontSize: '12px', color: '#888' }}>
            <summary>Debug Info</summary>
            <pre style={{ textAlign: 'left', marginTop: '5px' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  return (
    <EditorWithProvider
      ydoc={ydocRef.current}
      provider={provider}
      channelName={channelName}
      userName={userName}
      status={status}
    />
  );
};

export default TiptapCollabEditor;
