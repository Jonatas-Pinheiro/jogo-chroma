/* ===== NOTIFICAÇÕES PUSH — entrega somente quando o CHROMA está fora de uso ===== */
(function initChromaPush(){
  'use strict';
  const STORAGE='chroma-push-state-v1';
  const ICON='icon-192.png';
  window.CHROMA_PUSH_VAPID_KEY=window.CHROMA_PUSH_VAPID_KEY||'';
  const TYPES={
    reward:{title:'Recompensa disponível',emoji:'🎁',image:'MOEDA-E-RECOMPENSAS.png',route:'rewards',message:n=>n>1?`Você tem ${n} recompensas prontas para coletar.`:'Uma recompensa está pronta para coletar.'},
    ranking:{title:'Você foi ultrapassado',emoji:'🏆',image:'RANQUEADO-OU-PLACAR.png',route:'ranking',message:name=>`${name||'Outro jogador'} ultrapassou sua posição no ranking.`},
    season:{title:'Nova temporada disponível',emoji:'🌌',image:'PASSE-DE-BATALHA.png',route:'battlePass',message:name=>name?`A temporada ${name} já está disponível.`:'Uma nova temporada já está disponível.'},
    gift:{title:'Presente recebido',emoji:'🎁',image:'SOCIAL.png',route:'mail',message:name=>`${name||'Um amigo'} enviou um presente para você.`}
  };
  const getState=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch(_){return {}}};
  let state=load(), pollTimer=null, checking=false, ready=false;
  function load(){const x=getState();return {permission:x.permission||'default',enabled:x.enabled!==false,last:{...(x.last||{})},seenGifts:Array.isArray(x.seenGifts)?x.seenGifts:[],rankPosition:Number(x.rankPosition||0)||0,season:x.season||''};}
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify({...state,seenGifts:state.seenGifts.slice(-100)}));}catch(_){} }
  function inUse(){return document.visibilityState==='visible'&&!document.hidden&&document.hasFocus();}
  function supported(){return 'Notification' in window&&'serviceWorker' in navigator;}
  function outsideGame(){return !inUse();}
  function dedupeKey(type,key){return type+':'+String(key||'general');}
  function canSend(type,key){const k=dedupeKey(type,key),last=Number(state.last[k]||0);return Date.now()-last>24*60*60*1000;}
  function mark(type,key){state.last[dedupeKey(type,key)]=Date.now();save();}
  async function show(type,key,extra){
    if(!outsideGame()||!state.enabled||!supported()||Notification.permission!=='granted'||!canSend(type,key))return false;
    const t=TYPES[type];if(!t)return false;
    const title=t.emoji+' '+t.title,body=t.message(extra);mark(type,key);
    try{const reg=await navigator.serviceWorker.ready;await reg.showNotification(title,{body,icon:t.image||ICON,badge:ICON,tag:'chroma-'+type+'-'+String(key||'general'),renotify:false,data:{route:t.route,type,key}});return true;}
    catch(e){console.warn('[CHROMA PUSH] Não foi possível mostrar a notificação:',e);return false;}
  }
  async function requestPermission(){
    if(!supported())return {ok:false,message:'Este navegador não oferece notificações.'};
    try{const permission=await Notification.requestPermission();state.permission=permission;state.enabled=permission==='granted';save();updateUi();return {ok:permission==='granted',message:permission==='granted'?'Notificações ativadas.':'Permissão não concedida.'};}
    catch(e){return {ok:false,message:'Não foi possível pedir permissão neste navegador.'};}
  }
  async function registerSubscription(){
    if(!state.enabled||Notification.permission!=='granted'||!navigator.serviceWorker)return false;
    try{
      const reg=await navigator.serviceWorker.ready;
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:window.CHROMA_PUSH_VAPID_KEY||undefined});
      if(window.chromaCloud?.registerPushSubscription)await window.chromaCloud.registerPushSubscription(sub);
      return true;
    }catch(e){console.warn('[CHROMA PUSH] Assinatura indisponível:',e);return false;}
  }
  function updateUi(){
    const button=document.getElementById('pushEnable'),status=document.getElementById('pushStatus');if(!button||!status)return;
    if(!supported()){button.disabled=true;button.textContent='Indisponível';status.textContent='Este navegador não oferece notificações PUSH.';return;}
    if(Notification.permission==='granted'&&state.enabled){button.disabled=false;button.textContent='Notificações ativadas';status.textContent='O CHROMA só enviará avisos quando não estiver em uso.';registerSubscription();return;}
    if(Notification.permission==='denied'){button.disabled=true;button.textContent='Permissão bloqueada';status.textContent='Permita notificações nas configurações do navegador para ativá-las.';return;}
    button.disabled=false;button.textContent='Ativar notificações';status.textContent='Receba avisos de recompensas, ranking, temporadas e presentes fora do jogo.';
  }
  async function checkRewards(){
    let count=0;try{if(typeof canClaimDaily==='function'&&canClaimDaily())count++;const st=typeof readMissions==='function'?readMissions():null;if(st&&typeof DAILY_MISSIONS!=='undefined'){count+=DAILY_MISSIONS.filter(m=>!st.claimed.includes(m.id)&&Number(st.progress[m.stat]||0)>=m.goal).length;}const bp=typeof readBattlePass==='function'?readBattlePass():null;if(bp&&typeof BATTLE_PASS_REWARDS!=='undefined'){const level=typeof battlePassLevel==='function'?battlePassLevel(bp.xp):0;count+=BATTLE_PASS_REWARDS.filter(r=>r.level<=level&&!bp.claimed.includes(r.level)).length;}}catch(_){}
    if(count>0)await show('reward',String(count),count);return count;
  }
  async function checkGifts(){
    if(!window.chromaSocial?.isReady)return;try{const gifts=await window.chromaSocial.gifts(),pending=gifts.filter(g=>g.status==='pending');for(const g of pending){if(!state.seenGifts.includes(g.id)){state.seenGifts.push(g.id);save();await show('gift',g.id,g.senderName);}}}catch(_){}
  }
  async function checkRanking(){
    if(!window.chromaCloud?.readRankedBoard||!window.firebaseCurrentUserUid)return;try{const board=await window.chromaCloud.readRankedBoard(),name=(localStorage.getItem('chroma-name')||'').toLowerCase(),me=board.find(x=>x.uid===window.firebaseCurrentUserUid||String(x.name||'').toLowerCase()===name);if(!me)return;const pos=board.filter(x=>Number(x.points||0)>Number(me.points||0)).length+1;if(state.rankPosition&&pos<state.rankPosition)state.rankPosition=pos;if(pos>state.rankPosition&&state.rankPosition>0){const ahead=board.find(x=>Number(x.points||0)>Number(me.points||0));await show('ranking',`${ahead?.uid||ahead?.name||pos}-${pos}`,ahead?.name);}state.rankPosition=pos;save();}catch(_){}
  }
  async function checkSeason(){
    try{const bp=typeof readBattlePass==='function'?readBattlePass():null,season=String(bp?.season||'');if(!season)return;if(state.season&&state.season!==season)await show('season',season,season);state.season=season;save();}catch(_){}
  }
  async function check(){if(checking||!outsideGame())return;checking=true;try{await checkRewards();await checkGifts();await checkRanking();await checkSeason();}finally{checking=false;}}
  function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(()=>{if(document.hidden||!document.hasFocus())check();},45000);}
  function navigate(route){
    if(typeof window.chromaOpenScreen==='function')window.chromaOpenScreen(route);
    else if(typeof show==='function')show(route);
  }
  navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='CHROMA_NOTIFICATION_CLICK')navigate(e.data.route);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)check();else updateUi();});
  window.addEventListener('focus',updateUi);
  function bindAuth(){if(window.chromaAuth?.subscribe)window.chromaAuth.subscribe(()=>registerSubscription());}
  window.addEventListener('chroma-auth-state',()=>{ready=true;registerSubscription();});
  window.chromaPush={requestPermission,check,show,updateUi,isInUse:inUse,enabled:()=>state.enabled&&Notification.permission==='granted'};
  function boot(){ready=true;state.permission=Notification.permission||state.permission;state.enabled=state.permission==='granted'&&state.enabled!==false;save();updateUi();startPolling();bindAuth();const route=new URLSearchParams(location.search).get('notification');if(route)setTimeout(()=>navigate(route),700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  setTimeout(()=>{if(ready)registerSubscription();},2500);
  document.addEventListener('click',async e=>{if(e.target?.closest?.('#pushEnable')){const r=await requestPermission();if(r.ok)await registerSubscription();updateUi();if(!r.ok&&typeof toast==='function')toast(r.message,4500);}},true);
})();
