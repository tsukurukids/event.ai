import { supabase } from '../supabase.js';
import { WORKSHOP_GENRES, getGenreById } from '../config/workshopGenres.js';
import { formatExpiresDate } from '../utils/retention.js';
import {
  uploadAdminGameFolder,
  deleteGameWithFiles,
  buildPlayUrl,
  getFolderNameFromFiles,
} from '../utils/gameUpload.js';

const PAGE_SIZE = 50;
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])
  );

function showToast(message, type = 'success') {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2>確認</h2>
        <p style="margin-bottom:1.25rem; color:var(--text-sub); white-space:pre-wrap;">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">キャンセル</button>
          <button type="button" class="btn btn-danger" data-action="ok">削除する</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = (ok) => {
      overlay.remove();
      resolve(ok);
    };
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });
  });
}

export function renderGalleryAdmin(container) {
  let page = 0;
  let total = 0;
  let request = 0;
  let games = [];

  container.innerHTML = `
    <div class="admin-shell">
      <header class="admin-topbar">
        <div>
          <p class="admin-eyebrow">管理者</p>
          <h1>ギャラリー作品の管理</h1>
        </div>
        <div class="admin-topbar-actions">
          <button type="button" class="btn btn-primary" id="add-game-btn">＋ 作品を追加</button>
          <button type="button" class="logout-btn" id="logout-btn" style="width:auto;">ログアウト</button>
        </div>
      </header>

      <section class="content-card admin-panel">
        <div class="admin-toolbar">
          <p id="gallery-admin-count" class="admin-count">読み込み中…</p>
          <label class="admin-filter">
            ジャンル
            <select id="genre-filter">
              <option value="">すべて</option>
              ${WORKSHOP_GENRES.map((g) => `<option value="${g.id}">${escapeHtml(g.label)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div id="gallery-admin-list" class="admin-game-list" aria-busy="true"></div>
        <nav class="admin-pagination" id="gallery-admin-pagination" hidden>
          <button type="button" class="btn btn-ghost btn-sm" data-page="prev">← 前へ</button>
          <span id="gallery-admin-page"></span>
          <button type="button" class="btn btn-ghost btn-sm" data-page="next">次へ →</button>
        </nav>
      </section>
    </div>
  `;

  const listEl = container.querySelector('#gallery-admin-list');
  const countEl = container.querySelector('#gallery-admin-count');
  const pagination = container.querySelector('#gallery-admin-pagination');
  const genreFilter = container.querySelector('#genre-filter');

  container.querySelector('#logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  container.querySelector('#add-game-btn').addEventListener('click', () => {
    openAddModal(async () => {
      page = 0;
      await loadGames();
    });
  });

  genreFilter.addEventListener('change', () => {
    page = 0;
    loadGames();
  });

  pagination.querySelector('[data-page="prev"]').addEventListener('click', () => {
    if (page > 0) {
      page -= 1;
      loadGames();
    }
  });
  pagination.querySelector('[data-page="next"]').addEventListener('click', () => {
    const pages = Math.ceil(total / PAGE_SIZE);
    if (page + 1 < pages) {
      page += 1;
      loadGames();
    }
  });

  async function loadGames() {
    const token = ++request;
    listEl.setAttribute('aria-busy', 'true');
    listEl.innerHTML = '<p class="admin-muted">読み込み中…</p>';

    try {
      let query = supabase
        .from('games')
        .select('id, title, genre_id, storage_path, expires_at, uploaded_at, is_published', { count: 'exact' })
        .order('uploaded_at', { ascending: false })
        .order('id', { ascending: false });

      const genre = genreFilter.value;
      if (genre) query = query.eq('genre_id', genre);

      const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (token !== request) return;
      if (error) throw error;

      games = data || [];
      total = count || 0;

      if (!games.length && page > 0) {
        page = 0;
        return loadGames();
      }

      countEl.textContent = `${total} 件`;
      renderList();

      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      pagination.hidden = pages <= 1;
      pagination.querySelector('[data-page="prev"]').disabled = page === 0;
      pagination.querySelector('[data-page="next"]').disabled = page + 1 >= pages;
      container.querySelector('#gallery-admin-page').textContent = `${page + 1} / ${pages}`;
    } catch (err) {
      if (token !== request) return;
      console.error(err);
      countEl.textContent = '読み込み失敗';
      listEl.innerHTML = `<p class="admin-error">作品一覧を取得できませんでした。<br>${escapeHtml(err.message || '')}</p>`;
    } finally {
      if (token === request) listEl.setAttribute('aria-busy', 'false');
    }
  }

  function renderList() {
    if (!games.length) {
      listEl.innerHTML = '<p class="admin-muted">作品がありません。「作品を追加」からフォルダをアップロードしてください。</p>';
      return;
    }

    listEl.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>作品名</th>
            <th>ジャンル</th>
            <th>公開期限</th>
            <th>追加日</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${games.map((game) => {
            const genre = getGenreById(game.genre_id);
            const expiry = game.expires_at
              ? formatExpiresDate(game.expires_at)
              : '期限なし';
            const uploaded = game.uploaded_at
              ? new Date(game.uploaded_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
              : '—';
            return `
              <tr data-id="${escapeHtml(game.id)}">
                <td>
                  <div class="admin-game-title">${escapeHtml(game.title || '無題')}</div>
                  <a class="admin-link" href="${escapeHtml(buildPlayUrl(game.id))}" target="_blank" rel="noopener">プレイを開く</a>
                </td>
                <td>${escapeHtml(genre?.label || game.genre_id || '—')}</td>
                <td>${escapeHtml(expiry)}</td>
                <td>${escapeHtml(uploaded)}</td>
                <td class="admin-table-actions">
                  <button type="button" class="btn btn-danger btn-sm" data-action="delete">削除</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    listEl.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr')?.dataset.id;
        const game = games.find((g) => g.id === id);
        if (!game) return;
        const ok = await showConfirm(
          `「${game.title || '無題'}」をギャラリーから削除します。\nStorage のファイルも消えます。よろしいですか？`
        );
        if (!ok) return;
        btn.disabled = true;
        try {
          await deleteGameWithFiles(game);
          showToast('削除しました');
          await loadGames();
        } catch (err) {
          console.error(err);
          showToast(err.message || '削除に失敗しました', 'error');
          btn.disabled = false;
        }
      });
    });
  }

  loadGames();
}

