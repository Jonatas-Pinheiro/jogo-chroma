/* ===== RENDERIZAÇÃO & UI — telas, símbolos SVG, overlays, preferências, bootstrap de eventos ===== */
const SVG={
  skip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.2"/><path d="M6.2 17.8 17.8 6.2"/></svg>',
  rev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h16M15.5 3.5 20 8l-4.5 4.5M20.5 16h-16M8.5 11.5 4 16l4.5 4.5"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.5h14l-4-4M20 16.5H6l4 4"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>',
  blackhole:'<svg viewBox="0 0 512 512" aria-label="BURACO NEGRO" fill="currentColor"><path d="M19.188 17.5v152.063C66.86 258.63 151.98 320.656 248.28 341.092c7.287 2.303 15.034 3.563 23.064 3.563 6.747 0 13.288-.884 19.53-2.53-47.547 33.525-105.556 53.155-168.187 53.155-36.77 0-71.258-7.8-103.5-20.342v35.625c39.863 9.25 78.667 13.034 114.188 10.812 22.572-1.413 43.213-4.7 63.063-10.53-45.634 33.337-107.435 50.03-177.25 49.686v29.44c6.82.457 13.417.874 20.343.874 132.277 0 245.515-77.08 300.283-188.28.174-.357.357-.708.53-1.064.236-.48.463-.953.688-1.438-.046.417-.076.835-.124 1.25-7.255 62.57-34.964 122.59-82.937 170.563-7.697 7.696-15.647 14.944-23.94 21.594h104.595c28.33-57.514 37.687-120.485 29.125-180.72-3.284-23.093-8.64-45.25-16.938-67.188 53.172 71.838 78.54 160.38 71.47 247.907h73.374C492.68 363.235 416.173 252.043 305.406 199c-.273-.13-.538-.276-.812-.406-1.12-.54-2.227-1.045-3.375-1.53-.6-.278-1.183-.573-1.783-.845.102.086.21.16.313.25-4.324-1.73-8.834-3.08-13.5-4 61.317-7.77 125.604 3.935 183.25 37.218 8.896 5.135 17.562 10.86 25.656 16.78v-94.655c-22.682-5.175-45.22-7.668-68.125-7.97-66.77-.874-133.078 18.29-189.186 54.876-9.19 4.476-17.36 10.758-24.063 18.343 24.015-56.973 66.21-107.004 123.69-140.188 49.576-28.623 104.276-41.016 157.686-39V17.5h-118.78c-41.383 17.778-79.457 43.683-111.282 75.656 16.34-27.53 36.19-52.736 58.594-75.656h-42.032c-60.804 67.31-91.872 156.46-87 245.656-.093 1.544-.156 3.09-.156 4.656 0 14.815 4.25 28.65 11.563 40.407-47.44-37.913-83.766-90.83-100.625-153.75-12.45-46.46-12.248-92.975-2.657-136.97H19.188zm252.156 192.188c32.223 0 58.156 25.902 58.156 58.125 0 32.222-25.933 58.156-58.156 58.156-11.938 0-23.007-3.57-32.22-9.69 6.202 3.168 13.23 4.97 20.72 4.97 25.67 0 46.438-20.802 46.437-46.47.003-23.096-16.51-42.202-38.592-45.81 10.03 6.777 17 18.396 17 31.405 0 20.813-17.123 37.313-37.938 37.313-13.864 0-25.89-7.378-32.438-18.532-.72-3.67-1.125-7.457-1.125-11.344 0-32.223 25.934-58.125 58.157-58.125z"/></svg>',
  confuse:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 0 7 2.5 7 6s-2.8 5.5-6 5.5-4.8-1.6-4.8-3.7 1.8-3.3 3.8-3.3 3 1.1 3 2.6-1.1 2.2-2.2 2.2"/><circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none"/></svg>'
};
function sym(c,small){
  if(c.v==='skip')return SVG.skip;
  if(c.v==='skip2')return small?'2×':SVG.skip;
  if(c.v==='rev')return SVG.rev;
  if(c.v==='+99')return '+99';
  if(c.v==='wild')return small?'<span class="wdot"></span>':'';
  if(c.v==='swap')return small?'<span class="wdot"></span>':SVG.swap;
  if(c.v==='eye')return small?'':SVG.eye;
  if(c.v==='blackhole')return SVG.blackhole;
  if(c.v==='confuse')return small?'':SVG.confuse;
  return esc(c.v);
}
function cardEl(c,extra){
  const el=document.createElement('div');
  el.className='card c-'+c.c+(c.v==='+99'?' rainbow99':'')+(extra?' '+extra:'');
      if(extra&&extra.includes('own-card')){const st=readShop(),skin=SHOP_ITEMS.find(x=>x.id===st.equipped.cards);if(skin)el.classList.add(skin.css);}
  el.dataset.id=c.id;
  el.title=cardName(c);
  el.innerHTML='<span class="cn tl">'+sym(c,true)+'</span><div class="mid">'+sym(c,false)+'</div><span class="cn br">'+sym(c,true)+'</span>';
  return el;
}
const AV=['#e63946','#f5b301','#25b05a','#2c7be5','#9b5de5','#f15bb5','#00a6a6','#ff7b00'];
const ORD={r:0,y:1,g:2,b:3,w:4};
  const VORD=['0','1','2','3','4','5','6','7','8','9','skip','skip2','rev','+2','+4','+6','+10','+99','wild','swap','eye','blackhole','confuse'];
const GENDER_EMOJI={female:'',male:'',nonbinary:'',other:''};

