import { Router } from './router.js';
import { renderWorkshopEntry, renderWorkshopGenrePlaceholder } from './pages/workshop.js';
import './styles/main.css';

/**
 * 体験イベント専用（experience.html）
 * 参加者: 来場 → 3ジャンル選択 → ステップ一覧（DL＋プロンプト）
 */
new Router([
  { path: '/', handler: renderWorkshopEntry },
  { path: '/genre/:genreId', handler: renderWorkshopGenrePlaceholder },
  /** 旧プロンプトURL → ステップ一覧へ */
  {
    path: '/genre/:genreId/prompt',
    handler: (_container, params) => {
      window.location.hash = `/genre/${params.genreId}`;
    },
  },
]);
