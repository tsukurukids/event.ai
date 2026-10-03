import { supabase } from '../supabase.js';
import { formatExpiresDate } from '../utils/retention.js';
import { workshopThumbUrl } from '../config/workshopAssets.js';

const PAGE_SIZE = 30;
const GENRES = {
  athletic: { label: 'アスレチック', file: 'player_robot.png' },
  shooting: { label: 'シューティング', file: 'ship_blue.png' },
  puzzle: { label: 'パズル', file: 'block_green.png' },
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Public works are the entrance; creating a work belongs to the workshop. */
export function renderHome(container) {
  let page = 0;
  let request = 0;
  let disposed = false;
  let searchTimer;
  container.innerHTML = `
    <section class="gallery-home">
      <header class="gallery-heading">
        <div><p class="gallery-eyebrow">つくったゲームで、あそぼう。</p><h1>みんなのギャラリー</h1></div>
        <a class="gallery-workshop-link" href="/experience.html">体験ワークショップへ <span aria-hidden="true">→</span></a>
      </header>
      <p class="gallery-policy">体験の作品は公開から2か月間。公開中に作品をダウンロードして、おうちに持ち帰れます。</p>
      <form class="gallery-filters" role="search" aria-label="作品を探す">
        <label class="gallery-search">作品名でさがす<input type="search" name="title" placeholder="作品名を入力" maxlength="100" autocomplete="off"></label>
        <label class="gallery-genre">ジャンル<select name="genre"><option value="">すべてのジャンル</option><option value="athletic">アスレチック</option><option value="shooting">シューティング</option><option value="puzzle">パズル</option></select></label>
        <button class="gallery-search-button" type="submit">さがす</button>
      </form>
      <div class="gallery-results-head"><h2>公開中の作品</h2><p id="gallery-count" role="status" aria-live="polite"></p></div>
      <div class="gallery-grid" id="gallery-grid" aria-busy="true"></div>
      <nav class="gallery-pagination" aria-label="作品一覧のページ" hidden><button type="button" data-page="previous">← 前のページ</button><span id="gallery-page"></span><button type="button" data-page="next">次のページ →</button></nav>
    </section>`;

  const form = container.querySelector('form');
  const grid = container.querySelector('#gallery-grid');
  const count = container.querySelector('#gallery-count');
  const pagination = container.querySelector('.gallery-pagination');
  const previous = container.querySelector('[data-page="previous"]');
  const next = container.querySelector('[data-page="next"]');

  async function load() {
    const token = ++request;
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '<div class="gallery-empty"><div class="loading-spinner"></div><p>作品をよみこみ中…</p></div>';
    count.textContent = '';
    pagination.hidden = true;
    try {
      let query = supabase.from('games')
        .select('id,title,genre_id,expires_at,uploaded_at', { count: 'exact' })
        .eq('is_published', true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('uploaded_at', { ascending: false }).order('id', { ascending: false });
      const title = form.elements.title.value.trim();
      const genre = form.elements.genre.value;
      if (title) query = query.ilike('title', `%${title.replace(/[\\%_]/g, '\\$&')}%`);
      if (genre) query = query.eq('genre_id', genre);
      const { data, error, count: total } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (disposed || token !== request) return;
      if (error) throw error;
      if (!data?.length && page > 0) { page = 0; return load(); }
      count.textContent = `${total || 0}作品 · 新しい順`;
      if (!data?.length) {
        const filtered = title || genre;
        grid.innerHTML = `<div class="gallery-empty"><span aria-hidden="true">🎮</span><h3>${filtered ? '作品が見つかりませんでした' : '公開中の作品はまだありません'}</h3><p>${filtered ? '作品名やジャンルを変えて、もう一度さがしてみてね。' : '体験ワークショップで完成した作品が、ここに並びます。'}</p>${filtered ? '<button type="button" class="gallery-reset">絞り込みをリセット</button>' : ''}</div>`;
        grid.querySelector('.gallery-reset')?.addEventListener('click', () => { form.reset(); page = 0; load(); });
      } else {
        grid.innerHTML = data.map(createGameCard).join('');
      }
      const pages = Math.ceil((total || 0) / PAGE_SIZE);
      pagination.hidden = pages <= 1;
      previous.disabled = page === 0;
      next.disabled = page + 1 >= pages;
      container.querySelector('#gallery-page').textContent = `${page + 1} / ${pages}`;
    } catch (error) {
      if (disposed || token !== request) return;
      console.error('Gallery load failed:', error);
      count.textContent = '読み込みに失敗しました';
      grid.innerHTML = '<div class="gallery-empty"><h3>作品を読み込めませんでした</h3><p>通信を確認して、もう一度お試しください。</p><button type="button" class="gallery-retry">もう一度よみこむ</button></div>';
      grid.querySelector('.gallery-retry').addEventListener('click', load);
    } finally {
      if (!disposed && token === request) grid.setAttribute('aria-busy', 'false');
    }
  }
  const search = () => { clearTimeout(searchTimer); page = 0; load(); };
  form.addEventListener('submit', event => { event.preventDefault(); search(); });
  form.elements.genre.addEventListener('change', search);
  form.elements.title.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 350); });
  previous.addEventListener('click', () => { page--; load(); grid.scrollIntoView({ block: 'start' }); });
  next.addEventListener('click', () => { page++; load(); grid.scrollIntoView({ block: 'start' }); });
  load();
  return () => { disposed = true; request++; clearTimeout(searchTimer); };
}

function createGameCard(game) {
  const genre = GENRES[game.genre_id];
  const title = escapeHtml(game.title || 'タイトルのない作品');
  return `<article class="gallery-card">
    <div class="gallery-card-art gallery-card-art--${genre ? game.genre_id : 'other'}" aria-hidden="true">
      ${genre ? `<img src="${workshopThumbUrl(game.genre_id, genre.file)}" alt="" loading="lazy" decoding="async" width="128" height="128">` : '<span class="gallery-art-generic">🎮</span>'}
      <span class="gallery-art-note">${genre ? `${genre.label}のイメージ` : 'ゲーム作品'}</span>
    </div>
    <div class="gallery-card-body"><span class="gallery-genre-label">${genre?.label || 'オリジナルゲーム'}</span><h3>${title}</h3>
      <p class="gallery-card-expiry">${game.expires_at ? `${escapeHtml(formatExpiresDate(game.expires_at))}まで公開` : '公開中'}</p>
      <a class="gallery-play-link" href="#/play/${encodeURIComponent(game.id)}" aria-label="${title}であそぶ"><span aria-hidden="true">▶</span> あそぶ</a>
    </div>
  </article>`;
}
