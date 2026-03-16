import { supabase } from '../supabase.js';

/**
 * ③ Event Page — Game thumbnails grid (static cards, no live iframes)
 */
export function renderEvent(container, params) {
  container.innerHTML = `
    <a href="#/" class="back-nav" id="back-link">
      <span class="arrow">←</span> もどる
    </a>
    <div class="page-header">
      <h1 id="event-title">読み込み中...</h1>
      <p class="subtitle">あそびたいゲームをクリックしてね！</p>
    </div>
    <div class="card-grid" id="games-grid">
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>よみこみ中...</p>
      </div>
    </div>
  `;

  loadEventGames(params.id);
}

// Fun icons to assign to game cards
const gameIcons = ['🎮', '🕹️', '🎯', '🎲', '🧩', '🎪', '🚀', '⭐', '🌟', '🎨', '🤖', '🦄', '🐉', '🏆', '💎', '🔮'];

// Color variants for game cards
const cardVariants = ['game-pink', 'game-purple', 'game-blue', 'game-mint', 'game-orange', 'game-gold'];

async function loadEventGames(eventId) {
  const grid = document.getElementById('games-grid');
  const titleEl = document.getElementById('event-title');
  const backLink = document.getElementById('back-link');

  try {
    // Get event info with location (single query)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, locations(*)')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    titleEl.textContent = event.label;
    backLink.href = `#/location/${event.location_id}`;

    // Get ALL games under this event via sessions (optimized: single query with join)
    const { data: sessions, error: sessError } = await supabase
      .from('sessions')
      .select('id, games(*)')
      .eq('event_id', eventId);

    if (sessError) throw sessError;

    // Flatten games from all sessions, filter published, sort
    const games = (sessions || [])
      .flatMap(s => s.games || [])
      .filter(g => g.is_published)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    if (games.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>まだ作品が登録されていません</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = games.map((game, index) => createGameCard(game, index)).join('');

    // Add click handlers
    grid.querySelectorAll('.preview-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `/play/${card.dataset.id}`;
      });
    });

  } catch (err) {
    console.error('Error loading games:', err);
    grid.innerHTML = `
      <div class="empty-state">
        <p>データの読み込みに失敗しました</p>
      </div>
    `;
  }
}

function createGameCard(game, index) {
  const icon = gameIcons[index % gameIcons.length];
  const variant = cardVariants[index % cardVariants.length];

  return `
    <div class="preview-card ${variant}" data-id="${game.id}" role="button" tabindex="0">
      <div class="preview-thumbnail">
        <div class="thumbnail-bg"></div>
        <div class="thumbnail-icon">${icon}</div>
        <div class="thumbnail-play-overlay">
          <span class="thumbnail-play-icon">▶</span>
        </div>
      </div>
      <div class="preview-info">
        <span class="preview-title">${game.title}</span>
        <span class="play-btn">▶ あそぶ</span>
      </div>
    </div>
  `;
}
