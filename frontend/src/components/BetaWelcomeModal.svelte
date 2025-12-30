<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { apiUrl } from '../lib/api';

  export let authToken: string = '';
  export let userId: string = '';

  const dispatch = createEventDispatcher<{
    accepted: void;
  }>();

  let rulesAccepted = false;
  let loading = false;
  let error = '';

  async function handleAccept() {
    if (!rulesAccepted) {
      error = 'Please accept the rules and regulations to continue';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await fetch(apiUrl('/api/auth/accept-terms'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to accept terms');
      }

      dispatch('accepted');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to accept terms';
    } finally {
      loading = false;
    }
  }

  function openRules() {
    window.open('/rules', '_blank');
  }
</script>

<div class="modal-overlay" on:click|stopPropagation>
  <div class="modal-content" role="dialog" aria-labelledby="modal-title" aria-modal="true">
    <div class="modal-header">
      <h2 id="modal-title">Welcome to Beta</h2>
    </div>

    <div class="modal-body">
      <div class="beta-notice">
        <div class="icon">⚠️</div>
        <h3>Beta Environment Notice</h3>
        <p>
          You are accessing a <strong>Beta version</strong> of this platform. This means that some features 
          may not be fully functional, and you may encounter bugs or incomplete functionality.
        </p>
      </div>

      <div class="info-section">
        <h3>What to Expect</h3>
        <ul>
          <li>Some features may be in development or testing phases</li>
          <li>You may encounter occasional bugs or errors</li>
          <li>Performance may vary as we optimize the platform</li>
          <li>Features may change or be updated without notice</li>
        </ul>
      </div>

      <div class="support-section">
        <h3>Need Help?</h3>
        <p>
          If you encounter any issues, have questions, or would like to provide feedback, please contact us at:
        </p>
        <a href="mailto:sehnyaw@gmail.com" class="support-link">sehnyaw@gmail.com</a>
      </div>

      <div class="rules-section">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            bind:checked={rulesAccepted}
            class="checkbox"
          />
          <span class="checkbox-text">
            I have read and agree to the 
            <button type="button" class="rules-link" on:click={openRules}>
              Rules and Regulations
            </button>
            <span class="required">*</span>
          </span>
        </label>
        {#if error}
          <p class="error-message">{error}</p>
        {/if}
      </div>
    </div>

    <div class="modal-footer">
      <button 
        class="accept-button" 
        on:click={handleAccept}
        disabled={loading || !rulesAccepted}
      >
        {loading ? 'Accepting...' : 'Accept & Continue'}
      </button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .modal-content {
    background: #0a0a14;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    padding: 24px 24px 0 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 24px;
  }

  .modal-header h2 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 24px 0;
  }

  .modal-body {
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .beta-notice {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.3);
    border-radius: 12px;
    padding: 20px;
  }

  .beta-notice .icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .beta-notice h3 {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 12px 0;
  }

  .beta-notice p {
    font-size: 15px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  .info-section,
  .support-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 20px;
  }

  .info-section h3,
  .support-section h3 {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 12px 0;
  }

  .info-section p,
  .support-section p {
    font-size: 15px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 12px 0;
  }

  .info-section ul {
    margin: 0;
    padding-left: 20px;
    list-style: none;
  }

  .info-section ul li {
    font-size: 14px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
    position: relative;
    padding-left: 16px;
  }

  .info-section ul li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: rgba(255, 255, 255, 0.5);
  }

  .support-link {
    color: #63b3ed;
    text-decoration: none;
    font-weight: 500;
    font-size: 15px;
  }

  .support-link:hover {
    text-decoration: underline;
  }

  .rules-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 20px;
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
  }

  .checkbox {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    cursor: pointer;
    accent-color: #63b3ed;
  }

  .checkbox-text {
    font-size: 15px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
  }

  .rules-link {
    background: none;
    border: none;
    color: #63b3ed;
    text-decoration: underline;
    cursor: pointer;
    font-size: 15px;
    padding: 0;
    font-family: inherit;
  }

  .rules-link:hover {
    color: #90cdf4;
  }

  .required {
    color: #ef4444;
    margin-left: 4px;
  }

  .error-message {
    margin: 12px 0 0 0;
    color: #ef4444;
    font-size: 14px;
  }

  .modal-footer {
    padding: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: flex-end;
  }

  .accept-button {
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px 32px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .accept-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 54, 93, 0.4);
  }

  .accept-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

