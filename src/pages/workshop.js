import { openWorkshopDemo } from '../utils/workshopDemo.js';
import { WORKSHOP_GENRES, getGenreById, getGenreFolderLabel } from '../config/workshopGenres.js';
import { getWorkshopStepCards } from '../config/workshopManualSteps.js';
import {
  applyAssetPlaceholders,
  defaultAssetSelections,
  getChoicesForStep,
  listStarterAssetFiles,
  resolveChoiceOption,
  workshopThumbUrl,
  workshopTitleArtUrl,
} from '../config/workshopAssets.js';
import '../styles/workshop.css';
import '../styles/workshop-festival.css';
import { workshopBackgroundHtml } from '../utils/workshopBackground.js';
import {
  buildFolderName,
  downloadNamedStarterZip,
  sanitizeParticipantName,
} from '../utils/workshopStarterZip.js';
import {
  buildPlayUrl,
  buildQrImageUrl,
  getFolderNameFromFiles,
  uploadWorkshopGameFolder,
} from '../utils/gameUpload.js';
import { retentionNoticeShort } from '../utils/retention.js';

const STORAGE_KEYS = {
  name: 'ws-participant-name',
  genre: 'ws-genre-id',
  folder: 'ws-folder-name',
  done: 'ws-done-steps',
  assets: 'ws-asset-selections',
  drafts: 'ws-prompt-draft',
  checks: 'ws-step-checks',
};

/** スタッフ初期化まで残す（タブを閉じても消えない） */
const WORKSHOP_STORE = (() => {
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
})();

let activeTransfers = 0;

const GENRE_SCENES = {
  athletic: ['ground.png', 'player_boy.png', 'player_girl.png', 'coin.png'],
  shooting: ['ship_blue.png', 'enemy_green.png', 'enemy_purple.png'],
  puzzle: ['block_red.png', 'block_blue.png', 'block_yellow.png', 'block_green.png'],
};

function sprite(genreId, file, className = '') {
  return `<img class="ws-sprite ${className}" src="${workshopThumbUrl(genreId, file)}" alt="" draggable="false" width="128" height="128" decoding="async" loading="lazy" />`;
}

function genreScene(genreId) {
  // 入口カードは先読み対象なので loading を eager に
  return `<span class="ws-scene ws-scene--${genreId}" aria-hidden="true">${GENRE_SCENES[genreId].map((file, i) =>
    `<img class="ws-sprite ws-scene-item ws-scene-item--${i}" src="${workshopThumbUrl(genreId, file)}" alt="" draggable="false" width="128" height="128" decoding="async" fetchpriority="${i === 0 ? 'high' : 'low'}" />`
  ).join('')}</span>`;
}

function workshopNav(showTitleArt = true) {
  return `<nav class="ws-nav" aria-label="ワークショップナビゲーション">
    <a href="/experience.html#/" class="ws-brand">${showTitleArt ? `<img class="ws-header-title-art" src="${workshopTitleArtUrl()}" alt="AIでゲーム制作体験 自分だけのゲームを作ろう！" width="960" height="320" decoding="async" fetchpriority="high" />` : '<span class="ws-brand-icon" aria-hidden="true">✦</span><span>AIゲーム<span class="ws-brand-small">体験ワークショップ</span></span>'}</a>
    <div class="ws-nav-actions"><button type="button" class="ws-staff-reset" data-staff-reset>スタッフ用 · 次の参加者へ</button>
    <a class="ws-gallery-link" href="/index.html#/">みんなの作品 <span aria-hidden="true">↗</span></a></div>
  </nav>`;
}

/**
 * 体験者入口 — 来場したらすぐ3ジャンルから選ぶ
 */
