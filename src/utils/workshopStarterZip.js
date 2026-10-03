import JSZip from 'jszip';
import { listStarterAssetFiles, workshopAssetUrl } from '../config/workshopAssets.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * フォルダ／ZIP名用に危険な文字だけ除去（日本語は許可）
 */
export function sanitizeParticipantName(raw) {
  return String(raw || '')
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

/**
 * 例: たろう_シューティング
 */
export function buildFolderName(participantName, genreLabel) {
  const name = sanitizeParticipantName(participantName);
  const genre = String(genreLabel || 'ゲーム').trim() || 'ゲーム';
  return name ? `${name}_${genre}` : `なまえ_${genre}`;
}

function starterIndexHtml(folderName, genre) {
  const safeFolder = escapeHtml(folderName);
  const safeLabel = escapeHtml(genre.label);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeFolder}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", sans-serif;
      background: linear-gradient(160deg, #fff8f0, #e8d5f5 50%, #a8d8f0);
      color: #3d2c3e;
      text-align: center;
      padding: 1.5rem;
    }
    .card {
      background: rgba(255,255,255,0.9);
      border-radius: 24px;
      padding: 2rem 1.5rem;
      max-width: 28rem;
      box-shadow: 0 12px 40px rgba(200,162,232,0.25);
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { line-height: 1.6; color: #6b5a6d; }
    .emoji { font-size: 3rem; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${genre.emoji}</div>
    <h1>${safeFolder}</h1>
    <p>ここはスタート用のフォルダです。<br>
    Antigravity でこのフォルダを開いて、<br>
    AIと一緒に <strong>${safeLabel}</strong> ゲームを作ろう！</p>
    <p style="margin-top:1rem;font-size:0.9rem;">画像は <code>assets/</code> に入っています。</p>
  </div>
</body>
</html>
`;
}

async function fetchAssetBlob(genreId, file) {
  const url = workshopAssetUrl(genreId, file);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`素材の取得に失敗: ${file}`);
  return res.blob();
}

/**
 * ジャンル別スターターを「名前_ジャンル」フォルダ入りZIPでダウンロード
 */
export async function downloadNamedStarterZip({ participantName, genre }) {
  if (!genre) throw new Error('ジャンルがありません');

  const folderName = buildFolderName(participantName, genre.label);
  const zip = new JSZip();
  const root = zip.folder(folderName);
  const assets = root.folder('assets');

  root.file('index.html', starterIndexHtml(folderName, genre));

  const files = listStarterAssetFiles(genre.id);
  const failed = [];
  await Promise.all(
    files.map(async (file) => {
      try {
        const blob = await fetchAssetBlob(genre.id, file);
        assets.file(file, blob);
      } catch (err) {
        console.warn('[starterZip]', err);
        failed.push(file);
      }
    })
  );

  if (failed.length === files.length && files.length > 0) {
    throw new Error('素材画像をZIPに入れられませんでした。ページを再読み込みしてね。');
  }

  assets.file(
    'README.txt',
    [
      `ジャンル: ${genre.label}`,
      '',
      'このフォルダの画像をゲームで使います。',
      'プロンプトに書いてあるパス（例: ./assets/ship_blue.png）をそのままでOK。',
      '',
      '入っているファイル:',
      ...files.map((f) => `- ${f}`),
      ...(failed.length ? ['', '取得できなかったファイル:', ...failed.map((f) => `- ${f}`)] : []),
    ].join('\n')
  );

  root.file(
    'はじめてください.txt',
    [
      `【${folderName}】`,
      '',
      '1. このZIPを解凍する',
      '2. Antigravity で「Open Folder」を選ぶ',
      `3. 「${folderName}」フォルダを開く`,
      '4. サイトに戻って、ステップのお願い文をコピーする',
      '',
      `ジャンル: ${genre.label}`,
    ].join('\n')
  );

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return folderName;
}
