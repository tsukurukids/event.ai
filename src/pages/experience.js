import { supabase } from '../supabase.js';
import { downloadFolderAsZip } from '../utils/zipDownload.js';
import '../styles/experience.css';

// デザインシステムのパステルパレットに合わせた色
const GENRE_THEMES = [
  { color: '#E8879C', chip: '#FFB7C5', icon: '⚔️' },
  { color: '#9B6FBD', chip: '#C8A2E8', icon: '🔥' },
  { color: '#6CB4DA', chip: '#A8D8F0', icon: '🌊' },
  { color: '#52B788', chip: '#A8E6CF', icon: '🌿' },
  { color: '#E09050', chip: '#FFD5B5', icon: '⭐' },
  { color: '#7C85DB', chip: '#B8C0F0', icon: '🚀' },
  { color: '#D97BA8', chip: '#F5C0D8', icon: '🎀' },
  { color: '#3AADA8', chip: '#A0DDD8', icon: '💎' },
];

export async function renderExperienceAuto(container) {
  container.innerHTML = `<div class="loading"><div class="loading-spinner"></div></div>`;
  try {
    const { data: active } = await supabase
      .from('experience_themes').select('*')
      .eq('is_published', true).eq('is_active', true).limit(1);

    let ev = active?.[0];
    if (!ev) {
      const { data: fb } = await supabase
        .from('experience_themes').select('*')
        .eq('is_published', true).order('sort_order').limit(1);
      ev = fb?.[0];
    }

    if (!ev) { showStandby(container); return; }
    renderExperience(container, { slug: ev.slug });
  } catch (e) {
    console.error(e);
    showStandby(container);
  }
}

export async function renderExperience(container, params) {
  container.innerHTML = `<div class="loading"><div class="loading-spinner"></div></div>`;
  try {
    const { data: event, error } = await supabase
      .from('experience_themes')
      .select('*, experience_games(*)')
      .eq('slug', params.slug).eq('is_published', true).single();

    if (error || !event) { showStandby(container, 'イベントが見つかりません'); return; }

    const genres = (event.experience_games || [])
      .filter(g => g.is_published && g.game_url)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    if (!genres.length) { showStandby(container, 'ゲームを準備中です'); return; }

    buildCoverflow(container, event, genres);
  } catch (e) {
    console.error(e);
  }
}

// ── 3D カバーフロー ────────────────────────────────────────

