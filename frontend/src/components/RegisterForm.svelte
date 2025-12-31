<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LoginResponse, ApiError } from '../types';
  import { apiUrl } from '../lib/api';

  const dispatch = createEventDispatcher<{ 
    authenticated: { token: string; user?: unknown };
    switchToLogin: void;
  }>();

  let username: string = '';
  let email: string = '';
  let password: string = '';
  let confirmPassword: string = '';
  let error: string = '';
  let loading: boolean = false;

  async function handleSubmit() {
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      // Try to parse response as JSON
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error('Server returned invalid response');
          }
        }
      }

      if (!response.ok) {
        const errorMessage = data?.error?.message || data?.message || `Registration failed (${response.status})`;
        throw new Error(errorMessage);
      }

      if (!data) {
        throw new Error('Server returned empty response');
      }

      dispatch('authenticated', { 
        token: data.tokens.access_token,
        user: data.user
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Registration failed';
    } finally {
      loading = false;
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="register-form">
  <div class="logo">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
    </svg>
  </div>
  <h2>Create Account</h2>
  <p class="subtitle">Join the community today</p>
  
  <div class="form-group">
    <label for="username">Username</label>
    <input
      id="username"
      type="text"
      bind:value={username}
      placeholder="Choose a username"
      required
      disabled={loading}
    />
  </div>

  <div class="form-group">
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bind:value={email}
      placeholder="Enter your email"
      required
      disabled={loading}
    />
  </div>

  <div class="form-group">
    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      bind:value={password}
      placeholder="Create a password"
      required
      disabled={loading}
    />
  </div>

  <div class="form-group">
    <label for="confirmPassword">Confirm Password</label>
    <input
      id="confirmPassword"
      type="password"
      bind:value={confirmPassword}
      placeholder="Confirm your password"
      required
      disabled={loading}
    />
  </div>

  {#if error}
    <div class="error" role="alert">{error}</div>
  {/if}

  <button type="submit" disabled={loading}>
    {loading ? 'Creating account...' : 'Create Account'}
  </button>

  <p class="switch-text">
    Already have an account? 
    <button type="button" class="link-btn" on:click={() => dispatch('switchToLogin')}>
      Sign in
    </button>
  </p>
</form>

<style>
  .register-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    width: 100%;
    max-width: 380px;
    padding: 2.5rem;
    background: #050505;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .logo {
    width: 48px;
    height: 48px;
    margin: 0 auto 0.5rem;
    background: #fff;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #050505;
  }

  h2 {
    margin: 0;
    text-align: center;
    color: #fff;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .subtitle {
    margin: 0 0 0.5rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  input {
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
  }

  input:disabled {
    opacity: 0.5;
  }

  .error {
    color: #ff6b6b;
    font-size: 13px;
    padding: 12px 14px;
    background: rgba(255, 107, 107, 0.08);
    border: 1px solid rgba(255, 107, 107, 0.15);
    border-radius: 10px;
  }

  button[type="submit"] {
    padding: 12px 24px;
    background: #fff;
    color: #050505;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
    margin-top: 0.5rem;
  }

  button[type="submit"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button[type="submit"]:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
  }

  .switch-text {
    text-align: center;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    margin: 0.5rem 0 0;
  }

  .link-btn {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    font-weight: 500;
    transition: opacity 0.2s;
  }

  .link-btn:hover {
    opacity: 0.7;
  }
</style>