export async function renderWorkshopEntry(container) {
  container.innerHTML = `
    <div class="ws-page ws-page--entry ws-entry-picker">
      ${workshopBackgroundHtml()}
      <div class="ws-content ws-content--entry">
        ${workshopNav(true)}
        <section class="ws-genre-section" aria-labelledby="ws-choose-title">
          <h1 id="ws-choose-title" class="ws-entry-heading">つくるゲームを<span>えらぼう！</span></h1>
          <div class="ws-genre-grid">
            ${WORKSHOP_GENRES.map(genre => `
              <article class="ws-genre-card ws-genre-card--${genre.id}"
                data-genre="${genre.id}" style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};"
                aria-label="${genre.label}">
                ${genreScene(genre.id)}
                <span class="ws-genre-info"><span class="ws-genre-label">${genre.label}</span></span>
                <div class="ws-entry-actions"><button type="button" data-demo="${genre.id}">あそんでみる</button><button type="button" data-create-genre="${genre.id}">これをつくる →</button></div>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    </div>
  `;
  bindStaffReset(container);
  container.querySelectorAll('[data-demo]').forEach(btn => btn.addEventListener('click', () => openWorkshopDemo(getGenreById(btn.dataset.demo), btn)));

  container.querySelectorAll('[data-create-genre]').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `/genre/${btn.dataset.createGenre}`;
    });
  });
}

/**
 * ジャンル選択後 — ステップカード一覧＋モーダル
 */
export function renderWorkshopGenrePlaceholder(container, params) {
  const genre = getGenreById(params.genreId);
  const cards = getWorkshopStepCards(params.genreId);
  if (!genre || !cards) {
    window.location.hash = '#/';
    return;
  }

  const state = {
    done: loadDoneSteps(genre.id),
    openCardId: null,
    assetSelections: loadAssetSelections(genre.id),
  };

  const paint = (openId = null) => {
    state.openCardId = openId;
    const folderName = folderForGenre(genre.id);
    const participantName = getStored(STORAGE_KEYS.name) || '';
    const doneCount = cards.filter((c) => state.done.has(c.id)).length;

    container.innerHTML = `
      <div class="ws-page ws-page--hub" style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};">
        ${workshopBackgroundHtml()}
        <div class="ws-content ws-content--hub">
          ${workshopNav()}
          <a href="#/" class="ws-back">← ゲームをえらびなおす</a>
          <div class="ws-workbench"><aside class="ws-workbench-intro">

          <header class="ws-hub-header" style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};">
            ${genreScene(genre.id)}
            <div>
              <p class="ws-section-kicker">MY GAME WORKSHOP</p>
              <h1 class="ws-hub-title">${escapeHtml(genre.label)}<span>をつくろう！</span></h1>
              <p class="ws-hub-sub">${escapeHtml(genre.tagline)}</p>
              ${participantName ? `<p class="ws-hub-who">${escapeHtml(participantName)} さんの進行表</p>` : ''}
              ${folderName ? `<p class="ws-hub-folder">📁 ${escapeHtml(folderName)}</p>` : ''}
            </div>
          </header>

          <div class="ws-maker-tip">${sprite('athletic', 'player_robot.png')}<p><strong>先生といっしょに進めよう！</strong>先生が案内したステップをひらこう。お願いをコピーして、PCのAntigravityで試してね。</p></div>
          <a class="ws-back ws-material-link" href="#/" data-open-setup>素材をダウンロードする ↗</a>
          </aside><section class="ws-adventure" aria-label="制作ステップ">
          <div class="ws-progress-header"><h2>先生と進める制作ステップ</h2><p class="ws-hub-progress">${doneCount}<span> / ${cards.length} 完了</span></p></div>
          <div class="ws-progress-track" role="progressbar" aria-label="制作の進み具合" aria-valuenow="${doneCount}" aria-valuemin="0" aria-valuemax="${cards.length}"><span style="width:${doneCount / cards.length * 100}%"></span></div>

          <div class="ws-step-list">
            ${cards.map((card) => {
              const done = state.done.has(card.id);
              return `
                <button type="button" class="ws-step-card ${done ? 'is-done' : ''} "
                  data-card-id="${card.id}"
                  style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};">
                  <span class="ws-step-num" aria-hidden="true">${card.kind === 'prompt' ? card.stepIndex + 1 : card.kind === 'setup' ? '準備' : '発表'}</span>
                  <span class="ws-step-body">
                    <span class="ws-step-badge">${escapeHtml(card.badge)}</span>
                    <span class="ws-step-name">${escapeHtml(card.shortTitle)}</span>
                    <span class="ws-step-desc">${escapeHtml(card.title)}</span>
                  </span>
                  <span class="ws-step-go">${done ? '✓ 完了・ひらく' : 'ひらく →'}</span>
                </button>
              `;
            }).join('')}
          </div>
          <p class="ws-roadmap-note">次のステップは先生の案内に合わせて進めよう。困ったらスタッフに声をかけてね。</p>
          </section></div>
        </div>
        <div id="ws-modal-root"></div>
      </div>
    `;

    bindStaffReset(container);
    container.querySelector('[data-open-setup]').addEventListener('click', (event) => { event.preventDefault(); paint('setup'); });
    container.querySelectorAll('.ws-step-card').forEach((btn) => {
      btn.addEventListener('click', () => paint(btn.dataset.cardId));
    });

    if (openId) {
      const card = cards.find((c) => c.id === openId);
      if (card) {
        renderModal(card);
        const dialog = container.querySelector('[role="dialog"]');
        if (dialog) {
          dialog.setAttribute('aria-label', card.title);
          const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not([hidden]), textarea, [tabindex="0"]')].filter(el => el.getClientRects().length);
          if (!dialog.contains(document.activeElement)) focusable()[0]?.focus({ preventScroll: true });
          dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { event.preventDefault(); paint(null); container.querySelector(`[data-card-id="${card.id}"]`)?.focus({ preventScroll: true }); }
            if (event.key === 'Tab') {
              const items = focusable();
              const first = items[0], last = items[items.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
          });
        }
      }
    }
  };

  const markDone = (cardId) => {
    state.done.add(cardId);
    saveDoneSteps(genre.id, state.done);
  };

  const renderModal = (card) => {
    const root = container.querySelector('#ws-modal-root');
    if (!root) return;

    if (card.kind === 'setup') {
      root.innerHTML = setupModalHtml(genre);
      bindSetupModal(root, genre, () => {
        markDone('setup');
        paint(null);
      }, () => paint(null));
      return;
    }

    if (card.kind === 'upload') {
      root.innerHTML = uploadModalHtml(genre);
      bindUploadModal(root, genre, () => {
        markDone('upload');
        paint(null);
      }, () => paint(null));
      return;
    }

    const draftPrompt =
      loadDraft(genre.id, card.id) ??
      applyAssetPlaceholders(card.data.prompt || '', genre.id, state.assetSelections);
    root.innerHTML = promptModalHtml(genre, card, cards, draftPrompt, state.assetSelections, state.done);
    bindPromptModal(root, genre, card, state, () => {
      markDone(card.id);
      paint(null);
    }, () => paint(null));
  };

  paint(null);
}

function setupModalHtml(genre) {
  const previewName = buildFolderName(getStored(STORAGE_KEYS.name) || '', getGenreFolderLabel(genre));
  return `
    <div class="ws-modal-backdrop" data-close="1">
      <div class="ws-modal" style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};" role="dialog" aria-modal="true" aria-labelledby="ws-modal-title">
        <button type="button" class="ws-modal-close" data-close="1" aria-label="閉じる">×</button>
        <p class="ws-modal-badge">準備</p>
        <h2 id="ws-modal-title" class="ws-modal-title">📁 フォルダをダウンロード</h2>
        <p class="ws-modal-lead">名前を入れてダウンロード → 解凍 → Antigravity で Open Folder</p>

        <div class="ws-kit-preview" aria-label="ダウンロードに入っている素材">${listStarterAssetFiles(genre.id).map(file => sprite(genre.id, file)).join('')}<span>この素材がぜんぶ入っているよ！</span></div>
        <label class="ws-name-label" for="ws-participant-name">あなたの名前・ニックネーム</label>
        <input id="ws-participant-name" class="ws-name-input" type="text" maxlength="40"
          autocomplete="nickname" placeholder="例：たろう" value="${escapeAttr(getStored(STORAGE_KEYS.name) || '')}" />

        <p class="ws-folder-preview">フォルダ名：<strong id="ws-folder-preview-name">${escapeHtml(previewName)}</strong></p>

        <button type="button" class="ws-dl-btn" id="ws-download-starter">⬇️ ダウンロード</button>
        <p class="ws-dl-status" id="ws-dl-status" hidden></p>

        <ol class="ws-dl-steps">
          <li>ZIPをダウンロードして<strong>解凍</strong>する</li>
          <li>Antigravity で <strong>Open Folder</strong></li>
          <li>さっきの名前のフォルダを開く</li>
        </ol>

        <div class="ws-modal-actions">
          <button type="button" class="ws-secondary-btn" data-close="1">とじる</button>
          <button type="button" class="ws-dl-btn ws-modal-next" id="ws-setup-next" ${folderForGenre(genre.id) ? '' : 'disabled'}>
            このステップを完了
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindSetupModal(root, genre, onNext, onClose) {
  root.querySelectorAll('[data-close="1"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (el.classList.contains('ws-modal-backdrop') && e.target !== el) return;
      onClose();
    });
  });

  const nameInput = root.querySelector('#ws-participant-name');
  const previewEl = root.querySelector('#ws-folder-preview-name');
  const dlBtn = root.querySelector('#ws-download-starter');
  const statusEl = root.querySelector('#ws-dl-status');
  const nextBtn = root.querySelector('#ws-setup-next');

  const refreshPreview = () => {
    previewEl.textContent = buildFolderName(nameInput.value, getGenreFolderLabel(genre));
  };
  nameInput.addEventListener('input', refreshPreview);

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dlBtn.click();
    }
  });

  dlBtn.addEventListener('click', async () => {
    const name = sanitizeParticipantName(nameInput.value);
    if (!name) {
      statusEl.hidden = false;
      statusEl.classList.add('ws-dl-status--warn');
      statusEl.textContent = '名前を入れてからダウンロードしてね！';
      nameInput.focus();
      return;
    }

    dlBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.classList.remove('ws-dl-status--warn');
    statusEl.textContent = 'ダウンロード準備中…';

    activeTransfers += 1;
    try {
      const folderName = await downloadNamedStarterZip({ participantName: name, genre });
      setStored(STORAGE_KEYS.name, name);
      setStored(STORAGE_KEYS.genre, genre.id);
      setStored(STORAGE_KEYS.folder, folderName);
      statusEl.textContent = `できたよ！「${folderName}.zip」を解凍してね`;
      nextBtn.disabled = false;
    } catch (err) {
      console.error('[workshop] starter zip:', err);
      statusEl.classList.add('ws-dl-status--warn');
      statusEl.textContent = 'ダウンロードに失敗しました。もう一度ためしてね。';
    } finally {
      activeTransfers -= 1;
      dlBtn.disabled = false;
    }
  });

  nextBtn.addEventListener('click', () => {
    if (!folderForGenre(genre.id)) return;
    onNext();
  });

  nameInput.focus();
}