function openAddModal(onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:440px;">
      <h2>作品を追加</h2>
      <p style="margin-bottom:1rem; color:var(--text-sub); font-size:0.85rem;">
        index.html が入ったゲームフォルダを選んでください。管理者追加の作品は期限なしで公開されます。
      </p>
      <form id="add-game-form">
        <div class="form-group">
          <label for="add-title">作品名</label>
          <input type="text" id="add-title" maxlength="80" placeholder="フォルダ名が使われます（任意）">
        </div>
        <div class="form-group">
          <label for="add-genre">ジャンル</label>
          <select id="add-genre" required>
            ${WORKSHOP_GENRES.map((g) => `<option value="${g.id}">${escapeHtml(g.label)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="add-folder">ゲームフォルダ</label>
          <input type="file" id="add-folder" webkitdirectory directory multiple required>
        </div>
        <div id="add-progress" class="admin-progress" hidden>
          <div class="admin-progress-bar"><span></span></div>
          <p class="admin-progress-text"></p>
        </div>
        <div id="add-error" class="login-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-action="cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">アップロード</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector('#add-game-form');
  const errorEl = overlay.querySelector('#add-error');
  const progressEl = overlay.querySelector('#add-progress');
  const progressBar = progressEl.querySelector('span');
  const progressText = progressEl.querySelector('.admin-progress-text');
  const folderInput = overlay.querySelector('#add-folder');
  const titleInput = overlay.querySelector('#add-title');

  folderInput.addEventListener('change', () => {
    if (!titleInput.value.trim()) {
      titleInput.value = getFolderNameFromFiles([...folderInput.files]) || '';
    }
  });

  const close = () => overlay.remove();
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !form.querySelector('button[type="submit"]').disabled) close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');
    const files = [...folderInput.files];
    if (!files.length) {
      errorEl.textContent = 'フォルダを選んでください';
      errorEl.classList.add('show');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    overlay.querySelector('[data-action="cancel"]').disabled = true;
    progressEl.hidden = false;

    try {
      await uploadAdminGameFolder({
        files,
        title: titleInput.value.trim(),
        genreId: overlay.querySelector('#add-genre').value,
        onProgress: ({ percent, text }) => {
          progressBar.style.width = `${percent}%`;
          progressText.textContent = text || '';
        },
      });
      showToast('作品を追加しました');
      close();
      await onDone();
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'アップロードに失敗しました';
      errorEl.classList.add('show');
      submitBtn.disabled = false;
      overlay.querySelector('[data-action="cancel"]').disabled = false;
    }
  });
}
