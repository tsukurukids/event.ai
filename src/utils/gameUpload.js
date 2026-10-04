import { supabase } from '../supabase.js';
import { computeExpiresAt } from './retention.js';

function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/** Storage キーに使えるセグメントだけ残す（先頭ドット不可） */
function safeSegment(seg) {
  if (!seg) return '';
  const dot = seg.lastIndexOf('.');
  let base = seg;
  let ext = '';
  if (dot > 0) {
    const e = seg.slice(dot);
    if (/^\.[A-Za-z0-9]+$/.test(e)) {
      ext = e.toLowerCase();
      base = seg.slice(0, dot);
    }
  }
  // ドット始まり・非ASCII・記号はハッシュ化
  if (!/^[A-Za-z0-9_-]+$/.test(base)) {
    return `a_${hashStr(seg)}${ext}`;
  }
  return `${base}${ext}`;
}

export function safeRelativePath(rel) {
  return String(rel || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map(safeSegment)
    .filter(Boolean)
    .join('/');
}

const TEXT_EXTS = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'svg', 'xml', 'txt', 'md']);

function isTextFile(name) {
  return TEXT_EXTS.has(name.split('.').pop()?.toLowerCase());
}

function detectContentType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const types = {
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    mjs: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    txt: 'text/plain',
    md: 'text/plain',
  };
  return types[ext] || 'application/octet-stream';
}

function buildPathReplacements(relativePaths) {
  const map = new Map();
  for (const rel of relativePaths) {
    const safe = safeRelativePath(rel);
    if (safe && safe !== rel) map.set(rel, safe);
    const parts = rel.split('/').filter(Boolean);
    const safeParts = safe.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      const dir = `${parts.slice(0, i).join('/')}/`;
      const safeDir = `${safeParts.slice(0, i).join('/')}/`;
      if (dir !== safeDir) map.set(dir, safeDir);
    }
  }
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
}

function rewriteTextContent(text, replacements) {
  let out = text;
  for (const [find, repl] of replacements) {
    if (!find || find === repl) continue;
    out = out.split(find).join(repl);
  }
  return out;
}

export function getStorageRelativePath(file) {
  const raw = file.webkitRelativePath || file.relativePath || file.name || '';
  const normalized = String(raw).replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  // フォルダ選択時は先頭のルートフォルダ名を外す
  if ((file.webkitRelativePath || file.relativePath) && parts.length > 1) {
    parts.shift();
  }
  return parts.join('/');
}

export function getFolderNameFromFiles(files) {
  const first = files[0];
  if (!first) return '';
  const raw = first.webkitRelativePath || first.relativePath || '';
  if (raw) return raw.replace(/\\/g, '/').split('/').filter(Boolean)[0] || '';
  return '';
}

/** macOS / Windows のゴミファイル・非ゲームファイルを除外 */
function shouldSkipFile(relativePath) {
  const rel = relativePath.replace(/\\/g, '/');
  const parts = rel.split('/');
  const base = parts[parts.length - 1] || '';
  if (!rel || !base) return true;
  if (base.startsWith('.')) return true;
  if (base.startsWith('._')) return true;
  if (base === 'Thumbs.db' || base === 'desktop.ini') return true;
  if (parts.some((p) => p === '__MACOSX' || p === '.git' || p === 'node_modules')) return true;
  return false;
}

