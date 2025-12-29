import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import MessageInput from './MessageInput.svelte';

describe('MessageInput', () => {
  const defaultProps = {
    channelId: '123456789012345678',
    authToken: 'test-token'
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders input and send button', () => {
    render(MessageInput, { props: defaultProps });

    expect(screen.getByRole('textbox', { name: /message content/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /send/i })).toBeTruthy();
  });

  it('prevents empty message submission - button disabled when input empty', () => {
    render(MessageInput, { props: defaultProps });

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toHaveProperty('disabled', true);
  });

  it('enables send button when input has content', async () => {
    render(MessageInput, { props: defaultProps });

    const input = screen.getByRole('textbox', { name: /message content/i });
    const sendButton = screen.getByRole('button', { name: /send/i });

    await fireEvent.input(input, { target: { value: 'Hello world' } });

    expect(sendButton).toHaveProperty('disabled', false);
  });

  it('clears input and emits messageSent event on successful send', async () => {
    const mockMessage = {
      id: '987654321098765432',
      author_id: '111111111111111111',
      content: 'Hello world',
      created_at: '2024-01-01T12:00:00Z'
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockMessage)
    });
    vi.stubGlobal('fetch', mockFetch);

    const { component } = render(MessageInput, { props: defaultProps });
    const messageSentHandler = vi.fn();
    component.$on('messageSent', messageSentHandler);

    const input = screen.getByRole('textbox', { name: /message content/i }) as HTMLInputElement;
    const sendButton = screen.getByRole('button', { name: /send/i });

    await fireEvent.input(input, { target: { value: 'Hello world' } });
    await fireEvent.click(sendButton);

    await waitFor(() => {
      expect(messageSentHandler).toHaveBeenCalledTimes(1);
    });

    expect(messageSentHandler.mock.calls[0][0].detail).toEqual({ message: mockMessage });
    expect(input.value).toBe('');
    expect(mockFetch).toHaveBeenCalledWith('/channels/123456789012345678/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({ content: 'Hello world' })
    });
  });

  it('displays error on failed send', async () => {
    const errorMessage = 'Failed to send message';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: errorMessage })
    });
    vi.stubGlobal('fetch', mockFetch);

    render(MessageInput, { props: defaultProps });

    const input = screen.getByRole('textbox', { name: /message content/i });
    const sendButton = screen.getByRole('button', { name: /send/i });

    await fireEvent.input(input, { target: { value: 'Hello world' } });
    await fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(errorMessage);
    });
  });
});
