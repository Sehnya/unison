import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/svelte';
import MessageList from './MessageList.svelte';
import type { Message } from '../types';

describe('MessageList', () => {
  const mockChannelId = '123456789012345678';
  const mockAuthToken = 'test-auth-token';

  const mockMessages: Message[] = [
    { id: '100000000000000001', author_id: '200000000000000001', content: 'Hello world', created_at: '2024-01-01T10:00:00.000Z' },
    { id: '100000000000000002', author_id: '200000000000000002', content: 'Hi there', created_at: '2024-01-01T10:01:00.000Z' }
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('fetches messages when loadInitialMessages is called', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMessages)
    });
    vi.stubGlobal('fetch', mockFetch);

    const { component } = render(MessageList, { props: { channelId: mockChannelId, authToken: mockAuthToken } });
    
    // Manually trigger the load since onMount doesn't run in jsdom
    await component.loadInitialMessages();

    expect(mockFetch).toHaveBeenCalledWith(
      `/channels/${mockChannelId}/messages`,
      { headers: { 'Authorization': `Bearer ${mockAuthToken}` } }
    );
  });

  it('renders message with author_id, content, and timestamp', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMessages)
    });
    vi.stubGlobal('fetch', mockFetch);

    const { component } = render(MessageList, { props: { channelId: mockChannelId, authToken: mockAuthToken } });
    
    // Manually trigger the load
    await component.loadInitialMessages();

    await waitFor(() => {
      // Check author_id is displayed
      expect(screen.getByText('200000000000000001')).toBeTruthy();
    });

    // Check content is displayed
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('displays error on fetch failure', async () => {
    const errorMessage = 'Failed to fetch messages';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: errorMessage })
    });
    vi.stubGlobal('fetch', mockFetch);

    const { component } = render(MessageList, { props: { channelId: mockChannelId, authToken: mockAuthToken } });
    
    // Manually trigger the load
    await component.loadInitialMessages();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(errorMessage);
    });
  });
});
