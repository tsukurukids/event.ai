import { supabase } from '../supabase.js';

/**
 * 体験イベント管理 — サイドバー
 */
export function initExperienceAdmin(state, callbacks) {
  loadExperienceSidebar(state, callbacks);
}

async function loadExperienceSidebar(state, callbacks) {
  const sidebarEvents = document.getElementById('sidebar-themes');
  if (!sidebarEvents) return;

  const { data: events, error } = await supabase
    .from('experience_themes')
    .select('*')
    .order('sort_order');

  if (error) {
    console.error('Error loading events:', error);
    return;
  }

  state.experienceEvents = events || [];

  sidebarEvents.innerHTML = events.map(ev => `
    <button class="sidebar-item ${state.selectedThemeId === ev.id ? 'active' : ''}" data-theme-id="${ev.id}">
      <span style="display:flex;align-items:center;gap:6px;width:100%;">
        <span>${ev.is_published ? '🟢' : '🔴'}</span>
        <span style="flex:1;text-align:left;">${ev.name}</span>
        ${ev.is_active ? '<span style="font-size:0.7em;background:#16a34a;color:white;padding:1px 6px;border-radius:100px;">表示中</span>' : ''}
      </span>
    </button>
  `).join('');

  sidebarEvents.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      state.adminMode = 'experience';
      state.selectedThemeId = item.dataset.themeId;
      state.selectedLocationId = null;
      sessionStorage.setItem('admin_mode', 'experience');
      sessionStorage.setItem('admin_selectedThemeId', state.selectedThemeId);
      sessionStorage.removeItem('admin_selectedLocationId');

      document.querySelectorAll('#sidebar-locations .sidebar-item').forEach(i => i.classList.remove('active'));
      sidebarEvents.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      loadEventContent(state, callbacks);
    });
  });

  if (state.selectedThemeId && state.adminMode === 'experience') {
    const activeBtn = sidebarEvents.querySelector(`[data-theme-id="${state.selectedThemeId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      loadEventContent(state, callbacks);
    }
  }
}

export async function loadEventContent(state, callbacks) {
  const main = document.getElementById('main-content');
  const event = state.experienceEvents.find(e => e.id === state.selectedThemeId);
  if (!event) return;

  const { data: genres, error } = await supabase
    .from('experience_games')
    .select('*')
    .eq('theme_id', event.id)
    .order('sort_order');

  if (error) {
    console.error('Error loading genres:', error);
    return;
  }

  const experienceUrl = `${window.location.origin}/experience.html`;
  const dateStr = event.event_date ? formatDate(event.event_date) : '';

  main.innerHTML = `
    <div class="admin-main-header">
      <h1>📅 ${event.name}${dateStr ? ` <span style="font-size:0.7em;color:var(--admin-text-light);">${dateStr}</span>` : ''}</h1>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
        <button class="btn btn-ghost btn-sm" id="edit-event-btn">✏️ 編集</button>
        <button class="btn btn-ghost btn-sm" id="toggle-event-publish-btn">
          ${event.is_published ? '🔴 非公開にする' : '🟢 公開する'}
        </button>
        <button class="btn btn-danger btn-sm" id="delete-event-btn">🗑️ 削除</button>
        <button class="btn btn-primary" id="add-genre-btn">＋ ジャンル追加</button>
      </div>
    </div>

    <div class="exp-admin-status-card ${event.is_active ? 'exp-admin-status-active' : 'exp-admin-status-inactive'}">
      <div class="exp-admin-status-left">
        <span class="exp-admin-status-dot"></span>
        <div>
          <p class="exp-admin-status-label">${event.is_active ? '体験画面に表示中' : '体験画面に未表示'}</p>
          <p class="exp-admin-status-hint">
            ${event.is_active
              ? `会場のタブレット・PCで <strong>${experienceUrl}</strong> を開くとこのイベントが表示されます`
              : '「体験画面に表示する」を押すと、会場の画面に切り替わります'}
          </p>
        </div>
      </div>
      <div class="exp-admin-status-right">
        ${event.is_active
          ? `<a href="${experienceUrl}" target="_blank" class="btn btn-ghost btn-sm">画面を確認</a>`
          : `<button class="btn btn-primary" id="set-active-btn" ${!event.is_published ? 'disabled title="先に公開してください"' : ''}>体験画面に表示する</button>`
        }
      </div>
    </div>

    <div id="genres-container">
      ${genres && genres.length > 0
        ? genres.map(genre => renderGenreCard(genre)).join('')
        : '<p style="color:var(--admin-text-light); text-align:center; padding:2rem;">ジャンルがまだありません。「ジャンル追加」から登録してください。</p>'
      }
    </div>
  `;

  document.getElementById('edit-event-btn').addEventListener('click', () => {
    showEventModal('開催イベントを編集', event, async (data) => {
      await supabase.from('experience_themes').update(data).eq('id', event.id);
      await refreshEvents(state, callbacks);
      callbacks.showToast('イベントを更新しました');
    });
  });

  document.getElementById('toggle-event-publish-btn').addEventListener('click', async () => {
    await supabase.from('experience_themes').update({ is_published: !event.is_published }).eq('id', event.id);
    await refreshEvents(state, callbacks);
    callbacks.showToast(event.is_published ? '非公開にしました' : '公開しました');
  });

  document.getElementById('set-active-btn')?.addEventListener('click', async () => {
    if (!event.is_published) return;
    await supabase.from('experience_themes').update({ is_active: false }).neq('id', event.id);
    await supabase.from('experience_themes').update({ is_active: true }).eq('id', event.id);
    await refreshEvents(state, callbacks);
    callbacks.showToast('✅ 体験画面に表示するイベントを切り替えました');
  });

  document.getElementById('delete-event-btn').addEventListener('click', () => {
    callbacks.showConfirm(`「${event.name}」を削除しますか？\nジャンルもすべて削除されます。`, async () => {
      await supabase.from('experience_themes').delete().eq('id', event.id);
      state.selectedThemeId = null;
      sessionStorage.removeItem('admin_selectedThemeId');
      await refreshEvents(state, callbacks);
      main.innerHTML = '<div style="text-align:center;padding:4rem;color:var(--admin-text-light);"><p>開催イベントを選択してください</p></div>';
      callbacks.showToast('イベントを削除しました');
    });
  });

  document.getElementById('add-genre-btn').addEventListener('click', () => {
    showGenreModal('ジャンルを追加', {}, async (data) => {
      const maxOrder = genres ? genres.length : 0;
      await supabase.from('experience_games').insert({
        theme_id: event.id,
        genre_label: data.genre_label,
        title: data.title,
        description: data.description || '',
        game_url: data.game_url,
        sort_order: maxOrder,
        is_published: true,
      });
      loadEventContent(state, callbacks);
      callbacks.showToast('ジャンルを追加しました');
    });
  });

  attachGenreHandlers(state, callbacks);
}

function renderGenreCard(genre) {
  const hasUrl = !!genre.game_url;
  const hasMaterials = !!genre.materials_storage_path;

  return `
    <div class="content-card" style="margin-bottom:1rem;">
      <div class="content-card-header">
        <div>
          <h3>${genre.is_published ? '🟢' : '🔴'} ${genre.genre_label} — ${genre.title}</h3>
          ${genre.description ? `<p style="color:var(--admin-text-light);font-size:0.85rem;margin-top:0.25rem;">${genre.description}</p>` : ''}
        </div>
        <div style="display:flex; gap:0.3rem;">
          <button class="btn btn-ghost btn-sm edit-genre-btn" data-genre-id="${genre.id}">✏️ 編集</button>
          <button class="btn btn-ghost btn-sm toggle-genre-btn" data-genre-id="${genre.id}" data-published="${genre.is_published}">${genre.is_published ? '非公開' : '公開'}</button>
          <button class="btn btn-danger btn-sm delete-genre-btn" data-genre-id="${genre.id}" data-title="${genre.title}">🗑️</button>
        </div>
      </div>
      <div class="event-body-inner">
        <div class="exp-game-status">
          <span class="status-badge ${hasUrl ? 'status-ok' : 'status-warn'}">${hasUrl ? '✅ URL設定済' : '⚠️ URL未設定'}</span>
          <span class="status-badge ${hasMaterials ? 'status-ok' : 'status-warn'}">${hasMaterials ? '✅ 素材設定済' : '⚠️ 素材未設定'}</span>
        </div>
        ${genre.game_url ? `<p class="upload-hint" style="margin:0.5rem 0;">🔗 ${genre.game_url}</p>` : ''}
        ${genre.materials_storage_path ? `<p class="upload-hint" style="margin:0.5rem 0;">📦 ${genre.materials_storage_path}</p>` : ''}

        <div class="upload-area upload-zone exp-materials-upload" data-genre-id="${genre.id}" style="margin-top:0.75rem;">
          <div class="upload-icon">📦</div>
          <p>素材フォルダをドラッグ＆ドロップ、またはクリックしてアップロード</p>
          <p class="upload-hint">画像・音声・テンプレートなど</p>
          <input type="file" class="folder-input" webkitdirectory directory multiple style="display:none;">
          <div class="upload-progress">
            <div class="progress-bar"><div class="progress-bar-fill"></div></div>
            <p class="progress-text"></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachGenreHandlers(state, callbacks) {
  document.querySelectorAll('.edit-genre-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: genre } = await supabase.from('experience_games').select('*').eq('id', btn.dataset.genreId).single();
      if (!genre) return;

      showGenreModal('ジャンルを編集', genre, async (data) => {
        await supabase.from('experience_games').update({
          genre_label: data.genre_label,
          title: data.title,
          description: data.description || '',
          game_url: data.game_url,
        }).eq('id', genre.id);
        loadEventContent(state, callbacks);
        callbacks.showToast('更新しました');
      });
    });
  });

  document.querySelectorAll('.toggle-genre-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isPublished = btn.dataset.published === 'true';
      await supabase.from('experience_games').update({ is_published: !isPublished }).eq('id', btn.dataset.genreId);
      loadEventContent(state, callbacks);
      callbacks.showToast(isPublished ? '非公開にしました' : '公開しました');
    });
  });

  document.querySelectorAll('.delete-genre-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      callbacks.showConfirm(`「${btn.dataset.title}」を削除しますか？`, async () => {
        await supabase.from('experience_games').delete().eq('id', btn.dataset.genreId);
        loadEventContent(state, callbacks);
        callbacks.showToast('削除しました');
      });
    });
  });

  document.querySelectorAll('.exp-materials-upload').forEach(zone => {
    setupMaterialsUpload(zone, state, callbacks);
  });
}

