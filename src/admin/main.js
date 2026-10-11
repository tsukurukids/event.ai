import { supabase } from '../supabase.js';
import { renderLogin } from './login.js';
import { renderGalleryAdmin } from './gallery.js';
import '../styles/admin.css';

async function init() {
  const app = document.getElementById('admin-app');
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    renderGalleryAdmin(app);
  } else {
    renderLogin(app);
  }

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') {
      renderGalleryAdmin(app);
    } else if (event === 'SIGNED_OUT') {
      renderLogin(app);
    }
  });
}

init();