function uploadModalHtml(genre) {
  const defaultTitle =
    folderForGenre(genre.id) ||
    buildFolderName(getStored(STORAGE_KEYS.name) || '', getGenreFolderLabel(genre));

  return `
    <div class="ws-modal-backdrop" data-close="1">
      <div class="ws-modal ws-modal--wide" style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};" role="dialog" aria-modal="true">
        <button type="button" class="ws-modal-close" data-close="1" aria-label="閉じる">×</button>
        <p class="ws-modal-badge">発表</p>
        <h2 class="ws-modal-title">🚀 完成ゲームをアップロード</h2>
        <p class="ws-modal-lead">Antigravity で作ったフォルダを選ぶと、ギャラリーに公開されてQRで遊べるよ！</p>

        <div id="ws-upload-form">
          <label class="ws-name-label" for="ws-game-title">作品のなまえ</label>
          <input id="ws-game-title" class="ws-name-input" type="text" maxlength="80"
            value="${escapeAttr(defaultTitle)}" placeholder="例：たろうのシューティング" />

          <div class="ws-upload-drop" id="ws-upload-drop">
            <p class="ws-upload-drop-title">📁 完成フォルダをここにドロップ</p>
            <p class="ws-upload-drop-sub">または下のボタンからフォルダを選んでね</p>
            <label class="ws-dl-btn ws-upload-pick">
              フォルダを選ぶ
              <input type="file" id="ws-upload-folder" webkitdirectory directory multiple hidden />
            </label>
            <p class="ws-upload-picked" id="ws-upload-picked" hidden></p>
          </div>

          <div class="ws-upload-progress" id="ws-upload-progress" hidden>
            <div class="ws-upload-bar"><span id="ws-upload-bar-fill"></span></div>
            <p id="ws-upload-progress-text">準備中…</p>
          </div>
          <p class="ws-dl-status" id="ws-upload-status" hidden></p>

          <ol class="ws-dl-steps">
            <li>Antigravity で作った<strong>フォルダ全体</strong>を選ぶ</li>
            <li>中に <strong>index.html</strong> があることを確認（フォルダの奥にあってもOK）</li>
            <li>アップロードすると<strong>すぐ公開</strong>されるよ</li>
          </ol>

          <p class="ws-session-note">公開期間は2ヶ月です。期間中は誰でも遊んだり、作品フォルダをダウンロードできます。期限を過ぎると自動削除されます。</p>
          <div class="ws-modal-actions">
            <button type="button" class="ws-secondary-btn" data-close="1">とじる</button>
            <button type="button" class="ws-dl-btn ws-modal-next" id="ws-upload-submit" disabled>
              ⬆️ アップロードする
            </button>
          </div>
        </div>

        <div id="ws-upload-done" hidden>
          <p class="ws-upload-done-title">🎉 公開できたよ！</p>
          <p class="ws-upload-done-sub">このQRで作品ページを開けるよ。キーボードを使うゲームはPCで遊ぼう。</p>
          <img class="ws-upload-qr" id="ws-upload-qr" alt="プレイ用QRコード" width="220" height="220" />
          <p class="ws-upload-link-wrap">
            <a class="ws-upload-link" id="ws-upload-link" href="#" target="_blank" rel="noopener">プレイページをひらく</a>
          </p>
          <p class="ws-upload-retain" id="ws-upload-retain"></p>
          <div class="ws-modal-actions">
            <button type="button" class="ws-dl-btn" id="ws-upload-finish">一覧にもどる</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindUploadModal(root, genre, onDone, onClose) {
  root.querySelectorAll('[data-close="1"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (el.classList.contains('ws-modal-backdrop') && e.target !== el) return;
      onClose();
    });
  });

  const folderInput = root.querySelector('#ws-upload-folder');
  const drop = root.querySelector('#ws-upload-drop');
  const pickedEl = root.querySelector('#ws-upload-picked');
  const submitBtn = root.querySelector('#ws-upload-submit');
  const titleInput = root.querySelector('#ws-game-title');
  const progressWrap = root.querySelector('#ws-upload-progress');
  const progressFill = root.querySelector('#ws-upload-bar-fill');
  const progressText = root.querySelector('#ws-upload-progress-text');
  const statusEl = root.querySelector('#ws-upload-status');
  let selectedFiles = [];

  const setFiles = (files) => {
    selectedFiles = [...files];
    const folder = getFolderNameFromFiles(selectedFiles) || `${selectedFiles.length} files`;
    pickedEl.hidden = false;
    pickedEl.textContent = `選択中：${folder}（${selectedFiles.length}ファイル）`;
    submitBtn.disabled = selectedFiles.length === 0;
    if (!titleInput.value.trim()) {
      titleInput.value = folder;
    }
  };

  folderInput.addEventListener('change', () => {
    if (folderInput.files?.length) setFiles(folderInput.files);
  });

  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-drag');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-drag'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('is-drag');
    const items = e.dataTransfer?.items;
    if (!items?.length) return;
    const files = await readDataTransferFolder(items);
    if (files.length) setFiles(files);
  });

  submitBtn.addEventListener('click', async () => {
    if (!selectedFiles.length) return;
    submitBtn.disabled = true;
    progressWrap.hidden = false;
    statusEl.hidden = true;
    statusEl.classList.remove('ws-dl-status--warn');

    activeTransfers += 1;
    try {
      const game = await uploadWorkshopGameFolder({
        files: selectedFiles,
        genreId: genre.id,
        title: titleInput.value.trim() || getFolderNameFromFiles(selectedFiles),
        onProgress: ({ percent, text }) => {
          progressFill.style.width = `${percent}%`;
          progressText.textContent = text;
        },
      });

      const playUrl = buildPlayUrl(game.id);
      root.querySelector('#ws-upload-form').hidden = true;
      const done = root.querySelector('#ws-upload-done');
      done.hidden = false;
      root.querySelector('#ws-upload-qr').src = buildQrImageUrl(playUrl);
      const link = root.querySelector('#ws-upload-link');
      link.href = playUrl;
      link.textContent = playUrl;
      root.querySelector('#ws-upload-retain').textContent = retentionNoticeShort(game.expires_at);
      root.querySelector('#ws-upload-finish').addEventListener('click', onDone, { once: true });
    } catch (err) {
      console.error('[workshop] upload', err);
      statusEl.hidden = false;
      statusEl.classList.add('ws-dl-status--warn');
      statusEl.style.whiteSpace = 'pre-wrap';
      statusEl.textContent = err.message || 'アップロードに失敗しました';
      submitBtn.disabled = false;
    } finally {
      activeTransfers -= 1;
    }
  });
}

/** Drag&Drop のフォルダを File 配列に展開 */
async function readDataTransferFolder(items) {
  const files = [];

  const readEntry = (entry, path = '') =>
    new Promise((resolve) => {
      if (!entry) return resolve();
      if (entry.isFile) {
        entry.file((file) => {
          Object.defineProperty(file, 'relativePath', {
            value: path + file.name,
          });
          files.push(file);
          resolve();
        }, () => resolve());
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries(async (entries) => {
          for (const child of entries) {
            await readEntry(child, `${path}${entry.name}/`);
          }
          resolve();
        }, () => resolve());
      } else {
        resolve();
      }
    });

  const entries = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  for (const entry of entries) {
    await readEntry(entry);
  }
  return files;
}

function promptModalHtml(genre, card, allCards, draftPrompt, assetSelections, doneSteps) {
  const promptCards = allCards.filter((c) => c.kind === 'prompt');
  const stepNo = (card.stepIndex ?? 0) + 1;
  const data = card.data;
  const assetChoiceGroups = getChoicesForStep(genre.id, card.id);

  const assetPickers = assetChoiceGroups
    .map((group) => {
      const selectedId = assetSelections?.[group.slot] || group.options[0]?.id;
      return `
        <div class="ws-asset-picker" data-slot="${escapeAttr(group.slot)}">
          <p class="ws-hint-label">${escapeHtml(group.label)}</p>
          <div class="ws-asset-grid" role="group" aria-label="${escapeAttr(group.label)}">
            ${group.options
              .map(
                (opt) => `
              <button type="button" class="ws-asset-card ${opt.id === selectedId ? 'is-selected' : ''}"
                aria-pressed="${opt.id === selectedId ? 'true' : 'false'}"
                data-slot="${escapeAttr(group.slot)}" data-option-id="${escapeAttr(opt.id)}">
                <img class="ws-asset-thumb" src="${escapeAttr(opt.preview)}" alt="" loading="lazy" />
                <span class="ws-asset-label">${escapeHtml(opt.label)}</span>
              </button>`
              )
              .join('')}
          </div>
        </div>`;
    })
    .join('');

  const hints = (data.hintGroups || [])
    .map(
      (group) => `
      <div class="ws-hint-group">
        <p class="ws-hint-label">${escapeHtml(group.label)}</p>
        <div class="ws-hint-chips">
          ${group.items
            .map(
              (item) =>
                `<button type="button" class="ws-hint-chip" data-hint="${escapeAttr(item)}">${escapeHtml(item)}</button>`
            )
            .join('')}
        </div>
      </div>`
    )
    .join('');

  const examples = (data.examplePrompts || []).length
    ? `
      <div class="ws-example-group">
        <p class="ws-hint-label">✨ アレンジ例（お願い文を置き換えます・元に戻せます）</p>
        <div class="ws-example-list">
          ${(data.examplePrompts || [])
            .map(
              (ex, i) => `
            <button type="button" class="ws-example-card" data-example-index="${i}">
              <span class="ws-example-label">${escapeHtml(ex.label)}</span>
              <span class="ws-example-preview">${escapeHtml(ex.text.split('\n').slice(1, 3).join(' / '))}</span>
            </button>`
            )
            .join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="ws-modal-backdrop" data-close="1">
      <div class="ws-modal ws-modal--wide" style="--ws-accent: ${genre.color}; --ws-chip: ${genre.chip};" role="dialog" aria-modal="true">
        <button type="button" class="ws-modal-close" data-close="1" aria-label="閉じる">×</button>

        <div class="ws-step-pills" aria-hidden="true">
          ${promptCards
            .map(
              (step, i) =>
                `<span class="ws-step-pill ${i + 1 === stepNo ? 'is-active' : ''} ${doneSteps.has(step.id) ? 'is-past' : ''}">${i + 1}</span>`
            )
            .join('')}
        </div>

        <p class="ws-modal-badge">Step ${stepNo}</p>
        <h2 class="ws-modal-title">${escapeHtml(data.title)}</h2>

        ${assetPickers}

        <div class="ws-prompt-toolbar">
          <label class="ws-name-label" for="ws-prompt-text">AIへのお願い文</label>
          <button type="button" class="ws-dl-btn" id="ws-copy-prompt">📋 お願い文をコピー</button>
        </div>
        <p class="ws-dl-status" id="ws-copy-status" role="status" hidden></p>
        <textarea id="ws-prompt-text" class="ws-prompt-text" rows="8">${escapeHtml(draftPrompt)}</textarea>
        <p class="ws-session-note">コピーしたら Antigravity に貼り付けて試そう。</p>
        <button type="button" class="ws-secondary-btn" id="ws-undo-example" hidden>例文を使う前に戻す</button>
        ${examples}

        ${hints}

        ${
          data.checklist?.length
            ? `<div class="ws-checklist">
                <p class="ws-hint-label">このステップのゴール</p>
                ${data.checklist
                  .map(
                    (item, i) => `
                  <label class="ws-check-item">
                    <input type="checkbox" data-check="${i}" />
                    <span>${escapeHtml(item)}</span>
                  </label>`
                  )
                  .join('')}
              </div>`
            : ''
        }

        <details class="ws-help-details"><summary>困ったときのヒント・保存について</summary>
          ${data.rules ? `<p>${escapeHtml(data.rules)}</p>` : ''}
          ${data.tips?.length ? `<ul class="ws-tips">${data.tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
          <p>編集中のお願い文や進捗は、ブラウザを閉じても残ります。参加者交代時にスタッフがリセットします。</p>
        </details>
        <p class="ws-session-note">ゴールを確認したら完了にして、次は先生の案内を待とう。</p>

        <div class="ws-modal-actions">
          <button type="button" class="ws-secondary-btn" data-close="1">とじる</button>
          <button type="button" class="ws-dl-btn ws-modal-next" id="ws-prompt-next">このステップを完了</button>
        </div>
      </div>
    </div>
  `;
}

function bindPromptModal(root, genre, card, state, onNext, onClose) {
  root.querySelectorAll('[data-close="1"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (el.classList.contains('ws-modal-backdrop') && e.target !== el) return;
      onClose();
    });
  });

  const textarea = root.querySelector('#ws-prompt-text');
  const statusEl = root.querySelector('#ws-copy-status');

  const saveDraft = () => setStored(`${STORAGE_KEYS.drafts}:${genre.id}:${card.id}`, textarea.value);
  textarea.addEventListener('input', saveDraft);
  const checkKey = `${STORAGE_KEYS.checks}:${genre.id}:${card.id}`;
  let checked = [];
  try { checked = JSON.parse(getStored(checkKey) || '[]'); } catch (_) { /* start empty */ }
  root.querySelectorAll('[data-check]').forEach(input => {
    input.checked = Array.isArray(checked) && checked.includes(input.dataset.check);
    input.addEventListener('change', () => {
      setStored(checkKey, JSON.stringify([...root.querySelectorAll('[data-check]:checked')].map(el => el.dataset.check)));
    });
  });

  root.querySelectorAll('.ws-asset-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.slot;
      const optionId = btn.dataset.optionId;
      const previous = resolveChoiceOption(genre.id, slot, state.assetSelections[slot]);
      const selected = resolveChoiceOption(genre.id, slot, optionId);
      const oldDefault = applyAssetPlaceholders(card.data.prompt || '', genre.id, state.assetSelections);
      state.assetSelections[slot] = optionId;
      saveAssetSelections(genre.id, state.assetSelections);

      const picker = btn.closest('.ws-asset-picker');
      picker?.querySelectorAll('.ws-asset-card').forEach((el) => {
        const on = el.dataset.optionId === optionId;
        el.classList.toggle('is-selected', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (textarea.value === oldDefault) {
        textarea.value = applyAssetPlaceholders(card.data.prompt || '', genre.id, state.assetSelections);
      } else if (previous && selected && previous.id !== selected.id) {
        for (const field of ['path', 'label', 'promptExtra']) {
          if (previous[field] && selected[field]) {
            textarea.value = textarea.value.split(previous[field]).join(selected[field]);
          }
        }
      }
      saveDraft();
    });
  });

  root.querySelector('#ws-copy-prompt')?.addEventListener('click', async () => {
    const text = textarea.value;
    try {
      await navigator.clipboard.writeText(text);
      statusEl.hidden = false;
      statusEl.classList.remove('ws-dl-status--warn');
      statusEl.textContent = 'コピーできたよ！ Antigravity に貼り付けてね';
    } catch (_) {
      textarea.select();
      statusEl.hidden = false;
      statusEl.classList.add('ws-dl-status--warn');
      statusEl.textContent = '手動で選択してコピーしてね（Cmd+C / Ctrl+C）';
    }
  });

  root.querySelectorAll('.ws-hint-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hint = btn.dataset.hint || '';
      const cur = textarea.value.trimEnd();
      textarea.value = cur
        ? `${cur}\n・${hint}`
        : `さっきのゲーム（いまの index.html）に、つぎを追加して。新しい HTML ファイルは作らないで。\n・${hint}`;
      saveDraft();
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  });

  const undoKey = `${STORAGE_KEYS.drafts}:${genre.id}:${card.id}:before-example`;
  let beforeExample = loadDraft(genre.id, `${card.id}:before-example`);
  const undoExample = root.querySelector('#ws-undo-example');
  undoExample.hidden = beforeExample === null;
  undoExample.addEventListener('click', () => {
    if (beforeExample === null) return;
    textarea.value = beforeExample;
    beforeExample = null;
    removeStored(undoKey);
    undoExample.hidden = true;
    saveDraft();
    statusEl.hidden = false;
    statusEl.textContent = '例文を使う前のお願い文に戻しました。';
    textarea.focus();
  });
  root.querySelectorAll('.ws-example-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.exampleIndex);
      const ex = card.data.examplePrompts?.[idx];
      if (!ex?.text) return;
      if (beforeExample === null) {
        beforeExample = textarea.value;
        setStored(undoKey, beforeExample);
      }
      undoExample.hidden = false;
      textarea.value = ex.text;
      saveDraft();
      statusEl.hidden = false;
      statusEl.classList.remove('ws-dl-status--warn');
      statusEl.textContent = `「${ex.label}」をセットしたよ。コピーして貼り付けてね`;
      textarea.focus();
    });
  });

  root.querySelector('#ws-prompt-next')?.addEventListener('click', onNext);
}

