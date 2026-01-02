<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { loadProfile, updateGitHubCard, type GitHubProject } from '../lib/profileStorage';

  export let editable: boolean = false;
  export let cardId: string = 'default';
  export let profileGitHubData: { projects: GitHubProject[] } | null = null; // GitHub data from viewed profile
  export let isOwnProfile: boolean = true;

  interface ProjectData {
    id: string;
    repoUrl: string;
    repoName: string;
    username: string;
    description: string;
    image: string | null;
  }

  const dispatch = createEventDispatcher<{
    update: { projects: ProjectData[] };
  }>();

  let projects: ProjectData[] = [];
  let showAddProject = false;
  let editingProject: ProjectData | null = null;
  
  // Form state
  let repoUrl = '';
  let description = '';
  let customImage: string | null = null;
  let fileInput: HTMLInputElement;
  
  // Tooltip state
  let hoveredProject: ProjectData | null = null;
  let tooltipPosition = { x: 0, y: 0 };
  let tooltipVisible = false;
  let projectsContainer: HTMLElement;

  // Load saved projects from profile storage
  onMount(() => {
    loadProjectsData();
  });

  // Reload when profileGitHubData changes
  $: if (profileGitHubData !== undefined) {
    loadProjectsData();
  }

  function loadProjectsData() {
    if (!isOwnProfile && profileGitHubData) {
      projects = profileGitHubData.projects as ProjectData[];
    } else if (isOwnProfile) {
      const profile = loadProfile();
      if (profile.githubCards && profile.githubCards[cardId]) {
        projects = profile.githubCards[cardId].projects as ProjectData[];
      }
    }
  }

  function saveProjects() {
    if (!isOwnProfile) return;
    updateGitHubCard(cardId, projects as GitHubProject[]);
    dispatch('update', { projects });
  }

  function parseGitHubUrl(url: string): { username: string; repoName: string } | null {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('github.com')) return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { username: parts[0], repoName: parts[1] };
      }
    } catch {
      // Try simple pattern match
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (match) {
        return { username: match[1], repoName: match[2] };
      }
    }
    return null;
  }

  function addProject() {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    if (projects.some(p => p.repoUrl === repoUrl)) {
      alert('This project is already added!');
      return;
    }

    const newProject: ProjectData = {
      id: `project-${Date.now()}`,
      repoUrl: repoUrl.trim(),
      repoName: parsed.repoName,
      username: parsed.username,
      description: description.trim() || 'No description provided',
      image: customImage,
    };

    projects = [...projects, newProject];
    saveProjects();
    closeForm();
  }

  function updateProject() {
    if (!editingProject) return;

    projects = projects.map(p => {
      if (p.id === editingProject!.id) {
        return {
          ...p,
          description: description.trim() || 'No description provided',
          image: customImage,
        };
      }
      return p;
    });

    saveProjects();
    closeForm();
  }

  function removeProject(id: string) {
    projects = projects.filter(p => p.id !== id);
    saveProjects();
  }

  function editProject(project: ProjectData) {
    editingProject = project;
    repoUrl = project.repoUrl;
    description = project.description;
    customImage = project.image;
    showAddProject = true;
  }

  function closeForm() {
    showAddProject = false;
    editingProject = null;
    repoUrl = '';
    description = '';
    customImage = null;
  }

  function openAddForm() {
    editingProject = null;
    repoUrl = '';
    description = '';
    customImage = null;
    showAddProject = true;
  }

  function handleImageUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    // Convert to base64 for persistence
    const reader = new FileReader();
    reader.onload = (event) => {
      customImage = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  function removeImage() {
    customImage = null;
  }

  // Tooltip handlers
  function handleMouseEnter(e: MouseEvent, project: ProjectData) {
    hoveredProject = project;
    updateTooltipPosition(e);
    tooltipVisible = true;
  }

  function handleMouseMove(e: MouseEvent) {
    if (hoveredProject) {
      updateTooltipPosition(e);
    }
  }

  function handleMouseLeave() {
    hoveredProject = null;
    tooltipVisible = false;
  }

  function updateTooltipPosition(e: MouseEvent) {
    const containerRect = projectsContainer?.getBoundingClientRect();
    if (!containerRect) return;
    
    let x = e.clientX - containerRect.left + 15;
    let y = e.clientY - containerRect.top - 50;
    
    const tooltipWidth = 240;
    const tooltipHeight = 100;
    
    if (x + tooltipWidth > containerRect.width) {
      x = e.clientX - containerRect.left - tooltipWidth - 15;
    }
    if (y < 0) y = 10;
    if (y + tooltipHeight > containerRect.height) {
      y = containerRect.height - tooltipHeight - 10;
    }
    
    tooltipPosition = { x, y };
  }

  function openRepo(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
</script>

<div class="projects-card">
  {#if editable}
    <div class="card-header">
      <button class="add-btn" on:click={openAddForm}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </div>
  {/if}

  <div class="projects-grid" bind:this={projectsContainer}>
    {#each projects as project (project.id)}
      <div 
        class="project-item"
        on:mouseenter={(e) => handleMouseEnter(e, project)}
        on:mousemove={handleMouseMove}
        on:mouseleave={handleMouseLeave}
        on:click={() => openRepo(project.repoUrl)}
      >
        <div class="project-image">
          {#if project.image}
            <img src={project.image} alt={project.repoName} />
          {:else}
            <div class="default-image">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </div>
          {/if}
          
          {#if editable}
            <div class="project-actions">
              <button class="action-btn edit" on:click|stopPropagation={() => editProject(project)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </button>
              <button class="action-btn delete" on:click|stopPropagation={() => removeProject(project.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          {/if}
        </div>
        <div class="project-name">{project.repoName}</div>
      </div>
    {/each}

    {#if projects.length === 0}
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <span>No projects added yet</span>
      </div>
    {/if}

    <!-- Tooltip -->
    {#if tooltipVisible && hoveredProject}
      <div 
        class="project-tooltip"
        style="left: {tooltipPosition.x}px; top: {tooltipPosition.y}px;"
      >
        <div class="tooltip-header">
          <span class="tooltip-username">{hoveredProject.username}/</span>
          <span class="tooltip-repo">{hoveredProject.repoName}</span>
        </div>
        <p class="tooltip-desc">{hoveredProject.description}</p>
        <div class="tooltip-hint">Click to open on GitHub</div>
      </div>
    {/if}
  </div>

  <!-- Add/Edit Project Modal -->
  {#if showAddProject && editable}
    <div class="modal-overlay" on:click={closeForm} on:keydown={(e) => e.key === 'Escape' && closeForm()}>
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <div class="modal-header">
          <h4>{editingProject ? 'Edit Project' : 'Add Project'}</h4>
          <button class="close-btn" on:click={closeForm}>×</button>
        </div>

        <div class="modal-body">
          {#if !editingProject}
            <div class="form-group">
              <label>GitHub Repository URL</label>
              <input
                type="text"
                bind:value={repoUrl}
                placeholder="https://github.com/username/repo"
              />
            </div>
          {:else}
            <div class="repo-preview">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>{editingProject.username}/{editingProject.repoName}</span>
            </div>
          {/if}

          <div class="form-group">
            <label>Description</label>
            <textarea
              bind:value={description}
              placeholder="A short description of your project..."
              rows="3"
            ></textarea>
          </div>

          <div class="form-group">
            <label>Project Image</label>
            <input type="file" bind:this={fileInput} on:change={handleImageUpload} accept="image/*" class="hidden-input" />
            
            {#if customImage}
              <div class="image-preview">
                <img src={customImage} alt="Project preview" />
                <button class="remove-image" on:click={removeImage}>×</button>
              </div>
            {:else}
              <button class="upload-btn" on:click={() => fileInput?.click()}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                </svg>
                Upload Image
              </button>
            {/if}
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" on:click={closeForm}>Cancel</button>
          <button 
            class="save-btn" 
            on:click={editingProject ? updateProject : addProject}
            disabled={!editingProject && !repoUrl.trim()}
          >
            {editingProject ? 'Save Changes' : 'Add Project'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>


<style>
  .projects-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .add-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px dashed rgba(49, 130, 206, 0.5);
    background: rgba(49, 130, 206, 0.1);
    color: #63b3ed;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .add-btn:hover {
    background: rgba(49, 130, 206, 0.2);
    border-color: rgba(49, 130, 206, 0.7);
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
    flex: 1;
    overflow-y: auto;
    position: relative;
  }

  .project-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .project-item:hover {
    transform: translateY(-4px);
  }

  .project-image {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.05);
  }

  .project-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-image {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%);
    color: rgba(255, 255, 255, 0.6);
  }

  .project-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .project-item:hover .project-actions {
    opacity: 1;
  }

  .action-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    backdrop-filter: blur(8px);
  }

  .action-btn.edit {
    background: rgba(49, 130, 206, 0.8);
    color: #fff;
  }

  .action-btn.delete {
    background: rgba(239, 68, 68, 0.8);
    color: #fff;
  }

  .project-name {
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Tooltip */
  .project-tooltip {
    position: absolute;
    width: 240px;
    background: rgba(20, 20, 20, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 14px;
    z-index: 100;
    pointer-events: none;
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    animation: tooltipFadeIn 0.15s ease;
  }

  @keyframes tooltipFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tooltip-header {
    margin-bottom: 8px;
  }

  .tooltip-username {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .tooltip-repo {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .tooltip-desc {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.5;
    margin: 0 0 10px 0;
  }

  .tooltip-hint {
    font-size: 10px;
    color: #63b3ed;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal {
    width: 90%;
    max-width: 400px;
    max-height: 85vh;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modal-header h4 {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .close-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
  }

  .modal-body {
    padding: 16px 18px;
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    margin-bottom: 14px;
  }

  .form-group label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }

  .form-group input, .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
    font-family: inherit;
    resize: none;
  }

  .form-group input:focus, .form-group textarea:focus {
    outline: none;
    border-color: #3182ce;
  }

  .hidden-input {
    display: none;
  }

  .repo-preview {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin-bottom: 14px;
    color: #fff;
    font-size: 13px;
  }

  .upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background: rgba(49, 130, 206, 0.1);
    border: 1px dashed rgba(49, 130, 206, 0.5);
    border-radius: 10px;
    color: #63b3ed;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .upload-btn:hover {
    background: rgba(49, 130, 206, 0.2);
    border-color: rgba(49, 130, 206, 0.7);
  }

  .image-preview {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
  }

  .image-preview img {
    width: 100%;
    height: 120px;
    object-fit: cover;
  }

  .remove-image {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.9);
    color: #fff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .cancel-btn, .save-btn {
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: rgba(255, 255, 255, 0.7);
  }

  .save-btn {
    background: #1a365d;
    border: none;
    color: #fff;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .save-btn:not(:disabled):hover {
    background: #2c5282;
  }

  /* Scrollbar */
  .projects-grid::-webkit-scrollbar {
    width: 4px;
  }

  .projects-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .projects-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>