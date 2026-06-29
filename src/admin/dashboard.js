import { supabase } from '../supabase.js';
import { initExperienceAdmin, handleAddEvent } from './experience.js';

/**
 * Main admin dashboard
 */
export function renderDashboard(container) {
  container.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar" id="sidebar">
        <div class="sidebar-header">
          <h2>🔧 管理ダッシュボード</h2>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-title">開催地（ギャラリー）</div>
          <div id="sidebar-locations"></div>
          <button class="sidebar-item" id="add-location-btn">
            <span class="item-icon">＋</span> 開催地を追加
          </button>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-title">開催イベント（AI体験）</div>
          <div id="sidebar-themes"></div>
          <button class="sidebar-item" id="add-theme-btn">
            <span class="item-icon">＋</span> 開催イベントを追加
          </button>
        </div>
        <div class="sidebar-footer">
          <button class="logout-btn" id="logout-btn">
            🚪 ログアウト
          </button>
        </div>
      </aside>
      <main class="admin-main" id="main-content">
        <div style="text-align:center; padding:4rem; color:var(--admin-text-light);">
          <p style="font-size:2rem; margin-bottom:1rem;">👈</p>
          <p>左のサイドバーから開催地を選択してください</p>
        </div>
      </main>
    </div>
  `;

  const adminCallbacks = {
    showToast,
    showConfirm,
  };

  // Init state — restore from sessionStorage
  const state = {
    locations: [],
    themes: [],
    adminMode: sessionStorage.getItem('admin_mode') || 'gallery',
    selectedLocationId: sessionStorage.getItem('admin_selectedLocationId') || null,
    selectedThemeId: sessionStorage.getItem('admin_selectedThemeId') || null,
  };

  // Load data
  loadSidebar(state);
  initExperienceAdmin(state, adminCallbacks);

  // Event listeners
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  document.getElementById('add-theme-btn').addEventListener('click', () => {
    handleAddEvent(state, adminCallbacks);
  });

  document.getElementById('add-location-btn').addEventListener('click', () => {
    showLocationModal('開催地を追加', {}, async (name, imageFile) => {
      const maxOrder = state.locations.length;
      let image_url = null;

      // Upload image if provided
      if (imageFile) {
        image_url = await uploadLocationImage(imageFile, `loc-${Date.now()}`);
      }

      await supabase.from('locations').insert({
        name,
        image_url,
        sort_order: maxOrder,
      });
      loadSidebar(state);
      showToast('開催地を追加しました');
    });
  });
}

/**
 * Load sidebar with locations
 */
async function loadSidebar(state) {
  const sidebarLocations = document.getElementById('sidebar-locations');

  const { data: locations, error } = await supabase
    .from('locations')
    .select('*')
    .order('sort_order');

  if (error) {
    console.error('Error loading locations:', error);
    return;
  }

  state.locations = locations || [];

  sidebarLocations.innerHTML = locations.map(loc => `
    <button class="sidebar-item ${state.selectedLocationId === loc.id ? 'active' : ''}" data-location-id="${loc.id}">
      ${loc.name}
    </button>
  `).join('');

  // Click handlers
  sidebarLocations.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      state.adminMode = 'gallery';
      state.selectedLocationId = item.dataset.locationId;
      state.selectedThemeId = null;
      sessionStorage.setItem('admin_mode', 'gallery');
      sessionStorage.setItem('admin_selectedLocationId', state.selectedLocationId);
      sessionStorage.removeItem('admin_selectedThemeId');
      sidebarLocations.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('#sidebar-themes .sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      loadLocationContent(state);
    });
  });

  // Auto-restore previously selected location
  if (state.selectedLocationId && state.adminMode === 'gallery') {
    const activeBtn = sidebarLocations.querySelector(`[data-location-id="${state.selectedLocationId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      loadLocationContent(state);
    }
  }
}

/**
 * Load main content for selected location
 */
