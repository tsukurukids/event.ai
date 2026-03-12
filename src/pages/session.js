import { supabase } from '../supabase.js';

/**
 * ④ Session Page — Game previews grid
 */
export function renderSession(container, params) {
  container.innerHTML = `
    <a href="#/" class="back-nav" id="back-link">
      <span class="arrow">←</span> もどる
    </a>
    <div class="page-header">
      <span class="emoji-icon">🎮</span>
      <h1 id="session-title">読み込み中...</h1>
      <p class="subtitle">あそびたいゲームをクリックしてね！</p>
    </div>
    <div class="card-grid" id="games-grid">
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>よみこみ中...</p>
      </div>
    </div>
  `;

  loadGames(params.id);
}

/**
 * Build the base URL for a game's storage directory
 */
function getGameBaseUrl(storagePath) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/game-files/${storagePath}/`;
}

async function loadGames(sessionId) {
  const grid = document.getElementById('games-grid');
  const titleEl = document.getElementById('session-title');
  const backLink = document.getElementById('back-link');

  try {
    // Get session info with event
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, events(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    titleEl.textContent = `${session.events.label} ${session.label}`;
    backLink.href = `#/event/${session.event_id}`;

    // Get games
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_published', true)
      .order('sort_order');

    if (error) throw error;

    if (!games || games.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <p>まだ作品が登録されていません</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = games.map(game => createGameCard(game)).join('');

    // Load preview content for each game
    games.forEach(game => loadPreviewContent(game));

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
        <div class="empty-icon">😢</div>
        <p>データの読み込みに失敗しました</p>
      </div>
    `;
  }
}

function createGameCard(game) {
  return `
    <div class="preview-card" data-id="${game.id}" role="button" tabindex="0">
      <iframe 
        class="preview-frame" 
        id="preview-${game.id}"
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        title="${game.title}"
      ></iframe>
      <div class="preview-info">
        <span class="preview-title">${game.title}</span>
        <span class="play-btn">▶ あそぶ</span>
      </div>
    </div>
  `;
}

/**
 * Fetch HTML and inject into iframe as srcdoc with <base> tag
 */
async function loadPreviewContent(game) {
  const iframe = document.getElementById(`preview-${game.id}`);
  if (!iframe) return;

  try {
    const { data: urlData } = supabase.storage
      .from('game-files')
      .getPublicUrl(`${game.storage_path}/${game.entry_file}`);

    const gameUrl = urlData?.publicUrl || '';
    const baseUrl = getGameBaseUrl(game.storage_path);

    const response = await fetch(gameUrl);
    if (!response.ok) {
      iframe.src = gameUrl;
      return;
    }

    let html = await response.text();

    // Inject <base> tag for relative path resolution
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n<base href="${baseUrl}">`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n<base href="${baseUrl}">`);
    } else if (html.includes('<html')) {
      html = html.replace(/<html([^>]*)>/, `<html$1>\n<head><base href="${baseUrl}"></head>`);
    } else {
      html = `<base href="${baseUrl}">\n${html}`;
    }

    iframe.srcdoc = html;
  } catch (err) {
    console.error(`Failed to load preview for ${game.title}:`, err);
  }
}
