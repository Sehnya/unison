<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LoginResponse, ApiError } from '../types';
  import { apiUrl } from '../lib/api';

  const dispatch = createEventDispatcher<{ 
    authenticated: { token: string; user?: unknown };
    switchToRegister: void;
  }>();

  let email: string = '';
  let password: string = '';
  let error: string = '';
  let loading: boolean = false;

  async function handleSubmit() {
    loading = true;
    error = '';

    try {
      console.log('Attempting login for:', email);
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      console.log('Login response status:', response.status, response.statusText);

      // Parse response as JSON
      let data;
      try {
        const text = await response.text();
        console.log('Login response text:', text.substring(0, 200));
        data = text ? JSON.parse(text) : null;
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Server returned invalid response');
      }

      if (!response.ok) {
        const errorMessage = data?.error?.message || data?.message || `Login failed (${response.status})`;
        console.error('Login failed:', errorMessage, data);
        throw new Error(errorMessage);
      }

      // Validate response structure
      if (!data) {
        throw new Error('Server returned empty response');
      }

      if (!data.tokens || !data.tokens.access_token) {
        console.error('Invalid response structure:', data);
        throw new Error('Invalid response: missing access token');
      }

      if (!data.user) {
        console.error('Invalid response structure:', data);
        throw new Error('Invalid response: missing user data');
      }

      console.log('Login successful, dispatching authenticated event');
      dispatch('authenticated', { 
        token: data.tokens.access_token,
        user: data.user
      });
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        error = 'Network error: Could not connect to server. Please check if the API server is running.';
      } else {
        error = err instanceof Error ? err.message : 'Login failed';
      }
    } finally {
      loading = false;
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit} class="login-form">
  <div class="logo">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"/>
    </svg>
  </div>
  <h2>Welcome Back</h2>
  <p class="subtitle">Sign in to continue to your account</p>
  
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
      placeholder="Enter your password"
      required
      disabled={loading}
    />
  </div>

  {#if error}
    <div class="error" role="alert">{error}</div>
  {/if}

  <button type="submit" disabled={loading}>
    {loading ? 'Signing in...' : 'Sign In'}
  </button>

  <p class="switch-text">
    Don't have an account? 
    <button type="button" class="link-btn" on:click={() => dispatch('switchToRegister')}>
      Create one
    </button>
  </p>
</form>

<style>
  .login-form {
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
