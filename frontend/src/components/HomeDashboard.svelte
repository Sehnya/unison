<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Guild } from '../types';

  export let guilds: Guild[] = [];
  export let selectedGuildId: string | null = null;

  const dispatch = createEventDispatcher<{
    selectGuild: { guildId: string };
    createGuild: void;
  }>();

  // Online count - for now estimate based on member count
  // In production this would come from the gateway/presence service
  function getOnlineCount(guild: Guild): number {
    if (guild.online_count !== undefined) return guild.online_count;
    const memberCount = guild.member_count || 1;
    // Estimate ~30% online as placeholder until presence service is connected
    return Math.max(1, Math.floor(memberCount * 0.3));
  }

  function getMemberCount(guild: Guild): number {
    return guild.member_count || 1;
  }

  function getGuildInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function getGuildGradient(id: string): string {
    const gradients = [
      'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
      'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)',
      'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
      'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%)',
    ];
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
    return gradients[index];
  }

  function selectGuild(guildId: string) {
    dispatch('selectGuild', { guildId });
  }

  // Get time-based greeting
  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'good morning';
    if (hour < 18) return 'good afternoon';
    return 'good evening';
  }
</script>

<div class="dashboard">
  <header class="dashboard-header">
    <div class="header-content">
      <p class="greeting">{getGreeting()}</p>
      <h1>welcome back</h1>
      <p class="subtitle">your spaces are ready</p>
    </div>
  </header>

  <div class="section">
    <div class="section-header">
      <h2 class="section-title">your spaces</h2>
      <button class="create-btn" on:click={() => dispatch('createGuild')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        create
      </button>
    </div>

    {#if guilds.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3>no spaces yet</h3>
        <p>create your first space to get started</p>
        <button class="empty-create-btn" on:click={() => dispatch('createGuild')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          create space
        </button>
      </div>
    {:else}
      <div class="guilds-grid">
        {#each guilds as guild (guild.id)}
          {@const memberCount = getMemberCount(guild)}
          {@const onlineCount = getOnlineCount(guild)}
          <button 
            class="guild-card"
            class:selected={selectedGuildId === guild.id}
            on:click={() => selectGuild(guild.id)}
          >
            <!-- Icon -->
            <div class="card-icon-wrapper">
              {#if guild.icon}
                <img src={guild.icon} alt={guild.name} class="card-icon" />
              {:else}
                <div class="card-icon-placeholder" style="background: {getGuildGradient(guild.id)}">
                  {getGuildInitials(guild.name)}
                </div>
              {/if}
            </div>

            <!-- Content -->
            <div class="card-content">
              <h3 class="guild-name">{guild.name.toLowerCase()}</h3>
              
              {#if guild.description}
                <p class="guild-description">{guild.description.toLowerCase()}</p>
              {/if}

              <div class="guild-stats">
                <div class="stat">
                  <span class="status-indicator">
                    <span class="status-dot"></span>
                  </span>
                  <span class="stat-text">{onlineCount} online</span>
                </div>
                <div class="stat">
                  <span class="stat-text">{memberCount} members</span>
                </div>
              </div>
            </div>

            <!-- Arrow -->
            <div class="card-arrow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard {
    flex: 1;
    height: 100%;
    overflow-y: auto;
    background: #050505;
    padding: 48px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .dashboard-header {
    margin-bottom: 40px;
  }

  .greeting {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 0.02em;
  }

  .header-content h1 {
    margin: 0;
    font-size: 48px;
    font-weight: 600;
    color: #fff;
    letter-spacing: -0.04em;
  }

  .subtitle {
    margin: 12px 0 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Section */
  .section {
    margin-bottom: 32px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.02em;
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .create-btn:hover {
    background: #fff;
    border-color: #fff;
    color: #050505;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    text-align: center;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    color: rgba(255, 255, 255, 0.25);
  }

  .empty-state h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  .empty-state p {
    margin: 0 0 28px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
  }

  .empty-create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: #fff;
    border: none;
    border-radius: 10px;
    color: #050505;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .empty-create-btn:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(255, 255, 255, 0.15);
  }

  /* Guilds Grid */
  .guilds-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .guild-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .guild-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .guild-card.selected {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
  }

  /* Card Icon */
  .card-icon-wrapper {
    flex-shrink: 0;
  }

  .card-icon, .card-icon-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  .card-icon {
    object-fit: cover;
  }

  .card-icon-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Card Content */
  .card-content {
    flex: 1;
    min-width: 0;
  }

  .guild-name {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .guild-description {
    margin: 0 0 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Stats */
  .guild-stats {
    display: flex;
    gap: 16px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Pulsating status indicator like DaisyUI */
  .status-indicator {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 10px;
    height: 10px;
  }

  .status-dot {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
  }

  .status-dot::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: #22c55e;
    opacity: 0.4;
    animation: pulse-ring 1.5s ease-out infinite;
  }

  @keyframes pulse-ring {
    0% {
      transform: scale(1);
      opacity: 0.4;
    }
    100% {
      transform: scale(1.8);
      opacity: 0;
    }
  }

  .stat-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
  }

  /* Arrow */
  .card-arrow {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
  }

  .guild-card:hover .card-arrow {
    color: rgba(255, 255, 255, 0.5);
    transform: translateX(4px);
  }

  /* Scrollbar */
  .dashboard::-webkit-scrollbar {
    width: 6px;
  }

  .dashboard::-webkit-scrollbar-track {
    background: transparent;
  }

  .dashboard::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
  }

  .dashboard::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .dashboard {
      padding: 24px;
    }

    .header-content h1 {
      font-size: 36px;
    }
  }
</style>