function buildCoverflow(container, event, genres) {
  let active = 0;

  container.innerHTML = `
    <div class="exp-wrap">

      <!-- ヘッダー -->
      <header class="exp-header">
        <div class="exp-header-info">
          <h1 class="exp-event-title">${event.name}</h1>
          ${event.event_date ? `<p class="exp-event-date">📅 ${formatDate(event.event_date)}</p>` : ''}
        </div>
        <p class="exp-header-lead">ジャンルを選んで遊ぼう！</p>
      </header>

      <!-- 3D ステージ -->
      <div class="exp-stage" id="exp-stage">
        <button class="exp-cf-arrow exp-cf-prev" id="exp-prev">‹</button>

        <div class="exp-cf-scene" id="exp-scene">
          ${genres.map((g, i) => {
            const th = GENRE_THEMES[i % GENRE_THEMES.length];
            return `
              <div class="exp-cf-card" data-index="${i}"
                   style="--c:${th.color};--chip:${th.chip}">
                <div class="exp-cf-front">
                  <span class="exp-cf-icon">${th.icon}</span>
                  <span class="exp-cf-genre-label">${g.genre_label}</span>
                  <h3 class="exp-cf-title">${g.title}</h3>
                  <p class="exp-cf-desc">${g.description || ''}</p>
                  <button class="exp-cf-play-btn">遊ぶ ▶</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button class="exp-cf-arrow exp-cf-next" id="exp-next">›</button>
      </div>

      <!-- ドット -->
      <div class="exp-cf-dots" id="exp-dots">
        ${genres.map((_, i) => `<button class="exp-cf-dot" data-i="${i}"></button>`).join('')}
      </div>

    </div>

    <!-- ゲームモーダル -->
    <div class="exp-modal" id="exp-modal" aria-hidden="true">
      <div class="exp-modal-inner">
        <button class="exp-modal-close" id="exp-modal-close" aria-label="閉じる">✕</button>
        <div class="exp-modal-game">
          <iframe class="exp-iframe" id="exp-modal-iframe"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            src=""></iframe>
        </div>
        <div class="exp-modal-side">
          <div class="exp-modal-info">
            <div class="exp-genre-chip" id="exp-modal-genre"></div>
            <h2 class="exp-modal-title" id="exp-modal-title"></h2>
            <p class="exp-modal-desc" id="exp-modal-desc"></p>
          </div>
          <button class="exp-dl-btn" id="exp-modal-dl">
            <span class="exp-dl-icon">📦</span>
            <span id="exp-dl-text">素材をダウンロード</span>
          </button>
          <p class="exp-dl-note">ゲームで使った素材を持ち帰れます！</p>
        </div>
      </div>
    </div>
  `;

  // ── 要素取得 ──
  const scene      = document.getElementById('exp-scene');
  const cards      = [...scene.querySelectorAll('.exp-cf-card')];
  const dots       = [...document.querySelectorAll('.exp-cf-dot')];
  const modal      = document.getElementById('exp-modal');
  const modalClose = document.getElementById('exp-modal-close');
  const modalIframe = document.getElementById('exp-modal-iframe');
  const modalGenre = document.getElementById('exp-modal-genre');
  const modalTitle = document.getElementById('exp-modal-title');
  const modalDesc  = document.getElementById('exp-modal-desc');
  const dlBtn      = document.getElementById('exp-modal-dl');
  const dlText     = document.getElementById('exp-dl-text');

  // ── カードポジション計算 ──
  function position() {
    cards.forEach((card, i) => {
      const off = i - active;
      const abs = Math.abs(off);

      if (abs > 3) {
        card.style.opacity = '0';
        card.style.pointerEvents = 'none';
        return;
      }

      // 奥行きを二乗で増やすと「円弧」感が出る
      const tx = off * 230;
      const tz = -(abs * abs) * 90;
      const ry = off * 40;
      const sc = 1 - abs * 0.14;
      const op = 1 - abs * 0.28;

      card.style.transform = `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`;
      card.style.opacity   = String(Math.max(0, op));
      card.style.zIndex    = String(20 - abs);
      card.style.pointerEvents = 'auto';
      card.classList.toggle('exp-cf-card--active', off === 0);
    });

    dots.forEach((d, i) => d.classList.toggle('exp-cf-dot--active', i === active));
  }

  position();

  // ── ナビゲーション ──
  function go(newIdx) {
    active = Math.max(0, Math.min(genres.length - 1, newIdx));
    position();
  }

  document.getElementById('exp-prev').addEventListener('click', () => go(active - 1));
  document.getElementById('exp-next').addEventListener('click', () => go(active + 1));
  dots.forEach(d => d.addEventListener('click', () => go(parseInt(d.dataset.i))));

  // カードクリック：非アクティブは移動、アクティブはモーダルを開く
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      if (idx !== active) {
        go(idx);
      } else {
        openModal(idx);
      }
    });
  });

  // タッチスワイプ
  let tx0 = 0;
  scene.addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; }, { passive: true });
  scene.addEventListener('touchend',   e => {
    const d = tx0 - e.changedTouches[0].clientX;
    if (Math.abs(d) > 50) go(d > 0 ? active + 1 : active - 1);
  }, { passive: true });

  // キーボード
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  go(active - 1);
    if (e.key === 'ArrowRight') go(active + 1);
    if (e.key === 'Escape') closeModal();
  });

  // ── モーダル ──
  function openModal(idx) {
    const g  = genres[idx];
    const th = GENRE_THEMES[idx % GENRE_THEMES.length];
    modalGenre.textContent  = g.genre_label;
    modalGenre.style.background = th.color;
    modalTitle.textContent  = g.title;
    modalDesc.textContent   = g.description || '';
    dlBtn.dataset.materials = g.materials_storage_path || '';
    dlBtn.dataset.label     = g.genre_label;
    dlText.textContent = '素材をダウンロード';
    dlBtn.disabled = false;
    modal.style.setProperty('--modal-color', th.chip);
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('exp-modal--open');
    modalIframe.src = g.game_url;
  }

  function closeModal() {
    modal.classList.remove('exp-modal--open');
    modal.setAttribute('aria-hidden', 'true');
    modalIframe.src = '';
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // ── ダウンロード ──
  dlBtn.addEventListener('click', async () => {
    const path  = dlBtn.dataset.materials;
    const label = dlBtn.dataset.label;
    if (!path) {
      dlText.textContent = '⚠️ 素材が未設定です';
      setTimeout(() => { dlText.textContent = '素材をダウンロード'; }, 2000);
      return;
    }
    dlBtn.disabled = true;
    dlText.textContent = 'ダウンロード中…';
    try {
      await downloadFolderAsZip(path, `${label}-素材`);
      dlText.textContent = '✅ 完了！';
    } catch (err) {
      console.error('[DL]', err);
      dlText.textContent = '❌ 失敗';
      // 詳細をアラートで表示（インストラクターが原因を把握できるよう）
      alert(`素材のダウンロードに失敗しました。\n\n${err.message}`);
    }
    setTimeout(() => { dlText.textContent = '素材をダウンロード'; dlBtn.disabled = false; }, 2500);
  });
}

// ── ユーティリティ ────────────────────────────────────────

function formatDate(s) {
  const d = new Date(s + 'T00:00:00');
  const w = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w[d.getDay()]})`;
}

function showStandby(container, msg = '体験の準備中です') {
  container.innerHTML = `
    <div class="exp-standby">
      <p class="exp-standby-icon">✨</p>
      <h1>${msg}</h1>
      <p>しばらくお待ちください</p>
    </div>`;
}

export function renderExperienceList(container) {
  container.innerHTML = `
    <div class="page-header"><h1>AI体験</h1><p class="subtitle">開催イベント一覧</p></div>
    <div class="card-grid card-grid-2" id="evgrid">
      <div class="loading"><div class="loading-spinner"></div></div>
    </div>`;
  supabase.from('experience_themes').select('*')
    .eq('is_published', true).order('sort_order')
    .then(({ data }) => {
      const g = document.getElementById('evgrid');
      if (!data?.length) {
        g.innerHTML = `<div class="empty-state"><p>公開中のイベントがありません</p></div>`;
        return;
      }
      g.innerHTML = data.map(ev => `
        <div class="glass-card variant-candy" data-slug="${ev.slug}" role="button" tabindex="0"
             style="text-align:center;cursor:pointer;padding:2rem;">
          <span style="font-size:2.5rem;">✨</span>
          <h3 style="margin-top:0.5rem;font-weight:800;">${ev.name}</h3>
        </div>`).join('');
      g.querySelectorAll('[data-slug]').forEach(c =>
        c.addEventListener('click', () => { window.location.hash = `/${c.dataset.slug}`; }));
    });
}
