<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { User } from '../types';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let activeMediaTab: 'photos' | 'videos' | 'other' = 'photos';

  const mockMembers: User[] = [
    { id: '1', username: 'Alexa', avatar: 'https://i.pravatar.cc/100?img=1', status: 'online', role: 'UI/UX designer' },
    { id: '2', username: 'Alex', avatar: 'https://i.pravatar.cc/100?img=3', status: 'online', role: 'Developer' },
    { id: '3', username: 'Julia A.', avatar: 'https://i.pravatar.cc/100?img=5', status: 'offline', role: 'Unknown' },
  ];

  const mockPhotos = [
    'https://picsum.photos/100/100?random=1',
    'https://picsum.photos/100/100?random=2',
  ];
</script>

{#if isOpen}
  <aside class="group-info">
    <header class="info-header">
      <h2>Group Info</h2>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6L18 18"/>
        </svg>
      </button>
    </header>

    <div class="info-content">
      <!-- Group Avatar -->
      <div class="group-avatar-section">
        <div class="group-avatar">
          <img src="https://i.pravatar.cc/150?img=68" alt="UI/UX Group" />
        </div>
        <h3 class="group-name">UI/UX Group</h3>
        <span class="group-members">122 members</span>
      </div>

      <!-- Description -->
      <div class="info-section">
        <h4 class="section-title">Description</h4>
        <p class="description">
          Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's
        </p>
      </div>

      <!-- Invite Others -->
      <div class="info-section">
        <div class="section-header">
          <h4 class="section-title">Invite Others</h4>
          <button class="add-btn" aria-label="Add">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5V19M5 12H19"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Notifications -->
      <div class="info-section">
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"/>
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"/>
              </svg>
            </span>
            <span class="toggle-label">Notifications</span>
          </div>
          <label class="toggle">
            <input type="checkbox" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Shared Media -->
      <div class="info-section">
        <div class="section-header">
          <span class="section-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15L16 10L5 21"/>
            </svg>
          </span>
          <h4 class="section-title">Shared Media</h4>
        </div>
        
        <div class="media-tabs">
          <button 
            class="media-tab" 
            class:active={activeMediaTab === 'photos'}
            on:click={() => activeMediaTab = 'photos'}
          >
            Photos
          </button>
          <button 
            class="media-tab"
            class:active={activeMediaTab === 'videos'}
            on:click={() => activeMediaTab = 'videos'}
          >
            Videos
          </button>
          <button 
            class="media-tab"
            class:active={activeMediaTab === 'other'}
            on:click={() => activeMediaTab = 'other'}
          >
            Other
          </button>
        </div>

        <div class="media-grid">
          {#each mockPhotos as photo}
            <div class="media-item">
              <img src={photo} alt="Shared media" />
            </div>
          {/each}
          <div class="media-item more">
            <span>5+</span>
          </div>
        </div>
      </div>

      <!-- Members -->
      <div class="info-section">
        <div class="section-header">
          <span class="section-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="7" r="4"/>
              <path d="M3 21V19C3 16.7909 4.79086 15 7 15H11C13.2091 15 15 16.7909 15 19V21"/>
              <circle cx="17" cy="10" r="3"/>
              <path d="M21 21V20C21 18.3431 19.6569 17 18 17H16.5"/>
            </svg>
          </span>
          <h4 class="section-title">Members</h4>
          <span class="member-count">(122)</span>
        </div>

        <ul class="members-list">
          {#each mockMembers as member}
            <li class="member-item">
              <div class="member-avatar" class:online={member.status === 'online'}>
                <img src={member.avatar} alt={member.username} />
                {#if member.status === 'online'}
                  <span class="status-dot"></span>
                {/if}
              </div>
              <div class="member-info">
                <span class="member-name">{member.username}</span>
                <span class="member-role">{member.role}</span>
              </div>
              <button class="member-menu" aria-label="More options">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="12" cy="12" r="2"/>
                  <circle cx="12" cy="19" r="2"/>
                </svg>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </aside>
{/if}

<style>
  .group-info {
    width: 280px;
    height: 100%;
    background: rgba(26, 26, 46, 0.98);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .info-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .info-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .info-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  /* Group Avatar Section */
  .group-avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
  }

  .group-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .group-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .group-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  .group-members {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Info Sections */
  .info-section {
    margin-bottom: 20px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .section-icon {
    color: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
  }

  .section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    flex: 1;
  }

  .member-count {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
  }

  .add-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
  }

  .description {
    margin: 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
  }

  /* Toggle */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toggle-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .toggle-icon {
    color: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
  }

  .toggle-label {
    font-size: 14px;
    color: #fff;
  }

  .toggle {
    position: relative;
    width: 44px;
    height: 24px;
  }

  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 24px;
    transition: 0.3s;
  }

  .toggle-slider::before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: #fff;
    border-radius: 50%;
    transition: 0.3s;
  }

  .toggle input:checked + .toggle-slider {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  }

  .toggle input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }

  /* Media Tabs */
  .media-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .media-tab {
    padding: 8px 16px;
    border: none;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .media-tab:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .media-tab.active {
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    color: #fff;
  }

  /* Media Grid */
  .media-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .media-item {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
  }

  .media-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .media-item.more {
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  /* Members List */
  .members-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .member-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .member-avatar {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
    overflow: hidden;
  }

  .member-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .status-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid rgba(26, 26, 46, 0.98);
  }

  .member-info {
    flex: 1;
    min-width: 0;
  }

  .member-name {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
  }

  .member-role {
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  .member-menu {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .member-menu:hover {
    color: #fff;
  }
</style>
