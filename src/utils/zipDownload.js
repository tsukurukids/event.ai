import JSZip from 'jszip';
import { supabase } from '../supabase.js';

/**
 * ストレージフォルダ以下のファイルを再帰的に列挙する。
 * 匿名ユーザーの場合、ポリシーが未設定だと空配列が返る点に注意。
 */
async function listAllFiles(prefix) {
  const results = [];

  async function walk(path) {
    const { data, error } = await supabase.storage.from('game-files').list(path, {
      limit: 1000,
    });

    if (error) {
      // ポリシー不足などで list が失敗した場合
      console.error('[zipDownload] list error:', error.message, 'path:', path);
      throw new Error(`ファイル一覧の取得に失敗しました。\nStorageのポリシー設定を確認してください。\n(${error.message})`);
    }

    if (!data || data.length === 0) return;

    for (const item of data) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      if (item.id === null) {
        // フォルダ
        await walk(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }

  await walk(prefix);
  return results;
}

/**
 * Supabase Storageのフォルダを ZIP にまとめてダウンロードする。
 */
export async function downloadFolderAsZip(storagePath, zipName) {
  let files;
  try {
    files = await listAllFiles(storagePath);
  } catch (err) {
    throw err; // list 自体の失敗はそのまま上位へ
  }

  if (files.length === 0) {
    throw new Error(
      '素材フォルダにファイルが見つかりません。\n' +
      '① 管理画面で素材フォルダがアップロード済みか確認してください。\n' +
      '② Supabaseのgame-filesバケットのポリシーが公開設定になっているか確認してください。'
    );
  }

  const zip = new JSZip();
  const prefix = `${storagePath}/`;
  let downloadErrors = 0;

  for (const filePath of files) {
    const { data: urlData } = supabase.storage.from('game-files').getPublicUrl(filePath);

    let response;
    try {
      response = await fetch(urlData.publicUrl);
    } catch (fetchErr) {
      console.warn('[zipDownload] fetch failed:', filePath, fetchErr);
      downloadErrors++;
      continue;
    }

    if (!response.ok) {
      console.warn('[zipDownload] HTTP error:', response.status, filePath);
      downloadErrors++;
      continue;
    }

    const blob = await response.blob();
    const relativePath = filePath.startsWith(prefix)
      ? filePath.slice(prefix.length)
      : filePath.replace(`${storagePath}/`, '');

    zip.file(relativePath, blob);
  }

  const successCount = files.length - downloadErrors;
  if (successCount === 0) {
    throw new Error(
      'ファイルのダウンロードが全て失敗しました。\n' +
      'game-filesバケットが「公開」になっているか確認してください。'
    );
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zipName || 'materials'}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (downloadErrors > 0) {
    console.warn(`[zipDownload] ${downloadErrors}件のファイルがダウンロードできませんでした`);
  }
}