function genderEmoji(g){return GENDER_EMOJI[g]||'';}
function profileData(){
  let photo='',gender='';
  try{photo=localStorage.getItem('chroma-profile-photo')||'';gender=localStorage.getItem('chroma-profile-gender')||'';}catch(e){}
  const st=readShop(),item=SHOP_ITEMS.find(x=>x.id===st.equipped.profile&&x.type==='profile'),nameItem=SHOP_ITEMS.find(x=>x.id===st.equipped['name-effect']&&x.type==='name-effect');
  return{photo,gender,frame:item?item.css:'',nameEffect:nameItem?nameItem.css:''};
}
function saveProfile(profile){
  try{localStorage.setItem('chroma-profile-photo',profile.photo||'');localStorage.setItem('chroma-profile-gender',profile.gender||'');}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));
}
function avatarMarkup(p,cls='avatar'){
  const initial=esc((p&&p.name||'?').charAt(0).toUpperCase()),photo=p&&p.photo?'<img src="'+esc(p.photo)+'" alt="">':initial;
  const frame=p&&p.frame?safeFrameClass(p.frame):'';
  const inner='<span class="'+cls+(frame?' '+frame:'')+'">'+photo+'</span>';
  // molduras baseadas em imagem (ex. míticas) precisam envolver o avatar por fora,
  // já que .avatar usa overflow:hidden para recortar a foto em círculo
  const wrapCls=IMAGE_FRAME_WRAPS[frame];
  return wrapCls?'<span class="frame-wrap '+wrapCls+'">'+inner+'</span>':inner;
}
function safeFrameClass(frame){return SHOP_ITEMS.some(x=>x.type==='profile'&&x.css===frame)?frame:'';}
function safeNameEffect(effect){return SHOP_ITEMS.some(x=>x.type==='name-effect'&&x.css===effect)?effect:'';}

function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
  const coinHud=$('#coinHud');if(coinHud)coinHud.style.display=(id==='game')?'none':'';
  if(id!=='game'){stopMusic();document.body.classList.remove('chaos-bg','super-chaos-bg');}
  if(id!=='game'){$('#eyeTargetOv').classList.remove('on');$('#eyeViewOv').classList.remove('on');}
  if(id!=='game'){$('#endOv').classList.remove('on');$('#colorOv').classList.remove('on');}
  const dockScreens=['home','profile','achievements','mail','settings','rewards','shop','inventory','friends'];
  $('#mainDock').classList.toggle('on',dockScreens.includes(id));
  document.querySelectorAll('.dock-btn[data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===id));
}
function render(v){
  const prev=view;if(prev&&prev.phase==='playing'&&v.phase==='playing'&&prev.top&&v.top&&prev.top.id!==v.top.id&&prev.turn===v.me){try{const n=Number(localStorage.getItem('chroma-cards-played')||0)+1;localStorage.setItem('chroma-cards-played',String(n));}catch(e){}}view=v;
  if(v.phase==='lobby'){show('lobby');renderLobby(v,prev);}
  else{show('game');renderGame(v,prev);}
}

function renderLobby(v,prev){
  document.body.classList.remove('chaos-bg','super-chaos-bg');
  killFly();dealing.clear();lastTop=null;prevIds=new Set();
  if(prev&&prev.phase==='lobby'&&v.players.length>prev.players.length)sfx.join();
  $('#lobCode').textContent=v.code;
  $('#lobCount').textContent=v.players.length+' de '+v.opts.maxPlayers+' jogadores';
  $('#lobPlayers').innerHTML=v.players.map((p,i)=>
    '<li><span class="av" style="background:'+AV[i%AV.length]+'">'+esc(p.name.charAt(0).toUpperCase())+'</span>'+
    '<span class="pn">'+esc(p.name)+(p.id===v.me?' (você)':'')+(p.id==='host'?' ':'')+(p.bot?' ':'')+'</span>'+
    (isHost&&p.bot?'<button data-rm="'+esc(p.id)+'" aria-label="Remover bot"></button>':'')+'</li>'
  ).join('');
  const st=$('#optStack');st.checked=!!v.opts.stack;st.disabled=!isHost;
  const ef=$('#optEffects');ef.checked=!!v.opts.effects;ef.disabled=!isHost;
  const dc=$('#optDump');dc.checked=!!v.opts.dumpColor;dc.disabled=!isHost;
  const rk=$('#optRanked');if(rk){rk.checked=!!v.opts.ranked;rk.disabled=!isHost;}
  document.querySelectorAll('input[name=mode]').forEach(r=>{r.checked=r.value===(v.opts.mode||'classic');});
  $('#modeWrap').classList.toggle('locked',!isHost);
  updateModeLockUI();
  $('#matchTime').value=v.opts.minutes||10;$('#matchTime').disabled=!isHost;
  $('#turnTime').value=v.opts.turnSeconds||TURN_SECONDS;$('#turnTime').disabled=!isHost;
  $('#maxPlayers').value=v.opts.maxPlayers||4;$('#maxPlayers').disabled=!isHost;
  $('#hostBtns').style.display=isHost?'flex':'none';
  $('#waitHost').style.display=isHost?'none':'block';
  const teamCfg=teamConfig(v.opts.mode);
  $('#maxPlayers').value=teamCfg?teamCfg.players:(v.opts.maxPlayers||4);
  $('#maxPlayers').disabled=!isHost||!!teamCfg;
  $('#btnStart').disabled=teamCfg?v.players.length!==teamCfg.players:v.players.length<2;
  $('#btnBot').disabled=v.players.length>=v.opts.maxPlayers;
}

