import { supabase } from '../supabase.js';

/**
 * ① Home Page — Location Selection with background images
 */
export function renderHome(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>みんなのAIゲームギャラリー</h1>
      <p class="subtitle">～ 生成AIでつくった作品たち ～</p>
      <p class="description">開催地をえらんでね！</p>
    </div>
    <div class="card-grid card-grid-2" id="locations-grid">
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>よみこみ中...</p>
      </div>
    </div>
    <div class="footer-deco">
      <p>子ども × 生成AI 体験イベント</p>
    </div>
  `;

  loadLocations();
}

// Default images for known locations
const defaultImages = {
  '那覇': '/images/naha.png',
  'うるま': '/images/uruma.png',
};

function getLocationImage(location) {
  // Check if location has a custom image_url
  if (location.image_url) return location.image_url;
  // Try to find a default based on name
  for (const [key, url] of Object.entries(defaultImages)) {
    if (location.name.includes(key)) return url;
  }
  return null;
}

async function loadLocations() {
  const grid = document.getElementById('locations-grid');

  try {
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .order('sort_order');

    if (error) throw error;

    if (!locations || locations.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>まだ開催地が登録されていません</p>
        </div>
      `;
      return;
    }

    // Get game counts for each location
    const locationCards = await Promise.all(locations.map(async (loc) => {
      const { count } = await supabase
        .from('games')
        .select('*, sessions!inner(*, events!inner(location_id))', { count: 'exact', head: true })
        .eq('sessions.events.location_id', loc.id)
        .eq('is_published', true);

      return createLocationCard(loc, count || 0);
    }));

    grid.innerHTML = locationCards.join('');

    // Add click handlers
    grid.querySelectorAll('.location-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `/location/${card.dataset.id}`;
      });
    });

  } catch (err) {
    console.error('Error loading locations:', err);
    grid.innerHTML = `
      <div class="empty-state">
        <p>データの読み込みに失敗しました</p>
      </div>
    `;
  }
}

function createLocationCard(location, gameCount) {
  const imageUrl = getLocationImage(location);
  const hasImage = !!imageUrl;

  return `
    <div class="location-card ${hasImage ? 'has-image' : ''}" data-id="${location.id}" role="button" tabindex="0">
      ${hasImage ? `<div class="location-card-bg" style="background-image: url('${imageUrl}')"></div>` : ''}
      <div class="location-card-overlay"></div>
      <div class="location-card-content">
        <h3 class="location-card-title">${location.name}</h3>
        <span class="location-card-count">${gameCount}作品</span>
      </div>
    </div>
  `;
}
