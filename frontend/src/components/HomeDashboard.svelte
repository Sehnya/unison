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
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)',
      'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
    ];
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % gradients.length;
    return gradients[index];
  }

  function selectGuild(guildId: string) {
    dispatch('selectGuild', { guildId });
  }
</script>

<div class="dashboard">
  <header class="dashboard-header">
    <div class="header-content">
      <h1>Welcome Back</h1>
      <p class="subtitle">Your communities are waiting for you</p>
    </div>
    <button class="create-btn" on:click={() => dispatch('createGuild')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Create Guild
    </button>
  </header>

  <div class="section">
    <h2 class="section-title">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      Your Guilds
      <span class="count">{guilds.length}</span>
    </h2>

    {#if guilds.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3>No guilds yet</h3>
        <p>Create your first guild or join an existing one to get started</p>
        <button class="empty-create-btn" on:click={() => dispatch('createGuild')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Create Your First Guild
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
            <!-- Banner -->
            <div 
              class="card-banner" 
              style={guild.banner ? `background-image: url(${guild.banner})` : getGuildGradient(guild.id)}
            >
              <div class="banner-overlay"></div>
            </div>

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
              <h3 class="guild-name">{guild.name}</h3>
              
              {#if guild.description}
                <p class="guild-description">{guild.description}</p>
              {:else}
                <p class="guild-description no-desc">No description</p>
              {/if}

              <div class="guild-stats">
                <div class="stat">
                  <span class="stat-icon online"></span>
                  <span class="stat-value">{onlineCount}</span>
                  <span class="stat-label">Online</span>
                </div>
                <div class="stat">
                  <span class="stat-icon members"></span>
                  <span class="stat-value">{memberCount}</span>
                  <span class="stat-label">Members</span>
                </div>
              </div>
            </div>

            <!-- Hover indicator -->
            <div class="card-hover-indicator">
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
    background: linear-gradient(180deg, rgba(15, 15, 25, 0.98) 0%, rgba(10, 10, 20, 1) 100%);
    padding: 32px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
  }

  .header-content h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 8px 0 0;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.5);
  }

  .create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
  }

  .create-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(49, 130, 206, 0.4);
  }

  .section {
    margin-bottom: 32px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 20px;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .section-title svg {
    color: rgba(255, 255, 255, 0.5);
  }

  .count {
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    text-align: center;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    color: rgba(255, 255, 255, 0.3);
  }

  .empty-state h3 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #fff;
  }

  .empty-state p {
    margin: 0 0 24px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .empty-create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 24px;
    background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
    border: none;
    border-radius: 12px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .empty-create-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(49, 130, 206, 0.4);
  }

  /* Guilds Grid */
  .guilds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .guild-card {
    position: relative;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.25s ease;
    text-align: left;
  }

  .guild-card:hover {
    transform: translateY(-4px);
    border-color: rgba(49, 130, 206, 0.3);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }

  .guild-card.selected {
    border-color: #3182ce;
    box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.3);
  }

  /* Card Banner */
  .card-banner {
    position: relative;
    height: 80px;
    background-size: cover;
    background-position: center;
  }

  .banner-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 0%, rgba(15, 15, 25, 0.9) 100%);
  }

  /* Card Icon */
  .card-icon-wrapper {
    position: absolute;
    top: 50px;
    left: 16px;
    z-index: 10;
  }

  .card-icon, .card-icon-placeholder {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    border: 3px solid rgba(15, 15, 25, 0.95);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .card-icon {
    object-fit: cover;
  }

  .card-icon-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 700;
    color: #fff;
  }

  /* Card Content */
  .card-content {
    padding: 36px 16px 16px;
  }

  .guild-name {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .guild-description {
    margin: 0 0 16px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 40px;
  }

  .guild-description.no-desc {
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
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

  .stat-icon {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .stat-icon.online {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
  }

  .stat-icon.members {
    background: rgba(255, 255, 255, 0.4);
  }

  .stat-value {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .stat-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Hover Indicator */
  .card-hover-indicator {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%) translateX(10px);
    opacity: 0;
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.2s ease;
  }

  .guild-card:hover .card-hover-indicator {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }

  /* Scrollbar */
  .dashboard::-webkit-scrollbar {
    width: 8px;
  }

  .dashboard::-webkit-scrollbar-track {
    background: transparent;
  }

  .dashboard::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .dashboard::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
