import { Router } from './router.js';
import { renderHome } from './pages/home.js';
import { renderLocation } from './pages/location.js';
import { renderEvent } from './pages/event.js';
import { renderPlay } from './pages/play.js';
import './styles/main.css';

// Initialize router
new Router([
  { path: '/', handler: renderHome },
  { path: '/location/:id', handler: renderLocation },
  { path: '/event/:id', handler: renderEvent },
  { path: '/play/:id', handler: renderPlay },
]);
