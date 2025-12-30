<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import type { User, Channel } from '../types';
  import { apiUrl } from '../lib/api';
  import Avatar from './Avatar.svelte';
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
    type TypingIndicator
  } from '../lib/ably';

  export let channelId: string = 'general';
  export let authToken: string = '';
  export let currentUser: User | null = null;

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

  // Giphy picker state
  let showGifPicker = false;
  let gifSearchQuery = '';
  let gifResults: any[] = [];
  let gifLoading = false;
  let gifSearchTimeout: ReturnType<typeof setTimeout> | null = null;
  const GIPHY_API_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'; // Public beta key

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

      // Publish to Ably
      const ablyChannel = getAblyClient()?.channels.get(`channel:${channelId}`);
      if (ablyChannel) {
        await ablyChannel.publish('message', {
          id: savedMessage.id,
          authorId: savedMessage.author_id || visitorId,
          authorName: savedMessage.author_name || userName,
          authorAvatar: savedMessage.author_avatar || currentUser?.avatar,
          authorFont: savedMessage.author_font || currentUser?.username_font,
          content: savedMessage.content || content,
          timestamp: new Date(savedMessage.created_at || Date.now()).getTime(),
          channelId,
        });
      }
    } catch (error) {
      console.error('Failed to send GIF:', error);
      messages = messages.filter(msg => msg.id !== tempMessage.id);
      alert('Failed to send GIF. Please try again.');
    }
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
    messages = [];
    typingUsers = [];
    channel = null;

    // Fetch channel data
    try {
      const channelResponse = await fetch(apiUrl(`/api/channels/${channelId}`), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        channel = channelData.channel;
      } else {
        console.error('Failed to load channel data:', channelResponse.status);
      }
    } catch (error) {
      console.error('Error loading channel data:', error);
    } finally {
      channelLoading = false;
    }

    try {
      // Load messages from backend API
      const response = await fetch(apiUrl(`/api/channels/${channelId}/messages`), {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const fetchedMessages = Array.isArray(data) ? data : (data.messages || []);
        
        // Convert API messages to ChatMessage format
        // Use author_avatar from API (fetched from users table, so it's always current)
        messages = fetchedMessages.map((msg: any) => ({
          id: msg.id || msg.message?.id,
          authorId: msg.author_id || msg.message?.author_id,
          authorName: msg.author_name || msg.message?.author_name || currentUser?.username || 'Unknown',
          authorAvatar: msg.author_avatar || msg.message?.author_avatar || null,
          authorFont: msg.author_font || msg.message?.author_font || null,
          content: msg.content || msg.message?.content || '',
          timestamp: new Date(msg.created_at || msg.message?.created_at || Date.now()).getTime(),
          channelId,
        })).sort((a: ChatMessage, b: ChatMessage) => a.timestamp - b.timestamp);
        
        // Load Google fonts for all unique author fonts
        const uniqueFonts = [...new Set(messages.map(m => m.authorFont).filter(Boolean))];
        uniqueFonts.forEach(font => loadGoogleFont(font as string));

        // Check for unread messages
        lastReadMessageId = getLastReadMessageId(channelId);
        if (lastReadMessageId && messages.length > 0) {
          const lastReadIndex = messages.findIndex(m => m.id === lastReadMessageId);
          if (lastReadIndex >= 0 && lastReadIndex < messages.length - 1) {
            // There are unread messages
            firstUnreadIndex = lastReadIndex + 1;
            unreadCount = messages.length - firstUnreadIndex;
            hasUnreadMessages = true;
            showNewMessagesBanner = true;
          } else if (lastReadIndex === -1) {
            // Last read message not found (maybe deleted), show all as unread
            firstUnreadIndex = 0;
            unreadCount = messages.length;
            hasUnreadMessages = true;
            showNewMessagesBanner = true;
          } else {
            // All messages read
            hasUnreadMessages = false;
            showNewMessagesBanner = false;
            firstUnreadIndex = -1;
            unreadCount = 0;
          }
        } else if (messages.length > 0) {
          // First time viewing channel - mark all as read
          markAllAsRead();
        }
      } else if (response.status === 401) {
        console.error('Unauthorized - token may be invalid');
        messages = [];
      } else {
        console.warn('Failed to load messages from API, using fallback');
        messages = getMockMessages();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      messages = getMockMessages();
    }

      // Initialize Ably for real-time updates
    try {
      const currentClient = getAblyClient();
      if (!currentClient) {
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
        } else {
          console.warn('Cannot initialize Ably: currentUser not available');
        }
      }

      // Unsubscribe from previous channel if exists
      if (ablyChannel) {
        unsubscribeFromChannel(`channel:${channelId}`);
        await leavePresence(`channel:${channelId}`);
      }

      // Subscribe to new channel for real-time messages
      const channelName = `channel:${channelId}`;
      ablyChannel = subscribeToChannel(channelName, (message) => {
        // Only add if message is for this channel and not from current user
        if (message.channelId === channelId && message.authorId !== visitorId) {
          // Check if message already exists (avoid duplicates)
          if (!messages.find(m => m.id === message.id)) {
            // If message is marked as large, skip it - it will be fetched via API polling
            // Large messages are not published through Ably to avoid size limit errors
            if ((message as any).large) {
              console.log('Large message notification received, will be fetched via API');
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
    } catch (error) {
      console.warn('Ably initialization failed, continuing without real-time updates:', error);
    }

    loading = false;
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
    return content.replace(/@(\w+\s?\w*)/g, '<span class="mention">@$1</span>');
  }

  function handleUserClick(message: ChatMessage) {
    dispatch('viewUserProfile', {
      userId: message.authorId,
      username: message.authorName,
      avatar: message.authorAvatar,
    });
  }
</script>

<div class="chat-area">
  <!-- Radial gradient background -->
  <div class="bg-gradient"></div>
  
  <!-- Frosted Glass Header -->
  <header class="chat-header">
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
          <h2 class="channel-name">Loading...</h2>
        {:else if channel}
          <h2 class="channel-name">{channel.name}</h2>
          {#if channel.topic}
            <span class="channel-meta">{channel.topic}</span>
          {/if}
        {:else}
          <h2 class="channel-name">Unknown Channel</h2>
        {/if}
      </div>
    </div>
    <div class="header-actions">
      <button class="header-btn" aria-label="Call">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92V19.92C22 20.48 21.56 20.93 21 20.97C20.83 20.99 20.67 21 20.5 21C10.29 21 2 12.71 2 2.5C2 2.33 2.01 2.17 2.03 2C2.07 1.44 2.52 1 3.08 1H6.08C6.57 1 6.99 1.36 7.07 1.84C7.14 2.28 7.25 2.71 7.4 3.12C7.55 3.53 7.45 3.99 7.14 4.3L5.39 6.05C6.51 8.18 8.32 9.99 10.45 11.11L12.2 9.36C12.51 9.05 12.97 8.95 13.38 9.1C13.79 9.25 14.22 9.36 14.66 9.43C15.14 9.51 15.5 9.93 15.5 10.42V13.42"/>
        </svg>
      </button>
      <button class="header-btn" aria-label="Search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21L16.65 16.65"/>
        </svg>
      </button>
      <button class="header-btn grid" aria-label="Grid view" on:click={() => dispatch('openGroupInfo')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- Messages -->
  <div class="messages-container" bind:this={messagesContainer} on:scroll={handleScroll}>
    {#if loading}
      <div class="loading">Loading messages...</div>
    {:else}
      {#each messages as message, index (message.id)}
        {#if index === firstUnreadIndex && hasUnreadMessages}
          <div class="unread-separator">
            <div class="unread-line"></div>
            <span class="unread-text">New Messages ({unreadCount})</span>
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
        <div class="message-wrapper" class:new-author={shouldShowAvatar(message, index)} class:unread={index >= firstUnreadIndex && hasUnreadMessages}>
          {#if shouldShowAvatar(message, index)}
            <button class="message-avatar" on:click={() => handleUserClick(message)} aria-label="View {message.authorName}'s profile">
              <Avatar 
                src={message.authorAvatar}
                username={message.authorName}
                userId={message.authorId}
                size={40}
              />
            </button>
          {:else}
            <div class="message-avatar-spacer"></div>
          {/if}
          
          <div class="message-content">
            {#if shouldShowHeader(message, index)}
              <div class="message-header">
                <button 
                  class="message-author" 
                  on:click={() => handleUserClick(message)}
                  style={message.authorFont ? `font-family: '${message.authorFont}', sans-serif;` : ''}
                >{message.authorName}</button>
                <span class="message-time">{formatTimestamp(message.timestamp)}</span>
              </div>
            {/if}

            {#if message.content}
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
                          src="https://www.instagram.com/p/{embed.embedId}/embed/captioned/"
                          title="Instagram post"
                          frameborder="0"
                          scrolling="no"
                          allowtransparency={true}
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
          </div>
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
      <button class="gif-btn" class:active={showGifPicker} on:click={toggleGifPicker} aria-label="GIF">
        <span class="gif-label">GIF</span>
      </button>
      <input
        type="text"
        bind:value={messageContent}
        on:keydown={handleKeydown}
        on:input={handleInput}
        placeholder="Type something here..."
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
            placeholder="Search GIFs..."
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
            <div class="gif-loading">Loading...</div>
          {:else if gifResults.length === 0}
            <div class="gif-empty">No GIFs found</div>
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
          <span>Powered by</span>
          <img src="https://giphy.com/static/img/giphy_logo_square_social.png" alt="GIPHY" class="giphy-logo" />
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .chat-area {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex: 1;
    position: relative;
    background: #0a0a14;
    overflow: hidden;
  }

  /* Radial gradient background */
  .bg-gradient {
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse 80% 50% at 50% 100%, rgba(26, 54, 93, 0.2) 0%, transparent 50%),
      radial-gradient(ellipse 60% 40% at 70% 90%, rgba(49, 130, 206, 0.12) 0%, transparent 40%),
      radial-gradient(ellipse 50% 30% at 30% 95%, rgba(99, 179, 237, 0.08) 0%, transparent 35%);
    pointer-events: none;
  }

  /* Frosted Glass Header */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
    z-index: 10;
  }

  .channel-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .channel-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(26, 54, 93, 0.5);
  }

  .channel-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .channel-name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .channel-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .header-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .header-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .header-btn.grid {
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
  }

  /* Messages Container */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    z-index: 1;
    /* Ensure scrolling starts from bottom */
    scroll-behavior: smooth;
  }

  .loading {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    padding: 40px;
  }

  .channel-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.1);
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Message Wrapper - Discord style */
  .message-wrapper {
    display: flex;
    gap: 12px;
    padding: 4px 16px;
    position: relative;
    transition: background-color 0.1s ease;
  }

  .message-wrapper.new-author {
    margin-top: 16px;
  }

  .message-wrapper:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  /* Day Separator */
  .day-separator {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 16px 8px;
    margin-top: 8px;
  }

  .day-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .day-text {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  /* Unread Messages Separator */
  .unread-separator {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    margin-top: 8px;
  }

  .unread-line {
    flex: 1;
    height: 1px;
    background: #ef4444;
  }

  .unread-text {
    font-size: 12px;
    font-weight: 600;
    color: #ef4444;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .message-wrapper.unread {
    background: rgba(239, 68, 68, 0.03);
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
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    border: none;
    border-radius: 20px;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    animation: slideDown 0.3s ease;
  }

  .new-messages-banner:hover {
    transform: translateX(-50%) scale(1.05);
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
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    cursor: pointer;
    transition: border-radius 0.2s ease;
    border: none;
    background: transparent;
    padding: 0;
  }

  .message-avatar:hover {
    border-radius: 12px;
  }

  .message-avatar:focus {
    outline: 2px solid #3182ce;
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
    color: rgba(255, 255, 255, 0.3);
  }

  .message-avatar-spacer {
    width: 40px;
    flex-shrink: 0;
  }

  .message-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .message-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    line-height: 1.375;
  }

  .message-author {
    font-weight: 300;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font-family: inherit;
  }

  .message-author:hover {
    text-decoration: underline;
  }

  .message-author:focus {
    outline: none;
    text-decoration: underline;
  }

  .message-time {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 400;
  }

  /* Message Text - Discord style */
  .message-text {
    color: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    line-height: 1.375;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message-text :global(.mention) {
    color: #63b3ed;
    font-weight: 500;
    background-color: rgba(99, 179, 237, 0.1);
    padding: 0 2px;
    border-radius: 3px;
  }

  .message-reactions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .reaction {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reaction:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .reaction.purple {
    background: rgba(26, 54, 93, 0.3);
    border-color: rgba(26, 54, 93, 0.4);
    color: #63b3ed;
  }

  /* Attachments */
  .attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }

  .audio-attachment {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 24px;
  }

  .play-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: #1a365d;
    color: #fff;
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
    height: 24px;
  }

  .wave-bar {
    width: 2px;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 2px;
  }

  .duration {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-left: 8px;
  }

  .image-attachment {
    width: 120px;
    height: 120px;
    border-radius: 12px;
    overflow: hidden;
  }

  .image-attachment img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .more-images {
    width: 120px;
    height: 120px;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 600;
    color: #fff;
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    position: relative;
    z-index: 1;
  }

  .typing-dots {
    display: flex;
    gap: 4px;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    animation: bounce 1.4s infinite ease-in-out;
  }

  .dot:nth-child(1) { animation-delay: 0s; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }

  .typing-text strong {
    color: #fff;
  }

  /* Input Area */
  .input-area {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    position: relative;
    z-index: 10;
  }

  .input-avatar {
    width: 44px;
    height: 44px;
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
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 28px;
    padding: 6px 6px 6px 6px;
  }

  .attach-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease;
  }

  .attach-btn:hover {
    color: #fff;
  }

  .gif-btn {
    padding: 6px 12px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.15s ease;
    margin-right: 8px;
  }

  .gif-btn:hover {
    border-color: rgba(255, 255, 255, 0.4);
    color: #fff;
  }

  .gif-btn.active {
    background: rgba(49, 130, 206, 0.3);
    border-color: rgba(49, 130, 206, 0.6);
    color: #63b3ed;
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
  }

  .message-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
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
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.5);
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
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 4px;
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .send-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 20px rgba(26, 54, 93, 0.4);
  }

  /* GIF Picker */
  .gif-picker {
    position: absolute;
    bottom: 100%;
    left: 60px;
    right: 20px;
    max-width: 400px;
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    margin-bottom: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(20px);
    z-index: 100;
  }

  .gif-picker-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .gif-search {
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 10px 14px;
    color: #fff;
    font-size: 14px;
  }

  .gif-search::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .gif-search:focus {
    outline: none;
    border-color: rgba(49, 130, 206, 0.5);
  }

  .gif-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .gif-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .gif-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 12px;
    max-height: 300px;
    overflow-y: auto;
  }

  .gif-grid::-webkit-scrollbar {
    width: 6px;
  }

  .gif-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .gif-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .gif-loading,
  .gif-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .gif-item {
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.15s ease;
  }

  .gif-item:hover {
    transform: scale(1.05);
  }

  .gif-item img {
    width: 100%;
    height: 100px;
    object-fit: cover;
    display: block;
  }

  .gif-powered {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .giphy-logo {
    height: 16px;
    width: auto;
  }

  /* Message GIF */
  .message-gif {
    margin-top: 8px;
    max-width: 300px;
    border-radius: 12px;
    overflow: hidden;
  }

  .message-gif img {
    width: 100%;
    height: auto;
    display: block;
    max-height: 250px;
    object-fit: contain;
  }

  /* Image Preview */
  .image-preview {
    position: absolute;
    bottom: 100%;
    left: 60px;
    right: 20px;
    max-width: 300px;
    background: rgba(30, 30, 30, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    margin-bottom: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(20px);
    z-index: 100;
  }

  .image-preview-content {
    padding: 12px;
  }

  .image-preview-content img {
    width: 100%;
    max-height: 200px;
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
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .image-preview-actions {
    display: flex;
    gap: 8px;
  }

  .image-cancel-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .image-cancel-btn:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
  }

  .image-cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .image-send-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
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
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Social Media Embeds */
  .social-embed {
    margin-top: 8px;
    max-width: 400px;
  }

  /* YouTube Embed */
  .youtube-embed {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    border-radius: 12px;
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
    max-width: 400px;
    border-radius: 12px;
    overflow: hidden;
    background: #000;
  }

  .instagram-embed iframe {
    width: 100%;
    min-height: 480px;
    border: none;
    background: #000;
  }

  /* Twitter/X Embed */
  .twitter-embed {
    width: 100%;
    max-width: 400px;
    border-radius: 12px;
    overflow: hidden;
    background: #15202b;
  }

  .twitter-embed iframe {
    width: 100%;
    min-height: 300px;
    border: none;
  }
</style>