function setupMaterialsUpload(zone, state, callbacks) {
  const folderInput = zone.querySelector('.folder-input');
  const progressEl = zone.querySelector('.upload-progress');
  const progressBar = zone.querySelector('.progress-bar-fill');
  const progressText = zone.querySelector('.progress-text');
  const genreId = zone.dataset.genreId;

  zone.addEventListener('click', (e) => {
    if (e.target.closest('.upload-progress')) return;
    folderInput.click();
  });

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = await collectDroppedFiles(e.dataTransfer.items);
    if (files.length > 0) {
      await handleMaterialsUpload(files, genreId, progressEl, progressBar, progressText, state, callbacks);
    }
  });

  folderInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await handleMaterialsUpload(files, genreId, progressEl, progressBar, progressText, state, callbacks);
    }
  });
}

async function handleMaterialsUpload(files, genreId, progressEl, progressBar, progressText, state, callbacks) {
  progressEl.classList.add('show');
  progressBar.style.width = '0%';
  progressText.textContent = 'アップロード準備中...';

  try {
    const { data: genre } = await supabase.from('experience_games').select('*').eq('id', genreId).single();
    if (!genre) throw new Error('Genre not found');

    const storagePath = `experience/${genre.theme_id}/${genreId}/materials`;
    const total = files.length;
    let uploaded = 0;

    for (const file of files) {
      let filePath;
      if (file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        parts.shift();
        filePath = `${storagePath}/${parts.join('/')}`;
      } else if (file.relativePath) {
        const parts = file.relativePath.split('/');
        parts.shift();
        filePath = `${storagePath}/${parts.join('/')}`;
      } else {
        filePath = `${storagePath}/${file.name}`;
      }

      const { error } = await supabase.storage.from('game-files').upload(filePath, file, {
        upsert: true,
        contentType: detectContentType(file.name),
      });

      if (error) console.error('Upload error:', error);

      uploaded++;
      progressBar.style.width = `${Math.round((uploaded / total) * 100)}%`;
      progressText.textContent = `${uploaded}/${total} (${Math.round((uploaded / total) * 100)}%)`;
    }

    await supabase.from('experience_games').update({ materials_storage_path: storagePath }).eq('id', genreId);

    progressText.textContent = '✅ 完了！';
    callbacks.showToast('素材をアップロードしました');
    setTimeout(() => loadEventContent(state, callbacks), 800);
  } catch (err) {
    console.error('Upload failed:', err);
    progressText.textContent = '❌ 失敗しました';
    callbacks.showToast('アップロードに失敗しました', 'error');
  }
}

