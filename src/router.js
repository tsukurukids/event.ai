/**
 * Hash-based SPA Router
 * Routes: 
 *   #/                    → Home (location selection)
 *   #/location/:id        → Event dates for a location
 *   #/event/:id           → Sessions for an event
 *   #/session/:id         → Games in a session
 *   #/play/:id            → Play a game
 */

export class Router {
  constructor(routes) {
    this.routes = routes;
    this.currentCleanup = null;

    window.addEventListener('hashchange', () => this.resolve());
    window.addEventListener('load', () => this.resolve());
  }

  resolve() {
    const hash = window.location.hash || '#/';
    const path = hash.slice(1); // remove #

    // Try to match routes
    for (const route of this.routes) {
      const match = this.matchRoute(route.path, path);
      if (match) {
        // Clean up previous page
        if (this.currentCleanup && typeof this.currentCleanup === 'function') {
          this.currentCleanup();
        }

        const app = document.getElementById('app');
        app.innerHTML = '';
        app.classList.add('page-transition');
        
        requestAnimationFrame(() => {
          this.currentCleanup = route.handler(app, match.params);
          requestAnimationFrame(() => {
            app.classList.remove('page-transition');
          });
        });
        return;
      }
    }

    // 404 fallback
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="error-page">
        <h1>🌺 ページが見つかりません</h1>
        <a href="#/" class="btn btn-primary">トップにもどる</a>
      </div>
    `;
  }

  matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return { params };
  }

  static navigate(path) {
    window.location.hash = path;
  }
}
