import { Router } from './router.js';
import { renderHome } from './pages/home.js';
import { renderPlay } from './pages/play.js';
import './styles/main.css';
import './styles/gallery.css';

/**
 * ギャラリー専用エントリ（体験ページとは完全独立）
 */
document.body.classList.add('gallery-surface');

new Router([
  { path: '/', handler: renderHome },
  { path: '/location/:id', handler: renderHome },
  { path: '/event/:id', handler: renderHome },
  { path: '/play/:id', handler: renderPlay },
]);