function loadDraft(genreId, cardId) {
  const value = getStored(`${STORAGE_KEYS.drafts}:${genreId}:${cardId}`);
  return value || null;
}

function bindStaffReset(container) {
  const trigger = container.querySelector('[data-staff-reset]');
  trigger?.addEventListener('click', () => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ws-staff-dialog';
    dialog.innerHTML = `
      <form method="dialog">
        <p class="ws-modal-badge">スタッフ用・クール交代</p>
        <h2>次の参加者を迎える準備</h2>
        <p>このブラウザに残っている<strong>名前・フォルダー情報・お願い文・素材の選択・確認チェック・進捗</strong>を全ジャンルまとめて消し、最初の画面に戻します（タブを閉じても残る分も消します）。</p>
        <p>公開済みの作品は削除しません。PC内のファイルやAntigravityのチャット、クリップボードはこのボタンでは消えません。</p>
        <fieldset><legend>交代前の確認</legend>
          <label><input type="checkbox" required> 前の参加者の作品保存・公開URLの確認が済んでいる</label>
          <label><input type="checkbox" required> 前の制作フォルダーとチャットを閉じ、次の参加者用に切り替える準備ができている</label>
        </fieldset>
        <p class="ws-reset-status" role="status">${activeTransfers ? 'ファイルの送受信中です。完了してから開き直してください。' : '確認後、リセットボタンを押してください。'}</p>
        <div class="ws-modal-actions">
          <button class="ws-secondary-btn" value="cancel" formnovalidate autofocus>キャンセル</button>
          <button class="ws-dl-btn" value="reset" ${activeTransfers ? 'disabled' : ''}>リセットして次の参加者へ</button>
        </div>
      </form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => { dialog.remove(); trigger.focus({ preventScroll: true }); });
    dialog.querySelector('form').addEventListener('submit', event => {
      if (event.submitter?.value !== 'reset') return;
      event.preventDefault();
      if (activeTransfers) return;
      try {
        clearWorkshopStorage();
      } catch (_) {
        dialog.querySelector('.ws-reset-status').textContent = '初期化できませんでした。この体験用タブを閉じて、新しいタブで開き直してください。';
        return;
      }
      dialog.close();
      // Reload drops all in-memory participant state as well as returning to entry.
      window.location.replace('/experience.html');
    });
    dialog.showModal();
  });
}

/* ── persistent workshop storage (localStorage; staff reset clears) ── */

function isWorkshopKey(key) {
  return Object.values(STORAGE_KEYS).some((prefix) => key === prefix || key.startsWith(`${prefix}:`));
}

function clearWorkshopStorage() {
  const stores = [WORKSHOP_STORE, typeof sessionStorage !== 'undefined' ? sessionStorage : null].filter(Boolean);
  for (const store of stores) {
    const keys = Object.keys(store).filter(isWorkshopKey);
    keys.forEach((key) => store.removeItem(key));
  }
}

function doneKey(genreId) {
  return `${STORAGE_KEYS.done}:${genreId}`;
}

function loadDoneSteps(genreId) {
  try {
    const raw = getStored(doneKey(genreId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return new Set();
  }
}

function saveDoneSteps(genreId, set) {
  setStored(doneKey(genreId), JSON.stringify([...set]));
}

function assetKey(genreId) {
  return `${STORAGE_KEYS.assets}:${genreId}`;
}

function loadAssetSelections(genreId) {
  const defaults = defaultAssetSelections(genreId);
  try {
    const raw = getStored(assetKey(genreId));
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch (_) {
    return defaults;
  }
}

function saveAssetSelections(genreId, selections) {
  setStored(assetKey(genreId), JSON.stringify(selections));
}

function folderForGenre(genreId) {
  if (getStored(STORAGE_KEYS.genre) !== genreId) return '';
  const genre = getGenreById(genreId);
  const name = getStored(STORAGE_KEYS.name);
  // 古いセッションの「かんたん落ちもの」などを、現在のジャンル名で作り直す
  if (genre && name) {
    const next = buildFolderName(name, getGenreFolderLabel(genre));
    if (getStored(STORAGE_KEYS.folder) !== next) setStored(STORAGE_KEYS.folder, next);
    return next;
  }
  return getStored(STORAGE_KEYS.folder) || '';
}

function getStored(key) {
  try {
    if (WORKSHOP_STORE) {
      const local = WORKSHOP_STORE.getItem(key);
      if (local != null) return local;
    }
    // 旧 sessionStorage からの移行
    const legacy = sessionStorage.getItem(key);
    if (legacy != null) {
      setStored(key, legacy);
      try { sessionStorage.removeItem(key); } catch (_) { /* ignore */ }
      return legacy;
    }
    return '';
  } catch (_) {
    return '';
  }
}

function setStored(key, value) {
  try {
    if (WORKSHOP_STORE) WORKSHOP_STORE.setItem(key, value);
    else sessionStorage.setItem(key, value);
  } catch (_) { /* ignore */ }
}

function removeStored(key) {
  try {
    WORKSHOP_STORE?.removeItem(key);
    sessionStorage.removeItem(key);
  } catch (_) { /* ignore */ }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}