function renderGame(v,prev){
  awardMatchXP(v,prev);
  if(v.phase==='ended'&&prev&&prev.phase==='playing')settleRankedView(v);
  const playing=v.phase==='playing';
  document.body.classList.toggle('chaos-bg',v.opts.mode==='caos');
  document.body.classList.toggle('super-chaos-bg',v.opts.mode==='supercaos');
  syncMusic(v.opts.mode,playing);
  const myTurn=playing&&v.turn===v.me;
  const cont=!!prev&&prev.phase==='playing';
  if(playing&&!cont){prevIds=new Set();dealing.clear();killFly();}
  $('#roomCode').textContent=v.code;
  const remaining=v.endsAt?Math.max(0,v.endsAt-Date.now()):0;
  const timer=$('#matchTimer');timer.textContent=formatTime(remaining);timer.classList.toggle('urgent',remaining>0&&remaining<=60000);
  const chatFor=pid=>{const m=(v.chat||[]).filter(x=>x.pid===pid).pop();
    if(!m||Date.now()-m.at>=CHAT_BUBBLE_MS)return '';
    scheduleChatExpiry(m.at);
    return '<span class="chat-bubble">'+esc(m.text)+'</span>';};
  const mePlayer=v.players.find(p=>p.id===v.me);const myTag=$('#myTag');
  myTag.innerHTML=mePlayer?avatarMarkup(mePlayer,'avatar')+'<span class="my-name '+safeNameEffect(mePlayer.nameEffect)+'">Você · '+esc(mePlayer.name)+'</span>'+(genderEmoji(mePlayer.gender)?'<span class="gender">'+genderEmoji(mePlayer.gender)+'</span>':'')+chatFor(v.me):'';
  myTag.classList.toggle('chroma',!!(mePlayer&&mePlayer.count===1));
  const mt=$('#modeTag');const mn=(MODES[v.opts.mode]||'')+(v.opts.ranked?' · Ranqueado':'');
  mt.textContent=mn;mt.classList.toggle('on',v.opts.mode&&v.opts.mode!=='classic');
  $('#dirInd').textContent=v.dir===1?'↻':'↺';
  $('#stackInd').textContent=v.pending>0?'+'+v.pending:'';

  const mi=v.players.findIndex(p=>p.id===v.me),opps=[];
  for(let k=1;k<v.players.length;k++)opps.push(v.players[(mi+k)%v.players.length]);
  $('#opps').innerHTML=opps.map(p=>
    '<div class="opp team-'+(['a','b','c'][p.team]||'a')+''+(playing&&p.id===v.turn?' turn':'')+(p.count===1?' chroma':'')+'" data-pid="'+esc(p.id)+'"><div class="player-line">'+avatarMarkup(p)+'<div class="nm '+safeNameEffect(p.nameEffect)+'">'+esc(p.name)+(p.bot?' ':'')+'</div>'+(genderEmoji(p.gender)?'<span class="gender">'+genderEmoji(p.gender)+'</span>':'')+(isTeamMode(v.opts.mode)?'<span class="team-badge team-'+(['a','b','c'][p.team]||'a')+'">'+teamLabel(p.team)+'</span>':'')+'</div>'+chatFor(p.id)+
    '<div class="cnt'+(p.count===1?' one':'')+'">'+p.count+'</div>'+
    '<div class="w">'+(p.wins?' '+p.wins:'')+'</div></div>'
  ).join('');

  /* jogada de outro jogador: a carta voa do quadro dele até a pilha */
  if(cont&&!RM&&prev.top&&v.top&&prev.top.id!==v.top.id&&!(fly&&fly.id===v.top.id)){
    const chip=chipRect(prev.turn);
    if(chip)startFly(v.top,chip,false);
  }
  /* compras dos adversários: cartas voam da pilha até eles */
  if(cont&&!RM)v.players.forEach(p=>{
    if(p.id===v.me)return;
    const q=prev.players.find(x=>x.id===p.id);
    if(q&&p.count>q.count){const chip=chipRect(p.id);if(chip)for(let k=0;k<Math.min(p.count-q.count,4);k++)ghostFly(chip,k*110);}
  });
  const d0=flightRemain();

  if(v.top&&lastTop!==v.top.id){
    const d=$('#discard');d.innerHTML='';
    const el=cardEl(v.top);d.appendChild(el);lastTop=v.top.id;
    if(fly&&fly.id===v.top.id){el.style.visibility='hidden';fly.real=el;tryReveal(fly);}
    else{
      el.classList.add('pop');
      if(cont&&prev.top&&prev.top.id!==v.top.id)cardSfx(v.top);
    }
  }
  $('#discard').style.setProperty('--ring','var(--'+v.color+')');
  const pill=$('#colorPill');pill.textContent=CNAME[v.color];
  pill.style.setProperty('--c','var(--'+v.color+')');pill.className='pill '+v.color;
  $('#drawCount').textContent=v.drawLeft;

  const hidId=fly&&fly.own?fly.id:null;
  const hand=v.hand.slice().sort((a,b)=>ORD[a.c]-ORD[b.c]||VORD.indexOf(a.v)-VORD.indexOf(b.v));
  const hEl=$('#hand');hEl.innerHTML='';
  const fresh=[];
  hand.forEach(c=>{
    if(c.id===hidId)return;
    const el=cardEl(c,'own-card');
    if(myTurn)el.classList.add(v.legal.includes(c.id)?'legal':'dim');
    if(dealing.has(c.id))el.style.visibility='hidden';
    hEl.appendChild(el);
    if(!prevIds.has(c.id))fresh.push({el,card:c});
  });
  prevIds=new Set(v.hand.map(c=>c.id));
  if(!RM&&fresh.length)dealFromPile(fresh);
  sfxDiff(prev,v,d0);

  const ban=$('#banner');let t;
  if(!playing)t='Fim da rodada';
  else if(myTurn){
    if(v.drawnId)t='Jogue a carta comprada ou passe';
    else if(v.pending>0)t='Compre '+v.pending+(v.legal.length?' ou devolva +2/+4':'');
    else t='Sua vez!';
  }else{const tp=v.players.find(p=>p.id===v.turn);t='Vez de '+(tp?tp.name:'…');}
  ban.textContent=t;ban.classList.toggle('me',myTurn);
  const turnLeft=v.turnEndsAt&&playing?Math.max(0,v.turnEndsAt-Date.now()):0;
  const turnUrgent=playing&&turnLeft>0&&turnLeft<=2000;
  const turnTimer=$('#turnTimer');turnTimer.textContent=playing?(turnUrgent?' Últimos segundos: ':'Tempo do turno: ')+(turnLeft/1000).toFixed(1)+'s':'';turnTimer.classList.toggle('urgent',turnUrgent);
  const currentTurnWarningKey=String(v.turnEndsAt||'');
  if(!playing)turnWarningKey='';
  else if(turnUrgent&&turnWarningKey!==currentTurnWarningKey){
    turnWarningKey=currentTurnWarningKey;sfx.turnWarning();
    if(navigator.vibrate)navigator.vibrate([90,70,90]);
  }
  $('#msg').innerHTML=v.log.slice(-2).map(esc).join('<br>');

  const mine=v.hand.length;
  const ally=isTeamMode(v.opts.mode)?(v.players.find(p=>p.id!==v.me&&p.team===v.team)||null):null;
  $('#btnAllyView').classList.toggle('on',playing&&!!ally);
  $('#btnAllyView').textContent=ally?' Ver cartas de '+ally.name:' Ver aliado';
  const urgent=playing&&v.vulnerable===v.me;
  $('#btnChroma').classList.toggle('on',playing&&(urgent||mine<=2));
  $('#btnChroma').classList.toggle('urgent',urgent);
  $('#btnCatch').classList.toggle('on',playing&&!!v.vulnerable&&v.vulnerable!==v.me);
  $('#btnPass').classList.toggle('on',myTurn&&!!v.drawnId);
  $('#drawpile').classList.toggle('pulse',myTurn&&!v.drawnId&&(v.legal.length===0||v.pending>0));
  $('#quickChatBtn').style.display=playing?'block':'none';
  if(!playing)$('#quickChatMenu').classList.remove('on');

  if(myTurn&&!wasMyTurn&&navigator.vibrate)navigator.vibrate(60);
  wasMyTurn=myTurn;

  const ov=$('#endOv');
  if(v.phase==='ended'){
    const w=v.players.find(p=>p.id===v.winner);
    const me=isTeamMode(v.opts.mode)?(w&&w.team===v.team&&v.winnerTeam===v.team):(w&&w.id===v.me);
    const tour=v.opts.mode==='tournament', finished=!!(v.tournament&&v.tournament.finished);
    $('#endIcon').textContent=tour?(finished?'':''):(me?'':'');
    $('#endTitle').textContent=tour?(finished?'TORNEIO ENCERRADO!':'Rodada '+(v.tournament?v.tournament.round:'')+' encerrada'):(isTeamMode(v.opts.mode)&&v.winnerTeam!=null?(me?'Sua equipe venceu!':teamLabel(v.winnerTeam)+' venceu!'):(w?(me?'Você venceu!':w.name+' venceu!'):'Rodada encerrada'));
    const ordered=tour&&v.tournament? v.players.slice().sort((a,b)=>(v.tournament.scores[b.id]||0)-(v.tournament.scores[a.id]||0)) : v.players.slice().sort((a,b)=>b.wins-a.wins);
    $('#endScore').innerHTML=ordered.map((p,i)=>'<li class="'+(w&&p.id===w.id?'win':'')+'"><span>'+(tour?((i+1)+'º '):'')+esc(p.name)+(p.id===v.me?' (você)':'')+'</span><b>'+(tour?(v.tournament.scores[p.id]||0)+' pts':p.wins+(p.wins===1?' vitória':' vitórias'))+'</b></li>').join('');
    $('#tourneyMeta').textContent=tour?(finished?'Resultado final · '+v.tournament.round+' partidas':'Pontuação acumulada · partida '+v.tournament.round+' de '+v.tournament.maxRounds):'';
    $('#podium').style.display='none';
    $('#btnNext').style.display=isHost&&((isTeamMode(v.opts.mode)&&v.players.length===teamConfig(v.opts.mode).players)||(!isTeamMode(v.opts.mode)&&v.players.length>=2))&&(!tour||!finished)?'':'none';
    $('#btnTourAgain').style.display=tour&&finished&&isHost?'':'none';
    $('#btnTourRank').style.display=tour&&finished?'':'none';
    $('#btnBackLobby').style.display=isHost?'':'none';
    $('#endWait').style.display=isHost?'none':'block';
    if(tour&&finished){$('#endScore').style.display='none';$('#podium').style.display='grid';$('#podium').innerHTML=ordered.slice(0,3).map((p,i)=>'<div class="podium-card '+(i===0?'first':'')+'"><div class="medal">'+['','',''][i]+'</div><b>'+esc(p.name)+'</b><small>'+(v.tournament.scores[p.id]||0)+' pontos</small></div>').join('');}
    else $('#endScore').style.display='flex';
    ov.classList.add('on');
  }else ov.classList.remove('on');
}

