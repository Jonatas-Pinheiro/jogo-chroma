/* ===== REGRAS, REDE P2P E BOTS — motor de jogadas (doAct), PeerJS (criar/entrar/enviar sala), bots, ping, torneio/times ===== */
function hasUnreadMail(){const read=readMailIds();return MAIL_MESSAGES.some(m=>!read.includes(m.id));}
function updateMailBadge(){$('#mailBadge').classList.toggle('show',hasUnreadMail());}
function renderMail(){
  const read=readMailIds();
  if(!MAIL_MESSAGES.length){$('#mailList').innerHTML='<div class="mail-empty">Nenhuma mensagem por enquanto.</div>';return;}
  $('#mailList').innerHTML=MAIL_MESSAGES.map(m=>{
    const unread=!read.includes(m.id);
    return '<div class="mail-item'+(unread?' unread':'')+'"><h3>'+(unread?'<span class="mail-dot"></span>':'')+esc(m.title)+'</h3><small>'+esc(m.date)+'</small><p>'+esc(m.body)+'</p></div>';
  }).join('');
  writeMailIds(MAIL_MESSAGES.map(m=>m.id));
  updateMailBadge();
}
function renderAchievements(){
  const s=myRankStats(),f=myFlags();
  const unlockedCount=ACHIEVEMENTS.filter(a=>a.check(s,f)).length;
  $('#achGrid').innerHTML=ACHIEVEMENTS.map(a=>{
    const unlocked=a.check(s,f);
    return '<div class="ach-card'+(unlocked?' unlocked ':'')+(a.rainbow?' achievement-rainbow':'')+'"><span class="ach-ico">'+(a.image?'<img src="'+esc(a.image)+'" alt="">':a.ico)+'</span><b>'+esc(a.name)+'</b><small>'+esc(a.desc)+'</small></div>';
  }).join('')+'<div class="tourney-meta" style="grid-column:1/-1">'+unlockedCount+' de '+ACHIEVEMENTS.length+' conquistadas</div>';
}
function readFriends(){try{return JSON.parse(localStorage.getItem('chroma-friends')||'{\"friends\":[],\"requests\":[],\"sent\":[]}')}catch(e){return{friends:[],requests:[],sent:[]}}}
function writeFriends(x){try{localStorage.setItem('chroma-friends',JSON.stringify(x))}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function sendFriendRequest(username){const n=String(username||'').trim().toLowerCase().replace(/^@+/,'').replace(/[^a-z0-9_]/g,'').slice(0,18),me=String(localStorage.getItem('chroma-username')||'').toLowerCase();if(n.length<3){toast('Digite um nome de usuário válido');return;}if(n===me){toast('Você não pode adicionar a si mesmo');return;}const f=readFriends();if(f.friends.includes(n)||f.sent.includes(n)){toast('Esse jogador já está nos seus amigos ou pedidos');return;}f.sent.push(n);writeFriends(f);renderFriends();toast('Pedido enviado para @'+n);}
function renderFriends(){const f=readFriends(),empty='<div class="friend-empty">Nenhum registro por enquanto.</div>';const row=(n,actions)=>'<div class="friend-row"><span class="friend-avatar">@</span><b>@'+esc(n)+'</b><span class="friend-actions">'+(actions||'')+'</span></div>';$('#friendRequests').innerHTML=f.requests.length?f.requests.map(n=>row(n,'<button class="btn primary" data-friend-accept="'+esc(n)+'">Aceitar</button>')).join(''):empty;$('#friendSent').innerHTML=f.sent.length?f.sent.map(n=>row(n,'<small>Pendente</small>')).join(''):empty;$('#friendList').innerHTML=f.friends.length?f.friends.map(n=>row(n)).join(''):empty;}
function acceptFriend(n){const f=readFriends();f.requests=f.requests.filter(x=>x!==n);if(!f.friends.includes(n))f.friends.push(n);writeFriends(f);renderFriends();}
function renderMatchPlayers(){const list=$('#matchPlayersList');if(!list||!view)return;list.innerHTML=(view.players||[]).map(p=>'<div class="match-player-row"><div class="match-player-name">'+avatarMarkup(p,'avatar')+'<span>'+esc(p.name)+(p.id===view.me?' <small>(você)</small>':'')+'</span></div>'+(p.id!==view.me&&!p.bot?'<button class="btn primary" data-match-add="'+esc(p.name)+'">Adicionar amizade</button>':'<small class="player-status">'+(p.bot?'Bot':'Você')+'</small>')+'</div>').join('');}
function recordRank(name,delta,won,played){
  const a=readRank();let p=a.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!p){p={name,rating:1000,wins:0,losses:0,played:0};a.push(p)}
  p.rating=Math.max(0,Math.round(p.rating+delta));p.wins+=won?1:0;p.losses+=won?0:1;p.played+=played?1:0;p.updated=Date.now();writeRank(a);
}
const RANKED_WIN_POINTS=[34,30,26,22,18,14],RANKED_LOSS_POINTS=[12,11,10,9,8,7];
function readRanked(){try{return JSON.parse(localStorage.getItem('chroma-ranked')||'[]')}catch(e){return []}}
function writeRanked(a){try{localStorage.setItem('chroma-ranked',JSON.stringify(a))}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function rankedStats(name){const a=readRanked(),p=a.find(x=>x.name.toLowerCase()===String(name||'').toLowerCase());return p||{name:name||'Você',points:0,wins:0,losses:0,played:0};}
function recordRanked(name,delta,won){const a=readRanked();let p=a.find(x=>x.name.toLowerCase()===name.toLowerCase());if(!p){p={name,points:0,wins:0,losses:0,played:0};a.push(p);}p.points=Math.max(0,Math.round(p.points+delta));p.wins+=won?1:0;p.losses+=won?0:1;p.played++;p.updated=Date.now();writeRanked(a);return p;}
function settleRankedView(v){if(!v||!v.opts||!v.opts.ranked||!v.roundId||!v.winner)return;if(v.opts.mode==='tournament'&&v.tournament&&!v.tournament.finished)return;let done=[];try{done=JSON.parse(localStorage.getItem('chroma-ranked-settled')||'[]')}catch(e){}const key=v.code+'|'+v.roundId;if(done.includes(key))return;const me=v.players.find(p=>p.id===v.me),winner=v.players.find(p=>p.id===v.winner);if(!me)return;const won=v.winnerTeam!=null?me.team===v.winnerTeam:me.id===v.winner;const tier=rankedTier(rankedStats(me.name).points),idx=RANKED_TIERS.indexOf(tier),base=won?RANKED_WIN_POINTS[Math.floor(idx/4)]:-RANKED_LOSS_POINTS[Math.floor(idx/4)],delta=won&&v.opts.mode==='supercaos'?Math.round(base*1.5):base;recordRanked(me.name,delta,won);done.push(key);if(done.length>40)done=done.slice(-40);try{localStorage.setItem('chroma-ranked-settled',JSON.stringify(done));}catch(e){}if(me.id===v.me)toast((won?'+':'')+delta+' pontos ranqueados');}
function tournamentResults(){
  if(!room)return [];
  return room.players.slice().sort((a,b)=>(room.tournament.scores[b.id]||0)-(room.tournament.scores[a.id]||0)||a.name.localeCompare(b.name)).map((p,i)=>({id:p.id,name:p.name,points:room.tournament.scores[p.id]||0,place:i+1}));
}
function settleTournament(){
  if(!room||room.opts.mode!=='tournament'||room.tournament.finished)return;
  const results=tournamentResults();room.tournament.finished=true;
  results.forEach(r=>{const base=TOURNAMENT_POINTS[Math.min(r.place-1,TOURNAMENT_POINTS.length-1)]||5;recordRank(r.name,Math.round((base-50)*.8),r.place===1,true);});
}
function scoreTournamentRound(){
  if(!room||room.opts.mode!=='tournament')return;
  const results=room.players.slice().sort((a,b)=>a.id===room.winner?-1:b.id===room.winner?1:a.hand.length-b.hand.length||a.name.localeCompare(b.name));
  results.forEach((p,i)=>{if(room.tournament.scores[p.id]==null)room.tournament.scores[p.id]=0;room.tournament.scores[p.id]+=TOURNAMENT_POINTS[Math.min(i,TOURNAMENT_POINTS.length-1)]||5;});
  if(room.tournament.round>=room.tournament.maxRounds)settleTournament();
}
function teamConfig(mode){return mode==='team3x3'?{players:9,size:3}:mode==='team2x2'?{players:4,size:2}:null;}
function isTeamMode(mode){return !!teamConfig(mode);}
function teamForIndex(index,mode){const cfg=teamConfig(mode);return cfg?Math.floor(index/cfg.size):null;}
function teamOf(p){return p&&p.team!=null?p.team:null;}
function teamMate(p){return room&&room.players.find(q=>q.id!==p.id&&teamOf(q)===teamOf(p));}
function teamLabel(team){return team===0?'Equipe Azul':team===1?'Equipe Vermelha':team===2?'Equipe Verde':'';}
function finishByTime(){
  if(!room||room.phase!=='playing')return;
  clearInterval(clockTimer);clockTimer=null;
  const winner=room.players.slice().sort((a,b)=>a.hand.length-b.hand.length||a.name.localeCompare(b.name))[0];
  room.phase='ended';room.winner=winner?winner.id:null;room.winnerTeam=isTeamMode(room.opts.mode)?teamOf(winner):null;room.vulnerable=null;room.pending=0;room.drawnId=null;room.endsAt=null;
  if(winner){winner.wins++;log(room.winnerTeam!=null?'Tempo encerrado! '+teamLabel(room.winnerTeam)+' venceu.':'Tempo encerrado! '+winner.name+' venceu com menos cartas.');}
  scoreTournamentRound();
}
function endRound(p){
  clearInterval(clockTimer);clockTimer=null;
  room.phase='ended';room.winner=p.id;room.winnerTeam=isTeamMode(room.opts.mode)?teamOf(p):null;p.wins++;room.vulnerable=null;room.pending=0;room.drawnId=null;room.endsAt=null;
  log(room.winnerTeam!=null?teamLabel(room.winnerTeam)+' venceu! '+p.name+' terminou primeiro.':p.name+' venceu a rodada!');
  scoreTournamentRound();
}

/* Retorna null se ok, ou uma string com o motivo do erro */
function doAct(pid,a){
  if(!room||room.phase!=='playing')return 'A partida não está em andamento';
  const i=room.players.findIndex(p=>p.id===pid);
  if(i<0)return 'Jogador inválido';
  const p=room.players[i];

  if(a.type==='allyView'){
    if(!isTeamMode(room.opts.mode))return 'Essa função só existe nos modos de equipes';
    const cfg=teamConfig(room.opts.mode);
    if(room.players.length!==cfg.players)return 'Este modo precisa de exatamente '+cfg.players+' jogadores';
    const ally=teamMate(p);if(!ally)return 'Aliado indisponível';
    const cards=ally.hand.map(x=>({id:x.id,c:x.c,v:x.v}));
    if(pid==='host')showEyeView('Aliado · '+ally.name,cards);else if(conns[pid]&&conns[pid].open){try{conns[pid].send({t:'eye',name:'Aliado · '+ally.name,hand:cards});}catch(_){} }
    return null;
  }
  if(a.type==='chat'){
    if(room.phase!=='playing')return 'O chat só está disponível durante a partida';
    if(!QUICK_MESSAGES.includes(a.message))return 'Mensagem inválida';
    if(p.lastChatAt&&Date.now()-p.lastChatAt<1200)return;
    p.lastChatAt=Date.now();
    room.chat.push({pid,text:a.message,at:Date.now()});
    if(room.chat.length>30)room.chat.shift();
    return null;
  }

  if(a.type==='chroma'){
    if(room.vulnerable===pid){room.vulnerable=null;p.called=true;log(p.name+' gritou CHROMA!');return null;}
    if(p.hand.length<=2){p.called=true;return null;}
    return 'Você ainda tem cartas demais';
  }
  if(a.type==='catch'){
    const t=room.vulnerable?byId(room.vulnerable):null;
    if(!t||t.id===pid)return 'Ninguém para denunciar agora';
    drawCards(t,2);room.vulnerable=null;
    log(p.name+' pegou '+t.name+' sem CHROMA! (+2 cartas)');
    return null;
  }
  if(i!==room.turn)return 'Não é a sua vez';

  if(a.type==='play'){
    const idx=p.hand.findIndex(x=>x.id===a.cardId);
    if(idx<0)return 'Carta inválida';
    const c=p.hand[idx];
    if(room.drawnId&&room.drawnId!==c.id)return 'Jogue a carta comprada ou passe a vez';
    if(!isLegal(p,c))return 'Essa carta não pode ser jogada agora';
    if(c.v==='eye'&&room.opts.mode!=='caos'&&room.opts.mode!=='supercaos')return 'Essa carta só existe no modo Caos';
    if(c.v==='eye'){
      const target=byId(a.targetId);
      if(!target||target.id===p.id)return 'Escolha outro jogador para observar';
    }else if(c.c==='w'&&!COLORS.includes(a.color))return 'Escolha uma cor';
    room.vulnerable=null;
    p.hand.splice(idx,1);room.discard.push(c);
    if(c.c==='w'&&c.v!=='eye')room.color=a.color;else if(c.c!=='w')room.color=c.c;
    room.drawnId=null;
    log(p.name+' jogou '+cardName(c)+(c.c==='w'&&c.v!=='eye'?' → '+CNAME[a.color]:''));
    if(room.opts.dumpColor&&c.v==='blackhole'){
      const same=p.hand.filter(x=>x.c===c.c);
      if(same.length){
        p.hand=p.hand.filter(x=>x.c!==c.c);
        room.draw=shuffle(room.draw.concat(same));
        log(p.name+' abriu o BURACO NEGRO e devolveu '+same.length+' carta'+(same.length>1?'s':'')+' '+CNAME[c.c].toLowerCase()+' pro monte');
      }
    }
    if(p.hand.length===0){endRound(p);return null;}
    if(p.hand.length===1){
      if(p.called)log(p.name+': CHROMA! (1 carta)');
      else{room.vulnerable=p.id;log(p.name+' está com 1 carta!');}
    }
    if(p.hand.length!==1)p.called=false;
    const n=room.players.length;
    switch(c.v){
      case 'skip':{const s=peekP(1);log(s.name+' perdeu a vez');advance(2);break;}
      case 'skip2':{
        const k=Math.min(2,n-1);
        const names=[];for(let i=1;i<=k;i++)names.push(peekP(i).name);
        log(names.join(' e ')+' perderam a vez (Bloqueio Duplo)');advance(k+1);break;
      }
      case 'rev':room.dir*=-1;log('Sentido invertido');advance(n===2?2:1);break;
      case '+2':case '+4':case '+6':case '+10':case '+99':{
        const k=PLUS[c.v];
        if(room.opts.stack){room.pending+=k;advance(1);}
        else{const t=peekP(1);drawCards(t,k);log(t.name+' comprou '+k+' e perdeu a vez');advance(2);}
        break;
      }
      case 'swap':{
        const others=room.players.filter(x=>x.id!==p.id);
        if(others.length){
          const t=others[Math.floor(Math.random()*others.length)];
          const tmp=p.hand;p.hand=t.hand;t.hand=tmp;
          log(p.name+' trocou de mão com '+t.name+'!');
        }
        advance(1);break;
      }
      case 'confuse':{
        const pool=shuffle(room.players.reduce((acc,q)=>acc.concat(q.hand),[]));
        const total=pool.length,base=Math.floor(total/n);
        let extra=total-base*n;
        const startIdx=room.players.indexOf(p);
        const order=[];for(let i=0;i<n;i++)order.push(room.players[(startIdx+i)%n]);
        order.forEach(q=>{
          const take=base+(extra>0?1:0);if(extra>0)extra--;
          q.hand=pool.splice(0,take);
        });
        log('CONFUSÃO! As cartas de todos foram embaralhadas e redistribuídas ('+base+(total%n?'-'+(base+1):'')+' cada)');
        advance(1);break;
      }
      case 'eye':{
        const target=byId(a.targetId);
        if(target){
          const cards=target.hand.map(x=>({id:x.id,c:x.c,v:x.v}));
          if(pid==='host')showEyeView(target.name,cards);
          else if(conns[pid]&&conns[pid].open){try{conns[pid].send({t:'eye',name:target.name,hand:cards});}catch(_){} }
          log(p.name+' observou as cartas de '+target.name+' por 3 segundos');
        }
        advance(1);break;
      }
      case '0':{
        if(room.opts.effects&&n>=2){
          const old=room.players.map(q=>q.hand);
          room.players.forEach((q,j)=>{q.hand=old[((j-room.dir)%n+n)%n];});
          log('Todas as mãos giraram '+(room.dir===1?'em sentido horário':'em sentido anti-horário')+'!');
        }
        advance(1);break;
      }
      default:advance(1);
    }
    if(room.phase==='playing'){const zero=room.players.find(q=>q.hand.length===0);if(zero)endRound(zero);}
    return null;
  }
  if(a.type==='draw'){
    room.vulnerable=null;p.called=false;
    if(room.pending>0){
      drawCards(p,room.pending);log(p.name+' comprou '+room.pending+' cartas');
      room.pending=0;room.drawnId=null;advance(1);return null;
    }
    if(room.drawnId)return 'Você já comprou: jogue a carta ou passe a vez';
    const got=drawCards(p,1);
    if(!got.length){log('Não há mais cartas para comprar');advance(1);return null;}
    log(p.name+' comprou uma carta');
    if(isLegal(p,got[0]))room.drawnId=got[0].id;else advance(1);
    return null;
  }
  if(a.type==='pass'){
    if(!room.drawnId)return 'Só dá para passar depois de comprar';
    room.vulnerable=null;room.drawnId=null;advance(1);log(p.name+' passou a vez');return null;
  }
  return 'Ação desconhecida';
}

function removePlayer(id){
  const i=room.players.findIndex(p=>p.id===id);if(i<0)return;
  const p=room.players[i];
  const playing=room.phase==='playing';
  const wasTurn=playing&&i===room.turn;
  log(p.name+' saiu da sala');
  delete conns[id];
  if(playing){
    room.draw=shuffle(room.draw.concat(p.hand));
    if(room.vulnerable===id)room.vulnerable=null;
  }
  room.players.splice(i,1);
  if(playing){
    const n=room.players.length;
    if(n<2){
      room.phase='ended';
      if(room.players[0]){room.winner=room.players[0].id;room.winnerTeam=isTeamMode(room.opts.mode)?teamOf(room.players[0]):null;room.players[0].wins++;log(room.winnerTeam!=null?teamLabel(room.winnerTeam)+' venceu (todos saíram)':room.players[0].name+' venceu (todos saíram)');}
      return;
    }
    if(wasTurn){room.drawnId=null;room.turn=room.dir===1?i%n:(i-1+n)%n;room.turnEndsAt=Date.now()+(Number(room.opts.turnSeconds)||TURN_SECONDS)*1000;}
    else if(i<room.turn)room.turn--;
  }
}

/* ---------- bots ---------- */
function scheduleBot(){
  clearTimeout(botTimer);
  if(!room||room.phase!=='playing')return;
  const p=cur();if(!p||!p.bot)return;
  botTimer=setTimeout(botMove,BOT_MIN+Math.random()*BOT_VAR);
}
function botMove(){
  if(!room||room.phase!=='playing')return;
  const p=cur();if(!p||!p.bot)return;
  const legal=legalCards(p);
  let a;
  if(!legal.length)a={type:'draw'};
  else{
    const nonW=legal.filter(c=>c.c!=='w');
    let pool=nonW.length?nonW:legal;
    const act=pool.filter(c=>!/^\d$/.test(c.v));
    if(act.length&&(peekP(1).hand.length<=3||Math.random()<.4))pool=act;
    const c=pool[Math.floor(Math.random()*pool.length)];
    if(p.hand.length===2&&Math.random()<.85)p.called=true;
    let color,targetId;
    if(c.c==='w'){
      if(c.v==='eye'){
        const others=room.players.filter(x=>x.id!==p.id);
        targetId=others.length?others[Math.floor(Math.random()*others.length)].id:null;
      }
      const cnt={r:0,y:0,g:0,b:0};
      p.hand.forEach(x=>{if(x!==c&&x.c!=='w')cnt[x.c]++;});
      color=COLORS.slice().sort((x,y)=>cnt[y]-cnt[x]||Math.random()-.5)[0];
    }
    a={type:'play',cardId:c.id,color,targetId};
  }
  const err=doAct(p.id,a);
  if(err){console.warn('bot:',err);doAct(p.id,{type:room.drawnId?'pass':'draw'});}
  broadcast();
}

/* ---------- estado enviado a cada jogador (mão dos outros fica oculta) ---------- */
function viewFor(p){
  const playing=room.phase==='playing';
  const turnId=playing?cur().id:null;
  const mine=turnId===p.id;
  return{
    phase:room.phase,code:room.code,me:p.id,opts:room.opts,
    winnerTeam:room.winnerTeam==null?null:room.winnerTeam,team:p.team==null?null:p.team,turnEndsAt:room.turnEndsAt,
    players:room.players.map(q=>({id:q.id,name:q.name,photo:q.photo||'',gender:q.gender||'',count:q.hand.length,called:!!q.called,bot:q.bot,wins:q.wins,team:q.team==null?null:q.team,frame:safeFrameClass(q.frame),nameEffect:safeNameEffect(q.nameEffect)})),
    hand:p.hand,
    legal:mine?legalCards(p).map(c=>c.id):[],
    drawnId:mine?room.drawnId:null,
    top:room.discard[room.discard.length-1]||null,
    color:room.color,turn:turnId,dir:room.dir,pending:room.pending,
    drawLeft:room.draw.length,vulnerable:room.vulnerable,endsAt:room.endsAt,roundId:room.roundId,
    log:room.log.slice(-4),chat:room.chat.slice(-30),winner:room.winner,tournament:room.tournament
  };
}
function broadcast(){
  if(!room)return;
  for(const p of room.players){
    if(p.bot||p.id==='host')continue;
    const c=conns[p.id];
    if(c&&c.open){try{c.send({t:'state',s:viewFor(p)});}catch(e){console.warn(e);}}
  }
  render(viewFor(room.players.find(p=>p.id==='host')));
  scheduleBot();
}

/* ---------------------------------------------------------------
   INDICADOR DE PING
--------------------------------------------------------------- */
function classifyPing(ms){
  if(ms==null)return 'bad';
  if(ms<=80)return 'good';
  if(ms<=200)return 'mid';
  return 'bad';
}
function updatePingUI(){
  const badge=$('#pingBadge');if(!badge)return;
  let enabled=true;try{enabled=localStorage.getItem('chroma-ping')!=='0';}catch(e){}
  const connected=!!((isHost&&room)||(hostConn&&hostConn.open));
  badge.classList.toggle('show',enabled&&connected);
  if(!enabled||!connected)return;
  const stale=!pingUpdatedAt||Date.now()-pingUpdatedAt>8000;
  const val=stale?null:pingMs;
  const cls=classifyPing(val);
  $('#pingDot').className='ping-dot '+cls;
  $('#pingText').textContent=val==null?'--':(Math.round(val)+'ms');
}
function pingRecordHost(peerId,rtt){
  hostRtts[peerId]=rtt;
  const vals=Object.values(hostRtts);
  pingMs=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  pingUpdatedAt=Date.now();
  updatePingUI();
}
function sendPings(){
  if(isHost){
    if(!room)return updatePingUI();
    if(Object.keys(conns).length===0){pingMs=0;pingUpdatedAt=Date.now();}
    else for(const id in conns){const c=conns[id];if(c&&c.open){try{c.send({t:'ping',ts:Date.now()});}catch(_){}}}
  }else if(hostConn&&hostConn.open){
    try{hostConn.send({t:'ping',ts:Date.now()});}catch(_){}
  }
  updatePingUI();
}

/* ---------------------------------------------------------------
   REDE (PeerJS)
--------------------------------------------------------------- */
function genCode(){let s='';for(let i=0;i<5;i++)s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];return s;}
function busy(msg){$('#busy').classList.toggle('on',!!msg);if(msg)$('#busyTxt').textContent=msg;}
let chatExpiryTimer=null;
function scheduleChatExpiry(at){
  const fireAt=at+CHAT_BUBBLE_MS;
  const delay=fireAt-Date.now();
  if(delay<=0)return;
  if(chatExpiryTimer&&chatExpiryTimer.fireAt<=fireAt)return;
  if(chatExpiryTimer)clearTimeout(chatExpiryTimer.id);
  const id=setTimeout(()=>{chatExpiryTimer=null;if(view&&view.phase==='playing')renderGame(view,view);},delay+30);
  chatExpiryTimer={id,fireAt};
}
function toast(msg,ms){
  const t=$('#toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),ms||2200);
}
function cleanName(n){return (n||'').replace(/\s+/g,' ').trim().slice(0,14);}
function saveName(n){try{localStorage.setItem('chroma-name',n);}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}

function createRoom(name,profile){
  isHost=true;myId='host';busy('Criando sala…');
  let giveUp=setTimeout(()=>{teardown('Não consegui falar com o servidor de conexão. Verifique a internet e tente de novo.');},15000);
  const attempt=n=>{
    const code=genCode();
    const pr=new Peer(APP+code,{config:{iceServers:ICE}});
    let opened=false;
    pr.on('open',()=>{
      opened=true;clearTimeout(giveUp);peer=pr;room=newRoom(code,name,profile);
      pr.on('connection',onGuestConn);
      busy(null);broadcast();
    });
    pr.on('error',e=>{
      if(!opened){
        try{pr.destroy();}catch(_){}
        if(e.type==='unavailable-id'&&n<6)return attempt(n+1);
        clearTimeout(giveUp);
        teardown('Não consegui criar a sala ('+e.type+'). Tente de novo.');
      }else console.warn('peer:',e);
    });
    pr.on('disconnected',()=>{if(opened&&!pr.destroyed){try{pr.reconnect();}catch(_){}}});
  };
  attempt(0);
}

function onGuestConn(conn){
  conn.on('data',d=>{
    if(!room||!d)return;
    if(d.t==='join'){
      if(room.phase!=='lobby')return refuse(conn,'A partida já começou.');
      if(room.players.length>=room.opts.maxPlayers)return refuse(conn,'A sala está cheia.');
      if(room.players.some(p=>p.id===conn.peer))return;
      const p={id:conn.peer,name:uniqueName(cleanName(d.name)||'Jogador'),photo:typeof d.photo==='string'?d.photo.slice(0,350000):'',gender:GENDER_EMOJI[d.gender]?d.gender:'',frame:safeFrameClass(d.frame),nameEffect:safeNameEffect(d.nameEffect),hand:[],bot:false,wins:0,called:false,team:teamForIndex(room.players.length,room.opts.mode)};
      room.players.push(p);conns[conn.peer]=conn;
      broadcast();
    }else if(d.t==='act'){
      if(!byId(conn.peer))return;
      const err=doAct(conn.peer,d.a||{});
      if(err){try{conn.send({t:'err',msg:err});}catch(_){}}else broadcast();
    }else if(d.t==='leave'){
      if(byId(conn.peer)){removePlayer(conn.peer);broadcast();}
    }else if(d.t==='ping'){
      try{conn.send({t:'pong',ts:d.ts});}catch(_){}
    }else if(d.t==='pong'){
      pingRecordHost(conn.peer,Date.now()-d.ts);
    }
  });
  conn.on('close',()=>{delete hostRtts[conn.peer];if(room&&byId(conn.peer)&&conns[conn.peer]===conn){removePlayer(conn.peer);broadcast();}});
  conn.on('error',e=>console.warn('conn:',e));
}
function refuse(conn,msg){
  try{conn.send({t:'err',msg,fatal:true});}catch(_){}
  setTimeout(()=>{try{conn.close();}catch(_){}},400);
}
function uniqueName(base){
  let n=base,k=2;
  while(room.players.some(p=>p.name.toLowerCase()===n.toLowerCase()))n=base.slice(0,12)+' '+(k++);
  return n;
}

function joinRoom(code,name,profile){
  isHost=false;joined=false;busy('Entrando na sala…');
  const fail=msg=>{clearTimeout(giveUp);teardown(msg);};
  const giveUp=setTimeout(()=>{if(!joined)fail('Não deu para conectar. Confira o código e a internet (algumas redes bloqueiam conexão direta).');},15000);
  const pr=new Peer({config:{iceServers:ICE}});
  peer=pr;
  pr.on('error',e=>{
    if(e.type==='peer-unavailable')fail('Sala não encontrada. Confira o código.');
    else if(!joined)fail('Erro de conexão ('+e.type+').');
    else console.warn('peer:',e);
  });
  pr.on('open',id=>{
    myId=id;
    const conn=pr.connect(APP+code,{reliable:true});
    hostConn=conn;
    conn.on('open',()=>conn.send({t:'join',name,photo:profile.photo,gender:profile.gender,frame:profile.frame,nameEffect:profile.nameEffect}));
    conn.on('data',d=>{
      if(!d)return;
      if(d.t==='state'){if(!joined){joined=true;clearTimeout(giveUp);busy(null);}render(d.s);}
      else if(d.t==='err'){if(d.fatal)fail(d.msg);else{cancelFly();warn(d.msg);}}
      else if(d.t==='eye')showEyeView(d.name,d.hand||[]);
      else if(d.t==='closed')teardown('O host encerrou a sala.');
      else if(d.t==='ping'){try{conn.send({t:'pong',ts:d.ts});}catch(_){}}
      else if(d.t==='pong'){pingMs=Date.now()-d.ts;pingUpdatedAt=Date.now();updatePingUI();}
    });
    conn.on('close',()=>{if(hostConn===conn)teardown('A conexão com a sala foi perdida.',3500);});
    conn.on('error',e=>console.warn('conn:',e));
  });
}

function send(a){
  if(isHost){const err=doAct('host',a);if(err){cancelFly();warn(err);}else broadcast();}
  else if(hostConn&&hostConn.open)hostConn.send({t:'act',a});
}
function teardown(msg,ms){
  clearTimeout(botTimer);clearInterval(clockTimer);clockTimer=null;killFly();dealing.clear();document.querySelectorAll('.flying').forEach(e=>e.remove());
  const p=peer;peer=null;hostConn=null;room=null;view=null;isHost=false;joined=false;
  for(const k in conns)delete conns[k];
  try{if(p)p.destroy();}catch(_){}
  lastTop=null;prevIds=new Set();wasMyTurn=false;
  pingMs=null;pingUpdatedAt=0;hostRtts={};updatePingUI();
  busy(null);show('home');
  if(msg)toast(msg,ms||3500);
}
function leave(){
  if(isHost){
    for(const k in conns){try{conns[k].send({t:'closed'});}catch(_){}}
    setTimeout(()=>teardown(),200);
  }else{
    try{hostConn.send({t:'leave'});}catch(_){}
    setTimeout(()=>teardown(),100);
  }
}

/* ---------------------------------------------------------------
   INTERFACE
--------------------------------------------------------------- */
