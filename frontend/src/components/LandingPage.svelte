<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher<{
    login: void;
    register: void;
  }>();

  const nav = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how" },
    { label: "Security", href: "#security" },
    { label: "FAQ", href: "#faq" }
  ];

  let mobileOpen = false;

  const closeMobile = () => (mobileOpen = false);
  
  const scrollTo = (id: string) => {
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    closeMobile();
  };
</script>

<svelte:head>
  <title>Unison — Where conversations move as one</title>
  <meta
    name="description"
    content="Unison is a modern space for communities, teams, and friends — voice, chat, and presence without the noise."
  />
</svelte:head>

<div class="landing-page">
  <!-- Subtle background grid + glow -->
  <div class="bg-effects">
    <div class="bg-glow"></div>
    <div class="bg-grid"></div>
    <div class="bg-gradient"></div>
  </div>

  <!-- Header -->
  <header class="header">
    <div class="header-container">
      <div class="header-inner">
        <!-- Brand -->
        <a href="/" class="brand">
          <img src="/white-U.png" alt="Unison" class="brand-logo" />
          <span class="brand-name">unison</span>
          <span class="brand-badge">beta</span>
        </a>

        <!-- Desktop nav -->
        <nav class="desktop-nav">
          {#each nav as item}
            <button
              class="nav-link"
              on:click={() => scrollTo(item.href)}
              type="button"
            >
              {item.label}
            </button>
          {/each}
        </nav>

        <!-- Actions -->
        <div class="header-actions">
          <button
            class="btn-secondary"
            type="button"
            on:click={() => dispatch('login')}
          >
            Sign in
          </button>
          <button
            class="btn-primary"
            type="button"
            on:click={() => dispatch('register')}
          >
            Get Started
          </button>
        </div>

        <!-- Mobile menu button -->
        <button
          class="mobile-menu-btn"
          aria-label="Open menu"
          on:click={() => (mobileOpen = !mobileOpen)}
          type="button"
        >
          {#if !mobileOpen}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          {:else}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          {/if}
        </button>
      </div>

      {#if mobileOpen}
        <div class="mobile-nav">
          <div class="mobile-nav-inner">
            {#each nav as item}
              <button
                class="mobile-nav-link"
                on:click={() => scrollTo(item.href)}
                type="button"
              >
                {item.label}
              </button>
            {/each}
            <div class="mobile-nav-actions">
              <button
                class="btn-secondary"
                type="button"
                on:click={() => { closeMobile(); dispatch('login'); }}
              >
                Sign in
              </button>
              <button
                class="btn-primary"
                type="button"
                on:click={() => { closeMobile(); dispatch('register'); }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </header>

  <!-- Hero -->
  <main>
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <div class="hero-text">
            <h1 class="hero-logo-text">unison</h1>
            <p class="hero-badge">
              <span class="badge-dot"></span>
              Presence, voice, chat — unified
            </p>
            <h1 class="hero-title">
              Where conversations move <span class="text-muted">as one</span>
            </h1>
            <p class="hero-description">
              Unison is a modern space for communities, teams, and friends — voice, chat, and presence without the noise.
            </p>
            <div class="hero-cta">
              <button class="btn-primary btn-lg" type="button" on:click={() => dispatch('register')}>
                Get Started Free
              </button>
            </div>
            <div class="hero-features">
              <div class="hero-feature">
                <span class="feature-dot"></span>
                Low-noise channels
              </div>
              <div class="hero-feature">
                <span class="feature-dot"></span>
                Instant voice rooms
              </div>
              <div class="hero-feature">
                <span class="feature-dot"></span>
                Modern permissions
              </div>
            </div>
          </div>


        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Built for flow</h2>
          <p class="section-description">A calm, modern take on community chat — fast to join, easy to follow, hard to overwhelm.</p>
        </div>
        <div class="features-grid">
          {#each [
            { title: "Unified chat", desc: "Text, voice, and presence live together — fewer clicks, more continuity." },
            { title: "Smart spaces", desc: "Active conversations rise naturally. Quiet channels fade into the background." },
            { title: "Designed for calm", desc: "Minimal interface, intentional motion, and clear hierarchy — dark by design." }
          ] as f}
            <div class="feature-card">
              <div class="feature-icon">
                <span class="icon-circle"></span>
              </div>
              <h3 class="feature-title">{f.title}</h3>
              <p class="feature-desc">{f.desc}</p>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="section">
      <div class="container">
        <div class="how-grid">
          <div class="how-content">
            <h2 class="section-title left">Drop in. Stay synced.</h2>
            <p class="section-description left">
              Unison makes it effortless to move between messages and voice. Presence is lightweight, and spaces feel organized without feeling rigid.
            </p>
            <div class="how-items">
              {#each [
                { t: "Instant voice rooms", d: "Start a room from any channel. Join in one tap." },
                { t: "Activity-aware channels", d: "Signal bubbles up. Noise stays quiet." },
                { t: "Clarity-first UX", d: "Minimal chrome, clean typography, no clutter." }
              ] as item}
                <div class="how-item">
                  <div class="how-icon"></div>
                  <div class="how-text">
                    <div class="how-title">{item.t}</div>
                    <div class="how-desc">{item.d}</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
          <div class="how-visual">
            <div class="aesthetic-card">
              <div class="aesthetic-label">Design system</div>
              <div class="aesthetic-content">
                <div class="aesthetic-row">
                  <span>Stroke-based components</span>
                  <span class="aesthetic-badge">Minimal</span>
                </div>
                <div class="aesthetic-divider"></div>
                <div class="palette-section">
                  <div class="palette-label">Core palette</div>
                  <div class="palette-colors">
                    <div class="color-swatch black"></div>
                    <div class="color-swatch white"></div>
                    <div class="color-swatch gray-1"></div>
                    <div class="color-swatch gray-2"></div>
                  </div>
                </div>
                <div class="motion-section">
                  <div class="motion-label">Motion</div>
                  <div class="motion-items">
                    <div class="motion-item">
                      <span>Transitions</span>
                      <span class="motion-value">smooth</span>
                    </div>
                    <div class="motion-item">
                      <span>Hover effects</span>
                      <span class="motion-value">subtle</span>
                    </div>
                    <div class="motion-item">
                      <span>Scroll reveals</span>
                      <span class="motion-value">soft</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Security -->
    <section id="security" class="section">
      <div class="container">
        <div class="security-grid">
          <div class="security-header">
            <h2 class="section-title left">Private by default</h2>
            <p class="section-description left">Solid foundations for modern comms: clear permissions, moderation tools, and secure transport.</p>
          </div>
          <div class="security-cards">
            {#each [
              { t: "Granular roles", d: "Keep spaces clean with modern permission primitives." },
              { t: "Moderation tools", d: "Automations, reports, and audit-friendly actions." },
              { t: "Secure transport", d: "Industry-standard encryption in transit." },
              { t: "Data controls", d: "Simple retention + export options for teams." }
            ] as s}
              <div class="security-card">
                <div class="security-icon">
                  <div class="icon-circle"></div>
                </div>
                <h3 class="security-title">{s.t}</h3>
                <p class="security-desc">{s.d}</p>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">FAQ</h2>
          <p class="section-description">Everything you need to know.</p>
        </div>
        <div class="faq-list">
          {#each [
            { q: "Is Unison free?", a: "Unison has a generous free tier. Team features will have paid plans later." },
            { q: "Does it replace Discord?", a: "Unison is a modern alternative — calmer UI, smarter spaces, and fast voice rooms." },
            { q: "Can I import my community?", a: "We support invite links and onboarding tools. Automated imports coming soon." },
            { q: "When is launch?", a: "We're in beta now. Sign up to get access and help shape the product." }
          ] as item}
            <details class="faq-item">
              <summary class="faq-question">
                <span>{item.q}</span>
                <span class="faq-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </span>
              </summary>
              <p class="faq-answer">{item.a}</p>
            </details>
          {/each}
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section id="early" class="section cta-section">
      <div class="container">
        <div class="cta-card">
          <div class="cta-glow"></div>
          <div class="cta-content">
            <div class="cta-text">
              <h2 class="cta-title">Join the conversation — in <span class="text-muted">unison</span></h2>
              <p class="cta-description">Get access to the beta, product updates, and help shape the future of community chat.</p>
              <button class="btn-primary btn-lg" type="button" on:click={() => dispatch('register')}>
                Create your account
              </button>
              <p class="cta-note">Free to use. No credit card required.</p>
            </div>
            <div class="cta-benefits">
              <div class="benefits-label">What you'll get</div>
              <ul class="benefits-list">
                <li><span class="benefit-dot"></span>Full access to all features</li>
                <li><span class="benefit-dot"></span>Create unlimited spaces</li>
                <li><span class="benefit-dot"></span>Voice rooms with no time limits</li>
                <li><span class="benefit-dot"></span>Direct feedback channel with the team</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-brand">
            <img src="/white-U.png" alt="Unison" class="footer-logo" />
            <span class="footer-name">unison</span>
            <span class="footer-copy">© {new Date().getFullYear()}</span>
          </div>
          <div class="footer-links">
            <a class="footer-link" href="/privacy">Privacy</a>
            <a class="footer-link" href="/terms">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  </main>
</div>

<style>
  .landing-page {
    min-height: 100vh;
    background: #050505;
    color: #fff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-x: hidden;
    overflow-y: auto;
    height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Smooth scroll reveal animations */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Background effects */
  .bg-effects {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  .bg-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,255,255,0.06), transparent),
                radial-gradient(circle at 20% 80%, rgba(255,255,255,0.03), transparent 40%);
  }

  .bg-grid {
    position: absolute;
    inset: 0;
    opacity: 0.03;
    background-image: linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px);
    background-size: 64px 64px;
  }

  .bg-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(5,5,5,0.2) 0%, rgba(5,5,5,0.95) 50%, #050505 100%);
  }

  /* Container */
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* Header */
  .header {
    position: sticky;
    top: 0;
    z-index: 50;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(16px) saturate(180%);
    background: rgba(5,5,5,0.8);
  }

  .header-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
  }

  /* Brand */
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: inherit;
    transition: opacity 0.2s;
  }

  .brand:hover {
    opacity: 0.8;
  }

  .brand-logo {
    height: 28px;
    width: auto;
  }

  .brand-name {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .brand-badge {
    display: none;
    padding: 3px 10px;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.5);
  }

  @media (min-width: 640px) {
    .brand-badge { display: inline; }
  }

  /* Navigation */
  .desktop-nav {
    display: none;
    align-items: center;
    gap: 36px;
  }

  @media (min-width: 768px) {
    .desktop-nav { display: flex; }
  }

  .nav-link {
    background: none;
    border: none;
    color: rgba(255,255,255,0.5);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: color 0.2s;
    position: relative;
  }

  .nav-link::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 0;
    height: 1px;
    background: #fff;
    transition: width 0.2s;
  }

  .nav-link:hover {
    color: #fff;
  }

  .nav-link:hover::after {
    width: 100%;
  }

  /* Buttons */
  .header-actions {
    display: none;
    align-items: center;
    gap: 12px;
  }

  @media (min-width: 768px) {
    .header-actions { display: flex; }
  }

  .btn-primary {
    padding: 10px 22px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    border: none;
    border-radius: 8px;
    background: #fff;
    color: #050505;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary:hover {
    background: rgba(255,255,255,0.92);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255,255,255,0.15);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    padding: 10px 22px;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    background: transparent;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-secondary:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.15);
    color: #fff;
  }

  .btn-lg {
    padding: 14px 32px;
    font-size: 14px;
    border-radius: 10px;
  }

  /* Mobile menu */
  .mobile-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    transition: all 0.2s;
  }

  .mobile-menu-btn:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
  }

  @media (min-width: 768px) {
    .mobile-menu-btn { display: none; }
  }

  .mobile-nav {
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 16px 0;
  }

  .mobile-nav-inner {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .mobile-nav-link {
    padding: 12px 16px;
    text-align: left;
    font-size: 14px;
    font-weight: 500;
    border: none;
    border-radius: 10px;
    background: none;
    color: rgba(255,255,255,0.7);
    cursor: pointer;
    transition: all 0.2s;
  }

  .mobile-nav-link:hover {
    background: rgba(255,255,255,0.06);
    color: #fff;
  }

  .mobile-nav-actions {
    display: flex;
    gap: 10px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .mobile-nav-actions .btn-primary,
  .mobile-nav-actions .btn-secondary {
    flex: 1;
  }

  /* Hero */
  .hero {
    padding: 100px 0 80px;
    animation: fadeIn 0.8s ease-out;
  }

  @media (min-width: 768px) {
    .hero { padding: 120px 0 100px; }
  }

  .hero-content {
    text-align: center;
  }

  .hero-text {
    max-width: 800px;
    margin: 0 auto;
  }

  .hero-logo-text {
    font-size: 80px;
    font-weight: 700;
    letter-spacing: -0.05em;
    margin: 0 0 32px 0;
    background: linear-gradient(180deg, #fff 20%, rgba(255,255,255,0.5) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: fadeInUp 0.6s ease-out;
  }

  @media (min-width: 640px) {
    .hero-logo-text { font-size: 112px; }
  }

  @media (min-width: 1024px) {
    .hero-logo-text { font-size: 140px; }
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: rgba(255,255,255,0.6);
    animation: fadeInUp 0.6s ease-out 0.1s both;
  }

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    animation: pulse 2s ease-in-out infinite;
  }

  .hero-title {
    margin-top: 28px;
    font-size: 32px;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.15;
    animation: fadeInUp 0.6s ease-out 0.2s both;
  }

  @media (min-width: 640px) {
    .hero-title { font-size: 44px; }
  }

  @media (min-width: 1024px) {
    .hero-title { font-size: 52px; }
  }

  .text-muted {
    color: rgba(255,255,255,0.4);
  }

  .hero-description {
    margin-top: 24px;
    font-size: 16px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
    max-width: 560px;
    margin-left: auto;
    margin-right: auto;
    animation: fadeInUp 0.6s ease-out 0.3s both;
  }

  @media (min-width: 640px) {
    .hero-description { font-size: 17px; }
  }

  .hero-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-top: 40px;
    animation: fadeInUp 0.6s ease-out 0.4s both;
  }

  @media (min-width: 640px) {
    .hero-cta {
      flex-direction: row;
      justify-content: center;
    }
  }

  .hero-cta .btn-primary {
    width: 100%;
  }

  @media (min-width: 640px) {
    .hero-cta .btn-primary {
      width: auto;
    }
  }

  .hero-features {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 28px;
    margin-top: 48px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.35);
    animation: fadeInUp 0.6s ease-out 0.5s both;
  }

  .hero-feature {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .feature-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255,255,255,0.3);
  }



  /* Sections */
  .section {
    padding: 100px 0;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .section-header {
    max-width: 600px;
    margin: 0 auto;
    text-align: center;
  }

  .section-title {
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  @media (min-width: 640px) {
    .section-title { font-size: 36px; }
  }

  .section-title.left {
    text-align: left;
  }

  .section-description {
    margin-top: 16px;
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
  }

  .section-description.left {
    text-align: left;
  }

  /* Features */
  .features-grid {
    display: grid;
    gap: 16px;
    margin-top: 56px;
  }

  @media (min-width: 768px) {
    .features-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .feature-card {
    padding: 32px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    transition: all 0.3s ease;
  }

  .feature-card:hover {
    border-color: rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    transform: translateY(-2px);
  }

  .feature-icon {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon-circle {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.4);
    transition: border-color 0.3s;
  }

  .feature-card:hover .icon-circle {
    border-color: rgba(255,255,255,0.6);
  }

  .feature-title {
    margin-top: 20px;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .feature-desc {
    margin-top: 10px;
    font-size: 14px;
    line-height: 1.65;
    color: rgba(255,255,255,0.5);
  }

  /* How it works */
  .how-grid {
    display: grid;
    gap: 56px;
  }

  @media (min-width: 1024px) {
    .how-grid {
      grid-template-columns: 1fr 1fr;
      align-items: center;
    }
  }

  .how-items {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 36px;
  }

  .how-item {
    display: flex;
    gap: 16px;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    transition: all 0.3s ease;
  }

  .how-item:hover {
    border-color: rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
  }

  .how-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .how-title {
    font-size: 14px;
    font-weight: 600;
  }

  .how-desc {
    margin-top: 4px;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
  }

  /* Aesthetic card */
  .how-visual {
    position: relative;
  }

  .aesthetic-card {
    padding: 28px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
  }

  .aesthetic-label {
    font-size: 10px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
  }

  .aesthetic-content {
    margin-top: 24px;
  }

  .aesthetic-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
  }

  .aesthetic-badge {
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.5);
  }

  .aesthetic-divider {
    height: 1px;
    margin: 24px 0;
    background: rgba(255,255,255,0.06);
  }

  .palette-section,
  .motion-section {
    margin-top: 24px;
  }

  .palette-label,
  .motion-label {
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
  }

  .palette-colors {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }

  .color-swatch {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    transition: transform 0.2s;
  }

  .color-swatch:hover {
    transform: scale(1.05);
  }

  .color-swatch.black { background: #050505; }
  .color-swatch.white { background: #fff; }
  .color-swatch.gray-1 { background: rgba(255,255,255,0.12); }
  .color-swatch.gray-2 { background: rgba(255,255,255,0.06); }

  .motion-items {
    margin-top: 14px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.3);
  }

  .motion-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 12px;
    color: rgba(255,255,255,0.6);
  }

  .motion-value {
    color: rgba(255,255,255,0.35);
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 11px;
  }

  /* Security */
  .security-grid {
    display: grid;
    gap: 40px;
  }

  @media (min-width: 1024px) {
    .security-grid { grid-template-columns: 1fr 2fr; }
  }

  .security-cards {
    display: grid;
    gap: 12px;
  }

  @media (min-width: 640px) {
    .security-cards { grid-template-columns: repeat(2, 1fr); }
  }

  .security-card {
    padding: 24px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    transition: all 0.3s ease;
  }

  .security-card:hover {
    border-color: rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
  }

  .security-icon {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .security-title {
    margin-top: 16px;
    font-size: 15px;
    font-weight: 600;
  }

  .security-desc {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255,255,255,0.5);
  }

  /* FAQ */
  .faq-list {
    max-width: 680px;
    margin: 48px auto 0;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(255,255,255,0.02);
    overflow: hidden;
  }

  .faq-item {
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .faq-item:last-child {
    border-bottom: none;
  }

  .faq-question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    padding: 22px 24px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    list-style: none;
    transition: background 0.2s;
  }

  .faq-question:hover {
    background: rgba(255,255,255,0.02);
  }

  .faq-question::-webkit-details-marker {
    display: none;
  }

  .faq-icon {
    color: rgba(255,255,255,0.3);
    transition: all 0.3s ease;
  }

  .faq-item[open] .faq-icon {
    transform: rotate(45deg);
    color: rgba(255,255,255,0.5);
  }

  .faq-answer {
    padding: 0 24px 22px;
    font-size: 14px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
  }

  /* CTA */
  .cta-section {
    border-top: none;
    padding-bottom: 60px;
  }

  .cta-card {
    position: relative;
    overflow: hidden;
    padding: 56px 36px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.08);
    background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
  }

  @media (min-width: 640px) {
    .cta-card { padding: 64px 56px; }
  }

  .cta-glow {
    position: absolute;
    inset: 0;
    opacity: 0.3;
    background: radial-gradient(ellipse 60% 40% at 30% 20%, rgba(255,255,255,0.1), transparent);
  }

  .cta-content {
    position: relative;
    display: grid;
    gap: 48px;
  }

  @media (min-width: 1024px) {
    .cta-content {
      grid-template-columns: 1fr 1fr;
      align-items: center;
    }
  }

  .cta-title {
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.2;
  }

  @media (min-width: 640px) {
    .cta-title { font-size: 36px; }
  }

  .cta-description {
    margin-top: 18px;
    font-size: 15px;
    line-height: 1.7;
    color: rgba(255,255,255,0.5);
  }

  .cta-text .btn-primary {
    margin-top: 28px;
  }

  .cta-note {
    margin-top: 14px;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
  }

  .cta-benefits {
    padding: 28px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.3);
  }

  .benefits-label {
    font-size: 10px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
  }

  .benefits-list {
    margin-top: 20px;
    list-style: none;
    padding: 0;
  }

  .benefits-list li {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 10px 0;
    font-size: 13px;
    color: rgba(255,255,255,0.6);
  }

  .benefit-dot {
    width: 5px;
    height: 5px;
    margin-top: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.4);
    flex-shrink: 0;
  }

  /* Footer */
  .footer {
    padding: 36px 0;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  .footer-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  @media (min-width: 640px) {
    .footer-content {
      flex-direction: row;
      justify-content: space-between;
    }
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }

  .footer-logo {
    height: 22px;
    width: auto;
    opacity: 0.8;
  }

  .footer-name {
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .footer-copy {
    color: rgba(255,255,255,0.3);
  }

  .footer-links {
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .footer-link {
    font-size: 12px;
    color: rgba(255,255,255,0.4);
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: rgba(255,255,255,0.8);
  }
</style>
