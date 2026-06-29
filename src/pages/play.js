import { supabase } from '../supabase.js';
import { getGameBaseUrl, getGamePublicUrl, fetchAndPrepareHTML } from '../utils/gameHtml.js';

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

async function loadGame(gameId) {
  const playContainer = document.getElementById('play-container');
  const backLink = document.getElementById('back-link');

  try {
    const { data: game, error } = await supabase
      .from('games')
      .select('*, sessions(event_id)')
      .eq('id', gameId)
      .single();

    if (error) throw error;

    const eventId = game.sessions?.event_id;
    backLink.href = eventId ? `#/event/${eventId}` : '#/';

    const gameUrl = getGamePublicUrl(game.storage_path, game.entry_file);
    const baseUrl = getGameBaseUrl(game.storage_path);
    const html = await fetchAndPrepareHTML(gameUrl, baseUrl);

    if (!html) throw new Error('ゲームHTMLの取得に失敗しました');

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
        sandbox="allow-scripts allow-popups allow-modals allow-forms"
        title="${game.title}"
      ></iframe>
    `;

    const gameFrame = document.getElementById('game-frame');
    gameFrame.srcdoc = html;

    document.getElementById('fullscreen-btn').addEventListener('click', () => {
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
