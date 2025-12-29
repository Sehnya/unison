<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { searchGames, type CachedGame } from '../lib/rawg';
  import { loadProfile, updateGamesCard, type UserGame } from '../lib/profileStorage';

  export let editable: boolean = false;
  export let cardId: string = 'default';

  interface GameData {
    id: string;
    rawgId: number;
    slug: string;
    name: string;
    image: string;
    genre: string;
    platform: string;
    rating: number;
    description: string;
  }

  const dispatch = createEventDispatcher<{
    update: { games: GameData[] };
  }>();

  let games: GameData[] = [];
  let showAddGame = false;
  let editingGame: GameData | null = null;
  
  // Search state
  let searchQuery = '';
  let searchResults: CachedGame[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let selectedGame: CachedGame | null = null;
  
  // Custom fields
  let customRating = 5;
  
  // Tooltip state
  let hoveredGame: GameData | null = null;
  let tooltipPosition = { x: 0, y: 0 };
  let tooltipVisible = false;
  let gamesContainer: HTMLElement;

  // Load saved games from profile storage
  onMount(() => {
    const profile = loadProfile();
    if (profile.gamesCards && profile.gamesCards[cardId]) {
      games = profile.gamesCards[cardId].games as GameData[];
    }
  });

  // Save games to profile storage
  function saveGames() {
    updateGamesCard(cardId, games as UserGame[]);
    dispatch('update', { games });
  }

  // Debounced search
  function handleSearchInput() {
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      isSearching = true;
      searchResults = await searchGames(searchQuery, 1, 8);
      isSearching = false;
    }, 300);
  }

  function selectGame(game: CachedGame) {
    selectedGame = game;
    searchQuery = game.name;
    searchResults = [];
  }

  function addGame() {
    if (!selectedGame) return;

    // Check if game already exists
    if (games.some(g => g.rawgId === selectedGame!.rawgId)) {
      alert('This game is already in your favorites!');
      return;
    }

    const newGame: GameData = {
      id: `game-${Date.now()}`,
      rawgId: selectedGame.rawgId,
      slug: selectedGame.slug,
      name: selectedGame.name,
      image: selectedGame.image,
      genre: selectedGame.genres[0] || 'Unknown',
      platform: selectedGame.platforms[0] || 'Multi-platform',
      rating: customRating,
      description: selectedGame.description || '',
    };

    games = [...games, newGame];
    saveGames();
    closeForm();
  }

  function updateGame() {
    if (!editingGame) return;

    games = games.map(g => {
      if (g.id === editingGame!.id) {
        return {
          ...g,
          rating: customRating,
        };
      }
      return g;
    });

    saveGames();
    closeForm();
  }

  function removeGame(id: string) {
    games = games.filter(g => g.id !== id);
    saveGames();
  }

  function editGame(game: GameData) {
    editingGame = game;
    customRating = game.rating;
    showAddGame = true;
  }

  function closeForm() {
    showAddGame = false;
    editingGame = null;
    selectedGame = null;
    searchQuery = '';
    searchResults = [];
    customRating = 5;
  }

  function setRating(rating: number) {
    customRating = rating;
  }

  function openAddForm() {
    editingGame = null;
    selectedGame = null;
    searchQuery = '';
    searchResults = [];
    customRating = 5;
    showAddGame = true;
  }

  // Tooltip handlers
  function handleMouseEnter(e: MouseEvent, game: GameData) {
    hoveredGame = game;
    updateTooltipPosition(e);
    tooltipVisible = true;
  }

  function handleMouseMove(e: MouseEvent) {
    if (hoveredGame) {
      updateTooltipPosition(e);
    }
  }

  function handleMouseLeave() {
    hoveredGame = null;
    tooltipVisible = false;
  }

  function updateTooltipPosition(e: MouseEvent) {
    const containerRect = gamesContainer?.getBoundingClientRect();
    if (!containerRect) return;
    
    // Position tooltip to the right of cursor, with some offset
    let x = e.clientX - containerRect.left + 15;
    let y = e.clientY - containerRect.top - 60;
    
    // Keep tooltip within container bounds
    const tooltipWidth = 220;
    const tooltipHeight = 150;
    
    if (x + tooltipWidth > containerRect.width) {
      x = e.clientX - containerRect.left - tooltipWidth - 15;
    }
    if (y < 0) {
      y = 10;
    }
    if (y + tooltipHeight > containerRect.height) {
      y = containerRect.height - tooltipHeight - 10;
    }
    
    tooltipPosition = { x, y };
  }
