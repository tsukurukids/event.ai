import { workshopAssetUrl } from '../config/workshopAssets.js';

const configs = {
  athletic: { files: ['player_boy.png', 'ground.png', 'goal.png', 'coin.png'], help: '← → で移動・スペースでジャンプ。コインを集めて旗へ！' },
  shooting: { files: ['ship_blue.png', 'enemy_green.png', 'enemy_purple.png'], help: '← → で移動・スペースで発射。6体の敵を倒そう！' },
  puzzle: { files: ['block_red.png', 'block_blue.png', 'block_yellow.png'], help: '← → で列を選び、スペースで落とす。同じ色を縦か横に3つそろえよう！' },
};

export function openWorkshopDemo(genre, trigger) {
  const config = configs[genre.id];
  const dialog = document.createElement('dialog');
  dialog.className = 'ws-demo';
  dialog.setAttribute('aria-labelledby', 'ws-demo-title');
  dialog.innerHTML = `<header><div><p>あそべる見本</p><h2 id="ws-demo-title">${genre.label}</h2></div><button type="button" data-close aria-label="見本を閉じる">×</button></header>
    <p class="ws-demo-help">${config.help}</p>
    <canvas width="720" height="360" tabindex="0" aria-label="${genre.label}の見本ゲーム。${config.help}"></canvas>
    <p class="ws-demo-status" role="status">素材をよみこみ中…</p>
    <div class="ws-demo-controls"><button data-key="ArrowLeft" aria-label="左へ">←</button><button data-key="ArrowRight" aria-label="右へ">→</button><button data-key="Space">${genre.id === 'athletic' ? 'ジャンプ' : genre.id === 'shooting' ? '発射' : '落とす'}</button></div>
    <footer><button data-retry>もう一度あそぶ</button><button data-create>このゲームをつくる →</button></footer>`;
  document.body.append(dialog);
  const canvas = dialog.querySelector('canvas'), ctx = canvas.getContext('2d');
  // Keep game coordinates independent of CSS size and Retina pixel density.
  function resizeCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const density = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * density));
    const height = Math.max(1, Math.round(bounds.height * density));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(width / 720, 0, 0, height / 360, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  const resizeObserver = new ResizeObserver(resizeCanvas);
  const status = dialog.querySelector('[role="status"]');
  const keys = new Set(), images = [];
  let frame = 0, stopped = false, ready = false, last = 0, game;
  function reset() {
    keys.clear();
    game = { x: 45, y: 260, vy: 0, grounded: true, time: 0, cooldown: 0, score: 0, won: false, lost: false, bullets: [], coins: [170,340,500], enemies: Array.from({length:6}, (_,i)=>({x:100+i*95,y:50+(i%2)*42,alive:true})), col: 2, color: 0, board: Array.from({length:6},()=>Array(8).fill(-1)) };
    game.board[5][1] = 0; game.board[5][2] = 0;
    game.board[5][4] = 1; game.board[5][5] = 1;
    status.textContent = '見本で遊んだら「このゲームをつくる」で始めよう。';
    canvas.focus();
  }
  function finish(text, won=true) { game.won=won; game.lost=!won; status.textContent=text; keys.clear(); }
  function action(key) {
    if (!ready || game.won || game.lost) return;
    if (genre.id === 'shooting' && key === 'Space' && game.cooldown <= 0) { game.bullets.push({x:game.x+25,y:290}); game.cooldown=.2; }
    if (genre.id === 'puzzle') {
      if (key === 'ArrowLeft') game.col = Math.max(0,game.col-1);
      if (key === 'ArrowRight') game.col = Math.min(7,game.col+1);
      if (key === 'Space') {
        let row=5; while(row>=0 && game.board[row][game.col]!==-1) row--;
        if(row<0) { status.textContent='この列はいっぱい！ 別の列を選ぼう。'; return; }
        game.board[row][game.col]=game.color;
        const remove=new Set();
        for(let r=0;r<6;r++) for(let c=0;c<8;c++) for(const [dr,dc] of [[0,1],[1,0]]) {
          const color=game.board[r][c]; if(color<0) continue;
          const run=[]; let rr=r,cc=c;
          while(rr<6 && cc<8 && game.board[rr][cc]===color){run.push(rr*8+cc);rr+=dr;cc+=dc;}
          if(run.length>=3) run.forEach(v=>remove.add(v));
        }
        remove.forEach(v=>game.board[Math.floor(v/8)][v%8]=-1);
        for(let c=0;c<8;c++) {const values=game.board.map(r=>r[c]).filter(v=>v>=0); for(let r=5;r>=0;r--)game.board[r][c]=values.pop()??-1;}
        game.score+=remove.size; game.color=(game.color+1)%3;
        if(game.score>=6) finish('クリア！ 6こ消せたね。今度は自分のゲームをつくろう！');
        else if(game.board[0].every(v=>v>=0)) finish('いっぱいになったね。「もう一度あそぶ」で再挑戦！',false);
        else status.textContent=remove.size ? `${remove.size}こ消えた！ あと${6-game.score}こでクリア。` : '同じ色を3つ、縦か横にそろえよう。';
      }
    } else if(key==='Space' && genre.id==='athletic' && game.grounded) { game.vy=-510;game.grounded=false; }
  }
  function keydown(e){if(!['ArrowLeft','ArrowRight','Space'].includes(e.code)||e.target.tagName==='BUTTON')return;e.preventDefault();keys.add(e.code);if(!e.repeat)action(e.code);}
  function keyup(e){keys.delete(e.code);}
  dialog.addEventListener('keydown',keydown); dialog.addEventListener('keyup',keyup);
  const blur=()=>keys.clear(); window.addEventListener('blur',blur);
  dialog.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);action(button.dataset.key);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key));
    button.addEventListener('click',e=>{if(e.detail===0 && ready && !game.won && !game.lost){action(button.dataset.key);if(genre.id!=='puzzle' && button.dataset.key==='ArrowLeft')game.x=Math.max(0,game.x-35);if(genre.id!=='puzzle' && button.dataset.key==='ArrowRight')game.x=Math.min(660,game.x+35);}});
  });
  function cleanup(){if(stopped)return;stopped=true;cancelAnimationFrame(frame);resizeObserver.disconnect();window.removeEventListener('resize',resizeCanvas);window.removeEventListener('blur',blur);window.removeEventListener('hashchange',close);dialog.remove();trigger?.focus({preventScroll:true});}
  function close(){dialog.close();cleanup();}
  dialog.addEventListener('close',cleanup);
  dialog.querySelector('[data-close]').onclick=close;
  dialog.querySelector('[data-retry]').onclick=()=>{if(ready)reset();};
  dialog.querySelector('[data-create]').onclick=()=>{close();location.hash=`/genre/${genre.id}`;};
  window.addEventListener('hashchange',close);
  dialog.showModal();
  resizeCanvas();
  resizeObserver.observe(canvas);
  window.addEventListener('resize',resizeCanvas);
  function sprite(i,x,y,w,h=w){if(images[i])ctx.drawImage(images[i],x,y,w,h);}
  function draw(now){
    if(stopped)return;
    const dt=Math.min((now-last)/1000||0,0.04);last=now;
    ctx.fillStyle=genre.id==='shooting'?'#142546':'#e8f5ff';ctx.fillRect(0,0,720,360);
    const g=game;
    if(!g.won&&!g.lost){g.time+=dt;g.cooldown-=dt;
      if(genre.id!=='puzzle')g.x=Math.max(0,Math.min(660,g.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*280*dt));
      if(genre.id==='athletic'){
        const oldY=g.y;g.vy+=1250*dt;g.y+=g.vy*dt;g.grounded=false;
        for(const p of [[0,310,720],[235,235,115],[425,190,110]])if(g.vy>=0&&oldY+50<=p[1]&&g.y+50>=p[1]&&g.x+42>p[0]&&g.x+8<p[0]+p[2]){g.y=p[1]-50;g.vy=0;g.grounded=true;}
        g.coins=g.coins.filter(x=>{if(Math.abs(g.x+25-x)<32&&Math.abs(g.y+25-270)<42){g.score++;return false;}return true;});
        if(g.x>620)finish('ゴール！ ジャンプできたね。今度は自分のコースをつくろう！');
      }
      if(genre.id==='shooting'){
        if(keys.has('Space')&&g.cooldown<=0){g.bullets.push({x:g.x+25,y:290});g.cooldown=.2;}
        for(const b of g.bullets){b.y-=460*dt;for(const e of g.enemies)if(e.alive&&Math.abs(b.x-(e.x+Math.sin(g.time*1.5)*35+25))<25&&Math.abs(b.y-(e.y+25))<28){e.alive=false;b.y=-100;g.score++;}}
        g.bullets=g.bullets.filter(b=>b.y>0);if(g.score===6)finish('クリア！ 敵をぜんぶ倒したね。今度は自分の宇宙をつくろう！');
      }
    }
    if(genre.id==='athletic'){
      for(let x=0;x<720;x+=80)sprite(1,x,295,85,65);
      ctx.fillStyle='#7cba77';ctx.fillRect(235,235,115,15);ctx.fillRect(425,190,110,15);
      sprite(2,620,222,80);g.coins.forEach(x=>sprite(3,x-15,255,30));sprite(0,g.x,g.y,50);
    }else if(genre.id==='shooting'){
      ctx.fillStyle='#d5ecff';for(let i=0;i<40;i++)ctx.fillRect((i*137)%720,(i*73)%360,2,2);
      g.enemies.filter(e=>e.alive).forEach((e,i)=>sprite(1+i%2,e.x+Math.sin(g.time*1.5)*35,e.y,50));
      sprite(0,g.x,285,55);ctx.fillStyle='#ffe46f';g.bullets.forEach(b=>ctx.fillRect(b.x-3,b.y,6,16));
    }else{
      ctx.fillStyle='#d5e3f2';ctx.fillRect(160,60,400,300);
      ctx.fillStyle='#fff7b9';ctx.fillRect(160+g.col*50,60,50,300);
      for(let r=0;r<6;r++)for(let c=0;c<8;c++){ctx.strokeStyle='#b3c8db';ctx.strokeRect(160+c*50,60+r*50,50,50);if(g.board[r][c]>=0)sprite(g.board[r][c],162+c*50,62+r*50,46);}
      sprite(g.color,162+g.col*50,8,46);
    }
    ctx.textAlign='left';ctx.font='bold 18px sans-serif';ctx.fillStyle=genre.id==='shooting'?'#fff':'#193653';ctx.fillText(genre.id==='shooting'?`たおした数 ${g.score} / 6`:genre.id==='athletic'?`コイン ${g.score} / 3`:`消した数 ${g.score} / 6`,16,28);
    if(g.won||g.lost){ctx.fillStyle='#142546c9';ctx.fillRect(0,115,720,105);ctx.fillStyle='white';ctx.textAlign='center';ctx.font='bold 32px sans-serif';ctx.fillText(g.won?'できた！':'もう一度あそぼう',360,178);}
    frame=requestAnimationFrame(draw);
  }
  Promise.all(config.files.map(file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=workshopAssetUrl(genre.id,file);}))).then(loaded=>{if(stopped)return;images.push(...loaded);ready=true;reset();frame=requestAnimationFrame(draw);}).catch(()=>{if(!stopped)status.textContent='素材を読み込めませんでした。閉じて、もう一度開いてください。';});
}
