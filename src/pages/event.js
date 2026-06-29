import { supabase } from '../supabase.js';
import { getGameBaseUrl, getGamePublicUrl, prepareStaticPreviewHTML } from '../utils/gameHtml.js';

/**
 * ③ Event Page — Game static preview grid
 * iframes show game HTML/CSS only (scripts stripped for static appearance)
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

    grid.innerHTML = games.map(game => createGameCard(game)).join('');

    // Load static preview content for each game (scripts stripped)
    games.forEach(game => loadStaticPreview(game));

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

function createGameCard(game) {
  return `
    <div class="preview-card" data-id="${game.id}" role="button" tabindex="0">
      <div class="preview-frame-wrapper">
        <iframe 
          class="preview-frame" 
          id="preview-${game.id}"
          sandbox=""
          loading="lazy"
          title="${game.title}"
        ></iframe>
        <div class="preview-play-overlay">
          <span class="preview-play-icon">▶</span>
        </div>
      </div>
      <div class="preview-info">
        <span class="play-btn">▶ あそぶ</span>
      </div>
    </div>
  `;
}

/**
 * Fetch game HTML, strip all <script> tags, and inject as srcdoc.
 * This renders only HTML + CSS = static screenshot appearance.
 */
async function loadStaticPreview(game) {
  const iframe = document.getElementById(`preview-${game.id}`);
  if (!iframe) return;

  try {
    const gameUrl = getGamePublicUrl(game.storage_path, game.entry_file);
    const baseUrl = getGameBaseUrl(game.storage_path);
    const html = await prepareStaticPreviewHTML(gameUrl, baseUrl);
    if (html) iframe.srcdoc = html;
  } catch (err) {
    console.error(`Failed to load preview for ${game.title}:`, err);
  }
}
