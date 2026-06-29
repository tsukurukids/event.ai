import { supabase } from '../supabase.js';

/**
 * Storage パスの各セグメントを URL エンコード（日本語ファイル名対応）
 */
export function encodeStoragePath(path) {
  return path
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export function getGameBaseUrl(storagePath) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/storage/v1/object/public/game-files/${encodeStoragePath(storagePath)}/`;
}

export function getGamePublicUrl(storagePath, entryFile = 'index.html') {
  const filePath = `${storagePath}/${entryFile}`.replace(/\/+/g, '/');
  const { data } = supabase.storage.from('game-files').getPublicUrl(filePath);
  return data?.publicUrl || '';
}

export async function fetchAndPrepareHTML(url, baseUrl) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    let html = await response.text();
    if (!html.includes('<') || !html.includes('>')) return null;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n<base href="${baseUrl}">`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n<base href="${baseUrl}">`);
    } else if (html.includes('<html')) {
      html = html.replace(/<html([^>]*)>/, `<html$1>\n<head><base href="${baseUrl}"></head>`);
    } else {
      html = `<base href="${baseUrl}">\n${html}`;
    }

    return html;
  } catch (err) {
    console.error('Failed to fetch game HTML:', err);
    return null;
  }
}

export async function prepareStaticPreviewHTML(url, baseUrl) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    let html = await response.text();
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\s(on\w+)="[^"]*"/gi, '');
    html = html.replace(/\s(on\w+)='[^']*'/gi, '');

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>\n<base href="${baseUrl}">`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1>\n<base href="${baseUrl}">`);
    } else if (html.includes('<html')) {
      html = html.replace(/<html([^>]*)>/, `<html$1>\n<head><base href="${baseUrl}"></head>`);
    } else {
      html = `<base href="${baseUrl}">\n${html}`;
    }

    const freezeStyle = `<style>
      body { overflow: hidden !important; margin: 0 !important; pointer-events: none !important; }
      * { animation: none !important; transition: none !important; }
    </style>`;
    html = html.replace('</head>', `${freezeStyle}\n</head>`);

    return html;
  } catch (err) {
    console.error('Failed to prepare static preview:', err);
    return null;
  }
}
