import { supabase } from '../supabase.js';

/**
 * ⑤ Play Page — Full-size game view
 */
export function renderPlay(container, params) {
  container.innerHTML = `
    <a href="#/" class="back-nav" id="back-link">
      <span class="arrow">←</span> もどる
    </a>
    <div class="play-container" id="play-container">
      <div class="loading" style="padding: 4rem;">
        <div class="loading-spinner"></div>
        <p style="color: var(--text-mid);">ゲームを読み込み中...</p>
      </div>
    </div>
  `;

  loadGame(params.id);
}

/**
 * Build the base URL for a game's storage directory
 */
function getGameBaseUrl(storagePath) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/game-files/${storagePath}/`;
}

async function loadGame(gameId) {
  const playContainer = document.getElementById('play-container');
  const backLink = document.getElementById('back-link');

  try {
    // Get game info with session → event
    const { data: game, error } = await supabase
      .from('games')
      .select('*, sessions(event_id)')
      .eq('id', gameId)
      .single();

    if (error) throw error;

    const eventId = game.sessions?.event_id;
    backLink.href = eventId ? `#/event/${eventId}` : '#/';

    // Build the public URL for the entry file
    const { data: urlData } = supabase.storage
      .from('game-files')
      .getPublicUrl(`${game.storage_path}/${game.entry_file}`);

    const gameUrl = urlData?.publicUrl || '';
    const baseUrl = getGameBaseUrl(game.storage_path);

    // Fetch the HTML content and inject <base> tag
    const htmlContent = await fetchAndPrepareHTML(gameUrl, baseUrl);

    playContainer.innerHTML = `
      <div class="play-header">
        <span class="game-title">${game.title}</span>
        <button class="fullscreen-btn" id="fullscreen-btn">
          フルスクリーン
        </button>
      </div>
      <iframe 
        id="game-frame"
        class="play-frame" 
        sandbox="allow-scripts allow-same-origin allow-popups"
        title="${game.title}"
      ></iframe>
    `;

    // Set srcdoc with fetched HTML
    const gameFrame = document.getElementById('game-frame');
    if (htmlContent) {
      gameFrame.srcdoc = htmlContent;
    } else {
      // Fallback: use src directly
      gameFrame.src = gameUrl;
    }

    // Fullscreen button
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    fullscreenBtn.addEventListener('click', () => {
      if (gameFrame.requestFullscreen) {
        gameFrame.requestFullscreen();
      } else if (gameFrame.webkitRequestFullscreen) {
        gameFrame.webkitRequestFullscreen();
      }
    });

  } catch (err) {
    console.error('Error loading game:', err);
    playContainer.innerHTML = `
      <div class="empty-state" style="background: white; border-radius: var(--radius-lg); padding: 3rem;">
        <p style="color: var(--text-mid);">ゲームの読み込みに失敗しました</p>
        <a href="#/" class="btn btn-primary" style="margin-top: 1rem;">トップにもどる</a>
      </div>
    `;
  }
}

/**
 * Fetch HTML content and inject <base> tag so relative paths resolve correctly
 */
async function fetchAndPrepareHTML(url, baseUrl) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    let html = await response.text();

    // Check if it looks like HTML
    if (!html.includes('<') || !html.includes('>')) return null;

    // Inject <base> tag for relative path resolution
    // If <head> exists, inject after it
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n<base href="${baseUrl}">`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n<base href="${baseUrl}">`);
    } else if (html.includes('<html')) {
      // If no <head>, inject before first tag after <html>
      html = html.replace(/<html([^>]*)>/, `<html$1>\n<head><base href="${baseUrl}"></head>`);
    } else {
      // No html tag, just prepend base
      html = `<base href="${baseUrl}">\n${html}`;
    }

    return html;
  } catch (err) {
    console.error('Failed to fetch game HTML:', err);
    return null;
  }
}
