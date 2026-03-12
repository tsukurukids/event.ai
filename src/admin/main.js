import { supabase } from '../supabase.js';
import { renderLogin } from './login.js';
import { renderDashboard } from './dashboard.js';
import '../styles/admin.css';

/**
 * Admin entry point — check auth state and render accordingly
 */
async function init() {
  const app = document.getElementById('admin-app');

  // Check current session
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    renderDashboard(app);
  } else {
    renderLogin(app);
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      renderDashboard(app);
    } else if (event === 'SIGNED_OUT') {
      renderLogin(app);
    }
  });
}

init();
