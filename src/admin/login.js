import { supabase } from '../supabase.js';

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <span class="emoji-icon" aria-hidden="true">🔧</span>
        <h1>ギャラリー管理</h1>
        <p class="login-subtitle">作品の追加・削除</p>
        <div id="login-error" class="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label for="email">メールアドレス</label>
            <input type="email" id="email" placeholder="admin@example.com" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">パスワード</label>
            <input type="password" id="password" placeholder="パスワードを入力" required autocomplete="current-password">
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errorEl.textContent = 'メールアドレスまたはパスワードが正しくありません';
        errorEl.classList.add('show');
        submitBtn.textContent = 'ログイン';
        submitBtn.disabled = false;
      }
    } catch {
      errorEl.textContent = '接続エラーが発生しました';
      errorEl.classList.add('show');
      submitBtn.textContent = 'ログイン';
      submitBtn.disabled = false;
    }
  });
}
