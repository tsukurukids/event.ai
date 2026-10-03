import { supabase } from '../supabase.js';
import { getGameBaseUrl, getGamePublicUrl, fetchAndPrepareHTML } from '../utils/gameHtml.js';
import { isExpired, formatExpiresDate } from '../utils/retention.js';
import { downloadFolderAsZip } from '../utils/zipDownload.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderPlay(container, params) {
  let disposed = false, timer;
  container.innerHTML = `<div class="gallery-shell"><a class="gallery-back" href="#/">← みんなのギャラリー</a><section id="play-container" class="gallery-play"><p role="status">ゲームをよみこみ中…</p></section></div>`;
  const panel = container.querySelector('#play-container');
  const unavailable = () => {
    panel.innerHTML = `<div class="gallery-empty"><h1>この作品は公開されていません</h1><p>公開期間が終了したか、作品が見つかりませんでした。</p><p>保存した作品フォルダがあれば、おうちで引き続き遊べます。</p><a href="#/">公開中の作品を見る →</a></div>`;
  };
  async function load() {
    try {
      const { data: game, error } = await supabase.from('games').select('*').eq('id', params.id).eq('is_published',true).maybeSingle();
      if (disposed) return;
      if (error) throw error;
      if (!game || isExpired(game.expires_at)) { unavailable(); return; }
      panel.innerHTML = `<header class="gallery-play-header"><h1>${escape(game.title)}</h1><button class="gallery-button" id="fullscreen-btn">大きな画面であそぶ</button></header>
        <div class="gallery-save"><div><strong>${game.expires_at ? `${escape(formatExpiresDate(game.expires_at))}（日本時間）まで公開` : '公開中の作品'}</strong><p>作品フォルダを保存すると、公開終了後も手元に残せます。</p></div><button class="gallery-button gallery-button-primary" id="download-game-zip">作品をダウンロード（ZIP）</button></div>
        <p class="gallery-download-status" role="status"></p><p class="gallery-play-hint">操作方法はゲーム画面の案内を見てね。キーボードを使う作品はPCで遊ぼう。</p>
        <iframe id="game-frame" class="play-frame" sandbox="allow-scripts allow-modals" title="${escape(game.title)}"></iframe>`;
      const frame=panel.querySelector('#game-frame'), status=panel.querySelector('[role="status"]'), button=panel.querySelector('#download-game-zip');
      const checkPeriod = () => { if (isExpired(game.expires_at)) { clearInterval(timer); unavailable(); return false; } return true; };
      if (game.expires_at) timer=setInterval(checkPeriod,1000);
      button.addEventListener('click',async()=>{
        if(!checkPeriod())return;
        button.disabled=true;status.textContent='作品をまとめています。そのままお待ちください。';
        try {
          const {data: fresh,error}=await supabase.from('games').select('id, expires_at').eq('id',game.id).eq('is_published',true).maybeSingle();
          if(error)throw new Error('公開情報を確認できませんでした。もう一度試してください。');
          if(!fresh||isExpired(fresh.expires_at)){unavailable();return;}
          await downloadFolderAsZip(game.storage_path,game.title,{expiresAt:fresh.expires_at});
          status.textContent='ダウンロードを開始しました。PCのダウンロードフォルダを確認してください。';
        }catch(error){status.textContent=error.message || 'ダウンロードできませんでした。もう一度試してください。';}
        finally{button.disabled=false;}
      });
      panel.querySelector('#fullscreen-btn').addEventListener('click',async()=>{
        try { if(frame.requestFullscreen)await frame.requestFullscreen(); else status.textContent='このブラウザーでは全画面表示に対応していません。'; }
        catch { status.textContent='全画面表示に切り替えられませんでした。'; }
      });
      const html=await fetchAndPrepareHTML(getGamePublicUrl(game.storage_path,game.entry_file), getGameBaseUrl(game.storage_path));
      if(disposed||!checkPeriod())return;
      if(html)frame.srcdoc=html;else {frame.remove();status.textContent='ゲームを読み込めませんでした。作品のダウンロードは上のボタンから試せます。';}
    }catch(error){
      if(disposed)return;
      panel.innerHTML='<div class="gallery-empty"><h1>読み込みできませんでした</h1><p>通信を確認して、もう一度試してください。</p><button class="gallery-button" id="play-retry">もう一度よみこむ</button></div>';
      panel.querySelector('#play-retry').onclick=load;
    }
  }
  load();
  return()=>{disposed=true;clearInterval(timer);};
}
