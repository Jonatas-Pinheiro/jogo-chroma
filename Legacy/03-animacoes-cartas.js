/* ===== ANIMAÇÕES DE CARTAS — fly/deal, deck, shuffle, log de eventos ===== */
let fly=null;const dealing=new Set();
function backEl(){const el=document.createElement('div');el.className='card back';el.innerHTML='<div class="mid">C</div>';return el;}
function rectOf(el){const r=el.getBoundingClientRect();return{cx:r.left+r.width/2,cy:r.top+r.height/2,w:r.width};}
function chipRect(id){
  const c=[...document.querySelectorAll('#opps [data-pid]')].find(x=>x.dataset.pid===id);
  if(!c)return null;const r=c.getBoundingClientRect();
  return{cx:r.left+r.width/2,cy:r.top+r.height/2,w:Math.max(28,Math.min(r.width,r.height)*.7)};
}
function flyCard(o){
  const el=o.back?backEl():cardEl(o.card);
  el.classList.add('flying');
  const base=Math.max(o.from.w,o.to.w),H=base*1.5;
  el.style.setProperty('--card-w',base+'px');el.style.setProperty('--card-h',H+'px');
  el.style.left=(o.to.cx-base/2)+'px';el.style.top=(o.to.cy-H/2)+'px';
  document.body.appendChild(el);
  const s0=o.from.w/base,s1=o.to.w/base,dx=o.from.cx-o.to.cx,dy=o.from.cy-o.to.cy,rot=o.spin||0;
  const anim=el.animate([
    {transform:'translate('+dx+'px,'+dy+'px) scale('+s0+') rotate('+(-rot)+'deg)',offset:0},
    {transform:'translate('+(dx*.4)+'px,'+(dy*.4-24)+'px) scale('+((s0+s1)/2+.06)+') rotate('+(-rot*.4)+'deg)',offset:.55},
    {transform:'translate(0px,0px) scale('+s1+') rotate(0deg)',offset:1}
  ],{duration:o.dur||420,delay:o.delay||0,easing:'cubic-bezier(.22,.8,.3,1)',fill:'both'});
  anim.onfinish=()=>{if(o.onEnd)o.onEnd();};
  return{el,anim};
}
/* carta jogada: do lugar de origem (mão ou quadro do adversário) até a pilha de descarte */
function startFly(card,from,own){
  killFly();
  const d=$('#discard').getBoundingClientRect(),pw=$('#drawpile .card').getBoundingClientRect().width;
  if(!pw||!d.width)return null;
  const to={cx:d.left+d.width/2,cy:d.top+d.height/2,w:pw};
  const f={id:card.id,own,landed:false,real:null,t0:performance.now(),dur:400};
  const r=flyCard({card,from,to,dur:f.dur,spin:own?7:12,onEnd:()=>{f.landed=true;cardSfx(card);tryReveal(f);}});
  f.el=r.el;f.anim=r.anim;
  f.timeout=setTimeout(()=>{if(fly===f)cancelFly();},3000);
  fly=f;return f;
}
function tryReveal(f){
  if(!f||fly!==f||!f.landed||!f.real)return;
  f.real.style.visibility='';f.el.remove();clearTimeout(f.timeout);fly=null;
}
function killFly(){
  if(!fly)return null;
  const f=fly;fly=null;clearTimeout(f.timeout);
  try{f.anim.cancel();}catch(e){}
  f.el.remove();if(f.real)f.real.style.visibility='';
  return f;
}
function cancelFly(){const f=killFly();if(f&&f.own&&view)render(view);}
function flightRemain(){return fly?Math.max(.05,(fly.dur-(performance.now()-fly.t0))/1000+.05):.05;}
/* cartas compradas: da pilha até a mão */
function dealFromPile(items){
  const pr=$('#drawpile .card').getBoundingClientRect();if(!pr.width)return;
  const from={cx:pr.left+pr.width/2,cy:pr.top+pr.height/2,w:pr.width};
  items.slice(0,14).forEach(({el,card},i)=>{
    const r=el.getBoundingClientRect();if(!r.width)return;
    dealing.add(card.id);el.style.visibility='hidden';
    const a=flyCard({back:true,from,to:{cx:r.left+r.width/2,cy:r.top+r.height/2,w:r.width},dur:420,delay:i*70,spin:8,onEnd:()=>{
      dealing.delete(card.id);a.el.remove();
      const real=[...document.querySelectorAll('#hand .card')].find(x=>x.dataset.id===card.id);
      if(real)real.style.visibility='';
    }});
  });
}
/* cartas compradas por adversários: da pilha até o quadro deles */
function ghostFly(chip,delay){
  const pr=$('#drawpile .card').getBoundingClientRect();if(!pr.width)return;
  const from={cx:pr.left+pr.width/2,cy:pr.top+pr.height/2,w:pr.width};
  const r=flyCard({back:true,from,to:{cx:chip.cx,cy:chip.cy,w:Math.max(24,chip.w*.55)},dur:420,delay,spin:-10,onEnd:()=>r.el.remove()});
}
/* sons a partir da diferença entre o estado anterior e o novo (vale para host e convidados) */
function newLog(a,b){
  if(!a||!a.length)return b;
  const last=a[a.length-1];
  for(let i=b.length-1;i>=0;i--)if(b[i]===last)return b.slice(i+1);
  return b;
}
function sfxDiff(prev,v,d0){
  const oldChat=prev&&prev.chat&&prev.chat.length?prev.chat[prev.chat.length-1]:null;
  const newChat=v.chat&&v.chat.length?v.chat[v.chat.length-1]:null;
  if(newChat&&(!oldChat||oldChat.at!==newChat.at))sfx.chat(d0);
  if(v.phase==='playing'&&(!prev||prev.phase!=='playing')){sfx.deal();if(v.turn===v.me)sfx.turn(.75);return;}
  if(!prev||prev.phase!=='playing')return;
  const mine=v.hand.length-prev.hand.length;
  for(let k=0;k<Math.min(Math.max(mine,0),5);k++)sfx.draw(k*.09);
  if(mine<=0&&v.players.some(p=>{const q=prev.players.find(x=>x.id===p.id);return p.id!==v.me&&q&&p.count>q.count;}))sfx.draw(0);
  newLog(prev.log,v.log).forEach(m=>{
    if(/gritou CHROMA|CHROMA! \(1 carta\)/.test(m))sfx.chroma(d0);
    else if(/sem CHROMA/.test(m))sfx.buzz(0);
    else if(/está com 1 carta/.test(m)&&v.vulnerable!==v.me)sfx.alert(d0);
  });
  if(v.phase==='playing'&&prev.turn!==v.me&&v.turn===v.me)sfx.turn(d0+.02);
  if(v.phase==='ended')(v.winner===v.me?sfx.win:sfx.lose)(d0+.15);
}

/* ---------------------------------------------------------------
   MOTOR DO JOGO (roda só no host)
--------------------------------------------------------------- */
function makeDeck(mode,dumpColor){
  const d=[];let n=0;const add=(c,v)=>d.push({id:'k'+(n++),c,v});
  for(const c of COLORS){
    add(c,'0');
    for(let k=1;k<=9;k++){add(c,String(k));add(c,String(k));}
    for(const v of ['skip','rev','+2']){add(c,v);add(c,v);}
    if(mode==='caos'||mode==='supercaos'){add(c,'skip2');add(c,'+10');}
    if(dumpColor)add(c,'blackhole');
  }
  for(let k=0;k<4;k++){add('w','wild');add('w','+4');}
  if(mode==='caos'||mode==='supercaos')for(let k=0;k<2;k++){add('w','+6');add('w','swap');add('w','eye');}
  if(mode==='supercaos'){for(let k=0;k<2;k++)add('w','+99');for(let k=0;k<2;k++)add('w','confuse');}
  return d;
}
