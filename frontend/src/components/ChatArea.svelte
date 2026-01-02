<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { User, Channel } from '../types';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';
  import EmojiPicker from './EmojiPicker.svelte';
  import MiniProfileTrigger from './MiniProfileTrigger.svelte';
  import { 
    initAbly, 
    initAblyWithUser,
    subscribeToChannel, 
    unsubscribeFromChannel,
    publishTyping,
    subscribeToTyping,
    enterPresence,
    leavePresence,
    getAblyClient,
    type ChatMessage,
    type TypingIndicator,
    type MessageReaction
  } from '../lib/ably';

  export let channelId: string = 'general';
  export let guildId: string | null = null;
  export let authToken: string = '';
  export let currentUser: User | null = null;
  export let channelSettingsVersion: number = 0; // Triggers reload when settings change

  const dispatch = createEventDispatcher<{
    openGroupInfo: void;
    viewUserProfile: { userId: string; username: string; avatar?: string };
  }>();

  let messages: ChatMessage[] = [];
  let messageContent = '';
  let loading = true;
  let typingUsers: string[] = [];
  let messagesContainer: HTMLElement;
  let typingTimeout: ReturnType<typeof setTimeout> | null = null;
  let isTyping = false;
  let ablyChannel: ReturnType<typeof subscribeToChannel> = null;
  let channel: Channel | null = null;
  let channelLoading = true;

  // Channel custom settings (background, text color)
  let channelSettings: { background_url?: string | null; text_color?: string } = {};
  
  // Load channel settings from localStorage
  function loadChannelSettings(chId: string) {
    try {
      const stored = localStorage.getItem(`channel_settings_${chId}`);
      if (stored) {
        const settings = JSON.parse(stored);
        // Only use URL if it's a valid http(s) URL, not a data URL
        const bgUrl = settings.background_url || '';
        if (bgUrl.startsWith('http://') || bgUrl.startsWith('https://')) {
          channelSettings = {
            background_url: bgUrl,
            text_color: settings.text_color || '#ffffff'
          };
        } else {
          channelSettings = { text_color: settings.text_color || '#ffffff' };
        }
      } else {
        channelSettings = {};
      }
    } catch {
      channelSettings = {};
    }
  }
  
  // Reactive: load settings when channelId or channelSettingsVersion changes
  $: if (channelId || channelSettingsVersion) {
    loadChannelSettings(channelId);
  }

  // Giphy picker state
  let showGifPicker = false;
  let gifSearchQuery = '';
  let gifResults: any[] = [];
  let gifLoading = false;
  let gifSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public beta key

  // Emoji picker state
  let showEmojiPicker = false;
  
  // Guild emojis cache for rendering in messages
  let guildEmojis: Map<string, string> = new Map(); // name -> url

  // Image upload state
  let fileInput: HTMLInputElement;
  let pendingImage: string | null = null;
  let pendingImageName: string = '';
  let imageUploading = false;

  // Unread messages tracking
  let lastReadMessageId: string | null = null;
  let firstUnreadIndex: number = -1;
  let hasUnreadMessages = false;
  let showNewMessagesBanner = false;
  let unreadCount = 0;

  // Edit/Delete message state
  let editingMessageId: string | null = null;
  let editingContent: string = '';
  let hoveredMessageId: string | null = null;
  let showMessageMenu: string | null = null;

  // Reaction picker state
  let showReactionPicker: string | null = null; // message ID or null

  // Get last read message ID from localStorage
  function getLastReadMessageId(chId: string): string | null {
    try {
      const stored = localStorage.getItem(`lastRead_${chId}`);
      return stored;
    } catch {
      return null;
    }
  }

  // Save last read message ID to localStorage
  function saveLastReadMessageId(chId: string, messageId: string) {
    try {
      localStorage.setItem(`lastRead_${chId}`, messageId);
    } catch {
      // Ignore storage errors
    }
  }

  // Mark all messages as read
  function markAllAsRead() {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      saveLastReadMessageId(channelId, lastMessage.id);
      lastReadMessageId = lastMessage.id;
      hasUnreadMessages = false;
      showNewMessagesBanner = false;
      firstUnreadIndex = -1;
      unreadCount = 0;
    }
  }

  // Ping sound for new messages
  let pingSound: HTMLAudioElement | null = null;
  
  function playPingSound() {
    try {
      if (!pingSound) {
        pingSound = new Audio('/sounds/ping.wav');
        pingSound.volume = 0.5;
      }
      // Reset and play
      pingSound.currentTime = 0;
      pingSound.play().catch(() => {
        // Ignore autoplay errors (browser may block until user interaction)
      });
    } catch {
      // Ignore audio errors
    }
  }

  // Giphy search functions
  async function searchGifs(query: string) {
    if (!query.trim()) {
      // Load trending GIFs when no query
      await loadTrendingGifs();
      return;
    }
    
    gifLoading = true;
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      gifResults = data.data || [];
    } catch (error) {
      console.error('Failed to search GIFs:', error);
      gifResults = [];
    } finally {
      gifLoading = false;
    }
  }

  async function loadTrendingGifs() {
    gifLoading = true;
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      gifResults = data.data || [];
    } catch (error) {
      console.error('Failed to load trending GIFs:', error);
      gifResults = [];
    } finally {
      gifLoading = false;
    }
  }

  function handleGifSearch(e: Event) {
    const query = (e.target as HTMLInputElement).value;
    gifSearchQuery = query;
    
    // Debounce search
    if (gifSearchTimeout) clearTimeout(gifSearchTimeout);
    gifSearchTimeout = setTimeout(() => {
      searchGifs(query);
    }, 300);
  }

  function toggleGifPicker() {
    showGifPicker = !showGifPicker;
    showEmojiPicker = false; // Close emoji picker when opening GIF picker
    if (showGifPicker && gifResults.length === 0) {
      loadTrendingGifs();
    }
  }

  async function selectGif(gif: any) {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
    if (!gifUrl) return;
    
    showGifPicker = false;
    gifSearchQuery = '';
    
    // Send the GIF as a message with the URL embedded
    const content = gifUrl;
    
    // Optimistically add message to UI
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      authorId: visitorId,
      authorName: userName,
      authorAvatar: currentUser?.avatar,
      authorFont: currentUser?.username_font,
      content,
      timestamp: Date.now(),
      channelId,
    };
    messages = [...messages, tempMessage];
    scrollToBottom();

    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to send GIF');
      }

      const responseData = await response.json();
      const savedMessage = responseData.message || responseData;
      
      // Replace temp message with saved message
      messages = messages.map(msg => 
        msg.id === tempMessage.id 
          ? {
              id: savedMessage.id || tempMessage.id,
              authorId: savedMessage.author_id || visitorId,
              authorName: savedMessage.author_name || userName,
              authorAvatar: savedMessage.author_avatar || currentUser?.avatar,
              authorFont: savedMessage.author_font || currentUser?.username_font,
              content: savedMessage.content || content,
              timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
              channelId,
            }
          : msg
      );

      // Publish to Ably - send notification only, clients will fetch from API
      const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
      if (ablyChannel) {
        await ablyChannel.publish('message', {
          id: savedMessage.id,
          authorId: savedMessage.author_id || visitorId,
          authorName: savedMessage.author_name || userName,
          timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
          channelId,
          large: true, // Flag to indicate clients should fetch from API
        });
      }
    } catch (error) {
      console.error('Failed to send GIF:', error);
      messages = messages.filter(msg => msg.id !== tempMessage.id);
      alert('Failed to send GIF. Please try again.');
    }
  }

  // Emoji picker functions
  function toggleEmojiPicker() {
    showEmojiPicker = !showEmojiPicker;
    showGifPicker = false; // Close GIF picker when opening emoji picker
  }

  function handleEmojiSelect(event: CustomEvent<{ emoji: string; isCustom: boolean; url?: string }>) {
    const { emoji, isCustom, url } = event.detail;
    
    if (isCustom && url) {
      // Store custom emoji URL for rendering
      const emojiName = emoji.replace(/:/g, '');
      guildEmojis.set(emojiName, url);
    }
    
    // Insert emoji at cursor position or append to message
    messageContent += emoji;
    showEmojiPicker = false;
  }

  // Load guild emojis for rendering in messages
  async function loadGuildEmojis() {
    if (!guildId || !authToken) return;
    
    try {
      const response = await fetch(apiUrl(`/api/guilds/${guildId}/emojis`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        const emojis = data.emojis || [];
        guildEmojis = new Map(emojis.map((e: { name: string; image_url: string }) => [e.name, e.image_url]));
      }
    } catch (error) {
      console.error('Failed to load guild emojis:', error);
    }
  }

  // Load guild emojis when guildId changes
  $: if (guildId && authToken) {
    loadGuildEmojis();
  }

  // Reaction functions
  async function addReaction(messageId: string, emoji: string, emojiUrl?: string) {
    if (!authToken) return;
    
    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji_url: emojiUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        updateMessageReaction(messageId, data.reaction);
        
        // Broadcast reaction via Ably
        const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
        if (ablyChannel) {
          await ablyChannel.publish('reaction.added', {
            messageId,
            reaction: data.reaction,
          });
        }
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
    
    showReactionPicker = null;
  }

  async function removeReaction(messageId: string, emoji: string) {
    if (!authToken) return;
    
    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.reaction) {
          updateMessageReaction(messageId, data.reaction);
        } else {
          // Remove reaction entirely if count is 0
          removeMessageReaction(messageId, emoji);
        }
        
        // Broadcast reaction removal via Ably
        const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
        if (ablyChannel) {
          await ablyChannel.publish('reaction.removed', {
            messageId,
            emoji,
            reaction: data.reaction,
          });
        }
      }
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  }

  function updateMessageReaction(messageId: string, reaction: MessageReaction) {
    messages = messages.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const reactions = msg.reactions || [];
      const existingIdx = reactions.findIndex(r => r.emoji === reaction.emoji);
      
      if (existingIdx >= 0) {
        reactions[existingIdx] = reaction;
      } else {
        reactions.push(reaction);
      }
      
      return { ...msg, reactions: [...reactions] };
    });
  }

  function removeMessageReaction(messageId: string, emoji: string) {
    messages = messages.map(msg => {
      if (msg.id !== messageId) return msg;
      
      const reactions = (msg.reactions || []).filter(r => r.emoji !== emoji);
      return { ...msg, reactions };
    });
  }

  function toggleReaction(messageId: string, emoji: string, emojiUrl?: string, currentlyReacted?: boolean) {
    if (currentlyReacted) {
      removeReaction(messageId, emoji);
    } else {
      addReaction(messageId, emoji, emojiUrl);
    }
  }

  function handleReactionSelect(messageId: string, event: CustomEvent<{ emoji: string; isCustom: boolean; url?: string }>) {
    const { emoji, url } = event.detail;
    addReaction(messageId, emoji, url);
  }

  // Load reactions for multiple messages
  async function loadMessageReactions(messageIds: string[]) {
    if (!authToken || messageIds.length === 0) return;
    
    // Load reactions for each message in parallel
    const results = await Promise.allSettled(
      messageIds.map(async (messageId) => {
        const response = await fetch(apiUrl(`/api/channels/${channelId}/messages/${messageId}/reactions`), {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          return { messageId, reactions: data.reactions || [] };
        }
        return { messageId, reactions: [] };
      })
    );
    
    // Update messages with their reactions
    const reactionMap = new Map<string, MessageReaction[]>();
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        reactionMap.set(result.value.messageId, result.value.reactions);
      }
    });
    
    messages = messages.map(msg => ({
      ...msg,
      reactions: reactionMap.get(msg.id) || msg.reactions || [],
    }));
  }

  // Check if content is a GIF URL or image
  function isImageContent(content: string): boolean {
    // Check for base64 images
    if (content.startsWith('data:image/')) return true;
    // Check for GIF URLs
    return content.match(/\.(gif|webp|png|jpg|jpeg)(\?.*)?$/i) !== null || 
           content.includes('giphy.com') || 
           content.includes('tenor.com');
  }

  // Social media embed types
  type EmbedType = 'youtube' | 'instagram' | 'twitter' | null;

  // Instagram uses official embed iframe - no metadata fetching needed
  // The iframe handles video playback natively

  // Check if content contains a social media link

  // Check if content contains a social media link
  function getSocialEmbed(content: string): { type: EmbedType; embedId: string; originalUrl: string } | null {
    // YouTube patterns
    const youtubePatterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of youtubePatterns) {
      const match = content.match(pattern);
      if (match) {
        return { type: 'youtube', embedId: match[1], originalUrl: match[0] };
      }
    }

    // Instagram patterns
    const instagramPatterns = [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of instagramPatterns) {
      const match = content.match(pattern);
      if (match) {
        return { type: 'instagram', embedId: match[1], originalUrl: match[0] };
      }
    }

    // Twitter/X patterns
    const twitterPatterns = [
      /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    ];
    
    for (const pattern of twitterPatterns) {
      const match = content.match(pattern);
      if (match) {
        return { type: 'twitter', embedId: match[1], originalUrl: match[0] };
      }
    }

    return null;
  }

  // Extract text content without the embed URL
  function getTextWithoutEmbed(content: string, embedUrl: string): string {
    return content.replace(embedUrl, '').trim();
  }

  // Handle image file selection
  function handleImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image must be less than 25MB');
      return;
    }

    pendingImageName = file.name;
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingImage = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    input.value = '';
  }

  // Cancel pending image
  function cancelPendingImage() {
    pendingImage = null;
    pendingImageName = '';
  }

  // Send pending image
  async function sendImage() {
    if (!pendingImage || !authToken) return;

    const content = pendingImage;
    pendingImage = null;
    pendingImageName = '';
    imageUploading = true;

    // Optimistically add message to UI
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      authorId: visitorId,
      authorName: userName,
      authorAvatar: currentUser?.avatar,
      authorFont: currentUser?.username_font,
      content,
      timestamp: Date.now(),
      channelId,
    };
    messages = [...messages, tempMessage];
    scrollToBottom();

    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to send image');
      }

      const responseData = await response.json();
      const savedMessage = responseData.message || responseData;
      
      // Replace temp message with saved message
      messages = messages.map(msg => 
        msg.id === tempMessage.id 
          ? {
              id: savedMessage.id || tempMessage.id,
              authorId: savedMessage.author_id || visitorId,
              authorName: savedMessage.author_name || userName,
              authorAvatar: savedMessage.author_avatar || currentUser?.avatar,
              authorFont: savedMessage.author_font || currentUser?.username_font,
              content: savedMessage.content || content,
              timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
              channelId,
            }
          : msg
      );

      // Publish to Ably - for images, just send notification since base64 is large
      const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
      if (ablyChannel) {
        await ablyChannel.publish('message', {
          id: savedMessage.id,
          authorId: savedMessage.author_id || visitorId,
          authorName: savedMessage.author_name || userName,
          timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
          channelId,
          large: true, // Flag to indicate clients should fetch from API
        });
      }
    } catch (error) {
      console.error('Failed to send image:', error);
      messages = messages.filter(msg => msg.id !== tempMessage.id);
      pendingImage = content; // Restore so user can retry
      alert('Failed to send image. Please try again.');
    } finally {
      imageUploading = false;
    }
  }

  // Trigger file input click
  function triggerImageUpload() {
    fileInput?.click();
  }

  // Scroll to first unread message
  function scrollToFirstUnread() {
    if (firstUnreadIndex >= 0 && messagesContainer) {
      const messageElements = messagesContainer.querySelectorAll('.message-wrapper');
      const targetElement = messageElements[firstUnreadIndex];
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    showNewMessagesBanner = false;
  }

  // Load Google Font dynamically
  function loadGoogleFont(fontName: string) {
    const fontId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Check if already loaded
    if (document.getElementById(fontId)) return;
    
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }

  $: visitorId = currentUser?.id || 'user-1';
  $: userName = currentUser?.username || 'You';

  // Handle channel changes
  $: if (channelId) {
    loadChannel();
  }

  async function loadChannel() {
    if (!channelId || !authToken) {
      loading = false;
      channelLoading = false;
      return;
    }

    loading = true;
    channelLoading = true;
    typingUsers = [];

    // Don't clear messages immediately - show stale data while loading
    // This makes channel switching feel instant
    const previousMessages = messages;
    const previousChannel = channel;

    // Fetch channel and messages in parallel
    const [channelResult, messagesResult] = await Promise.allSettled([
      fetch(apiUrl(`/api/channels/${channelId}`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      }),
      fetch(apiUrl(`/api/channels/${channelId}/messages?limit=50`), {
        headers: { 'Authorization': `Bearer ${authToken}` },
      }),
    ]);

    // Process channel data
    if (channelResult.status === 'fulfilled' && channelResult.value.ok) {
      const channelData = await channelResult.value.json();
      channel = channelData.channel;
    } else {
      channel = previousChannel;
      console.error('Failed to load channel data');
    }
    channelLoading = false;

    // Process messages
    if (messagesResult.status === 'fulfilled' && messagesResult.value.ok) {
      const data = await messagesResult.value.json();
      const fetchedMessages = Array.isArray(data) ? data : (data.messages || []);
      
      messages = fetchedMessages.map((msg: any) => ({
        id: msg.id || msg.message?.id,
        authorId: msg.author_id || msg.message?.author_id,
        authorName: msg.author_name || msg.message?.author_name || currentUser?.username || 'Unknown',
        authorAvatar: msg.author_avatar || msg.message?.author_avatar || null,
        authorFont: msg.author_font || msg.message?.author_font || null,
        content: msg.content || msg.message?.content || '',
        timestamp: new Date(msg.created_at || msg.message?.created_at || Date.now()).getTime(),
        channelId,
        edited: msg.edited_at ? true : false,
        reactions: [], // Will be loaded separately
      })).sort((a: ChatMessage, b: ChatMessage) => a.timestamp - b.timestamp);
      
      // Load reactions for all messages in background
      loadMessageReactions(messages.map(m => m.id));
      
      // Load Google fonts asynchronously (don't block)
      const uniqueFonts = [...new Set(messages.map(m => m.authorFont).filter(Boolean))];
      uniqueFonts.forEach(font => loadGoogleFont(font as string));

      // Check for unread messages
      lastReadMessageId = getLastReadMessageId(channelId);
      if (lastReadMessageId && messages.length > 0) {
        const lastReadIndex = messages.findIndex(m => m.id === lastReadMessageId);
        if (lastReadIndex >= 0 && lastReadIndex < messages.length - 1) {
          firstUnreadIndex = lastReadIndex + 1;
          unreadCount = messages.length - firstUnreadIndex;
          hasUnreadMessages = true;
          showNewMessagesBanner = true;
        } else if (lastReadIndex === -1) {
          firstUnreadIndex = 0;
          unreadCount = messages.length;
          hasUnreadMessages = true;
          showNewMessagesBanner = true;
        } else {
          hasUnreadMessages = false;
          showNewMessagesBanner = false;
          firstUnreadIndex = -1;
          unreadCount = 0;
        }
      } else if (messages.length > 0) {
        markAllAsRead();
      }
    } else if (messagesResult.status === 'fulfilled' && messagesResult.value.status === 401) {
      console.error('Unauthorized - token may be invalid');
      messages = [];
    } else {
      messages = previousMessages.length > 0 ? previousMessages : [];
    }

    loading = false;

    // Initialize Ably in background (don't block UI)
    try {
      let ablyReady = !!getAblyClient();
      if (!ablyReady) {
        // Check if API key is available before initializing
        const apiKey = import.meta.env.VITE_ABLY_API_KEY;
        if (!apiKey) {
          console.warn('⚠️  Ably API key not found. Real-time features will be disabled.');
          console.warn('   Set VITE_ABLY_API_KEY in your .env file and restart the dev server.');
          throw new Error('Ably API key not configured');
        }
        
        // Initialize Ably with user information if available
        // Note: Ably should already be initialized in App.svelte on login,
        // but we ensure it's initialized here if needed
        if (currentUser?.id) {
          initAblyWithUser(currentUser.id, currentUser.username, currentUser.avatar || null);
          ablyReady = true;
        } else {
          console.warn('Cannot initialize Ably: currentUser not available. Real-time features disabled.');
        }
      }

      // Unsubscribe from previous channel if exists
      if (ablyChannel) {
        unsubscribeFromChannel(`channel:${channelId}`);
        await leavePresence(`channel:${channelId}`);
      }

      // Only subscribe if Ably is ready
      if (!ablyReady) {
        console.warn('Skipping Ably subscription - client not initialized');
      } else {
        // Subscribe to new channel for real-time messages
        const channelName = `channel:${channelId}`;
        ablyChannel = subscribeToChannel(channelName, async (message) => {
        console.log('📨 Ably message received:', { id: message.id, authorId: message.authorId, channelId: message.channelId });
        // Only add if message is for this channel and not from current user
        if (message.channelId === channelId && message.authorId !== visitorId) {
          // Check if message already exists (avoid duplicates)
          if (!messages.find(m => m.id === message.id)) {
            // If message is marked as large, fetch it from API
            if ((message as any).large) {
              console.log('Large message notification received, fetching from API...');
              try {
                const response = await fetch(apiUrl(`/api/channels/${channelId}/messages?limit=1&after=${message.id}`), {
                  headers: { 'Authorization': `Bearer ${authToken}` },
                });
                if (response.ok) {
                  const data = await response.json();
                  // The message we want should be the one with the matching ID
                  // Since we're fetching after, we need to get the specific message
                  const fetchedMessages = Array.isArray(data) ? data : data.messages || [];
                  // Actually fetch the specific message by ID
                  const msgResponse = await fetch(apiUrl(`/api/channels/${channelId}/messages?limit=50`), {
                    headers: { 'Authorization': `Bearer ${authToken}` },
                  });
                  if (msgResponse.ok) {
                    const allData = await msgResponse.json();
                    const allMessages = Array.isArray(allData) ? allData : allData.messages || [];
                    const fullMessage = allMessages.find((m: any) => m.id === message.id);
                    if (fullMessage && !messages.find(m => m.id === fullMessage.id)) {
                      const chatMessage: ChatMessage = {
                        id: fullMessage.id,
                        authorId: fullMessage.author_id,
                        authorName: fullMessage.author_name || 'Unknown',
                        authorAvatar: fullMessage.author_avatar,
                        authorFont: fullMessage.author_font,
                        content: fullMessage.content,
                        timestamp: new Date(fullMessage.created_at).getTime(),
                        channelId,
                      };
                      if (chatMessage.authorFont) loadGoogleFont(chatMessage.authorFont);
                      playPingSound();
                      messages = [...messages, chatMessage];
                    }
                  }
                }
              } catch (err) {
                console.error('Failed to fetch large message:', err);
              }
              return;
            }
            // Load the author's font if they have one
            if (message.authorFont) {
              loadGoogleFont(message.authorFont);
            }
            // Play ping sound for new message
            playPingSound();
            // Normal message - add directly
            messages = [...messages, message];
            // scrollToBottom is handled by reactive statement
          }
        }
      });

      // Subscribe to message edits
      const ablyChannelRef = getAblyClient()?.channels.get(channelName);
      if (ablyChannelRef) {
        ablyChannelRef.subscribe('message.edited', (msg) => {
          const data = msg.data as { id: string; content: string; channelId: string };
          if (data.channelId === channelId) {
            messages = messages.map(m => 
              m.id === data.id ? { ...m, content: data.content, edited: true } : m
            );
          }
        });

        ablyChannelRef.subscribe('message.deleted', (msg) => {
          const data = msg.data as { id: string; channelId: string };
          if (data.channelId === channelId) {
            messages = messages.filter(m => m.id !== data.id);
          }
        });

        // Subscribe to reaction events
        ablyChannelRef.subscribe('reaction.added', (msg) => {
          const data = msg.data as { messageId: string; reaction: MessageReaction };
          updateMessageReaction(data.messageId, data.reaction);
        });

        ablyChannelRef.subscribe('reaction.removed', (msg) => {
          const data = msg.data as { messageId: string; emoji: string; reaction: MessageReaction | null };
          if (data.reaction) {
            updateMessageReaction(data.messageId, data.reaction);
          } else {
            removeMessageReaction(data.messageId, data.emoji);
          }
        });
      }

      // Subscribe to typing indicators
      subscribeToTyping(
        channelName,
        (indicator) => {
          if (indicator.userId !== visitorId && indicator.channelId === channelId) {
            if (!typingUsers.includes(indicator.userName)) {
              typingUsers = [...typingUsers, indicator.userName];
            }
          }
        },
        (indicator) => {
          if (indicator.channelId === channelId) {
            typingUsers = typingUsers.filter(u => u !== indicator.userName);
          }
        }
      );

        // Enter presence with minimal user information (avoid large avatars)
        await enterPresence(channelName, {
          odId: visitorId,
          userName: currentUser?.username || userName,
          status: 'online',
          // Don't send avatar in presence - it can exceed Ably's message size limit
          avatar: undefined,
        });
      } // end of ablyReady else block
    } catch (error) {
      console.warn('Ably initialization failed, continuing without real-time updates:', error);
    }

    scrollToBottom();
  }

  onMount(async () => {
    await loadChannel();
    // Scroll to appropriate position after initial load
    setTimeout(() => {
      scrollToAppropriatePosition();
    }, 100);
  });

  onDestroy(async () => {
    // Mark messages as read when leaving channel
    markAllAsRead();
    if (typingTimeout) clearTimeout(typingTimeout);
    if (channelId) {
      await leavePresence(`channel:${channelId}`);
      unsubscribeFromChannel(`channel:${channelId}`);
    }
  });

  function getMockMessages(): ChatMessage[] {
    return [
      {
        id: '1',
        authorId: '2',
        authorName: 'James Ryan',
        authorAvatar: undefined,
        content: 'Lorem Ipsum is simply dummy text. Lorem Ipsum',
        timestamp: Date.now() - 22 * 60 * 60 * 1000,
        channelId,
      },
      {
        id: '2',
        authorId: '3',
        authorName: 'Alex',
        authorAvatar: undefined,
        content: '@James Ryan Lorem Ipsum is simply.',
        timestamp: Date.now() - 12 * 60 * 1000,
        channelId,
      },
      {
        id: '3',
        authorId: visitorId,
        authorName: userName,
        content: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been',
        timestamp: Date.now() - 9 * 60 * 1000,
        channelId,
      },
      {
        id: '4',
        authorId: '4',
        authorName: 'Julia A.',
        authorAvatar: undefined,
        content: '',
        timestamp: Date.now() - 22 * 60 * 60 * 1000,
        channelId,
        attachments: [
          { type: 'audio', url: '#', name: 'voice.mp3' },
          { type: 'image', url: 'https://picsum.photos/200/200?random=1', name: 'image1.jpg' },
          { type: 'image', url: 'https://picsum.photos/200/200?random=2', name: 'image2.jpg' },
        ]
      },
    ];
  }

  function scrollToBottom() {
    if (messagesContainer) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }
  }

  // Scroll to position based on unread status
  function scrollToAppropriatePosition() {
    if (hasUnreadMessages && firstUnreadIndex >= 0) {
      // Scroll to first unread message
      setTimeout(() => {
        scrollToFirstUnread();
      }, 100);
    } else {
      // Scroll to bottom
      scrollToBottom();
    }
  }

  // Handle scroll to detect when user has read messages
  function handleScroll() {
    if (!messagesContainer || !hasUnreadMessages) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    if (isNearBottom) {
      // User scrolled to bottom, mark all as read
      markAllAsRead();
    }
  }

  // Auto-scroll behavior when messages change
  $: if (messages.length > 0 && !loading) {
    // Only auto-scroll to bottom for new messages if user is already at bottom
    // or if there are no unread messages
    if (!hasUnreadMessages) {
      scrollToBottom();
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffHours >= 24) {
      return `${Math.floor(diffHours / 24)}d ago`;
    } else if (diffHours >= 1) {
      return `${diffHours}h ago`;
    } else if (diffMins >= 1) {
      return `${diffMins}m ago`;
    }
    return 'Just now';
  }

  function getTimeString(date: Date): string {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Reset times to midnight for day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / (1000 * 60 * 60 * 24));
    
    const timeStr = getTimeString(date);
    
    // Same day - just show time
    if (diffDays === 0) {
      return timeStr;
    }
    
    // Yesterday
    if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    }
    
    // Same week (within 7 days)
    if (diffDays < 7) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${dayNames[date.getDay()]} at ${timeStr}`;
    }
    
    // Older - show full date
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year} ${timeStr}`;
  }

  function formatDaySeparator(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Reset times to midnight for day comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / (1000 * 60 * 60 * 24));
    
    // Same day
    if (diffDays === 0) {
      return 'Today';
    }
    
    // Yesterday
    if (diffDays === 1) {
      return 'Yesterday';
    }
    
    // Show full date
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }

  function shouldShowDaySeparator(message: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    const prevDate = new Date(prevMessage.timestamp);
    const currDate = new Date(message.timestamp);
    
    // Check if different day
    return prevDate.getFullYear() !== currDate.getFullYear() ||
           prevDate.getMonth() !== currDate.getMonth() ||
           prevDate.getDate() !== currDate.getDate();
  }

  function shouldShowAvatar(message: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    const timeDiff = message.timestamp - prevMessage.timestamp;
    // Show avatar if different author or more than 5 minutes apart or different day
    if (shouldShowDaySeparator(message, index)) return true;
    return prevMessage.authorId !== message.authorId || timeDiff > 5 * 60 * 1000;
  }

  function shouldShowHeader(message: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    const timeDiff = message.timestamp - prevMessage.timestamp;
    // Show header if different author or more than 5 minutes apart
    return prevMessage.authorId !== message.authorId || timeDiff > 5 * 60 * 1000;
  }

  function isOwnMessage(authorId: string): boolean {
    return authorId === visitorId;
  }

  async function sendMessage() {
    if (!messageContent.trim() || !authToken) return;

    const content = messageContent.trim();
    messageContent = '';
    
    if (isTyping) {
      isTyping = false;
      await publishTyping(channelId, visitorId, userName, false);
    }

    // Optimistically add message to UI
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      authorId: visitorId,
      authorName: userName,
      authorAvatar: currentUser?.avatar,
      authorFont: currentUser?.username_font,
      content,
      timestamp: Date.now(),
      channelId,
    };
    messages = [...messages, tempMessage];
    scrollToBottom();

    try {
      // Save message to backend first
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Failed to send message' } }));
        throw new Error(errorData.error?.message || 'Failed to send message');
      }

      const responseData = await response.json();
      const savedMessage = responseData.message || responseData;
      
      // Replace temp message with saved message
      messages = messages.map(msg => 
        msg.id === tempMessage.id 
          ? {
              id: savedMessage.id || tempMessage.id,
              authorId: savedMessage.author_id || visitorId,
              authorName: savedMessage.author_name || userName,
              authorAvatar: savedMessage.author_avatar || currentUser?.avatar,
              authorFont: savedMessage.author_font || currentUser?.username_font,
              content: savedMessage.content || content,
              timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
              channelId,
            }
          : msg
      );

      // Publish to Ably for real-time distribution
      // Only publish if message size is within Ably's 64KB limit
      const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
      if (ablyChannel) {
        const messagePayload = {
          id: savedMessage.id,
          authorId: savedMessage.author_id || visitorId,
          authorName: savedMessage.author_name || userName,
          authorAvatar: savedMessage.author_avatar || currentUser?.avatar,
          authorFont: savedMessage.author_font || currentUser?.username_font,
          content: savedMessage.content || content,
          timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
          channelId,
        };
        
        // Check message size (Ably limit is 64KB = 65536 bytes)
        const messageSize = new Blob([JSON.stringify(messagePayload)]).size;
        const ABLY_MAX_SIZE = 65536; // 64KB
        
        if (messageSize > ABLY_MAX_SIZE) {
          // Message is too large - publish a lightweight notification instead
          // Clients will fetch the full message from the API
          console.warn(`Message too large for Ably (${messageSize} bytes), publishing notification only`);
          await ablyChannel.publish('message', {
            id: savedMessage.id,
            authorId: savedMessage.author_id || visitorId,
            authorName: savedMessage.author_name || userName,
            timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
            channelId,
            large: true, // Flag to indicate clients should fetch from API
          });
        } else {
          // Message is small enough - publish full content
          console.log('📤 Publishing message to Ably:', { id: messagePayload.id, channelId: messagePayload.channelId });
          await ablyChannel.publish('message', messagePayload);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove failed message from UI
      messages = messages.filter(msg => msg.id !== tempMessage.id);
      messageContent = content; // Restore content so user can retry
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function handleInput() {
    if (!authToken) return;

    if (!isTyping && messageContent.trim()) {
      isTyping = true;
      await publishTyping(`channel:${channelId}`, visitorId, userName, true);
    }

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(async () => {
      if (isTyping) {
        isTyping = false;
        await publishTyping(`channel:${channelId}`, visitorId, userName, false);
      }
    }, 2000);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function highlightMention(content: string): string {
    // First handle mentions
    let result = content.replace(/@(\w+\s?\w*)/g, '<span class="mention">@$1</span>');
    
    // Then render custom emojis :emoji_name:
    result = result.replace(/:([a-z0-9_]+):/gi, (match, emojiName) => {
      const url = guildEmojis.get(emojiName.toLowerCase());
      if (url) {
        return `<img src="${url}" alt=":${emojiName}:" class="custom-emoji-inline" title=":${emojiName}:" />`;
      }
      return match; // Return original if not found
    });
    
    return result;
  }

  function handleUserClick(message: ChatMessage) {
    dispatch('viewUserProfile', {
      userId: message.authorId,
      username: message.authorName,
      avatar: message.authorAvatar,
    });
  }

  // Start editing a message
  function startEditing(message: ChatMessage) {
    editingMessageId = message.id;
    editingContent = message.content;
    showMessageMenu = null;
  }

  // Cancel editing
  function cancelEditing() {
    editingMessageId = null;
    editingContent = '';
  }

  // Save edited message
  async function saveEdit() {
    if (!editingMessageId || !editingContent.trim() || !authToken) return;

    const messageId = editingMessageId;
    const newContent = editingContent.trim();
    const originalMessage = messages.find(m => m.id === messageId);
    
    if (!originalMessage || originalMessage.content === newContent) {
      cancelEditing();
      return;
    }

    // Optimistically update UI
    messages = messages.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: newContent, edited: true }
        : msg
    );
    cancelEditing();

    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages/${messageId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      // Publish edit to Ably
      const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
      if (ablyChannel) {
        await ablyChannel.publish('message.edited', {
          id: messageId,
          content: newContent,
          channelId,
        });
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
      // Revert on failure
      messages = messages.map(msg => 
        msg.id === messageId ? originalMessage : msg
      );
      alert('Failed to edit message. Please try again.');
    }
  }

  // Handle edit keydown
  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveEdit();
    } else if (event.key === 'Escape') {
      cancelEditing();
    }
  }

  // Delete a message
  async function deleteMessage(messageId: string) {
    if (!authToken) return;

    const confirmed = confirm('Are you sure you want to delete this message?');
    if (!confirmed) return;

    const originalMessage = messages.find(m => m.id === messageId);
    
    // Optimistically remove from UI
    messages = messages.filter(msg => msg.id !== messageId);
    showMessageMenu = null;

    try {
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages/${messageId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Publish delete to Ably
      const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
      if (ablyChannel) {
        await ablyChannel.publish('message.deleted', {
          id: messageId,
          channelId,
        });
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      // Revert on failure
      if (originalMessage) {
        messages = [...messages, originalMessage].sort((a, b) => a.timestamp - b.timestamp);
      }
      alert('Failed to delete message. Please try again.');
    }
  }

  // Toggle message menu
  function toggleMessageMenu(messageId: string) {
    showMessageMenu = showMessageMenu === messageId ? null : messageId;
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.message-menu') && !target.closest('.message-actions-btn')) {
      showMessageMenu = null;
    }
  }
</script>

<div class="chat-area">
  <!-- Radial gradient background -->
  <div class="bg-gradient"></div>
  
  <!-- Frosted Glass Header -->
  <header 
    class="chat-header" 
    class:has-background={channelSettings.background_url}
  >
    {#if channelSettings.background_url}
      <img src={channelSettings.background_url} alt="" class="header-bg-img" />
    {/if}
    <div class="header-overlay"></div>
    <div class="channel-info">
      <div class="channel-avatar">
        {#if channelLoading}
          <div class="avatar-placeholder"></div>
        {:else if channel}
          <div class="channel-icon">#</div>
        {:else}
          <div class="channel-icon">#</div>
        {/if}
      </div>
      <div class="channel-details">
        {#if channelLoading}
          <h2 class="channel-name">loading...</h2>
        {:else if channel}
          <h2 class="channel-name">{channel.name}</h2>
          {#if channel.topic}
            <span class="channel-meta">{channel.topic}</span>
          {/if}
        {:else}
          <h2 class="channel-name">unknown channel</h2>
        {/if}
      </div>
    </div>
  </header>

  <!-- Messages -->
  <div class="messages-container" bind:this={messagesContainer} on:scroll={handleScroll}>
    {#if loading}
      <div class="loading">loading messages...</div>
    {:else}
      {#each messages as message, index (message.id)}
        {#if index === firstUnreadIndex && hasUnreadMessages}
          <div class="unread-separator">
            <div class="unread-line"></div>
            <span class="unread-text">new messages ({unreadCount})</span>
            <div class="unread-line"></div>
          </div>
        {/if}
        {#if shouldShowDaySeparator(message, index)}
          <div class="day-separator">
            <div class="day-line"></div>
            <span class="day-text">{formatDaySeparator(message.timestamp)}</span>
            <div class="day-line"></div>
          </div>
        {/if}
        <div 
          class="message-wrapper" 
          class:new-author={shouldShowAvatar(message, index)} 
          class:unread={index >= firstUnreadIndex && hasUnreadMessages}
          class:editing={editingMessageId === message.id}
          on:mouseenter={() => hoveredMessageId = message.id}
          on:mouseleave={() => { hoveredMessageId = null; if (showMessageMenu === message.id) showMessageMenu = null; }}
        >
          {#if shouldShowAvatar(message, index)}
            <MiniProfileTrigger
              userId={message.authorId}
              username={message.authorName}
              avatar={message.authorAvatar}
              {authToken}
              currentUserId={currentUser?.id || ''}
              onViewProfile={(userId) => handleUserClick(message)}
            >
              <button class="message-avatar" on:click={() => handleUserClick(message)} aria-label="View {message.authorName}'s profile">
                <Avatar 
                  src={message.authorAvatar}
                  username={message.authorName}
                  userId={message.authorId}
                  size={40}
                />
              </button>
            </MiniProfileTrigger>
          {:else}
            <div class="message-avatar-spacer"></div>
          {/if}
          
          <div class="message-content">
            {#if shouldShowHeader(message, index)}
              <div class="message-header">
                <MiniProfileTrigger
                  userId={message.authorId}
                  username={message.authorName}
                  avatar={message.authorAvatar}
                  {authToken}
                  currentUserId={currentUser?.id || ''}
                  onViewProfile={(userId) => handleUserClick(message)}
                >
                  <button 
                    class="message-author" 
                    on:click={() => handleUserClick(message)}
                    style={message.authorFont ? `font-family: '${message.authorFont}', sans-serif;` : ''}
                  >{message.authorName}</button>
                </MiniProfileTrigger>
                <span class="message-time">{formatTimestamp(message.timestamp)}{message.edited ? ' (edited)' : ''}</span>
              </div>
            {/if}

            {#if editingMessageId === message.id}
              <div class="edit-input-container">
                <input
                  type="text"
                  class="edit-input"
                  bind:value={editingContent}
                  on:keydown={handleEditKeydown}
                  autofocus
                />
                <div class="edit-actions">
                  <button class="edit-cancel-btn" on:click={cancelEditing}>cancel</button>
                  <button class="edit-save-btn" on:click={saveEdit}>save</button>
                </div>
              </div>
            {:else if message.content}
              {#if isImageContent(message.content)}
                <div class="message-gif">
                  <img src={message.content} alt="Image" loading="lazy" />
                </div>
              {:else}
                {@const embed = getSocialEmbed(message.content)}
                {#if embed}
                  {@const remainingText = getTextWithoutEmbed(message.content, embed.originalUrl)}
                  {#if remainingText}
                    <div class="message-text">
                      {@html highlightMention(remainingText)}
                    </div>
                  {/if}
                  <div class="social-embed {embed.type}">
                    {#if embed.type === 'youtube'}
                      <div class="youtube-embed">
                        <iframe
                          src="https://www.youtube.com/embed/{embed.embedId}"
                          title="YouTube video"
                          frameborder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowfullscreen
                        ></iframe>
                      </div>
                    {:else if embed.type === 'instagram'}
                      <div class="instagram-embed">
                        <iframe
                          src="https://www.instagram.com/p/{embed.embedId}/embed/"
                          title="Instagram post"
                          frameborder="0"
                          scrolling="no"
                          allowfullscreen
                        ></iframe>
                      </div>
                    {:else if embed.type === 'twitter'}
                      <div class="twitter-embed">
                        <iframe
                          src="https://platform.twitter.com/embed/Tweet.html?id={embed.embedId}&theme=dark"
                          title="Twitter post"
                          frameborder="0"
                          scrolling="no"
                        ></iframe>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="message-text">
                    {@html highlightMention(message.content)}
                  </div>
                {/if}
              {/if}
            {/if}

            {#if message.attachments && message.attachments.length > 0}
              <div class="attachments">
                {#each message.attachments as attachment}
                  {#if attachment.type === 'audio'}
                    <div class="audio-attachment">
                      <button class="play-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5V19L19 12L8 5Z"/>
                        </svg>
                      </button>
                      <div class="waveform">
                        {#each Array(25) as _, i}
                          <div class="wave-bar" style="height: {Math.random() * 16 + 4}px"></div>
                        {/each}
                      </div>
                      <span class="duration">12min</span>
                    </div>
                  {:else if attachment.type === 'image'}
                    <div class="image-attachment">
                      <img src={attachment.url} alt={attachment.name || 'Image'} />
                    </div>
                  {/if}
                {/each}
                {#if message.attachments.filter(a => a.type === 'image').length > 1}
                  <div class="more-images">
                    <span>5+</span>
                  </div>
                {/if}
              </div>
            {/if}

            {#if message.id === '1' || message.id === '2'}
              <div class="message-reactions">
                <button class="reaction" class:purple={message.id === '2'}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
                  </svg>
                  <span>2</span>
                </button>
              </div>
            {/if}

            <!-- Message Reactions -->
            {#if message.reactions && message.reactions.length > 0}
              <div class="message-reactions">
                {#each message.reactions as reaction}
                  <button 
                    class="reaction" 
                    class:reacted={reaction.me}
                    on:click={() => toggleReaction(message.id, reaction.emoji, reaction.emoji_url, reaction.me)}
                    title={`${reaction.count} reaction${reaction.count > 1 ? 's' : ''}`}
                  >
                    {#if reaction.emoji_url}
                      <img src={reaction.emoji_url} alt={reaction.emoji} class="reaction-emoji-img" />
                    {:else if reaction.emoji.startsWith(':')}
                      {@const emojiName = reaction.emoji.replace(/:/g, '')}
                      {@const url = guildEmojis.get(emojiName)}
                      {#if url}
                        <img src={url} alt={reaction.emoji} class="reaction-emoji-img" />
                      {:else}
                        <span class="reaction-emoji">{reaction.emoji}</span>
                      {/if}
                    {:else}
                      <span class="reaction-emoji">{reaction.emoji}</span>
                    {/if}
                    <span class="reaction-count">{reaction.count}</span>
                  </button>
                {/each}
                <button 
                  class="add-reaction-btn"
                  on:click={() => showReactionPicker = showReactionPicker === message.id ? null : message.id}
                  title="Add reaction"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                    <line x1="9" y1="9" x2="9.01" y2="9"/>
                    <line x1="15" y1="9" x2="15.01" y2="9"/>
                  </svg>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="plus-icon">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
              </div>
            {/if}
          </div>

          <!-- Add Reaction Button (shown on hover) -->
          {#if hoveredMessageId === message.id && editingMessageId !== message.id}
            <button 
              class="hover-add-reaction"
              on:click={() => showReactionPicker = showReactionPicker === message.id ? null : message.id}
              title="Add reaction"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
          {/if}

          <!-- Reaction Picker for this message -->
          {#if showReactionPicker === message.id}
            <div class="reaction-picker-container">
              <EmojiPicker 
                {guildId}
                {authToken}
                isOpen={true}
                on:select={(e) => handleReactionSelect(message.id, e)}
                on:close={() => showReactionPicker = null}
              />
            </div>
          {/if}

          <!-- Message Actions (Edit/Delete) -->
          {#if hoveredMessageId === message.id && message.authorId === visitorId && editingMessageId !== message.id}
            <div class="message-actions">
              <button 
                class="message-actions-btn" 
                on:click={() => toggleMessageMenu(message.id)}
                aria-label="Message options"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
              {#if showMessageMenu === message.id}
                <div class="message-menu">
                  {#if !isImageContent(message.content)}
                    <button class="menu-item" on:click={() => startEditing(message)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      edit
                    </button>
                  {/if}
                  <button class="menu-item delete" on:click={() => deleteMessage(message.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    delete
                  </button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- New Messages Banner -->
  {#if showNewMessagesBanner && hasUnreadMessages}
    <button class="new-messages-banner" on:click={scrollToFirstUnread}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
      <span>{unreadCount} new message{unreadCount > 1 ? 's' : ''}</span>
    </button>
  {/if}

  <!-- Typing Indicator -->
  {#if typingUsers.length > 0}
    <div class="typing-indicator">
      <span class="typing-dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
      <span class="typing-text"><strong>{typingUsers.join(', ')}</strong> is typing</span>
    </div>
  {/if}

  <!-- Input Area -->
  <div class="input-area">
    <!-- Hidden file input for image upload -->
    <input 
      type="file" 
      accept="image/*" 
      bind:this={fileInput}
      on:change={handleImageSelect}
      style="display: none;"
    />
    
    <div class="input-avatar">
      <Avatar 
        src={currentUser?.avatar}
        username={currentUser?.username || ''}
        userId={currentUser?.id || ''}
        size={36}
        alt="You"
      />
    </div>
    <div class="input-container">
      <button class="attach-btn" on:click={triggerImageUpload} aria-label="Attach image">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.44 11.05L12.25 20.24C10.45 22.04 7.51 22.04 5.71 20.24C3.91 18.44 3.91 15.5 5.71 13.7L14.9 4.51C16.04 3.37 17.88 3.37 19.02 4.51C20.16 5.65 20.16 7.49 19.02 8.63L9.83 17.82C9.26 18.39 8.34 18.39 7.77 17.82C7.2 17.25 7.2 16.33 7.77 15.76L16.96 6.57"/>
        </svg>
      </button>
      <button class="emoji-btn" class:active={showEmojiPicker} on:click={toggleEmojiPicker} aria-label="Emoji">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </button>
      <button class="gif-btn" class:active={showGifPicker} on:click={toggleGifPicker} aria-label="GIF">
        <span class="gif-label">GIF</span>
      </button>
      <input
        type="text"
        bind:value={messageContent}
        on:keydown={handleKeydown}
        on:input={handleInput}
        placeholder="type something here..."
        class="message-input"
      />
      <div class="input-actions">
        <button class="mic-btn" aria-label="Voice">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"/>
            <path d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10"/>
            <path d="M12 19V23M8 23H16"/>
          </svg>
        </button>
        <div class="divider"></div>
        <button class="send-btn" on:click={sendMessage} aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Image Preview -->
    {#if pendingImage}
      <div class="image-preview">
        <div class="image-preview-content">
          <img src={pendingImage} alt="Preview" />
          <div class="image-preview-info">
            <span class="image-preview-name">{pendingImageName}</span>
            <div class="image-preview-actions">
              <button class="image-cancel-btn" on:click={cancelPendingImage} disabled={imageUploading}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
              <button class="image-send-btn" on:click={sendImage} disabled={imageUploading}>
                {#if imageUploading}
                  <span class="uploading-spinner"></span>
                {:else}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z"/>
                  </svg>
                {/if}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- GIF Picker -->
    {#if showGifPicker}
      <div class="gif-picker">
        <div class="gif-picker-header">
          <input
            type="text"
            class="gif-search"
            placeholder="search gifs..."
            bind:value={gifSearchQuery}
            on:input={handleGifSearch}
          />
          <button class="gif-close" on:click={() => showGifPicker = false}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="gif-grid">
          {#if gifLoading}
            <div class="gif-loading">loading...</div>
          {:else if gifResults.length === 0}
            <div class="gif-empty">no gifs found</div>
          {:else}
            {#each gifResults as gif}
              <button class="gif-item" on:click={() => selectGif(gif)}>
                <img 
                  src={gif.images?.fixed_height_small?.url || gif.images?.fixed_height?.url} 
                  alt={gif.title || 'GIF'}
                  loading="lazy"
                />
              </button>
            {/each}
          {/if}
        </div>
        <div class="gif-powered">
          <span>powered by</span>
          <img src="https://giphy.com/static/img/giphy_logo_square_social.png" alt="GIPHY" class="giphy-logo" />
        </div>
      </div>
    {/if}

    <!-- Emoji Picker -->
    <EmojiPicker 
      {guildId}
      {authToken}
      isOpen={showEmojiPicker}
      on:select={handleEmojiSelect}
      on:close={() => showEmojiPicker = false}
    />
  </div>
</div>

<style>
  .chat-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex: 1;
    position: relative;
    background: #050505;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Subtle radial gradient background */
  .bg-gradient {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255, 255, 255, 0.02) 0%, transparent 50%),
      radial-gradient(ellipse 60% 40% at 70% 90%, rgba(255, 255, 255, 0.015) 0%, transparent 40%);
    pointer-events: none;
  }

  /* Frosted Glass Header */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 10;
  }

  .chat-header.has-background {
    min-height: 80px;
    padding: 16px 20px;
  }

  .header-bg-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
  }

  .header-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, rgba(5, 5, 5, 0.85) 0%, rgba(5, 5, 5, 0.6) 50%, rgba(5, 5, 5, 0.4) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .chat-header.has-background .header-overlay {
    background: linear-gradient(to right, rgba(5, 5, 5, 0.9) 0%, rgba(5, 5, 5, 0.7) 40%, rgba(5, 5, 5, 0.3) 100%);
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 2;
  }

  .channel-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .channel-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .channel-name {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: #fff;
    text-transform: lowercase;
    letter-spacing: -0.01em;
  }

  .channel-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: lowercase;
  }

  /* Messages Container */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    z-index: 1;
    scroll-behavior: smooth;
  }

  .messages-container::-webkit-scrollbar {
    width: 6px;
  }

  .messages-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .messages-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .messages-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .loading {
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    padding: 40px;
    font-size: 13px;
    text-transform: lowercase;
  }

  .channel-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.06);
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Message Wrapper */
  .message-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 6px 12px;
    position: relative;
    transition: background-color 0.1s ease;
    border-radius: 8px;
  }

  .message-wrapper.new-author {
    margin-top: 12px;
  }

  .message-wrapper:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  /* Day Separator */
  .day-separator {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 12px 8px;
    margin-top: 8px;
  }

  .day-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
  }

  .day-text {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.35);
    text-transform: lowercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  /* Unread Messages Separator */
  .unread-separator {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 12px;
    margin-top: 8px;
  }

  .unread-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.3);
  }

  .unread-text {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    text-transform: lowercase;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .message-wrapper.unread {
    background: rgba(255, 255, 255, 0.02);
  }

  /* New Messages Banner */
  .new-messages-banner {
    position: absolute;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #fff;
    border: none;
    border-radius: 20px;
    color: #050505;
    font-size: 12px;
    font-weight: 500;
    text-transform: lowercase;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    animation: slideDown 0.3s ease;
  }

  .new-messages-banner:hover {
    transform: translateX(-50%) scale(1.02);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
    transition: border-radius 0.2s ease;
    border: none;
    background: transparent;
    padding: 0;
    margin-top: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .message-avatar:hover {
    border-radius: 10px;
  }

  .message-avatar:focus {
    outline: 2px solid rgba(255, 255, 255, 0.3);
    outline-offset: 2px;
  }

  .message-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .message-avatar svg {
    width: 100%;
    height: 100%;
    color: rgba(255, 255, 255, 0.2);
  }

  .message-avatar-spacer {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
  }

  .message-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .message-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    line-height: 1.4;
  }

  .message-author {
    font-weight: 500;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
    text-transform: lowercase;
  }

  .message-author:hover {
    text-decoration: underline;
  }

  .message-author:focus {
    outline: none;
    text-decoration: underline;
  }

  .message-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 400;
    text-transform: lowercase;
  }

  /* Message Text */
  .message-text {
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message-text :global(.mention) {
    color: #fff;
    font-weight: 500;
    background-color: rgba(255, 255, 255, 0.1);
    padding: 0 4px;
    border-radius: 4px;
  }

  .message-text :global(.custom-emoji-inline) {
    width: 20px;
    height: 20px;
    vertical-align: middle;
    margin: 0 2px;
    object-fit: contain;
  }

  .message-reactions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  .reaction {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reaction:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .reaction.reacted {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .reaction.purple {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .reaction-emoji {
    font-size: 14px;
    line-height: 1;
  }

  .reaction-emoji-img {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .reaction-count {
    font-size: 11px;
    font-weight: 500;
    min-width: 10px;
    text-align: center;
  }

  .add-reaction-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .add-reaction-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.6);
  }

  .add-reaction-btn .plus-icon {
    margin-left: -2px;
  }

  .hover-add-reaction {
    position: absolute;
    right: 60px;
    top: 4px;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(5, 5, 5, 0.95);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    opacity: 0;
  }

  .message-wrapper:hover .hover-add-reaction {
    opacity: 1;
  }

  .hover-add-reaction:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .reaction-picker-container {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 200;
  }

  .reaction-picker-container :global(.emoji-picker) {
    position: relative;
    bottom: auto;
    left: auto;
    margin-bottom: 0;
  }

  /* Attachments */
  .attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }

  .audio-attachment {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
  }

  .play-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #fff;
    color: #050505;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease;
  }

  .play-btn:hover {
    transform: scale(1.05);
  }

  .waveform {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 20px;
  }

  .wave-bar {
    width: 2px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  .duration {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-left: 6px;
    text-transform: lowercase;
  }

  .image-attachment {
    width: 110px;
    height: 110px;
    border-radius: 10px;
    overflow: hidden;
  }

  .image-attachment img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .more-images {
    width: 110px;
    height: 110px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    position: relative;
    z-index: 1;
  }

  .typing-dots {
    display: flex;
    gap: 3px;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
    animation: bounce 1.4s infinite ease-in-out;
  }

  .dot:nth-child(1) { animation-delay: 0s; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-5px); }
  }

  .typing-text {
    text-transform: lowercase;
  }

  .typing-text strong {
    color: #fff;
    font-weight: 500;
  }

  /* Input Area */
  .input-area {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    position: relative;
    z-index: 10;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .input-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .input-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .input-container {
    flex: 1;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 24px;
    padding: 4px 4px 4px 4px;
    transition: border-color 0.15s ease;
  }

  .input-container:focus-within {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .attach-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }

  .attach-btn:hover {
    color: #fff;
  }

  .emoji-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .emoji-btn:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }

  .emoji-btn.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }

  .gif-btn {
    padding: 5px 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: all 0.15s ease;
    margin-right: 8px;
    text-transform: lowercase;
  }

  .gif-btn:hover {
    border-color: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .gif-btn.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .gif-label {
    letter-spacing: 0.5px;
  }

  .message-input {
    flex: 1;
    background: none;
    border: none;
    color: #fff;
    font-size: 14px;
    padding: 10px 0;
    font-family: inherit;
  }

  .message-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
    text-transform: lowercase;
  }

  .message-input:focus {
    outline: none;
  }

  .input-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mic-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }

  .mic-btn:hover {
    color: #fff;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 4px;
  }

  .send-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #050505;
    transition: all 0.15s ease;
  }

  .send-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.2);
  }

  /* GIF Picker */
  .gif-picker {
    position: absolute;
    bottom: 100%;
    left: 60px;
    right: 20px;
    max-width: 380px;
    background: #050505;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    margin-bottom: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .gif-picker-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .gif-search {
    flex: 1;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 13px;
    font-family: inherit;
  }

  .gif-search::placeholder {
    color: rgba(255, 255, 255, 0.35);
    text-transform: lowercase;
  }

  .gif-search:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.15);
  }

  .gif-close {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .gif-close:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .gif-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    padding: 10px;
    max-height: 280px;
    overflow-y: auto;
  }

  .gif-grid::-webkit-scrollbar {
    width: 5px;
  }

  .gif-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .gif-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .gif-loading,
  .gif-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    text-transform: lowercase;
  }

  .gif-item {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    transition: transform 0.15s ease;
  }

  .gif-item:hover {
    transform: scale(1.03);
  }

  .gif-item img {
    width: 100%;
    height: 90px;
    object-fit: cover;
    display: block;
  }

  .gif-powered {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    text-transform: lowercase;
  }

  .giphy-logo {
    height: 14px;
    width: auto;
    opacity: 0.6;
  }

  /* Message GIF */
  .message-gif {
    margin-top: 6px;
    max-width: 280px;
    border-radius: 10px;
    overflow: hidden;
  }

  .message-gif img {
    width: 100%;
    height: auto;
    display: block;
    max-height: 220px;
    object-fit: contain;
  }

  /* Image Preview */
  .image-preview {
    position: absolute;
    bottom: 100%;
    left: 60px;
    right: 20px;
    max-width: 280px;
    background: #050505;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    margin-bottom: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 100;
  }

  .image-preview-content {
    padding: 12px;
  }

  .image-preview-content img {
    width: 100%;
    max-height: 180px;
    object-fit: contain;
    border-radius: 8px;
    display: block;
  }

  .image-preview-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    gap: 12px;
  }

  .image-preview-name {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    text-transform: lowercase;
  }

  .image-preview-actions {
    display: flex;
    gap: 6px;
  }

  .image-cancel-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .image-cancel-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .image-cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .image-send-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: #fff;
    color: #050505;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .image-send-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .image-send-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .uploading-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(5, 5, 5, 0.3);
    border-top-color: #050505;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Social Media Embeds */
  .social-embed {
    margin-top: 6px;
    max-width: 380px;
  }

  /* YouTube Embed */
  .youtube-embed {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    border-radius: 10px;
    overflow: hidden;
    background: #000;
  }

  .youtube-embed iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
  }

  /* Instagram Embed */
  .instagram-embed {
    width: 100%;
    max-width: 380px;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
  }

  .instagram-embed iframe {
    width: 100%;
    min-height: 480px;
    border: none;
  }

  /* Twitter/X Embed */
  .twitter-embed {
    width: 100%;
    max-width: 380px;
    border-radius: 10px;
    overflow: hidden;
    background: #0a0a0a;
  }

  .twitter-embed iframe {
    width: 100%;
    min-height: 280px;
    border: none;
  }

  /* Message Actions (Edit/Delete) */
  .message-wrapper {
    position: relative;
  }

  .message-wrapper.editing {
    background: rgba(255, 255, 255, 0.04);
  }

  .message-actions {
    position: absolute;
    right: 12px;
    top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .message-actions-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(5, 5, 5, 0.95);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .message-actions-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.12);
    color: #fff;
  }

  .message-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: #050505;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    z-index: 100;
    min-width: 110px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: left;
    text-transform: lowercase;
    font-family: inherit;
  }

  .menu-item:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  .menu-item.delete {
    color: rgba(255, 255, 255, 0.6);
  }

  .menu-item.delete:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  /* Edit Input */
  .edit-input-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .edit-input {
    width: 100%;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-family: inherit;
  }

  .edit-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.25);
  }

  .edit-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .edit-cancel-btn,
  .edit-save-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    text-transform: lowercase;
    font-family: inherit;
  }

  .edit-cancel-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
  }

  .edit-cancel-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .edit-save-btn {
    background: #fff;
    color: #050505;
  }

  .edit-save-btn:hover {
    transform: scale(1.02);
  }

  /* Mobile breakpoint */
  @media (max-width: 768px) {
    .chat-area {
      padding-bottom: 64px; /* Space for mobile navbar */
    }

    .chat-header {
      padding: 12px 16px;
    }

    .channel-name {
      font-size: 15px;
    }

    .messages-container {
      padding: 12px;
    }

    .message {
      padding: 10px 12px;
    }

    .message-author {
      font-size: 18px;
    }

    .message-content {
      font-size: 14px;
    }

    .message-input-container {
      padding: 12px;
    }

    .message-input-wrapper {
      padding: 10px 12px;
    }

    .message-input {
      font-size: 15px;
    }

    .send-button {
      width: 36px;
      height: 36px;
    }

    .emoji-picker-container {
      right: 8px;
      bottom: 70px;
      max-width: calc(100vw - 16px);
    }

    .attachment-preview {
      max-width: 100%;
    }
  }

  @media (max-width: 480px) {
    .chat-header {
      padding: 10px 12px;
    }

    .messages-container {
      padding: 8px;
    }

    .message {
      padding: 8px 10px;
    }

    .message-content {
      font-size: 13px;
    }

    .message-input-container {
      padding: 8px;
    }
  }
</style>
