import { supabase } from '../supabase.js';

/**
 * Upload a game folder to Supabase Storage
 * This module is imported by dashboard.js
 */
export async function uploadGameFolder(files, storagePath, onProgress) {
  const total = files.length;
  let uploaded = 0;
  const errors = [];

  for (const file of files) {
    let filePath;

    if (file.webkitRelativePath) {
      const parts = file.webkitRelativePath.split('/');
      parts.shift(); // remove top-level folder
      filePath = `${storagePath}/${parts.join('/')}`;
    } else if (file.relativePath) {
      const parts = file.relativePath.split('/');
      parts.shift();
      filePath = `${storagePath}/${parts.join('/')}`;
    } else {
      filePath = `${storagePath}/${file.name}`;
    }

    try {
      const { error } = await supabase.storage
        .from('game-files')
        .upload(filePath, file, {
          upsert: true,
          contentType: getContentType(file.name),
        });

      if (error) {
        errors.push({ file: file.name, error });
      }
    } catch (err) {
      errors.push({ file: file.name, error: err });
    }

    uploaded++;
    if (onProgress) {
      onProgress(uploaded, total);
    }
  }

  return { uploaded, total, errors };
}

/**
 * Determine content type based on file extension
 */
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const types = {
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
  };
  return types[ext] || 'application/octet-stream';
}
