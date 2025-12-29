import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import LoginForm from './LoginForm.svelte';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders email and password inputs', () => {
    render(LoginForm);

    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /login/i })).toBeTruthy();
  });

  it('emits authenticated event on successful login', async () => {
    const mockToken = 'test-access-token';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        user: { id: '1', email: 'test@example.com', username: 'testuser' },
        tokens: { access_token: mockToken, refresh_token: 'rt' }
      })
    });
    vi.stubGlobal('fetch', mockFetch);

    const { component } = render(LoginForm);
    const authenticatedHandler = vi.fn();
    component.$on('authenticated', authenticatedHandler);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'password123' } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(authenticatedHandler).toHaveBeenCalledTimes(1);
    });

    expect(authenticatedHandler.mock.calls[0][0].detail).toEqual({ token: mockToken });
    expect(mockFetch).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
    });
  });

  it('displays error on failed login', async () => {
    const errorMessage = 'Invalid credentials';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: errorMessage })
    });
    vi.stubGlobal('fetch', mockFetch);

    render(LoginForm);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(errorMessage);
    });
  });
});