function dirnamePath(path) {
  const parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function basenameLower(path) {
  const parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return (parts[parts.length - 1] || '').toLowerCase();
}

function isIndexHtmlPath(path) {
  const base = basenameLower(path);
  return base === 'index.html' || base === 'index.htm';
}

/** prefix 配下なら相対パス、外なら null（prefix 空ならそのまま） */
function stripDirPrefix(path, prefix) {
  const p = String(path || '').replace(/\\/g, '/');
  const pre = String(prefix || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (!pre) return p;
  if (p === pre) return '';
  if (p.startsWith(`${pre}/`)) return p.slice(pre.length + 1);
  return null;
}

/** いちばん浅い index.html をゲームの入口にする */
function pickEntryIndex(prepared) {
  const indexes = prepared.filter((e) => isIndexHtmlPath(e.safe) || isIndexHtmlPath(e.relative));
  if (!indexes.length) return null;
  indexes.sort((a, b) => {
    const da = a.safe.split('/').filter(Boolean).length;
    const db = b.safe.split('/').filter(Boolean).length;
    if (da !== db) return da - db;
    return a.safe.length - b.safe.length;
  });
  return indexes[0];
}

/**
 * index.html のあるフォルダをルートに揃える
 * （親フォルダを選んでも、ネストしていてもアップロード可能にする）
 */
function rerootAroundIndex(prepared) {
  const entry = pickEntryIndex(prepared);
  if (!entry) return { entries: null, error: 'フォルダのどこかに index.html が必要です' };

  const dirSafe = dirnamePath(entry.safe);
  const dirRel = dirnamePath(entry.relative);
  const remapped = [];
  for (const item of prepared) {
    const safe = stripDirPrefix(item.safe, dirSafe);
    const relative = stripDirPrefix(item.relative, dirRel);
    if (safe == null || relative == null || !safe) continue;
    remapped.push({ ...item, safe, relative });
  }

  if (!remapped.some((e) => isIndexHtmlPath(e.safe))) {
    return { entries: null, error: 'フォルダのどこかに index.html が必要です' };
  }
  return { entries: remapped, error: null };
}

function buildWorkshopStoragePath() {
  const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  return `workshop/${id}`;
}

async function uploadOne(filePath, body, contentType) {
  const attempt = async (upsert) =>
    supabase.storage.from('game-files').upload(filePath, body, {
      upsert,
      contentType,
      cacheControl: '3600',
    });

  let { error } = await attempt(true);
  if (!error) return null;

  // いったん失敗したら ArrayBuffer で再送
  try {
    const buf = body instanceof Blob ? await body.arrayBuffer() : body;
    ({ error } = await attempt(true));
    if (!error) return null;
    // 最終手段: contentType なし
    ({ error } = await supabase.storage.from('game-files').upload(filePath, buf, { upsert: true }));
    return error || null;
  } catch (e) {
    return error || e;
  }
}

/**
 * 参加者フォルダを Storage + games に公開アップロード
 */
export async function uploadWorkshopGameFolder({
  files,
  title,
  genreId,
  onProgress = () => {},
}) {
  if (!files?.length) throw new Error('フォルダを選んでください');

  if (!['athletic', 'shooting', 'puzzle'].includes(genreId)) {
    throw new Error('ジャンルを選び直してください');
  }

  const prepared = [];
  for (const file of files) {
    const relative = getStorageRelativePath(file);
    if (shouldSkipFile(relative)) continue;
    const safe = safeRelativePath(relative);
    if (!safe) continue;
    prepared.push({ file, relative, safe });
  }

  if (!prepared.length) {
    throw new Error('アップロードできるファイルが見つかりません。フォルダを選び直してください。');
  }

  const { entries: rooted, error: rootError } = rerootAroundIndex(prepared);
  if (rootError || !rooted?.length) {
    throw new Error(rootError || 'フォルダのどこかに index.html が必要です');
  }

  // 同じ安全パスがぶつかる場合は後勝ち（稀）
  const bySafe = new Map();
  for (const entry of rooted) bySafe.set(entry.safe, entry);
  const entries = [...bySafe.values()];

  onProgress({ percent: 2, text: '公開の準備中…' });
  const storagePath = buildWorkshopStoragePath();
  const replacements = buildPathReplacements(entries.map((e) => e.relative));

  const failed = [];
  let uploaded = 0;
  const total = entries.length;

  for (const { file, safe } of entries) {
    const filePath = `${storagePath}/${safe}`;
    const contentType = detectContentType(safe);
    let body = file;
    try {
      if (replacements.length > 0 && isTextFile(safe)) {
        const text = await file.text();
        body = new Blob([rewriteTextContent(text, replacements)], { type: contentType });
      }
      const error = await uploadOne(filePath, body, contentType);
      if (error) {
        console.error('[workshop upload]', filePath, error);
        failed.push({ safe, message: error.message || String(error) });
      }
    } catch (err) {
      console.error('[workshop upload]', filePath, err);
      failed.push({ safe, message: err.message || String(err) });
    }

    uploaded += 1;
    onProgress({
      percent: Math.min(95, Math.round((uploaded / total) * 90) + 5),
      text: `${uploaded}/${total} ファイル送信中…`,
    });
  }

  if (failed.length > 0) {
    const sample = failed.slice(0, 3).map((f) => `${f.safe}: ${f.message}`).join('\n');
    const hint = /Bucket not found|NoSuchBucket/i.test(sample)
      ? '\n（Supabase Storage に public バケット「game-files」がありません。Dashboard → Storage で作成してください）'
      : /Failed to fetch|NetworkError|Load failed/i.test(sample)
        ? '\n（通信エラーです。ネット接続・Supabase URL、または「game-files」バケットの有無を確認してください）'
      : /row-level security|RLS|policy|403|Unauthorized|JWT/i.test(sample)
        ? '\n（Storage の workshop 用アップロード権限を確認してください）'
        : /InvalidKey|invalid.*key/i.test(sample)
          ? '\n（ファイル名に使えない文字があります。別フォルダで試してください）'
          : '';
    throw new Error(
      `一部のファイルを送信できませんでした（${failed.length}/${total}件失敗）。\n${sample}${hint}`
    );
  }

  const expiresAt = computeExpiresAt();
  const gameTitle = (title || getFolderNameFromFiles(files) || 'わたしのゲーム').slice(0, 80);

  onProgress({ percent: 96, text: 'ギャラリーに登録中…' });
  const { data: game, error: insertError } = await supabase
    .from('games')
    .insert({
      session_id: null,
      genre_id: genreId,
      title: gameTitle,
      storage_path: storagePath,
      entry_file: 'index.html',
      is_published: true,
      sort_order: 0,
      expires_at: expiresAt,
    })
    .select('id, title, storage_path, expires_at')
    .single();

  if (insertError || !game) {
    console.error('[workshop upload] insert', insertError);
    throw new Error(
      'ファイルは送れましたが、ギャラリー登録に失敗しました。スタッフに声をかけてください。\n' +
        (insertError?.message || '')
    );
  }

  onProgress({ percent: 100, text: '完了！' });
  return game;
}

export function buildPlayUrl(gameId) {
  const origin = window.location.origin;
  return `${origin}/index.html#/play/${gameId}`;
}

export function buildQrImageUrl(playUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(playUrl)}`;
}
