import { supabase } from '../supabase.js';

/**
 * ② Location Page — Event dates for a location
 */
export function renderLocation(container, params) {
  container.innerHTML = `
    <a href="#/" class="back-nav">
      <span class="arrow">←</span> トップにもどる
    </a>
    <div class="page-header">
      <h1 id="location-name">読み込み中...</h1>
      <p class="subtitle">開催日をえらんでね！</p>
    </div>
    <div class="card-grid card-grid-2" id="events-grid">
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>よみこみ中...</p>
      </div>
    </div>
  `;

  loadEvents(params.id);
}

async function loadEvents(locationId) {
  const grid = document.getElementById('events-grid');
  const nameEl = document.getElementById('location-name');

  try {
    // Get location info
    const { data: location, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('id', locationId)
      .single();

    if (locError) throw locError;

    nameEl.textContent = location.name;

    // Get events for this location
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('location_id', locationId)
      .order('sort_order');

    if (error) throw error;

    if (!events || events.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>まだ開催日が登録されていません</p>
        </div>
      `;
      return;
    }

    // Get game counts per event
    const eventCards = await Promise.all(events.map(async (event, index) => {
      const { count } = await supabase
        .from('games')
        .select('*, sessions!inner(event_id)', { count: 'exact', head: true })
        .eq('sessions.event_id', event.id)
        .eq('is_published', true);

      return createEventCard(event, count || 0, index);
    }));

    grid.innerHTML = eventCards.join('');

    // Add click handlers
    grid.querySelectorAll('.glass-card').forEach(card => {
      card.addEventListener('click', () => {
        window.location.hash = `/event/${card.dataset.id}`;
      });
    });

  } catch (err) {
    console.error('Error loading events:', err);
    grid.innerHTML = `
      <div class="empty-state">
        <p>データの読み込みに失敗しました</p>
      </div>
    `;
  }
}

function createEventCard(event, gameCount, index) {
  const variants = ['variant-ocean', 'variant-coral', 'variant-gold', 'variant-purple'];
  const variant = variants[index % variants.length];

  // Format date
  const date = new Date(event.date);
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日(${dayOfWeek})`;

  return `
    <div class="glass-card ${variant}" data-id="${event.id}" role="button" tabindex="0">
      <h3 class="card-title">${event.label}</h3>
      <p class="card-subtitle">${dateStr}</p>
      <span class="card-count">${gameCount}作品</span>
    </div>
  `;
}