async function loadLocationContent(state) {
  const main = document.getElementById('main-content');
  const location = state.locations.find(l => l.id === state.selectedLocationId);
  if (!location) return;

  // Get events with games (via sessions)
  const { data: events, error } = await supabase
    .from('events')
    .select('*, sessions(*, games(*))')
    .eq('location_id', state.selectedLocationId)
    .order('sort_order');

  if (error) {
    console.error('Error loading events:', error);
    return;
  }

  // Build image preview HTML
  const imagePreview = location.image_url 
    ? `<div style="margin-bottom:1rem;"><img src="${location.image_url}" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;"></div>`
    : '';

  main.innerHTML = `
    <div class="admin-main-header">
      <h1>${location.name}</h1>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn btn-ghost btn-sm" id="edit-location-btn">開催地を編集</button>
        <button class="btn btn-danger btn-sm" id="delete-location-btn">削除</button>
        <button class="btn btn-primary" id="add-event-btn">＋ 開催日を追加</button>
      </div>
    </div>
    ${imagePreview}
    <div id="events-container">
      ${events && events.length > 0 
        ? events.map((event, i) => renderEventCard(event, i, events.length)).join('') 
        : '<p style="color:var(--admin-text-light); text-align:center; padding:2rem;">まだ開催日がありません。「開催日を追加」ボタンで追加しましょう。</p>'
      }
    </div>
  `;

  // Edit location
  document.getElementById('edit-location-btn').addEventListener('click', () => {
    showLocationModal('開催地を編集', { name: location.name, image_url: location.image_url }, async (name, imageFile) => {
      const updateData = { name };

      if (imageFile) {
        updateData.image_url = await uploadLocationImage(imageFile, location.id);
      }

      await supabase.from('locations').update(updateData).eq('id', location.id);
      loadSidebar(state);
      loadLocationContent(state);
      showToast('開催地を更新しました');
    });
  });

  // Delete location
  document.getElementById('delete-location-btn').addEventListener('click', () => {
    showConfirm(`「${location.name}」を削除しますか？\n関連するすべてのデータも削除されます。`, async () => {
      await supabase.from('locations').delete().eq('id', location.id);
      state.selectedLocationId = null;
      loadSidebar(state);
      document.getElementById('main-content').innerHTML = '<div style="text-align:center;padding:4rem;color:var(--admin-text-light);"><p>開催地を選択してください</p></div>';
      showToast('✅ 開催地を削除しました');
    });
  });

  // Add event
  document.getElementById('add-event-btn').addEventListener('click', () => {
    showModal('開催日を追加', [
      { label: '日付', name: 'date', type: 'date' },
      { label: 'ラベル', name: 'label', type: 'text', placeholder: '例：DAY 1 — 3月8日(土)' },
    ], async (data) => {
      const maxOrder = events ? events.length : 0;
      // Create event
      const { data: newEvent, error: eventErr } = await supabase.from('events').insert({
        location_id: state.selectedLocationId,
        date: data.date,
        label: data.label,
        sort_order: maxOrder,
      }).select().single();

      if (eventErr) {
        showToast('❌ エラーが発生しました', 'error');
        return;
      }

      // Auto-create a default session for uploads
      await supabase.from('sessions').insert({
        event_id: newEvent.id,
        time: '00:00',
        label: 'デフォルト',
        sort_order: 0,
      });

      loadLocationContent(state);
      showToast('✅ 開催日を追加しました');
    });
  });

  // Attach event card handlers
  attachEventCardHandlers(state);
}

/**
 * 開催日（イベント）の表示順を入れ替える。
 * 隣り合うイベントと順序を交換し、sort_order を 0..n-1 に正規化して保存する。
 */
async function moveEvent(state, eventId, direction) {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, sort_order')
    .eq('location_id', state.selectedLocationId)
    .order('sort_order');

  if (error || !events) {
    console.error('Error loading events for reorder:', error);
    return;
  }

  const idx = events.findIndex(e => e.id === eventId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= events.length) return;

  [events[idx], events[swapIdx]] = [events[swapIdx], events[idx]];

  // sort_order を順番通りに振り直して保存（古いデータの null/重複も正規化）
  const updates = await Promise.all(
    events.map((e, i) =>
      supabase.from('events').update({ sort_order: i }).eq('id', e.id)
    )
  );

  if (updates.some(u => u.error)) {
    console.error('Error updating sort order:', updates.find(u => u.error)?.error);
    showToast('❌ 並び替えに失敗しました', 'error');
    return;
  }

  loadLocationContent(state);
}