function pickColor(cb){colorCb=cb;$('#colorOv').classList.add('on');}
function pickEyeTarget(cb){
  eyeTargetCb=cb;
  const targets=(view&&view.players||[]).filter(p=>p.id!==view.me);
  $('#eyeTargets').innerHTML=targets.map(p=>'<button type="button" data-eye-target="'+esc(p.id)+'">'+esc(p.name)+' · '+p.count+' cartas</button>').join('');
  $('#eyeTargetOv').classList.add('on');
}
function closeEyeView(){
  clearTimeout(eyeViewTimer);eyeViewTimer=null;$('#eyeViewOv').classList.remove('on');
}
function showEyeView(name,cards){
  closeEyeView();
  $('#eyeViewTitle').textContent='Cartas de '+name;
  $('#eyeCountdown').textContent='Você tem 3 segundos';
  $('#eyeCards').innerHTML='';
  (cards||[]).forEach(c=>$('#eyeCards').appendChild(cardEl(c)));
  $('#eyeViewOv').classList.add('on');
  const started=Date.now();
  const tick=()=>{const left=Math.max(0,3000-(Date.now()-started));$('#eyeCountdown').textContent=left?'Fecha em '+(left/1000).toFixed(1)+'s':'Visão encerrada';if(left)eyeViewTimer=setTimeout(tick,100);else eyeViewTimer=setTimeout(closeEyeView,300);};
  tick();
}
function formatTime(ms){const total=Math.ceil(Math.max(0,ms)/1000),m=Math.floor(total/60),s=String(total%60).padStart(2,'0');return m+':'+s;}


