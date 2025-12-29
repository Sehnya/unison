import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import ChatView from './ChatView.svelte';
import type { Message } from '../types';

describe('ChatView', () => {
  const mockAuthToken = 'test-auth-token';

  const mockMessages: Message[] = [
    { id: '100000000000000001', author_id: '200000000000000001', content: 'Hello world', created_at: '2024-01-01T10:00:00.000Z' }
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('composes MessageList and MessageInput components', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMessages)
    });
    vi.stubGlobal('fetch', mockFetch);

    render(ChatView, { props: { authToken: mockAuthToken } });

    // MessageInput renders input and button
    expect(screen.getByRole('textbox', { name: /message content/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /send/i })).toBeTruthy();

    // MessageList container exists (loading state initially)
    expect(screen.getByText('Loading messages...')).toBeTruthy();
  });

  it('passes correct props to child components and handles message sending', async () => {
    const newMessage: Message = {
      id: '100000000000000002',
      author_id: '200000000000000001',
      content: 'New message',
      created_at: '2024-01-01T10:05:00.000Z'
    };

    // Mock fetch for initial load and message send
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockMessages)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(newMessage)
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });
    vi.stubGlobal('fetch', mockFetch);

    render(ChatView, { props: { authToken: mockAuthToken } });

    // Type and send a new message
    const input = screen.getByRole('textbox', { name: /message content/i });
    const sendButton = screen.getByRole('button', { name: /send/i });

    await fireEvent.input(input, { target: { value: 'New message' } });
    await fireEvent.click(sendButton);

    // Verify the POST request was made with correct auth header
    await waitFor(() => {
      const postCall = mockFetch.mock.calls.find(call => 
        call[1]?.method === 'POST'
      );
      expect(postCall).toBeTruthy();
      expect(postCall[1].headers['Authorization']).toBe(`Bearer ${mockAuthToken}`);
    });

    // Input should be cleared after successful send
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });
});