async function collectDroppedFiles(items) {
  const files = [];
  if (!items) return files;
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await readEntryRecursive(entry, files);
  }
  return files;
}

function readEntryRecursive(entry, files, path = '') {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        file.relativePath = path + file.name;
        files.push(file);
        resolve();
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      reader.readEntries(async (entries) => {
        for (const childEntry of entries) {
          await readEntryRecursive(childEntry, files, path + entry.name + '/');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function detectContentType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const types = {
    html: 'text/html', css: 'text/css', js: 'application/javascript',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', mp3: 'audio/mpeg',
    wav: 'audio/wav', txt: 'text/plain', zip: 'application/zip',
  };
  return types[ext] || 'application/octet-stream';
}

function showEventModal(title, existing, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <h2>${title}</h2>
      <form id="event-modal-form">
        <div class="form-group">
          <label>イベント名 <span style="color:var(--danger)">*</span></label>
          <input type="text" id="ev-name" value="${existing.name || ''}" placeholder="例：那覇市 AI体験 3月15日" required>
        </div>
        <div class="form-group">
          <label>開催日</label>
          <input type="date" id="ev-date" value="${existing.event_date || ''}">
        </div>
        <div class="form-group">
          <label>ようこそタイトル</label>
          <input type="text" id="ev-welcome-title" value="${existing.welcome_title || 'AI体験へようこそ！'}">
          <p class="upload-hint">体験画面の大見出しに表示されます</p>
        </div>
        <div class="form-group">
          <label>サブタイトル</label>
          <input type="text" id="ev-welcome-subtitle" value="${existing.welcome_subtitle || ''}" placeholder="例：今日はゲームを作ろう！">
        </div>
        <div class="form-group">
          <label>説明文</label>
          <input type="text" id="ev-welcome-desc" value="${existing.welcome_description || ''}" placeholder="例：ジャンルを選んで、お手本ゲームを遊んでみよう！">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modal-cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#event-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('ev-name').value;
    // スラッグは名前から自動生成（既存の場合はそのまま保持）
    const slug = existing.slug || generateSlug(name);
    const data = {
      name,
      event_date: document.getElementById('ev-date').value || null,
      slug,
      welcome_title: document.getElementById('ev-welcome-title').value,
      welcome_subtitle: document.getElementById('ev-welcome-subtitle').value,
      welcome_description: document.getElementById('ev-welcome-desc').value,
    };
    overlay.remove();
    await onSubmit(data);
  });
}

function generateSlug(name) {
  // ひらがな・カタカナ・漢字はそのままローマ字に変換できないため、タイムスタンプで一意性を確保
  const base = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')   // ASCII以外を除去
    .replace(/[\s_]+/g, '-')    // スペースをハイフンに
    .replace(/[^a-z0-9-]/g, '') // 英数字・ハイフン以外を除去
    .replace(/^-+|-+$/g, '');   // 先頭末尾のハイフンを除去

  const ts = Date.now().toString(36); // 短いタイムスタンプ
  return base ? `${base}-${ts}` : `event-${ts}`;
}

function showGenreModal(title, existing, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal" style="max-width:520px;">
      <h2>${title}</h2>
      <form id="genre-modal-form">
        <div class="form-group">
          <label>ジャンル名</label>
          <input type="text" id="genre-label" value="${existing.genre_label || ''}" placeholder="例：RPG" required>
        </div>
        <div class="form-group">
          <label>ゲームタイトル</label>
          <input type="text" id="genre-title" value="${existing.title || ''}" placeholder="例：勇者の冒険" required>
        </div>
        <div class="form-group">
          <label>説明（任意）</label>
          <input type="text" id="genre-desc" value="${existing.description || ''}" placeholder="例：ターン制バトルゲーム">
        </div>
        <div class="form-group">
          <label>ゲームURL</label>
          <input type="url" id="genre-url" value="${existing.game_url || ''}" placeholder="https://..." required>
          <p class="upload-hint">体験者が遊ぶゲームのURLを入力してください</p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modal-cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#genre-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      genre_label: document.getElementById('genre-label').value,
      title: document.getElementById('genre-title').value,
      description: document.getElementById('genre-desc').value,
      game_url: document.getElementById('genre-url').value,
    };
    overlay.remove();
    await onSubmit(data);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
}

