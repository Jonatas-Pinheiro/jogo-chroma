/* ===== XP, CÓDIGOS E MISSÕES — níveis, resgate de código promocional, missões diárias, recompensa de login ===== */
// ---- experiência, níveis e códigos promocionais ----
const MATCH_XP=50;
const REDEEM_CODES={
  CHROMA100:{type:'coins',amount:100},
  MOEDAS250:{type:'coins',amount:250},
  CARTAS500:{type:'coins',amount:500},
  CHROMA200:{type:'coins',amount:200},
  MOEDAS1000:{type:'coins',amount:1000},
  BEMVINDO:{type:'coins',amount:150},
  XP100:{type:'xp',amount:100},
  XP250:{type:'xp',amount:250},
  SUPERXP500:{type:'xp',amount:500},
  XP500:{type:'xp',amount:500},
  XP1000:{type:'xp',amount:1000},
  FESTACHROMA:{type:'coins',amount:750}
};
function readXP(){try{return Math.max(0,parseInt(localStorage.getItem('chroma-xp')||'0',10)||0);}catch(e){return 0;}}
function writeXP(n){try{localStorage.setItem('chroma-xp',String(Math.max(0,Math.floor(n))));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
const LOCKED_MODES=['caos','supercaos'];
const LEVEL_REWARDS={
  2:{coins:50,title:'Recompensa do nível 2',body:'Você alcançou o nível 2 e recebeu 50 moedas.'},
  3:{coins:75,title:'Recompensa do nível 3',body:'Você alcançou o nível 3 e recebeu 75 moedas.'},
  4:{coins:100,title:'Recompensa do nível 4',body:'Você alcançou o nível 4 e recebeu 100 moedas.'},
  5:{coins:150,title:'Recompensa do nível 5',body:'Você alcançou o nível 5 e recebeu 150 moedas. Os modos Caos e Super Caos foram desbloqueados.'},
  6:{coins:200,title:'Recompensa do nível 6',body:'Você alcançou o nível 6 e recebeu 200 moedas.'},
  7:{coins:250,title:'Recompensa do nível 7',body:'Você alcançou o nível 7 e recebeu 250 moedas.'},
  8:{coins:300,title:'Recompensa do nível 8',body:'Você alcançou o nível 8 e recebeu 300 moedas.'},
  9:{coins:400,title:'Recompensa do nível 9',body:'Você alcançou o nível 9 e recebeu 400 moedas.'},
  10:{item:'card-aurora',title:'Recompensa especial do nível 10',body:'Parabéns! Você alcançou o nível 10 e desbloqueou a skin de carta rara Cartas Aurora. Equipe-a na Loja.'}
};
function xpToReachLevel(level){const n=Math.max(1,Math.floor(level));return 50*n*(n-1);}
function xpForNextLevel(level){return Math.max(100,Math.floor(level)*100);}
function levelFromXP(xp){let level=1,value=Math.max(0,Math.floor(xp)||0);while(value>=xpToReachLevel(level+1))level++;return level;}
function renderProfileXP(){
  const xp=readXP(),level=levelFromXP(xp),base=xpToReachLevel(level),needed=xpForNextLevel(level),current=Math.max(0,xp-base),el=$('#profileXpFill');
  if(!el)return;
  $('#profileLevel').textContent='Nível '+level;
  $('#profileXpText').textContent=current+' / '+needed+' XP';
  $('#profileXpNext').textContent='Nível '+(level+1);
  el.style.width=Math.min(100,(current/needed)*100)+'%';
}
function readLevelRewards(){try{return JSON.parse(localStorage.getItem('chroma-level-rewards')||'[]');}catch(e){return [];}}
function writeLevelRewards(a){try{localStorage.setItem('chroma-level-rewards',JSON.stringify(a));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function ensureLevelRewards(){
  const level=levelFromXP(readXP()),claimed=readLevelRewards(),shop=readShop();
  let coinsAdded=0,shopChanged=false;
  Object.keys(LEVEL_REWARDS).map(Number).sort((a,b)=>a-b).forEach(levelReward=>{
    if(levelReward>level||claimed.includes(levelReward))return;
    const reward=LEVEL_REWARDS[levelReward];
    if(reward.coins){writeCoins(readCoins()+reward.coins);coinsAdded+=reward.coins;}
    if(reward.item&&!shop.owned.includes(reward.item)){shop.owned.push(reward.item);shopChanged=true;}
    const mailId='level-reward-'+levelReward;
    if(!MAIL_MESSAGES.some(m=>m.id===mailId))MAIL_MESSAGES.push({id:mailId,title:reward.title,date:new Date().toLocaleDateString('pt-BR'),body:reward.body});
    claimed.push(levelReward);
  });
  if(shopChanged)writeShop(shop);
  writeLevelRewards(claimed);
  if(coinsAdded)updateCoinHud(true);
}
function isModeLocked(mode){return LOCKED_MODES.includes(mode)&&levelFromXP(readXP())<5;}
function updateModeLockUI(){
  const lockedByLevel=levelFromXP(readXP())<5;
  document.querySelectorAll('input[name=mode]').forEach(r=>{
    const locked=lockedByLevel&&LOCKED_MODES.includes(r.value),card=r.closest('.mode-card');
    r.disabled=!isHost||locked;
    if(card){card.classList.toggle('is-locked',locked);const lock=card.querySelector('.mode-lock');if(lock)lock.hidden=!locked;}
  });
}
function addXP(amount,reason){
  const before=readXP(),after=before+Math.max(0,Math.floor(amount));writeXP(after);ensureLevelRewards();renderProfileXP();updateModeLockUI();
  if(reason)toast('+'+Math.floor(amount)+' XP · '+reason);
}
function readRedeemedCodes(){try{return JSON.parse(localStorage.getItem('chroma-redeemed-codes')||'[]');}catch(e){return [];}}
function writeRedeemedCodes(a){try{localStorage.setItem('chroma-redeemed-codes',JSON.stringify(a));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function redeemCode(){
  const input=$('#redeemCode');if(!input)return;
  const code=(input.value||'').trim().toUpperCase();
  if(!code){toast('Digite um código');input.focus();return;}
  const reward=REDEEM_CODES[code];
  if(!reward){toast('Código inválido ou inexistente');return;}
  const used=readRedeemedCodes();
  if(used.includes(code)){toast('Esse código já foi resgatado');return;}
  used.push(code);writeRedeemedCodes(used);
  if(reward.type==='coins'){writeCoins(readCoins()+reward.amount);updateCoinHud(true);toast('Código resgatado: +'+reward.amount+' moedas');}
  else{addXP(reward.amount,'código '+code);}
  input.value='';renderProfileXP();
}
function xpMultiplier(){const st=readShop(),now=Date.now();return Number(st.activePotionUntil)>now?2:1;}
function awardMatchXP(v,prev){
  if(!v||v.phase!=='ended'||!prev||prev.phase!=='playing'||!v.roundId)return;
  const key='chroma-xp-awarded-'+v.roundId;
  try{if(localStorage.getItem(key)==='1')return;localStorage.setItem(key,'1');}catch(e){}
  const won=v.winner===v.me,mult=xpMultiplier(),amount=(won?MATCH_XP*2:MATCH_XP)*mult;
  addXP(amount,(mult===2?'poção 2× · ':'')+(won?'vitória!':'partida concluída'));
  bumpMissionStat('played',1);
  if(won)bumpMissionStat('wins',1);
}
function canClaimDaily(){const s=readStreak();return s.lastClaim!==todayKey();}

// ---- missões diárias ----
const DAILY_MISSIONS=[
 {id:'play-1',desc:'Jogue 1 partida',goal:1,stat:'played',reward:20,icon:''},
 {id:'play-3',desc:'Jogue 3 partidas',goal:3,stat:'played',reward:50,icon:''},
 {id:'win-1',desc:'Vença 1 partida',goal:1,stat:'wins',reward:60,icon:''},
 {id:'play-5',desc:'Jogue 5 partidas',goal:5,stat:'played',reward:100,icon:'⭐'}
];
function readMissions(){
  const today=todayKey();
  let st;
  try{st=JSON.parse(localStorage.getItem('chroma-missions')||'null');}catch(e){st=null;}
  if(!st||st.day!==today)st={day:today,progress:{},claimed:[]};
  return st;
}
function writeMissions(st){try{localStorage.setItem('chroma-missions',JSON.stringify(st));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function bumpMissionStat(stat,amount){
  const st=readMissions();
  st.progress[stat]=(st.progress[stat]||0)+amount;
  writeMissions(st);
}
function claimMission(id){
  const m=DAILY_MISSIONS.find(x=>x.id===id);if(!m)return;
  const st=readMissions();
  const val=st.progress[m.stat]||0;
  if(val<m.goal||st.claimed.includes(id))return;
  st.claimed.push(id);writeMissions(st);
  writeCoins(readCoins()+m.reward);
  updateCoinHud(true);
  toast('+'+m.reward+' moedas — '+m.desc);
  renderMissions();
}
function renderMissions(){
  const list=$('#missionList');if(!list)return;
  const st=readMissions();
  list.innerHTML=DAILY_MISSIONS.map(m=>{
    const val=Math.min(m.goal,st.progress[m.stat]||0);
    const done=val>=m.goal;
    const claimed=st.claimed.includes(m.id);
    const pct=Math.round((val/m.goal)*100);
    return '<div class="mission-item'+(done?' done':'')+'"><span class="mission-ico">'+m.icon+'</span><div class="mission-body"><b>'+m.desc+'</b><div class="mission-track"><i style="width:'+pct+'%"></i></div><div class="mission-meta"><span>'+val+'/'+m.goal+'</span><span class="mission-reward"> +'+m.reward+'</span></div></div><button class="mission-claim'+(claimed?' claimed':'')+'" data-claim-mission="'+m.id+'" '+((!done||claimed)?'disabled':'')+'>'+(claimed?'Resgatado ':'Coletar')+'</button></div>';
  }).join('');
}

function renderRewards(){
  const s=readStreak();const today=todayKey();
  const row=$('#streakRow');if(row){
    row.innerHTML=DAILY_REWARD_AMOUNTS.map((amt,i)=>{
      const dayNum=i+1;
      const completed=s.lastClaim!==null && dayNum<=s.day;
      const isToday=canClaimDaily()&&dayNum===((s.day%7)+1);
      return '<div class="streak-day'+(completed?' done':'')+(isToday?' today':'')+'"><span class="sd-n">Dia '+dayNum+'</span><span class="sd-ico">'+(completed?'':'')+'</span><span class="sd-amt">+'+amt+'</span></div>';
    }).join('');
  }
  const btn=$('#btnClaimDaily');
  if(btn){
    const can=canClaimDaily();
    btn.disabled=!can;
    btn.textContent=can?'Coletar':'Coletado hoje ';
  }
  updateCoinHud(false);
  renderMissions();
}
function claimDaily(e){
  if(!canClaimDaily())return;
  const s=readStreak();const today=todayKey();
  let nextDay;
  if(s.lastClaim && daysBetween(s.lastClaim,today)===1){nextDay=(s.day%7)+1;}
  else{nextDay=1;}
  const amount=DAILY_REWARD_AMOUNTS[nextDay-1];
  writeStreak({day:nextDay,lastClaim:today});
  writeCoins(readCoins()+amount);
  flyCoins(e&&e.currentTarget?e.currentTarget:$('#btnClaimDaily'),$('#coinHud'));
  renderRewards();
}
function flyCoins(fromEl,toEl){
  if(!fromEl||!toEl)return;
  const from=fromEl.getBoundingClientRect(),to=toEl.getBoundingClientRect();
  const startX=from.left+from.width/2,startY=from.top+from.height/2;
  const endX=to.left+to.width/2,endY=to.top+to.height/2;
  const count=8;
  for(let i=0;i<count;i++){
    const el=document.createElement('div');
    el.className='coin-fly';el.textContent='';
    document.body.appendChild(el);
    const jx=(Math.random()-.5)*60,jy=(Math.random()-.5)*40;
    const delay=i*45;
    el.style.transform='translate('+startX+'px,'+startY+'px) scale(1)';
    el.style.opacity='1';
    el.style.transition='transform .6s cubic-bezier(.2,.7,.3,1) '+delay+'ms, opacity .6s ease '+delay+'ms';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      el.style.transform='translate('+(startX+jx)+'px,'+(startY+jy-30)+'px) scale(1.2)';
    }));
    setTimeout(()=>{
      el.style.transform='translate('+endX+'px,'+endY+'px) scale(.4)';
      el.style.opacity='0';
    },140+delay);
    setTimeout(()=>{el.remove();if(i===count-1)updateCoinHud(true);},760+delay);
  }
  if(count===0)updateCoinHud(true);
}