/**
 * Render an event card with its games (flattened from sessions)
 */
function renderEventCard(event, index = 0, total = 1) {
  // Flatten all games from all sessions
  const sessions = event.sessions || [];
  const allGames = sessions.flatMap(s => (s.games || []).map(g => ({ ...g, sessionId: s.id })));
  // Get first session ID for uploads
  const defaultSessionId = sessions.length > 0 ? sessions[0].id : null;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return `
    <div class="content-card" data-event-id="${event.id}">
      <div class="content-card-header">
        <div class="event-toggle-area" data-event-id="${event.id}">
          <span class="toggle-chevron">▾</span>
          <h3>📅 ${event.label}</h3>
          <span class="event-game-count">🎮 ${allGames.length} 作品</span>
        </div>
        <div style="display:flex; gap:0.3rem;">
          <button class="btn btn-ghost btn-sm move-event-btn" data-event-id="${event.id}" data-dir="up" title="上へ" ${isFirst ? 'disabled' : ''}>↑</button>
          <button class="btn btn-ghost btn-sm move-event-btn" data-event-id="${event.id}" data-dir="down" title="下へ" ${isLast ? 'disabled' : ''}>↓</button>
          <button class="btn btn-ghost btn-sm edit-event-btn" data-event-id="${event.id}" data-label="${event.label}" data-date="${event.date}">✏️</button>
          <button class="btn btn-danger btn-sm delete-event-btn" data-event-id="${event.id}" data-label="${event.label}">🗑️</button>
        </div>
      </div>

      <div class="event-card-body" id="event-body-${event.id}">
        <div class="event-body-inner">
          <ul class="item-list">
            ${allGames.map(game => `
              <li class="item-row">
                <span class="item-name">
                  ${game.is_published ? '🟢' : '🔴'} ${game.title}
                </span>
                <div class="item-actions">
                  <button class="btn btn-ghost btn-sm toggle-publish-btn" data-game-id="${game.id}" data-published="${game.is_published}">
                    ${game.is_published ? '非公開にする' : '公開する'}
                  </button>
                  <button class="btn btn-ghost btn-sm edit-game-btn" data-game-id="${game.id}" data-title="${game.title}">✏️</button>
                  <button class="btn btn-danger btn-sm delete-game-btn" data-game-id="${game.id}" data-title="${game.title}" data-storage-path="${game.storage_path}">🗑️</button>
                </div>
              </li>
            `).join('')}
          </ul>

          <div class="upload-area upload-zone" data-session-id="${defaultSessionId}" data-event-id="${event.id}" style="margin-top:0.75rem;">
            <div class="upload-icon">📁</div>
            <p>フォルダをドラッグ＆ドロップ、またはクリックしてアップロード</p>
            <p class="upload-hint">HTML / CSS / JS / 画像（PNG・JPG など）を含むゲームフォルダ</p>
            <input type="file" class="folder-input" webkitdirectory directory multiple style="display:none;">
            <div class="upload-progress">
              <div class="progress-bar"><div class="progress-bar-fill"></div></div>
              <p class="progress-text"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event handlers to dynamically created elements
 */
function attachEventCardHandlers(state) {
  // Accordion toggle
  document.querySelectorAll('.event-toggle-area').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const eventId = toggle.dataset.eventId;
      const body = document.getElementById(`event-body-${eventId}`);
      const card = toggle.closest('.content-card');
      const chevron = toggle.querySelector('.toggle-chevron');
      const isCollapsed = body.classList.toggle('collapsed');
      card.classList.toggle('card-collapsed', isCollapsed);
      chevron.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
  });

  // Edit event buttons
  document.querySelectorAll('.edit-event-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showModal('開催日を編集', [
        { label: '日付', name: 'date', type: 'date', value: btn.dataset.date },
        { label: 'ラベル', name: 'label', type: 'text', value: btn.dataset.label },
      ], async (data) => {
        await supabase.from('events').update({ date: data.date, label: data.label }).eq('id', btn.dataset.eventId);
        loadLocationContent(state);
        showToast('✅ 開催日を更新しました');
      });
    });
  });

  // Move event up/down (reorder 開催日)
  document.querySelectorAll('.move-event-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      moveEvent(state, btn.dataset.eventId, btn.dataset.dir);
    });
  });

  // Delete event buttons
  document.querySelectorAll('.delete-event-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm(`「${btn.dataset.label}」を削除しますか？`, async () => {
        await supabase.from('events').delete().eq('id', btn.dataset.eventId);
        loadLocationContent(state);
        showToast('✅ 開催日を削除しました');
      });
    });
  });

  // Toggle publish
  document.querySelectorAll('.toggle-publish-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isPublished = btn.dataset.published === 'true';
      await supabase.from('games').update({ is_published: !isPublished }).eq('id', btn.dataset.gameId);
      loadLocationContent(state);
      showToast(isPublished ? '🔴 非公開にしました' : '🟢 公開しました');
    });
  });

  // Edit game
  document.querySelectorAll('.edit-game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showModal('作品名を編集', [
        { label: '作品名', name: 'title', type: 'text', value: btn.dataset.title },
      ], async (data) => {
        await supabase.from('games').update({ title: data.title }).eq('id', btn.dataset.gameId);
        loadLocationContent(state);
        showToast('✅ 作品名を更新しました');
      });
    });
  });

  // Delete game
  document.querySelectorAll('.delete-game-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showConfirm(`「${btn.dataset.title}」を削除しますか？`, async () => {
        if (btn.dataset.storagePath) {
          const { data: files } = await supabase.storage.from('game-files').list(btn.dataset.storagePath);
          if (files && files.length > 0) {
            const filePaths = files.map(f => `${btn.dataset.storagePath}/${f.name}`);
            await supabase.storage.from('game-files').remove(filePaths);
          }
        }
        await supabase.from('games').delete().eq('id', btn.dataset.gameId);
        loadLocationContent(state);
        showToast('✅ 作品を削除しました');
      });
    });
  });

  // Upload zones
  document.querySelectorAll('.upload-zone').forEach(zone => {
    const folderInput = zone.querySelector('.folder-input');
    const progressEl = zone.querySelector('.upload-progress');
    const progressBar = zone.querySelector('.progress-bar-fill');
    const progressText = zone.querySelector('.progress-text');

    zone.addEventListener('click', (e) => {
      if (e.target.closest('.upload-progress')) return;
      folderInput.click();
    });

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');

      const items = e.dataTransfer.items;
      if (!items) return;

      const files = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          await readEntryRecursive(entry, files);
        }
      }

      if (files.length === 0) {
        showToast('ゲームフォルダをドロップしてください', 'error');
        return;
      }

      await handleUpload(files, zone.dataset.sessionId, zone.dataset.eventId, progressEl, progressBar, progressText, state);
    });

    folderInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      e.target.value = '';
      if (files.length > 0) {
        await handleUpload(files, zone.dataset.sessionId, zone.dataset.eventId, progressEl, progressBar, progressText, state);
      }
    });
  });
}

/**
 * Read directory entries recursively (for drag & drop)
 */
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

/**
 * Detect content type from file extension
 */
function detectContentType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const types = {
    'html': 'text/html', 'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript', 'mjs': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp',
    'bmp': 'image/bmp', 'ico': 'image/x-icon',
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg',
    'mp4': 'video/mp4', 'webm': 'video/webm',
    'woff': 'font/woff', 'woff2': 'font/woff2',
    'ttf': 'font/ttf', 'otf': 'font/otf',
    'txt': 'text/plain', 'xml': 'application/xml',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Supabase Storage は非ASCII（日本語）や % をキーに使えない（InvalidKey）。
 * 日本語などを含むパスを ASCII 安全名に変換する。
 * 同じ元セグメントは常に同じ安全名になる（決定的ハッシュ）。
 */
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function safeSegment(seg) {
  if (!seg || SAFE_SEGMENT.test(seg)) return seg;
  const dot = seg.lastIndexOf('.');
  let ext = '';
  if (dot > 0) {
    const e = seg.slice(dot);
    if (/^\.[A-Za-z0-9]+$/.test(e)) ext = e.toLowerCase();
  }
  return `a_${hashStr(seg)}${ext}`;
}

function safeRelativePath(rel) {
  return rel.split('/').map(safeSegment).join('/');
}

const TEXT_EXTS = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'svg', 'xml', 'txt']);

function isTextFile(name) {
  return TEXT_EXTS.has(name.split('.').pop()?.toLowerCase());
}

function replaceAllStr(str, find, repl) {
  if (!find || find === repl) return str;
  return str.split(find).join(repl);
}

/**
 * 元の相対パス → 安全な相対パス の置換ペアを作る。
 * ファイルのフルパスと、各ディレクトリ接頭辞（末尾スラッシュ付き）の両方を対象にし、
 * HTML/CSS/JS 内の静的参照と動的（dir + 名前）参照の両方を解決する。
 */
function buildPathReplacements(relativePaths) {
  const map = new Map();
  for (const rel of relativePaths) {
    const safe = safeRelativePath(rel);
    if (safe !== rel) map.set(rel, safe);

    const parts = rel.split('/');
    const safeParts = safe.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/') + '/';
      const safeDir = safeParts.slice(0, i).join('/') + '/';
      if (dir !== safeDir) map.set(dir, safeDir);
    }
  }
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
}

function rewriteTextContent(text, replacements) {
  let out = text;
  for (const [find, repl] of replacements) {
    out = replaceAllStr(out, find, repl);
  }
  return out;
}

function getStorageRelativePath(file) {
  if (file.webkitRelativePath) {
    const parts = file.webkitRelativePath.split('/');
    parts.shift();
    return parts.join('/');
  }
  if (file.relativePath) {
    const parts = file.relativePath.split('/');
    parts.shift();
    return parts.join('/');
  }
  return file.name;
}

async function ensureSession(sessionId, eventId) {
  if (sessionId && sessionId !== 'null') return sessionId;

  const { data: newSession } = await supabase.from('sessions').insert({
    event_id: eventId,
    time: '00:00',
    label: 'デフォルト',
    sort_order: 0,
  }).select().single();

  return newSession.id;
}

function buildStoragePath(event) {
  const gameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const locationSlug = event.location_id.substring(0, 8);
  return `${locationSlug}/${event.date}/${gameId}`;
}

/**
 * Handle folder upload (HTML/CSS/JS + image assets)
 */
async function handleUpload(files, sessionId, eventId, progressEl, progressBar, progressText, state) {
  progressEl.classList.add('show');
  progressBar.style.width = '0%';
  progressText.textContent = 'アップロード準備中...';

  try {
    sessionId = await ensureSession(sessionId, eventId);

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('date, location_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) throw new Error('開催日情報の取得に失敗しました');

    let folderName = '';
    if (files[0].webkitRelativePath) {
      folderName = files[0].webkitRelativePath.split('/')[0];
    } else if (files[0].relativePath) {
      folderName = files[0].relativePath.split('/')[0];
    } else {
      folderName = `game-${Date.now()}`;
    }

    const storagePath = buildStoragePath(event);
    const total = files.length;
    let uploaded = 0;

    // 各ファイルの相対パスを算出し、日本語などを ASCII 安全名へ変換する置換表を作成
    const entries = files.map(file => {
      const relative = getStorageRelativePath(file);
      return { file, relative, safe: safeRelativePath(relative) };
    });
    const replacements = buildPathReplacements(entries.map(e => e.relative));

    for (const { file, safe } of entries) {
      const filePath = `${storagePath}/${safe}`;
      const contentType = detectContentType(file.name);

      // テキスト系（HTML/CSS/JS等）は中の参照パスも安全名に書き換える
      let body = file;
      if (replacements.length > 0 && isTextFile(file.name)) {
        const text = await file.text();
        body = new Blob([rewriteTextContent(text, replacements)], { type: contentType });
      }

      const { error } = await supabase.storage.from('game-files').upload(filePath, body, {
        upsert: true,
        contentType,
      });

      if (error) console.error('Upload error:', error);

      uploaded++;
      const percent = Math.round((uploaded / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `${uploaded}/${total} ファイルをアップロード中... (${percent}%)`;
    }

    await supabase.from('games').insert({
      session_id: sessionId,
      title: folderName,
      storage_path: storagePath,
      entry_file: 'index.html',
      is_published: true,
      sort_order: 0,
    });

    progressText.textContent = '✅ アップロード完了！';
    showToast(`✅ 「${folderName}」をアップロードしました`);

    setTimeout(() => loadLocationContent(state), 1000);
  } catch (err) {
    console.error('Upload failed:', err);
    progressText.textContent = '❌ アップロードに失敗しました';
    showToast('❌ アップロードに失敗しました', 'error');
  }
}

/**
 * Show location modal with image upload
 */
function showLocationModal(title, existing, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const currentImage = existing.image_url || '';

  overlay.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <form id="location-modal-form">
        <div class="form-group">
          <label for="loc-name">名前</label>
          <input type="text" id="loc-name" name="name" 
            placeholder="例：那覇市開催" 
            value="${existing.name || ''}" 
            required>
        </div>
        <div class="form-group">
          <label>背景画像</label>
          ${currentImage ? `<div id="current-image-preview" style="margin-bottom:0.5rem;position:relative;">
            <img src="${currentImage}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;">
            <button type="button" id="remove-image-btn" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:12px;">✕</button>
          </div>` : ''}
          <div class="image-upload-area" id="image-upload-area" style="border:2px dashed var(--admin-border);border-radius:8px;padding:1.5rem;text-align:center;cursor:pointer;transition:border-color 0.2s;">
            <p style="color:var(--admin-text-light);font-size:0.9rem;">クリックして画像を選択</p>
            <p style="color:var(--admin-text-light);font-size:0.8rem;margin-top:0.25rem;">PNG/JPG/WEBP</p>
            <input type="file" id="loc-image-input" accept="image/*" style="display:none;">
          </div>
          <div id="image-preview-new" style="margin-top:0.5rem;"></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modal-cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const fileInput = overlay.querySelector('#loc-image-input');
  const uploadArea = overlay.querySelector('#image-upload-area');
  const previewNew = overlay.querySelector('#image-preview-new');
  let selectedFile = null;

  // Click to select image
  uploadArea.addEventListener('click', () => fileInput.click());

  // File selected
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        previewNew.innerHTML = `<img src="${ev.target.result}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;">`;
        uploadArea.style.display = 'none';
        // Hide current image if exists
        const prev = overlay.querySelector('#current-image-preview');
        if (prev) prev.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });

  // Remove existing image
  const removeBtn = overlay.querySelector('#remove-image-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.querySelector('#current-image-preview').style.display = 'none';
    });
  }

  // Focus name input
  setTimeout(() => overlay.querySelector('#loc-name')?.focus(), 100);

  // Cancel & close
  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Submit
  overlay.querySelector('#location-modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = overlay.querySelector('#loc-name').value;
    overlay.remove();
    await onSubmit(name, selectedFile);
  });
}

/**
 * Upload a location background image to Supabase Storage
 */
async function uploadLocationImage(file, locationId) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `location-images/${locationId}.${ext}`;

  const { error } = await supabase.storage.from('game-files').upload(filePath, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  });

  if (error) {
    console.error('Image upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage.from('game-files').getPublicUrl(filePath);
  return urlData?.publicUrl || null;
}

/**
 * Show a modal dialog
 */
function showModal(title, fields, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const fieldsHtml = fields.map(f => `
    <div class="form-group">
      <label for="modal-${f.name}">${f.label}</label>
      <input type="${f.type}" id="modal-${f.name}" name="${f.name}" 
        placeholder="${f.placeholder || ''}" 
        value="${f.value || ''}" 
        required>
    </div>
  `).join('');

  overlay.innerHTML = `
    <div class="modal">
      <h2>${title}</h2>
      <form id="modal-form">
        ${fieldsHtml}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="modal-cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.querySelector('input')?.focus();
  }, 100);

  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {};
    fields.forEach(f => {
      formData[f.name] = document.getElementById(`modal-${f.name}`).value;
    });
    overlay.remove();
    await onSubmit(formData);
  });
}

/**
 * Show confirm dialog
 */
function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal">
      <h2>⚠️ 確認</h2>
      <p style="margin-bottom:1rem; white-space:pre-line;">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="confirm-cancel">キャンセル</button>
        <button class="btn btn-danger" id="confirm-ok">削除する</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#confirm-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirm-ok').addEventListener('click', async () => {
    overlay.remove();
    await onConfirm();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