function rankedData(){const a=readRanked(),name=cleanName($('#inName').value)||'Você';if(!a.some(x=>x.name.toLowerCase()===name.toLowerCase()))a.push({name,points:0,wins:0,losses:0,played:0});return a.sort((x,y)=>y.points-x.points||y.wins-x.wins||x.name.localeCompare(y.name));}
const RANKED_REWARDS={Prata:'Moldura Dourada',Ametista:'Nome Dourado',Ouro:'Banner Dourado',Diamante:'Distintivo Dourado',Dominador:'Cartas Douradas',Soberano:'Pacote Dourado'};
function renderRanking(){
  const a=rankedData(),name=cleanName($('#inName').value)||'Você',me=a.find(x=>x.name.toLowerCase()===name.toLowerCase())||a[0],tier=rankedTier(me.points),idx=a.indexOf(me),next=tier.next?Math.max(0,tier.next-me.points):0;
  $('#rankMe').innerHTML='<div><small>Sua posição</small><b>#'+(idx+1)+'</b></div><div><small>Patente</small><b>'+tier.name+' '+tier.level+'</b></div><div><small>Pontos</small><b>'+me.points+(tier.next?' · '+next+' para avançar':' · Máximo')+'</b></div>';
  const rewards=$('#rankRewards');if(rewards)rewards.innerHTML=RANKED_TIERS.filter((x,i)=>i%4===3).map(t=>'<div class="rank-reward-card"><span class="reward-rank-icon">'+esc(t.name.slice(0,3).toUpperCase())+'</span><div><b>'+esc(t.name)+' IV</b><small>'+esc(RANKED_REWARDS[t.name])+' · cosmético dourado</small></div></div>').join('');
  $('#rankList').innerHTML=a.map((p,i)=>{const t=rankedTier(p.points),pr=t.next?Math.min(100,Math.max(0,(p.points-t.min)/(t.next-t.min)*100)):100;return '<div class="rank-row '+(p.name.toLowerCase()===name.toLowerCase()?'me':'')+'"><div class="rank-pos">#'+(i+1)+'</div><div class="rank-who"><b>'+esc(p.name)+'</b><small>'+t.name+' '+t.level+' · '+(p.wins||0)+' vitórias</small><div class="rank-progress"><i style="width:'+pr+'%"></i></div></div><div class="rank-stat"><strong>'+p.points+'</strong>'+ (p.played||0)+' partidas</div></div>';}).join('');
}
function openRanking(){renderRanking();show('ranking');}
function renderProfile(){
  let username='',name='',photo='';try{username=localStorage.getItem('chroma-username')||'';name=localStorage.getItem('chroma-name')||'';photo=localStorage.getItem('chroma-profile-photo')||'';}catch(e){}
  const st=readShop(),items=(st.owned||[]).length,frame=SHOP_ITEMS.find(x=>x.id===st.equipped.profile&&x.type==='profile'),theme=SHOP_ITEMS.find(x=>x.id===st.equipped['profile-theme']&&x.type==='profile-theme'),badge=SHOP_ITEMS.find(x=>x.id===st.equipped['profile-badge']&&x.type==='profile-badge'),rstat=rankedStats(name),classic=myRankStats(),friends=readFriends(),rtier=rankedTier(rstat.points);
  $('#profileUsername').value=username;$('#profileUsernameDisplay').textContent='@'+(username||'usuario');$('#profileDisplayName').textContent=name||'Jogador';$('#profileAccountDisplay').textContent=window.firebaseCurrentUserEmail||'Progresso local';$('#profileRankImage').innerHTML='<img src="'+esc(RANK_IMAGE_BY_NAME[rtier.name]||'')+'" alt="Patente '+esc(rtier.name)+'">';$('#profileInfoLevel').textContent=levelFromXP(readXP());$('#profileInfoXp').textContent=readXP();$('#profileInfoCoins').textContent=readCoins();$('#profileInfoItems').textContent=items;$('#profileInfoMatches').textContent=classic.played||0;$('#profileInfoCards').textContent=classic.cardsPlayed||0;$('#profileInfoFriends').textContent=(friends.friends||[]).length;$('#profileRankName').textContent=rtier.name+' '+rtier.level;$('#profileRankPoints').textContent=rstat.points+' pontos'+(rtier.next?' · '+(rtier.next-rstat.points)+' para avançar':' · nível máximo');
  if(photo)$('#profileScreenPhoto').innerHTML='<img src="'+esc(photo)+'" alt="Foto de perfil">';
  const wrap=$('#profileScreenWrap'),photoEl=$('#profileScreenPhoto');if(wrap){const wc=frame&&IMAGE_FRAME_WRAPS[frame.css];wrap.className='frame-wrap'+(wc?' '+wc:'');}if(photoEl)photoEl.className='profile-photo '+(frame&&!IMAGE_FRAME_WRAPS[frame.css]?frame.css:'');const banner=$('#profileBanner');if(banner)banner.className='profile-banner '+(theme?theme.css:'profile-theme-default');const badgeEl=$('#profileBadge');if(badgeEl){badgeEl.textContent=badge?badge.symbol||'':' ';badgeEl.className='profile-badge '+(badge?badge.css:'');}
  applyCosmetics();
}
function saveUsername(){const input=$('#profileUsername'),msg=$('#usernameMsg');let value=(input.value||'').trim().toLowerCase().replace(/^@+/,'').replace(/[^a-z0-9_]/g,'').slice(0,18);if(value.length<3){msg.textContent='Use pelo menos 3 caracteres.';msg.className='account-msg error';return;}try{localStorage.setItem('chroma-username',value);}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));renderProfile();msg.textContent='Nome de usuário salvo.';msg.className='account-msg';}

