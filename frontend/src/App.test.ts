import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import App from './App.svelte';

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows LoginForm when unauthenticated', () => {
    render(App);

    // LoginForm should be visible with email/password inputs
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /login/i })).toBeTruthy();
  });

  it('shows ChatView after successful authentication', async () => {
    const mockToken = 'test-access-token';
    
    // Mock successful login
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        user: { id: '1', email: 'test@example.com', username: 'testuser' },
        tokens: { access_token: mockToken, refresh_token: 'rt' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    render(App);

    // Fill in login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    await fireEvent.click(submitButton);

    // After authentication, ChatView should be shown (contains message input)
    await waitFor(() => {
      // ChatView contains MessageInput which has a send button
      expect(screen.getByRole('button', { name: /send/i })).toBeTruthy();
    });

    // LoginForm should no longer be visible
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it('updates state when authenticated event is received', async () => {
    const mockToken = 'test-access-token';
    
    // Mock successful login followed by message fetch
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          user: { id: '1', email: 'test@example.com', username: 'testuser' },
          tokens: { access_token: mockToken, refresh_token: 'rt' }
        })
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });
    vi.stubGlobal('fetch', mockFetch);

    render(App);

    // Initially shows login form
    expect(screen.getByLabelText(/email/i)).toBeTruthy();

    // Perform login
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    await fireEvent.click(screen.getByRole('button', { name: /login/i }));

    // State should update - ChatView should now be rendered
    await waitFor(() => {
      expect(screen.queryByLabelText(/email/i)).toBeNull();
    });
  });
});