export async function refreshEvents(state, callbacks) {
  const { data: events } = await supabase
    .from('experience_themes')
    .select('*')
    .order('sort_order');

  state.experienceEvents = events || [];
  initExperienceAdmin(state, callbacks);

  if (state.selectedThemeId) {
    loadEventContent(state, callbacks);
  }
}

export function handleAddEvent(state, callbacks) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px;">
      <h2>開催イベントを追加</h2>
      <form id="add-event-form">
        <div class="form-group">
          <label>イベント名 <span style="color:var(--danger)">*</span></label>
          <input type="text" id="add-ev-name" placeholder="例：那覇市 AI体験 3月15日" required autofocus>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="add-ev-cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">追加</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('#add-ev-name')?.focus(), 80);

  overlay.querySelector('#add-ev-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#add-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = overlay.querySelector('#add-ev-name').value.trim();
    if (!name) return;

    const slug = generateSlug(name);
    const maxOrder = state.experienceEvents?.length || 0;

    const { data: newEvent, error } = await supabase.from('experience_themes').insert({
      name,
      slug,
      welcome_title: 'AI体験へようこそ！',
      welcome_subtitle: '',
      welcome_description: 'ジャンルを選んで、お手本ゲームを遊んでみよう！',
      sort_order: maxOrder,
    }).select().single();

    overlay.remove();

    if (error) {
      callbacks.showToast('追加に失敗しました', 'error');
      return;
    }

    state.selectedThemeId = newEvent.id;
    state.adminMode = 'experience';
    sessionStorage.setItem('admin_mode', 'experience');
    sessionStorage.setItem('admin_selectedThemeId', newEvent.id);

    await refreshEvents(state, callbacks);
    callbacks.showToast(`「${name}」を追加しました`);
  });
}

// 後方互換
export const loadThemeContent = loadEventContent;
export const refreshThemes = refreshEvents;
export const handleAddTheme = handleAddEvent;