function usePotion(index){const st=readShop(),potions=st.potions||[],p=potions[index];if(!p)return;const minutes=Number(p.minutes)||30;potions.splice(index,1);st.potions=potions;st.activePotionUntil=Math.max(Date.now(),Number(st.activePotionUntil)||0)+minutes*60000;writeShop(st);toast('Poção ativada: XP em dobro por '+minutes+' minutos');renderInventory();}
function renderInventory(){const st=readShop(),owned=(st.owned||[]),cos=$('#inventoryCosmetics'),cons=$('#inventoryConsumables');if(!cos||!cons)return;const cosmetics=owned.map(id=>SHOP_ITEMS.find(x=>x.id===id)).filter(Boolean),potions=st.potions||[],active=Number(st.activePotionUntil)>Date.now();$('#inventoryCount').textContent=(cosmetics.length+potions.length)+' itens';const art=x=>x.image&&x.image!=='Link da imagem aqui'?'<img src="'+esc(x.image)+'" alt="">':shopPreviewMarkup(x);cos.innerHTML=cosmetics.length?cosmetics.map((x,i)=>{const st2=readShop(),eq=st2.equipped[x.type]===x.id;return '<article class="inventory-card"><div class="inventory-art '+esc(x.css||'')+'">'+art(x)+'</div><b>'+esc(x.name)+'</b><small>'+esc(x.desc)+'</small><div class="inventory-actions"><button class="btn '+(eq?'equipped':'primary')+'" data-inv-equip="'+esc(x.id)+'" type="button">'+(eq?'Equipado':'Equipar')+'</button></div></article>';}).join(''):'<div class="inventory-empty">Você ainda não recebeu cosméticos.</div>';cons.innerHTML=potions.length?potions.map((p,i)=>'<article class="inventory-card"><div class="inventory-art potion-art">🧪</div><b>Poção 2× XP</b><small>'+Number(p.minutes||30)+' minutos de experiência em dobro.</small><div class="inventory-actions"><button class="btn primary" data-use-potion="'+i+'" type="button">Usar</button></div></article>').join(''):'<div class="inventory-empty">Nenhuma poção armazenada.</div>';if(active)$('#inventoryConsumables').insertAdjacentHTML('afterbegin','<div class="inventory-active">Poção ativa · XP em dobro até '+new Date(Number(st.activePotionUntil)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'</div>');}

/* ---------- preferências ---------- */
function applyPreferences(){
  let light=false,low=false,ping=true;try{light=localStorage.getItem('chroma-theme')==='light';low=localStorage.getItem('chroma-light')==='1';ping=localStorage.getItem('chroma-ping')!=='0';}catch(e){}
  document.body.classList.toggle('light',light);document.body.classList.toggle('lightweight',low);
  $('#lightMode').checked=low;$('#pingMode').checked=ping;$('#themeLight').classList.toggle('active',light);$('#themeDark').classList.toggle('active',!light);updatePingUI();
}
function initPreferences(){applyPreferences();syncAudioVolumes();$('#lightMode').onchange=e=>{try{localStorage.setItem('chroma-light',e.target.checked?'1':'0');}catch(_){}applyPreferences();};$('#pingMode').onchange=e=>{try{localStorage.setItem('chroma-ping',e.target.checked?'1':'0');}catch(_){}updatePingUI();};$('#themeLight').onclick=()=>{try{localStorage.setItem('chroma-theme','light');localStorage.setItem('chroma-flag-psicopata','1');}catch(_){}applyPreferences();};$('#themeDark').onclick=()=>{try{localStorage.setItem('chroma-theme','dark');}catch(_){}applyPreferences();};$('#musicVolume').oninput=e=>{setMusicVolume(Number(e.target.value)/100);$('#musicVolumeValue').textContent=e.target.value+'%';};$('#sfxVolume').oninput=e=>{setSfxVolume(Number(e.target.value)/100);$('#sfxVolumeValue').textContent=e.target.value+'%';};}

/* ---------- eventos ---------- */
(function init(){
  $('#logo').innerHTML='CHROMA'.split('').map((ch,i)=>'<span style="color:var(--'+'rygb'[i%4]+')">'+ch+'</span>').join('');
  const fan=$('#fan');
  [{c:'r',v:'7',rot:'-16deg',ty:'8px'},{c:'y',v:'rev',rot:'-6deg',ty:'0px'},{c:'w',v:'+4',rot:'6deg',ty:'0px'},{c:'b',v:'skip',rot:'16deg',ty:'8px'}]
    .forEach((s,i)=>{const el=cardEl({id:'f'+i,c:s.c,v:s.v});el.style.setProperty('--rot',s.rot);el.style.setProperty('--ty',s.ty);fan.appendChild(el);});
  try{$('#inName').value=localStorage.getItem('chroma-name')||'';}catch(e){}
  const savedProfile=profileData();
  $('#profileGender').value=savedProfile.gender;
  if(savedProfile.photo){$('#profilePreview').innerHTML='<img src="'+esc(savedProfile.photo)+'" alt="Foto de perfil">';$('.profile-upload').textContent=' Trocar foto';}
  $('#profileGender').onchange=e=>{const p=profileData();p.gender=GENDER_EMOJI[e.target.value]?e.target.value:'';saveProfile(p);};
  $('#profilePhoto').onchange=e=>{
    const file=e.target.files&&e.target.files[0];if(!file)return;
    if(!file.type.startsWith('image/')){toast('Escolha um arquivo de imagem');e.target.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=256,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        const p=profileData();p.photo=canvas.toDataURL('image/jpeg',.82);saveProfile(p);
        $('#profilePreview').innerHTML='<img src="'+esc(p.photo)+'" alt="Foto de perfil">';$('.profile-upload').textContent=' Trocar foto';
      };
      img.onerror=()=>toast('Não consegui ler essa imagem');img.src=reader.result;
    };
    reader.readAsDataURL(file);
  };

  $('#inCode').addEventListener('input',e=>{
    e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
  });
  $('#btnCreate').onclick=()=>{
    const n=cleanName($('#inName').value);
    if(!n){toast('Digite seu nome primeiro');$('#inName').focus();return;}
    if(typeof Peer==='undefined'){toast('Não consegui carregar a biblioteca de conexão. Verifique a internet.');return;}
    saveName(n);createRoom(n,profileData());
  };
  $('#btnJoin').onclick=()=>{
    const n=cleanName($('#inName').value),code=$('#inCode').value.trim().toUpperCase();
    if(!n){toast('Digite seu nome primeiro');$('#inName').focus();return;}
    if(code.length!==5){toast('O código tem 5 letras/números');$('#inCode').focus();return;}
    if(typeof Peer==='undefined'){toast('Não consegui carregar a biblioteca de conexão. Verifique a internet.');return;}
    saveName(n);joinRoom(code,n,profileData());
  };
  $('#inCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btnJoin').click();});
  $('#inName').addEventListener('keydown',e=>{if(e.key==='Enter')($('#inCode').value?$('#btnJoin'):$('#btnCreate')).click();});

  $('#btnRanking').onclick=openRanking;
  $('#btnRankBack').onclick=()=>show('home');
  document.querySelectorAll('[data-rfilter]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-rfilter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderRanking();});
  $('#btnTourRank').onclick=()=>{$('#endOv').classList.remove('on');openRanking();};
  $('#btnTourAgain').onclick=()=>{if(isHost&&room){room.tournament={round:0,maxRounds:5,scores:{},finished:false,id:null};startRound();broadcast();}};
  $('#btnLobLeave').onclick=leave;
  $('#btnEndLeave').onclick=leave;
  $('#btnMatchMenu').onclick=e=>{e.stopPropagation();const open=$('#matchMenuDropdown').classList.toggle('on');$('#btnMatchMenu').setAttribute('aria-expanded',open?'true':'false');};
  $('#menuOptLeave').onclick=()=>{$('#matchMenuDropdown').classList.remove('on');if(confirm('Sair da partida?'))leave();};
  document.addEventListener('click',e=>{if(!e.target.closest('#btnMatchMenu')&&!e.target.closest('#matchMenuDropdown')){$('#matchMenuDropdown').classList.remove('on');$('#btnMatchMenu').setAttribute('aria-expanded','false');}});
  $('#btnCopy').onclick=async()=>{
    const code=view?view.code:'';
    try{await navigator.clipboard.writeText(code);toast('Código copiado: '+code);}
    catch(e){toast('Código: '+code);}
  };
  $('#optStack').onchange=e=>{if(isHost&&room&&room.phase==='lobby'){room.opts.stack=e.target.checked;broadcast();}};
  $('#optEffects').onchange=e=>{if(isHost&&room&&room.phase==='lobby'){room.opts.effects=e.target.checked;broadcast();}};
  $('#optDump').onchange=e=>{if(isHost&&room&&room.phase==='lobby'){room.opts.dumpColor=e.target.checked;broadcast();}};
  $('#optRanked').onchange=e=>{if(isHost&&room&&room.phase==='lobby'){room.opts.ranked=e.target.checked;broadcast();}};
  const updateRoomLimits=()=>{
    if(!isHost||!room||room.phase!=='lobby')return;
    const cfg=teamConfig(room.opts.mode);
    if(cfg&&room.players.length!==cfg.players){toast('Para iniciar '+MODES[room.opts.mode]+', é necessário ter exatamente '+cfg.players+' jogadores');return;}
    const limits=clampRoomOptions($('#matchTime').value,cfg?cfg.players:$('#maxPlayers').value,$('#turnTime').value);
    limits.maxPlayers=Math.max(limits.maxPlayers,room.players.length);
    room.opts.minutes=limits.minutes;room.opts.maxPlayers=Math.min(MAX_PLAYERS,limits.maxPlayers);room.opts.turnSeconds=limits.turnSeconds;broadcast();
  };
  $('#matchTime').onchange=updateRoomLimits;$('#maxPlayers').onchange=updateRoomLimits;$('#turnTime').onchange=updateRoomLimits;
  $('#modeWrap').addEventListener('change',e=>{
    if(e.target.name==='mode'&&isHost&&room&&room.phase==='lobby'){if(isModeLocked(e.target.value)){toast('Este modo será desbloqueado somente no nível 5');updateModeLockUI();return;}const cfg=teamConfig(e.target.value);if(cfg&&room.players.length>cfg.players){toast('Este modo exige no máximo '+cfg.players+' jogadores');return;}room.opts.mode=e.target.value;room.opts.maxPlayers=cfg?cfg.players:Math.max(4,room.opts.maxPlayers||4);room.players.forEach((p,i)=>p.team=teamForIndex(i,room.opts.mode));broadcast();}
  });
  $('#btnBot').onclick=()=>{
    if(!isHost||!room||room.players.length>=room.opts.maxPlayers)return;
    const free=BOT_NAMES.filter(n=>!room.players.some(p=>p.name===n));
    const name=free.length?free[Math.floor(Math.random()*free.length)]:'Bot '+room.players.length;
    room.players.push({id:'bot-'+Math.random().toString(36).slice(2,7),name,hand:[],bot:true,wins:0,called:false,team:teamForIndex(room.players.length,room.opts.mode)});
    broadcast();
  };
  $('#lobPlayers').addEventListener('click',e=>{
    const b=e.target.closest('[data-rm]');if(!b||!isHost||!room)return;
    removePlayer(b.dataset.rm);broadcast();
  });
  $('#btnStart').onclick=()=>{
    if(!isHost||!room)return;
    if(isModeLocked(room.opts.mode)){toast('Este modo será desbloqueado somente no nível 5');return;}
    const cfg=teamConfig(room.opts.mode);
    if(cfg&&room.players.length!==cfg.players){toast('Para iniciar '+MODES[room.opts.mode]+', é necessário ter exatamente '+cfg.players+' jogadores');return;}
    if(room.players.length<MIN_PLAYERS){toast('Precisa de pelo menos 2 jogadores');return;}
    startRound();broadcast();
  };
  $('#btnNext').onclick=()=>{if(isHost&&room&&room.phase==='ended'&&((isTeamMode(room.opts.mode)&&room.players.length===teamConfig(room.opts.mode).players)||(!isTeamMode(room.opts.mode)&&room.players.length>=MIN_PLAYERS))){startRound();broadcast();}};
  $('#btnAllyView').onclick=()=>{if(view&&view.phase==='playing')send({type:'allyView'});};
  $('#menuOptPlayers').onclick=()=>{$('#matchMenuDropdown').classList.remove('on');renderMatchPlayers();$('#playersOv').classList.add('on');};
  $('#playersClose').onclick=()=>$('#playersOv').classList.remove('on');
  $('#playersOv').addEventListener('click',e=>{if(e.target.id==='playersOv')e.target.classList.remove('on');const b=e.target.closest('[data-match-add]');if(b)sendFriendRequest(b.dataset.matchAdd);});
  $('#btnBackLobby').onclick=()=>{if(isHost&&room){room.phase='lobby';broadcast();}};


  if(window.lucide)lucide.createIcons();
  initPreferences();
  pingTimer=setInterval(sendPings,3000);
  setInterval(()=>{if(view&&view.phase==='playing'){
    if(view.endsAt){const left=Math.max(0,view.endsAt-Date.now()),timer=$('#matchTimer');timer.textContent=formatTime(left);timer.classList.toggle('urgent',left>0&&left<=60000);}
    if(view.turnEndsAt){
      const left=Math.max(0,view.turnEndsAt-Date.now()),urgent=left>0&&left<=2000,timer=$('#turnTimer');
      timer.textContent=(urgent?' Últimos segundos: ':'Tempo do turno: ')+(left/1000).toFixed(1)+'s';timer.classList.toggle('urgent',urgent);
      const key=String(view.turnEndsAt);
      if(urgent&&turnWarningKey!==key){turnWarningKey=key;sfx.turnWarning();if(navigator.vibrate)navigator.vibrate([90,70,90]);}
    }
  }},100);
  $('#btnSettings').onclick=()=>show('settings');
  $('#dockProfile').onclick=()=>{renderProfile();show('profile');};
  $('#settingsBack').onclick=()=>show('home');
  $('#profileBack').onclick=()=>show('home');
  $('#saveUsername').onclick=saveUsername;
  $('#btnRedeem').onclick=redeemCode;
  $('#redeemCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);});
  $('#redeemCode').addEventListener('keydown',e=>{if(e.key==='Enter')redeemCode();});

  // ---- dock inferior (categorias) ----
  $('#dockAchievements').onclick=()=>{renderAchievements();show('achievements');};
  $('#dockMail').onclick=()=>{renderMail();show('mail');};
  $('#dockHome').onclick=()=>show('home');
  $('#dockRewards').onclick=()=>{renderRewards();show('rewards');};
  $('#dockShop').onclick=()=>{renderShop();show('shop');};
  $('#dockInventory').onclick=()=>{renderInventory();show('inventory');};
  $('#dockFriends').onclick=()=>{renderFriends();show('friends');};
  document.querySelectorAll('[data-shop-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-shop-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderShop(b.dataset.shopTab);});
  $('#shopGrid').addEventListener('click',e=>{const b=e.target.closest('[data-shop-buy]');if(b)buyShop(b.dataset.shopBuy);});
  $('#inventory').addEventListener('click',e=>{const use=e.target.closest('[data-use-potion]');if(use)usePotion(Number(use.dataset.usePotion));const equip=e.target.closest('[data-inv-equip]');if(equip){equipShop(equip.dataset.invEquip);renderInventory();}});
  $('#friends').addEventListener('click',e=>{const b=e.target.closest('[data-friend-accept]');if(b)acceptFriend(b.dataset.friendAccept);});
  $('#sendFriendRequest').onclick=()=>{sendFriendRequest($('#friendUsername').value);$('#friendUsername').value='';};
  $('#rouletteClose').onclick=()=>$('#rouletteOv').classList.remove('on');
  $('#btnAdmin').onclick=openAdminPrompt;
  $('#adminUnlockAll').onclick=adminUnlockAll;
  $('#adminLockAll').onclick=adminLockAll;
  $('#adminClose').onclick=()=>$('#adminOv').classList.remove('on');
  $('#achBack').onclick=()=>show('home');
  $('#mailBack').onclick=()=>show('home');
  $('#rewardsBack').onclick=()=>show('home');
  $('#shopBack').onclick=()=>show('home');
  $('#inventoryBack').onclick=()=>show('home');
  $('#friendsBack').onclick=()=>show('home');
  $('#btnClaimDaily').onclick=e=>claimDaily(e);
  $('#missionList').addEventListener('click',e=>{const b=e.target.closest('[data-claim-mission]');if(b)claimMission(b.dataset.claimMission);});
  ensureLevelRewards();
  updateModeLockUI();
  updateMailBadge();
  updateCoinHud(false);
  renderProfileXP();
  applyCosmetics();
  renderShop();

  $('#hand').addEventListener('click',e=>{
    const el=e.target.closest('.card');if(!el||!view||view.phase!=='playing')return;
    if(fly&&fly.own)return;
    const id=el.dataset.id,c=view.hand.find(x=>x.id===id);if(!c)return;
    if(view.turn!==view.me){warn('Ainda não é a sua vez');return;}
    if(!view.legal.includes(id)){
      el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');
      warn(view.drawnId?'Só dá para jogar a carta que você comprou':view.pending>0?'Compre as cartas ou devolva um +2/+4':c.v==='+4'?'Coringa +4 só sem carta da cor atual':'Essa carta não combina');
      return;
    }
    const from=rectOf(el);
    const play=payload=>{
      if(!RM)startFly(c,from,true);
      send(Object.assign({type:'play',cardId:id},payload||{}));
    };
    if(c.v==='eye')pickEyeTarget(targetId=>play({targetId}));
    else if(c.c==='w')pickColor(color=>play({color}));
    else play();
  });
  $('#drawpile').onclick=()=>{
    if(!view||view.phase!=='playing')return;
    if(fly&&fly.own)return;
    if(view.turn!==view.me){warn('Ainda não é a sua vez');return;}
    send({type:'draw'});
  };
  $('#btnChroma').onclick=()=>send({type:'chroma'});
  $('#btnCatch').onclick=()=>send({type:'catch'});
  $('#btnPass').onclick=()=>send({type:'pass'});
  $('#quickChatMenu').innerHTML=QUICK_MESSAGES.map((m,i)=>'<button type="button" data-quick-chat="'+i+'">'+esc(m)+'</button>').join('');
  $('#quickChatBtn').onclick=()=>{if(view&&view.phase==='playing')$('#quickChatMenu').classList.toggle('on');};
  $('#quickChatMenu').addEventListener('click',e=>{
    const b=e.target.closest('[data-quick-chat]');if(!b||!view||view.phase!=='playing')return;
    if(Date.now()<quickChatCooldownUntil){$('#quickChatMenu').classList.remove('on');return;}
    const message=QUICK_MESSAGES[Number(b.dataset.quickChat)];
    if(message){send({type:'chat',message});quickChatCooldownUntil=Date.now()+1500;}
    $('#quickChatMenu').classList.remove('on');
  });
  $('#colorOv').addEventListener('click',e=>{
    const b=e.target.closest('[data-c]');
    if(b){const cb=colorCb;colorCb=null;$('#colorOv').classList.remove('on');if(cb)cb(b.dataset.c);}
    else if(e.target.id==='colorCancel'||e.target.id==='colorOv'){colorCb=null;$('#colorOv').classList.remove('on');}
  });
  $('#eyeTargetOv').addEventListener('click',e=>{
    const b=e.target.closest('[data-eye-target]');
    if(b){const cb=eyeTargetCb;eyeTargetCb=null;$('#eyeTargetOv').classList.remove('on');if(cb)cb(b.dataset.eyeTarget);}
    else if(e.target.id==='eyeTargetCancel'||e.target.id==='eyeTargetOv'){eyeTargetCb=null;$('#eyeTargetOv').classList.remove('on');}
  });
  $('#eyeViewOv').addEventListener('click',e=>{if(e.target.id==='eyeViewOv')closeEyeView();});
  ['pointerdown','touchend','keydown'].forEach(n=>document.addEventListener(n,()=>audio(),{passive:true}));
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('button'))sfx.click();});
  window.addEventListener('beforeunload',()=>{
    if(isHost){for(const k in conns){try{conns[k].send({t:'closed'});}catch(_){}}}
    else if(hostConn&&hostConn.open){try{hostConn.send({t:'leave'});}catch(_){}}
  });
})();
