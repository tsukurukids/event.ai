import { Router } from './router.js';
import { renderExperienceAuto, renderExperience } from './pages/experience.js';
import './styles/main.css';

/**
 * 体験イベント専用エントリ（ギャラリーとは完全独立）
 * 参加者は experience.html を開くだけ。QR・URL選択は不要。
 */
new Router([
  { path: '/', handler: renderExperienceAuto },
  { path: '/:slug', handler: renderExperience },
]);
