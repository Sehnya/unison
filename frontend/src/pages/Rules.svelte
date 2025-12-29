<script lang="ts">
  import { onMount } from 'svelte';

  let mounted = false;
  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
<div class="rules-page">
  <div class="rules-container">
    <header class="rules-header">
      <h1>Community Rules & Guidelines</h1>
      <p class="subtitle">Our commitment to a respectful and enjoyable community</p>
    </header>

    <div class="rules-content">
      <section class="rule-section">
        <h2>1. Respect</h2>
        <p>
          Treat all members of our community with dignity and kindness. We are a diverse group of individuals 
          with different backgrounds, experiences, and perspectives. Respectful communication means:
        </p>
        <ul>
          <li>Using appropriate language and tone in all interactions</li>
          <li>Listening to others' viewpoints without interruption or dismissal</li>
          <li>Avoiding personal attacks, harassment, or discriminatory behavior</li>
          <li>Being patient and understanding with fellow community members</li>
          <li>Respecting privacy and personal boundaries</li>
        </ul>
      </section>

      <section class="rule-section">
        <h2>2. Honesty</h2>
        <p>
          Integrity in communication builds trust. We expect all members to be truthful and transparent:
        </p>
        <ul>
          <li>Provide accurate information when sharing knowledge or experiences</li>
          <li>Be honest about your identity and intentions</li>
          <li>Admit mistakes and take responsibility for your actions</li>
          <li>Do not spread misinformation or false claims</li>
          <li>Report issues or concerns truthfully</li>
        </ul>
      </section>

      <section class="rule-section">
        <h2>3. Integrity</h2>
        <p>
          Act with moral principles and ethical behavior in all your interactions:
        </p>
        <ul>
          <li>Follow through on commitments and promises</li>
          <li>Do not engage in cheating, exploitation, or manipulation</li>
          <li>Respect intellectual property and give credit where due</li>
          <li>Maintain confidentiality when appropriate</li>
          <li>Uphold the spirit of the rules, not just the letter</li>
        </ul>
      </section>

      <section class="rule-section">
        <h2>4. Accountability</h2>
        <p>
          Take ownership of your actions and their consequences:
        </p>
        <ul>
          <li>Accept responsibility for mistakes and work to correct them</li>
          <li>Follow community guidelines and platform rules</li>
          <li>Understand that actions have consequences</li>
          <li>Participate constructively in conflict resolution</li>
          <li>Learn from feedback and improve your behavior</li>
        </ul>
      </section>

      <section class="rule-section">
        <h2>5. Fun</h2>
        <p>
          While we take our community seriously, we also want everyone to enjoy their time here:
        </p>
        <ul>
          <li>Engage in positive and constructive conversations</li>
          <li>Share your interests, hobbies, and passions</li>
          <li>Participate in community events and activities</li>
          <li>Celebrate others' achievements and successes</li>
          <li>Create a welcoming atmosphere for new members</li>
        </ul>
      </section>

      <section class="consequences-section">
        <h2>Consequences</h2>
        <p>
          Violations of these rules may result in warnings, temporary restrictions, or permanent removal from 
          the community, depending on the severity and frequency of the offense. Our goal is to maintain a 
          safe and enjoyable environment for all members.
        </p>
      </section>

      <section class="contact-section">
        <h2>Questions or Concerns?</h2>
        <p>
          If you have questions about these rules or need to report a violation, please contact us at 
          <a href="mailto:sehnyaw@gmail.com">sehnyaw@gmail.com</a>.
        </p>
      </section>
    </div>

    <footer class="rules-footer">
      <a href="/" class="back-link">← Back to App</a>
    </footer>
  </div>
</div>
{/if}

<style>
  .rules-page {
    min-height: 100vh;
    background: #0a0a14;
    color: #fff;
    padding: 40px 20px;
  }

  .rules-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .rules-header {
    text-align: center;
    margin-bottom: 48px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .rules-header h1 {
    font-size: 36px;
    font-weight: 700;
    margin: 0 0 12px 0;
    color: #fff;
  }

  .rules-header .subtitle {
    font-size: 18px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .rules-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .rule-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 24px;
  }

  .rule-section h2 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 16px 0;
    color: #fff;
  }

  .rule-section p {
    font-size: 16px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 16px 0;
  }

  .rule-section ul {
    margin: 0;
    padding-left: 24px;
    list-style: none;
  }

  .rule-section ul li {
    font-size: 15px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
    position: relative;
    padding-left: 20px;
  }

  .rule-section ul li::before {
    content: "•";
    position: absolute;
    left: 0;
    color: rgba(255, 255, 255, 0.5);
    font-weight: bold;
  }

  .consequences-section,
  .contact-section {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 24px;
  }

  .consequences-section h2,
  .contact-section h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 12px 0;
    color: #fff;
  }

  .consequences-section p,
  .contact-section p {
    font-size: 15px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }

  .contact-section a {
    color: #63b3ed;
    text-decoration: none;
    font-weight: 500;
  }

  .contact-section a:hover {
    text-decoration: underline;
  }

  .rules-footer {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .back-link {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: 15px;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: #fff;
  }
</style>

