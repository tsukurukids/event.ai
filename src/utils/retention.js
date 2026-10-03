/** 体験参加者作品の Storage 保存期間（月） */
export const RETENTION_MONTHS = 2;

export function computeExpiresAt(fromDate = new Date()) {
  const d = new Date(fromDate);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + RETENTION_MONTHS);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}

/** 表示用: 2026年4月2日 */
export function formatExpiresDate(expiresAt) {
  if (!expiresAt) return '';
  const d = new Date(expiresAt);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

/** 体験者・保護者向けの短い案内文 */
export function retentionNoticeShort(expiresAt) {
  if (!expiresAt) return '';
  const date = formatExpiresDate(expiresAt);
  return `この作品は ${date} までギャラリーに保存されます（アップロードから${RETENTION_MONTHS}ヶ月）。おうちで続きを作る場合は、期限前にフォルダをダウンロードして保存してください。`;
}

export const RETENTION_POLICY_SUMMARY =
  `体験でアップロードした作品は、アップロードから${RETENTION_MONTHS}ヶ月後に自動で削除されます。` +
  'おうちで続けて作りたい方は、完成後にフォルダをパソコンに保存しておいてください。';
