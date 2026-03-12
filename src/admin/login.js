import { supabase } from '../supabase.js';

/**
 * Login page for admin dashboard
 */
export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <span class="emoji-icon">🔧</span>
        <h1>管理者ログイン</h1>
        <p class="login-subtitle">AIゲームギャラリー 管理ダッシュボード</p>
        <div id="login-error" class="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label for="email">メールアドレス</label>
            <input type="email" id="email" placeholder="admin@example.com" required>
          </div>
          <div class="form-group">
            <label for="password">パスワード</label>
            <input type="password" id="password" placeholder="パスワードを入力" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center; padding:0.85rem; margin-top:0.5rem;">
            ログイン
          </button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.remove('show');

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'ログイン中...';
    submitBtn.disabled = true;

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        errorEl.textContent = 'メールアドレスまたはパスワードが正しくありません';
        errorEl.classList.add('show');
        submitBtn.textContent = 'ログイン';
        submitBtn.disabled = false;
      }
    } catch (err) {
      errorEl.textContent = '接続エラーが発生しました';
      errorEl.classList.add('show');
      submitBtn.textContent = 'ログイン';
      submitBtn.disabled = false;
    }
  });
}