</script>

<div class="games-card">
  {#if editable}
    <div class="card-header">
      <button class="add-btn" on:click={openAddForm}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>
    </div>
  {/if}

  <div class="games-grid" bind:this={gamesContainer}>
    {#each games as game (game.id)}
      <div 
        class="game-item"
        on:mouseenter={(e) => handleMouseEnter(e, game)}
        on:mousemove={handleMouseMove}
        on:mouseleave={handleMouseLeave}
      >
        <div class="game-image">
          <img src={game.image} alt={game.name} loading="lazy" />
          
          {#if editable}
            <div class="game-actions">
              <button class="action-btn edit" on:click|stopPropagation={() => editGame(game)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </button>
              <button class="action-btn delete" on:click|stopPropagation={() => removeGame(game.id)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/each}

    {#if games.length === 0}
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="6" width="20" height="12" rx="2"/>
          <path d="M6 12h4M8 10v4M14 10h2M14 14h2"/>
        </svg>
        <span>No games added yet</span>
      </div>
    {/if}

    <!-- Tooltip -->
    {#if tooltipVisible && hoveredGame}
      <div 
        class="game-tooltip"
        style="left: {tooltipPosition.x}px; top: {tooltipPosition.y}px;"
      >
        <div class="tooltip-title">{hoveredGame.name}</div>
        <div class="tooltip-meta">
          <span class="tooltip-genre">{hoveredGame.genre}</span>
          <span class="tooltip-platform">{hoveredGame.platform}</span>
        </div>
        <div class="tooltip-rating">
          {#each Array(5) as _, i}
            <svg width="12" height="12" viewBox="0 0 24 24" fill={i < hoveredGame.rating ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          {/each}
        </div>
        {#if hoveredGame.description}
          <p class="tooltip-desc">{hoveredGame.description.slice(0, 100)}{hoveredGame.description.length > 100 ? '...' : ''}</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Add/Edit Game Modal -->
  {#if showAddGame && editable}
    <div class="modal-overlay" on:click={closeForm} on:keydown={(e) => e.key === 'Escape' && closeForm()}>
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <div class="modal-header">
          <h4>{editingGame ? 'Edit Game' : 'Add Game'}</h4>
          <button class="close-btn" on:click={closeForm}>×</button>
        </div>

        <div class="modal-body">
          {#if !editingGame}
            <!-- Game Search -->
            <div class="form-group">
              <label>Search Game</label>
              <div class="search-container">
                <input
                  type="text"
                  bind:value={searchQuery}
                  on:input={handleSearchInput}
                  placeholder="Search for a game..."
                  class="search-input"
                />
                {#if isSearching}
                  <div class="search-spinner"></div>
                {/if}
              </div>
              
              {#if searchResults.length > 0}
                <div class="search-results">
                  {#each searchResults as result}
                    <button
                      class="search-result"
                      class:selected={selectedGame?.rawgId === result.rawgId}
                      on:click={() => selectGame(result)}
                    >
                      {#if result.image}
                        <img src={result.image} alt={result.name} />
                      {:else}
                        <div class="no-image">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="6" width="20" height="12" rx="2"/>
                            <path d="M6 12h4M8 10v4M14 10h2M14 14h2"/>
                          </svg>
                        </div>
                      {/if}
                      <div class="result-info">
                        <span class="result-name">{result.name}</span>
                        <span class="result-meta">
                          {result.genres[0] || 'Unknown'} • {result.released?.split('-')[0] || 'N/A'}
                        </span>
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Selected Game Preview -->
            {#if selectedGame}
              <div class="selected-preview">
                <img src={selectedGame.image} alt={selectedGame.name} />
                <div class="preview-info">
                  <h5>{selectedGame.name}</h5>
                  <p>{selectedGame.genres.slice(0, 2).join(', ')}</p>
                  <p>{selectedGame.platforms.slice(0, 2).join(', ')}</p>
                </div>
              </div>
            {/if}
          {:else}
            <!-- Editing existing game - show preview -->
            <div class="selected-preview">
              <img src={editingGame.image} alt={editingGame.name} />
              <div class="preview-info">
                <h5>{editingGame.name}</h5>
                <p>{editingGame.genre}</p>
                <p>{editingGame.platform}</p>
              </div>
            </div>
          {/if}

          <!-- Custom Fields -->
          <div class="form-group">
            <label>Your Rating</label>
            <div class="rating-picker">
              {#each Array(5) as _, i}
                <button
                  type="button"
                  class="star-btn"
                  class:filled={i < customRating}
                  on:click={() => setRating(i + 1)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={i < customRating ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              {/each}
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" on:click={closeForm}>Cancel</button>
          <button 
            class="save-btn" 
            on:click={editingGame ? updateGame : addGame}
            disabled={!editingGame && !selectedGame}
          >
            {editingGame ? 'Save Changes' : 'Add Game'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>


<style>
  .games-card {
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

  .games-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
    flex: 1;
    overflow-y: auto;
    position: relative;
  }

  .game-item {
    aspect-ratio: 3/4;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .game-item:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .game-image {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .game-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .game-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .game-item:hover .game-actions {
    opacity: 1;
  }

  .action-btn {
    width: 26px;
    height: 26px;
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

  .action-btn:hover {
    transform: scale(1.1);
  }

  /* Tooltip */
  .game-tooltip {
    position: absolute;
    width: 220px;
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

  .tooltip-title {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 8px;
    line-height: 1.3;
  }

  .tooltip-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .tooltip-genre, .tooltip-platform {
    font-size: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .tooltip-platform {
    background: rgba(49, 130, 206, 0.3);
    color: #63b3ed;
  }

  .tooltip-rating {
    display: flex;
    gap: 2px;
    color: #fbbf24;
    margin-bottom: 10px;
  }

  .tooltip-desc {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
    margin: 0;
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

  .form-group input {
    width: 100%;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    font-size: 13px;
  }

  .form-group input:focus {
    outline: none;
    border-color: #3182ce;
  }

  /* Search */
  .search-container {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding-right: 36px;
  }

  .search-spinner {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #3182ce;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: translateY(-50%) rotate(360deg); }
  }

  .search-results {
    margin-top: 8px;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
  }

  .search-result {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease;
  }

  .search-result:last-child {
    border-bottom: none;
  }

  .search-result:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .search-result.selected {
    background: rgba(49, 130, 206, 0.2);
  }

  .search-result img {
    width: 40px;
    height: 50px;
    object-fit: cover;
    border-radius: 4px;
  }

  .search-result .no-image {
    width: 40px;
    height: 50px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .result-info {
    flex: 1;
    min-width: 0;
  }

  .result-name {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .result-meta {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Selected Preview */
  .selected-preview {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin-bottom: 14px;
  }

  .selected-preview img {
    width: 70px;
    height: 90px;
    object-fit: cover;
    border-radius: 6px;
  }

  .preview-info {
    flex: 1;
  }

  .preview-info h5 {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 6px 0;
  }

  .preview-info p {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 2px 0;
  }

  .rating-picker {
    display: flex;
    gap: 4px;
  }

  .star-btn {
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
    transition: color 0.15s ease;
  }

  .star-btn:hover,
  .star-btn.filled {
    color: #fbbf24;
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
  .games-grid::-webkit-scrollbar,
  .modal-body::-webkit-scrollbar,
  .search-results::-webkit-scrollbar {
    width: 4px;
  }

  .games-grid::-webkit-scrollbar-track,
  .modal-body::-webkit-scrollbar-track,
  .search-results::-webkit-scrollbar-track {
    background: transparent;
  }

  .games-grid::-webkit-scrollbar-thumb,
  .modal-body::-webkit-scrollbar-thumb,
  .search-results::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>
