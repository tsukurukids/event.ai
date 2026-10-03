import JSZip from 'jszip';
import { supabase } from '../supabase.js';

async function listAllFiles(prefix) {
  const results = [];
  async function walk(path) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from('game-files').list(path, {
        limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error('ファイル一覧を取得できませんでした。時間をおいて試してください。');
      for (const item of data || []) {
        const fullPath = `${path}/${item.name}`;
        if (item.id === null) await walk(fullPath); else results.push(fullPath);
      }
      if (!data || data.length < 1000) break;
    }
  }
  await walk(prefix);
  return results;
}

/** Download only a complete archive, never silently deliver missing files. */
export async function downloadFolderAsZip(storagePath, zipName, { expiresAt } = {}) {
  const checkExpiry = () => {
    if (expiresAt && new Date(expiresAt) <= new Date()) throw new Error('この作品の公開期間は終了しました。');
  };
  checkExpiry();
  const files = await listAllFiles(storagePath);
  if (!files.length) throw new Error('作品ファイルが見つかりません。公開期間が終了している可能性があります。');
  const zip = new JSZip();
  for (const filePath of files) {
    checkExpiry();
    const { data } = supabase.storage.from('game-files').getPublicUrl(filePath);
    const response = await fetch(data.publicUrl);
    if (!response.ok) throw new Error('一部のファイルを取得できませんでした。もう一度ダウンロードしてください。');
    zip.file(filePath.slice(storagePath.length + 1), await response.blob());
  }
  const content = await zip.generateAsync({ type: 'blob' });
  checkExpiry();
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(zipName || 'game').replace(/\.zip$/i, '').replace(/[\\/:*?"<>|]/g, '_')}.zip`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
