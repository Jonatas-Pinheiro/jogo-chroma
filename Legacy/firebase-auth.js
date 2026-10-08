import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, linkWithCredential, signOut, sendPasswordResetEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app), googleProvider=new GoogleAuthProvider();
const authPersistenceReady=setPersistence(auth,browserLocalPersistence).catch(e=>{reportError('setPersistence',e);});   // falha de persistência é registrada (o Auth usa a persistência padrão do SDK)
const $=s=>document.querySelector(s);
const keys={coins:'chroma-coins',xp:'chroma-xp',shop:'chroma-shop',name:'chroma-name',username:'chroma-username',photo:'chroma-profile-photo',gender:'chroma-profile-gender',streak:'chroma-daily-streak',levelRewards:'chroma-level-rewards',redeemedCodes:'chroma-redeemed-codes',missions:'chroma-missions',ranking:'chroma-ranking',ranked:'chroma-ranked',mailRead:'chroma-mail-read',friends:'chroma-friends',battlePass:'chroma-battle-pass'};
const defaultShop=()=>({owned:[],equipped:{profile:'',cards:'','name-effect':'', 'profile-theme':'','profile-badge':''},potions:[]});
function json(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){return fallback;}}
function localState(){const shop=json(keys.shop,defaultShop()),name=localStorage.getItem(keys.name)||'';let rank='Prata I';try{if(typeof rankedStats==='function'&&typeof rankedTier==='function'){const tier=rankedTier(rankedStats(name).points);rank=tier.name+' '+tier.level;}}catch(e){reportError('localStateRank',e);}return {coins:Number(localStorage.getItem(keys.coins)||0)||0,xp:Number(localStorage.getItem(keys.xp)||0)||0,level:typeof levelFromXP==='function'?levelFromXP(Number(localStorage.getItem(keys.xp)||0)||0):1,rank,cosmetics:Array.isArray(shop.owned)?shop.owned:[],equipped:shop.equipped||{},shop,name,username:localStorage.getItem(keys.username)||'',photo:localStorage.getItem(keys.photo)||'',gender:localStorage.getItem(keys.gender)||'',streak:json(keys.streak,{day:0,lastClaim:null}),levelRewards:json(keys.levelRewards,[]),redeemedCodes:json(keys.redeemedCodes,[]),missions:json(keys.missions,null),ranking:json(keys.ranking,[]),ranked:json(keys.ranked,[]),mailRead:json(keys.mailRead,[]),friends:json(keys.friends,{friends:[],requests:[],sent:[]}),battlePass:json(keys.battlePass,{season:'s1',xp:0,claimed:[],daily:{period:'',progress:{},claimed:[]},weekly:{period:'',progress:{},claimed:[]}}),gameStats:json('chroma-game-stats',{}),showcaseAchievements:json('chroma-showcase-achievements',[]),cardsPlayed:Number(localStorage.getItem('chroma-cards-played')||0)||0,flags:{psicopata:localStorage.getItem('chroma-flag-psicopata')==='1'}};}
function writeLocal(data){if(data.coins!=null)localStorage.setItem(keys.coins,String(data.coins));if(data.xp!=null)localStorage.setItem(keys.xp,String(data.xp));if(data.shop)localStorage.setItem(keys.shop,JSON.stringify({...defaultShop(),...data.shop,equipped:{...defaultShop().equipped,...(data.shop.equipped||{})}}));for(const k of ['streak','levelRewards','redeemedCodes','missions','ranking','ranked','mailRead','friends'])if(data[k]!==undefined)localStorage.setItem(keys[k],JSON.stringify(data[k]));const remoteBattlePass=data.missions?.__battlePass||data.battlePass;if(remoteBattlePass!==undefined)localStorage.setItem(keys.battlePass,JSON.stringify(remoteBattlePass));if(data.gameStats!==undefined)localStorage.setItem('chroma-game-stats',JSON.stringify(data.gameStats));if(data.showcaseAchievements!==undefined)localStorage.setItem('chroma-showcase-achievements',JSON.stringify(data.showcaseAchievements));if(data.cardsPlayed!=null)localStorage.setItem('chroma-cards-played',String(data.cardsPlayed));if(data.flags?.psicopata!=null)localStorage.setItem('chroma-flag-psicopata',data.flags.psicopata?'1':'0');for(const k of ['name','username','photo','gender'])if(data[k]!==undefined)localStorage.setItem(keys[k],data[k]||'');}

/* ===== SESSÃO / ESTADOS =====
   Autenticação (quem é o usuário) e perfil Firestore (dados da conta) são conceitos separados:

   AUTH_LOADING                  Firebase ainda restaurando a sessão (onAuthStateChanged não respondeu)
   UNAUTHENTICATED               Firebase confirmou: não há usuário
   AUTHENTICATED_LOADING_PROFILE usuário confirmado (UID válido); users/{uid} sendo carregado/criado
   AUTHENTICATED                 usuário confirmado E perfil carregado  -> único estado em que canWrite() é true
   AUTHENTICATED_PROFILE_ERROR   usuário confirmado, mas ler/criar users/{uid} falhou (erro REAL em sessionError)
   AUTH_ERROR                    o próprio observador do Firebase Auth reportou erro

   Um erro de Firestore NUNCA derruba a identidade: currentUser continua valendo nos estados de erro de perfil. */
const STATE={LOADING:'AUTH_LOADING',UNAUTHENTICATED:'UNAUTHENTICATED',PROFILE_LOADING:'AUTHENTICATED_LOADING_PROFILE',READY:'AUTHENTICATED',PROFILE_ERROR:'AUTHENTICATED_PROFILE_ERROR',AUTH_ERROR:'AUTH_ERROR'};
const CACHE_OWNER='chroma-cache-owner';          // UID dono dos dados em cache no localStorage (NÃO prova autenticação)
const CACHE_KEYS=[...Object.values(keys),'chroma-game-stats','chroma-showcase-achievements','chroma-cards-played','chroma-flag-psicopata','chroma-clan-id'];
const SYNC_DEBOUNCE_MS=400, RETRY_DELAYS=[3000,10000,30000];
let currentUser=null, authState=STATE.LOADING, sessionError=null, sessionToken=0, applyingRemote=false, pendingGoogle=null;
let syncChain=Promise.resolve(), syncTimer=null, retryTimer=null, retryCount=0, lastPublishedSig='', lastRankedBoardSig='', lastToast='', publishInFlight=null;
const listeners=new Set();

class ChromaError extends Error{constructor(message,code='chroma/validation'){super(message);this.name='ChromaError';this.code=code;}}
const staleError=()=>new ChromaError('A conta mudou durante a operação; ela foi descartada para não afetar a conta atual.','chroma/stale-session');

/* ===== CLASSIFICAÇÃO CENTRAL DE ERROS =====
   Preserva o erro original (info.original) e devolve {kind, code, message, retryable}.
   Nenhuma mensagem de "internet" é usada para permission-denied; nenhuma mensagem de "deslogado" para usuário autenticado. */
function classifyError(e,ctx={}){
  const code=String(e&&e.code||'').toLowerCase().replace(/^firestore\//,'');
  const what=ctx.what||'a esta operação';
  const detail=String(e&&e.message||e||'').trim();
  const host=(typeof location!=='undefined'&&location.hostname)||'este domínio';
  let kind='unknown',message='';
  switch(code){
    case 'auth/invalid-credential':kind='auth-credentials';message='E-mail ou senha incorretos.';break;
    case 'auth/user-not-found':kind='auth-credentials';message='Não existe conta com este e-mail. Use “Criar conta”.';break;
    case 'auth/wrong-password':kind='auth-credentials';message='Senha incorreta.';break;
    case 'auth/email-already-in-use':kind='auth-credentials';message='Este e-mail já está cadastrado. Entre com e-mail e senha ou com o Google.';break;
    case 'auth/weak-password':kind='auth-credentials';message='A senha precisa ter pelo menos 6 caracteres.';break;
    case 'auth/invalid-email':kind='auth-credentials';message='Digite um e-mail válido.';break;
    case 'auth/missing-password':kind='auth-credentials';message='Informe a senha.';break;
    case 'auth/user-disabled':kind='auth-credentials';message='Esta conta foi desativada.';break;
    case 'auth/too-many-requests':kind='auth-credentials';message='Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';break;
    case 'auth/account-exists-with-different-credential':kind='auth-credentials';message='Esta conta já existe com outro método de login. Entre com e-mail e senha para vincular o Google.';break;
    case 'auth/credential-already-in-use':kind='auth-credentials';message='Esta credencial já está vinculada a outra conta.';break;
    case 'auth/popup-closed-by-user':kind='auth-popup';message='A janela do Google foi fechada antes da conclusão.';break;
    case 'auth/cancelled-popup-request':kind='auth-popup';message='Outra janela de login foi aberta. Tente novamente.';break;
    case 'auth/popup-blocked':kind='auth-popup';message='O navegador bloqueou a janela do Google. Permita pop-ups para este site.';break;
    case 'auth/unauthorized-domain':kind='auth-config';message='O domínio “'+host+'” não está autorizado no Firebase Authentication (Console → Authentication → Settings → Authorized domains).';break;
    case 'auth/operation-not-allowed':kind='auth-config';message='Este método de login não está ativado no Firebase (Console → Authentication → Sign-in method).';break;
    case 'auth/operation-not-supported-in-this-environment':kind='auth-config';message='Este ambiente não suporta o login do Firebase. Abra o jogo por http(s), não por arquivo local.';break;
    case 'auth/invalid-api-key':case 'auth/internal-error':kind='auth-config';message='Configuração do Firebase inválida ('+code+'). Verifique firebase-config.js.';break;
    case 'auth/network-request-failed':case 'network':kind='network';message='Falha de rede ao falar com o Firebase Authentication. Tente novamente.';break;
    case 'permission-denied':kind='permission';message='Conta autenticada, mas o Firebase recusou o acesso '+what+' (permission-denied). As regras do Firestore precisam permitir esta operação.';break;
    case 'unauthenticated':kind='unauthenticated';message='O Firebase não aceitou a credencial desta sessão (unauthenticated). Saia da conta e entre novamente.';break;
    case 'unavailable':kind='network';message='Não foi possível se comunicar com o Firebase (unavailable). Sua conta continua conectada; tente novamente em instantes.';break;
    case 'deadline-exceeded':kind='network';message='O Firebase demorou demais para responder (deadline-exceeded). Tente novamente.';break;
    case 'failed-precondition':kind='precondition';message=/index/i.test(detail)?'O Firestore precisa de um índice para esta consulta (failed-precondition). Crie o índice no Console do Firebase.':'O Firestore recusou a operação por pré-condição (failed-precondition). Verifique a configuração do projeto Firebase.';break;
    case 'aborted':kind='conflict';message='A operação conflitou com outra alteração simultânea (aborted). Tente novamente.';break;
    case 'resource-exhausted':kind='quota';message='O limite de uso do Firebase foi atingido (resource-exhausted). Tente mais tarde.';break;
    case 'not-found':kind='not-found';message='O Firestore não encontrou o documento pedido (not-found).';break;
    default:
      if(code.startsWith('chroma/')){kind='app';message=detail;}
      else if(code){kind='unknown';message='Erro do Firebase ('+code+'): '+detail;}
      else if(/failed to fetch|networkerror|network error/i.test(detail)){kind='network';message='Falha de rede ao carregar recursos do Firebase. Verifique a conexão e tente novamente.';}
      else{kind='unknown';message=detail?'Erro inesperado: '+detail:'Erro inesperado sem detalhes.';}
  }
  return {kind,code:code||'unknown',message,retryable:kind==='network'||kind==='conflict',original:e};
}
function describeError(e,action){const info=classifyError(e);return info.kind==='unknown'&&action?'Falha ao '+action+': '+info.message:info.message;}
const friendlyError=e=>classifyError(e).message;
function isDev(){try{return ['localhost','127.0.0.1','[::1]',''].includes(location.hostname)||/[?&]debug\b/.test(location.search)||localStorage.getItem('chroma-debug')==='1';}catch(_){return false;}}
function reportError(context,e,ctx){const info=classifyError(e,ctx);if(isDev())console.error('[CHROMA]',context,info.kind,info.code,e);else console.warn('[CHROMA] '+context+': '+info.kind+' ('+info.code+')');return info;}
function notify(text){if(typeof window.toast==='function'&&text!==lastToast){lastToast=text;window.toast(text);}}
function surface(info){accountMessage(info.message,true);notify(info.message);}
function backgroundFailure(context,e,ctx){const info=reportError(context,e,ctx);window.firebaseBackgroundError={context,kind:info.kind,code:info.code,message:info.message};surface(info);return info;}

/* ===== SESSÃO: todo trabalho assíncrono guarda {token,uid} e confere antes de aplicar o resultado ===== */
const snapshot=()=>({token:sessionToken,uid:currentUser?currentUser.uid:null});
const isCurrent=s=>!!s&&!!s.uid&&s.token===sessionToken&&!!currentUser&&currentUser.uid===s.uid;
function canWrite(){return authState===STATE.READY&&!!currentUser;}
function writeBlock(){
  switch(authState){
    case STATE.LOADING:return new ChromaError('Verificando sua sessão no Firebase… aguarde um instante.','chroma/auth-loading');
    case STATE.UNAUTHENTICATED:return new ChromaError('Entre na sua conta para continuar.','chroma/unauthenticated');
    case STATE.PROFILE_LOADING:return new ChromaError('Conta autenticada. Carregando seu perfil… aguarde um instante.','chroma/profile-loading');
    case STATE.PROFILE_ERROR:return new ChromaError(sessionError?sessionError.message:'Conta autenticada, mas o perfil não pôde ser carregado.','chroma/profile-error');
    case STATE.AUTH_ERROR:return new ChromaError(sessionError?sessionError.message:'Erro de autenticação no Firebase.','chroma/auth-error');
    default:return new ChromaError('A conta ainda não está pronta para esta operação.','chroma/not-ready');
  }
}
function authUnavailableMessage(){return writeBlock().message;}
function assertWritable(){if(!canWrite())throw writeBlock();}
function emit(){const info={state:authState,uid:currentUser?currentUser.uid:'',canWrite:canWrite(),error:sessionError};for(const fn of [...listeners]){try{fn(info);}catch(e){reportError('subscriber',e);}}}
function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function refreshSocialViews(){try{if(typeof window.renderSocial==='function')window.renderSocial();}catch(e){reportError('renderSocial',e);}}
function setState(next,err=null){authState=next;sessionError=err;updateAccountUI();emit();refreshSocialViews();}

function usernameFromUser(user){return String(user.displayName||user.email?.split('@')[0]||'jogador').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/g,'').slice(0,18)||'jogador';}
function accountMessage(text,error=false){const el=$('#accountMsg');if(el){el.textContent=text;el.className='account-msg'+(error?' error':'');}}
function defaultProfile(user){const shop=defaultShop();return {uid:user.uid,email:user.email||'',username:usernameFromUser(user),coins:0,xp:0,level:1,rank:'Prata I',cosmetics:[],equipped:{},shop,name:user.displayName||'',photo:user.photoURL||'',gender:'',streak:{day:0,lastClaim:null},levelRewards:[],redeemedCodes:[],missions:null,ranking:[],ranked:[],mailRead:[],friends:{friends:[],requests:[],sent:[]},battlePass:{season:'s1',xp:0,claimed:[],daily:{period:'',progress:{},claimed:[]},weekly:{period:'',progress:{},claimed:[]}},gameStats:{},showcaseAchievements:[],cardsPlayed:0,flags:{psicopata:false},createdAt:serverTimestamp(),updatedAt:serverTimestamp()};}
function cloudPayload(uid){const s=localState();const missions={...(s.missions||{}),__battlePass:s.battlePass};const payload={...s,uid,email:currentUser&&currentUser.uid===uid?currentUser.email||'':'',cosmetics:Array.isArray(s.shop?.owned)?s.shop.owned:[],equipped:s.shop?.equipped||{},missions,updatedAt:serverTimestamp()};delete payload.battlePass;return payload;}
function updateAccountUI(){
  const email=currentUser&&currentUser.email||'';
  window.firebaseCurrentUserEmail=email;window.firebaseCurrentUserUid=currentUser&&currentUser.uid||'';window.firebaseAuthState=authState;window.firebaseAuthError=sessionError?sessionError.message:'';
  const status=$('#accountStatus'),open=$('#accountOpen'),out=$('#accountLogout'),who=currentUser?(email||'conectada'):'';
  const label={[STATE.LOADING]:'Verificando sessão…',[STATE.UNAUTHENTICATED]:'Progresso local — entre para salvar na nuvem',[STATE.PROFILE_LOADING]:'Conta: '+who+' — carregando perfil…',[STATE.READY]:'Conta: '+who,[STATE.PROFILE_ERROR]:'Conta: '+who+(sessionError&&sessionError.kind==='network'?' — sem comunicação com o Firebase':' — perfil indisponível'),[STATE.AUTH_ERROR]:'Erro de autenticação — recarregue a página'}[authState];
  if(status)status.textContent=label;
  if(open){open.textContent=authState===STATE.LOADING?'Verificando sessão…':currentUser?'Gerenciar conta':'Entrar ou criar conta';open.disabled=authState===STATE.LOADING;}
  if(out)out.hidden=!currentUser;
  document.documentElement.classList.toggle('firebase-ready',canWrite());
}

/* ===== CACHE LOCAL (espelho dos dados da conta) ===== */
function withRemoteGuard(fn){const prev=applyingRemote;applyingRemote=true;try{return fn();}finally{applyingRemote=prev;}}
function refreshGameAfterCloud(){try{if($('#inName'))$('#inName').value=localStorage.getItem(keys.name)||'';if($('#profileGender'))$('#profileGender').value=localStorage.getItem(keys.gender)||'';const photo=localStorage.getItem(keys.photo)||'';if(photo&&$('#profilePreview'))$('#profilePreview').innerHTML='<img src="'+photo.replace(/"/g,'&quot;')+'" alt="Foto de perfil">';if(typeof updateCoinHud==='function')updateCoinHud(false);if(typeof renderProfileXP==='function')renderProfileXP();if(typeof updateModeLockUI==='function')updateModeLockUI();if(typeof applyCosmetics==='function')applyCosmetics();if(typeof renderShop==='function')renderShop();if(typeof renderProfile==='function')renderProfile();if(typeof renderInventory==='function')renderInventory();if(typeof renderBattlePass==='function'&&$('#battlePass')?.classList.contains('on'))renderBattlePass();if(typeof updateMailBadge==='function')updateMailBadge();}catch(e){reportError('refreshGameAfterCloud',e);}}
function clearCloudCache(){withRemoteGuard(()=>{for(const k of CACHE_KEYS)localStorage.removeItem(k);localStorage.removeItem(CACHE_OWNER);window._socialSearch={};refreshGameAfterCloud();});lastPublishedSig='';lastRankedBoardSig='';}
function applyRemote(data,user){
  clearTimeout(syncTimer);syncTimer=null;                      // o que estava agendado partiu de dados locais antigos
  withRemoteGuard(()=>{if(localStorage.getItem(CACHE_OWNER)!==user.uid)clearCloudCache();writeLocal(data);localStorage.setItem(CACHE_OWNER,user.uid);refreshGameAfterCloud();});
}

/* ===== PERFIL users/{uid}: LEITURA primeiro; a transação só existe para CRIAR (sem sobrescrever criação simultânea de outro aparelho) ===== */
function missingProfileFields(d,user){const m={};if(d.uid==null)m.uid=user.uid;if(d.email==null)m.email=user.email||'';if(d.username==null)m.username=usernameFromUser(user);if(d.level==null)m.level=1;if(d.rank==null)m.rank='Prata I';if(d.cosmetics==null)m.cosmetics=[];if(d.equipped==null)m.equipped={};return m;}
async function fetchProfile(user,s,opts={}){
  const ref=doc(db,'users',user.uid);
  let snap=await getDoc(ref);
  if(!isCurrent(s))return null;
  if(!snap.exists()){
    await runTransaction(db,async tx=>{const cur=await tx.get(ref);if(!cur.exists())tx.set(ref,defaultProfile(user));});
    if(!isCurrent(s))return null;
    snap=await getDoc(ref);
    if(!isCurrent(s))return null;
    if(!snap.exists())throw new ChromaError('O perfil users/'+user.uid+' foi criado, mas não pôde ser lido de volta.','chroma/profile-missing');
  }
  const data={...snap.data()};
  if(opts.patch){
    const missing=missingProfileFields(data,user);
    if(Object.keys(missing).length){
      Object.assign(data,missing);                              // o jogo usa os padrões já agora
      try{await setDoc(ref,{...missing,updatedAt:serverTimestamp()},{merge:true});}
      catch(e){if(isCurrent(s))reportError('completeProfile',e,{what:'ao seu perfil'});}   // não-fatal: o próximo salvamento reenvia
    }
  }
  return data;
}
async function loadAccount(user,token){
  const s={token,uid:user.uid};
  try{
    const data=await fetchProfile(user,s,{patch:true});
    if(!data||!isCurrent(s))return;                             // sessão antiga terminando depois de uma nova: descartada
    applyRemote(data,user);
    window.firebaseSyncError='';lastToast='';
    setState(STATE.READY);
    accountMessage('Conectado. Seu progresso será salvo na nuvem.');
    publishSocialProfile().then(()=>{window.firebaseSocialError='';},e=>{if(isCurrent(s)){const info=backgroundFailure('publishSocialProfile',e,{what:'ao seu perfil público'});window.firebaseSocialError=info.message;}});
    publishRankedBoardIfChanged(s).catch(e=>{if(isCurrent(s)&&!(e&&e.code==='chroma/stale-session'))backgroundFailure('publishRankedBoard',e,{what:'ao placar ranqueado'});});
  }catch(e){
    if(!isCurrent(s))return;
    const info=reportError('loadAccount',e,{what:'ao seu perfil'});
    setState(STATE.PROFILE_ERROR,info);                         // identidade preservada: currentUser continua definido
    accountMessage(info.message,true);
  }
}
function retryProfileLoad(){if(!currentUser)return Promise.resolve(false);const token=++sessionToken;cancelSync();setState(STATE.PROFILE_LOADING);return loadAccount(currentUser,token).then(()=>true);}
async function restoreFromServer(){
  if(!currentUser)return false;
  const s=snapshot();
  try{const data=await fetchProfile(currentUser,s,{patch:false});if(!data||!isCurrent(s))return false;applyRemote(data,currentUser);return true;}
  catch(e){if(isCurrent(s))backgroundFailure('restoreFromServer',e,{what:'ao seu perfil'});return false;}
}

/* ===== SINCRONIZAÇÃO: fila serial + debounce + guarda de sessão ===== */
function cancelSync(){clearTimeout(syncTimer);syncTimer=null;clearTimeout(retryTimer);retryTimer=null;retryCount=0;}
async function doPersist(s){
  if(!isCurrent(s)||localStorage.getItem(CACHE_OWNER)!==s.uid)throw staleError();   // nunca grava dados de uma conta em outra
  assertWritable();
  await setDoc(doc(db,'users',s.uid),cloudPayload(s.uid),{merge:true});
  if(!isCurrent(s))return;
  await publishIfChanged(s);
  await publishRankedBoardIfChanged(s);
}
function persistState(){
  assertWritable();
  const s=snapshot();
  const run=syncChain.then(()=>doPersist(s));
  syncChain=run.then(()=>undefined,()=>undefined);             // mantém a fila andando; o erro chega ao chamador por `run`
  return run;
}
function syncToCloud(){
  if(!canWrite()||applyingRemote)return;
  const s=snapshot();
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{syncTimer=null;runSync(s);},SYNC_DEBOUNCE_MS);
}
async function runSync(s){
  if(!isCurrent(s)||!canWrite())return;
  try{await persistState();retryCount=0;window.firebaseSyncError='';}
  catch(e){await onSyncFailure(e,s);}
}
async function onSyncFailure(e,s){
  if(!isCurrent(s)||(e&&e.code==='chroma/stale-session'))return;   // erro de sessão antiga não pertence à conta atual
  const info=backgroundFailure('syncToCloud',e,{what:'ao salvar seu progresso'});
  window.firebaseSyncError=info.message;
  if(info.retryable){                                             // rede: mantém o progresso local e tenta de novo
    if(retryCount<RETRY_DELAYS.length){clearTimeout(retryTimer);retryTimer=setTimeout(()=>{retryTimer=null;runSync(s);},RETRY_DELAYS[retryCount++]);}
    return;
  }
  await restoreFromServer();                                      // o servidor recusou: realinha o cache com o que está na nuvem
}
async function flushPending(){if(!syncTimer)return;clearTimeout(syncTimer);syncTimer=null;await runSync(snapshot());}

const SHOP_CATALOG={};
function catalogItem(item){if(!item||!item.id)return null;const known=window.CHROMA_SHOP_CATALOG?.[item.id]||SHOP_CATALOG[item.id];return known&&known.price===Number(item.price)?known:null;}
function applyWritten(next,s){if(!isCurrent(s))throw staleError();withRemoteGuard(()=>{writeLocal(next);refreshGameAfterCloud();});return next;}
async function purchaseShopItem(item){assertWritable();const s=snapshot();const valid=catalogItem(item);if(!valid)throw new ChromaError('Cosmético inválido.');const ref=doc(db,'users',s.uid);let next;await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new ChromaError('Perfil não encontrado.');const d=snap.data(),shop={...defaultShop(),...(d.shop||{})},owned=Array.isArray(shop.owned)?shop.owned:[],level=Number(d.level||1);if(valid.levelOnly&&level<valid.levelOnly)throw new ChromaError('Nível insuficiente para este cosmético.');if(owned.includes(valid.id))throw new ChromaError('Este item já está desbloqueado.');if(Number(d.coins||0)<valid.price)throw new ChromaError('Moedas insuficientes.');shop.owned=[...owned,valid.id];next={...d,coins:Number(d.coins)-valid.price,xp:Number(d.xp||0),level,rank:d.rank||'Prata I',cosmetics:shop.owned,equipped:shop.equipped,shop,updatedAt:serverTimestamp()};tx.set(ref,next,{merge:true});});return applyWritten(next,s);}
async function equipShopItem(itemId,type,equipped){assertWritable();const s=snapshot();const ref=doc(db,'users',s.uid);let next;await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new ChromaError('Perfil não encontrado.');const d=snap.data(),shop={...defaultShop(),...(d.shop||{})};if(!shop.owned.includes(itemId)&&equipped)throw new ChromaError('Cosmético não desbloqueado.');shop.equipped={...shop.equipped,[type]:equipped};next={...d,shop,equipped:shop.equipped,cosmetics:shop.owned,updatedAt:serverTimestamp()};tx.set(ref,next,{merge:true});});return applyWritten(next,s);}
async function debitCoins(amount){assertWritable();const s=snapshot();const ref=doc(db,'users',s.uid);let next;await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new ChromaError('Perfil não encontrado.');const d=snap.data(),coins=Number(d.coins||0);if(coins<amount)throw new ChromaError('Moedas insuficientes.');next={...d,coins:coins-amount,updatedAt:serverTimestamp()};tx.set(ref,next,{merge:true});});return applyWritten(next,s);}

const hasIdentity=()=>!!currentUser&&[STATE.PROFILE_LOADING,STATE.READY,STATE.PROFILE_ERROR].includes(authState);
async function registerPushSubscription(subscription){
  const s=ensureSocial();
  const raw=subscription?.toJSON?subscription.toJSON():subscription;
  if(!raw?.endpoint)throw new ChromaError('Assinatura PUSH inválida.');
  await setDoc(doc(db,'pushSubscriptions',s.uid),{uid:s.uid,endpoint:String(raw.endpoint),keys:raw.keys||{},updatedAt:serverTimestamp(),userAgent:String(navigator.userAgent||'').slice(0,240)},{merge:true});
  return true;
}
window.chromaCloud={canWrite,isReady:canWrite,persistState,syncToCloud,restoreFromServer,retryProfileLoad,purchaseShopItem,equipShopItem,debitCoins,registerPushSubscription,readRankedBoard,listActiveEvents,eventParticipation,eventParticipantCount,joinEvent,leaveEvent,getUser:()=>currentUser,getAuthState:()=>authState,getWriteMessage:authUnavailableMessage,isAuthenticated:hasIdentity,describeError,classifyError,subscribe,STATES:STATE};
window.chromaAuth={getState:()=>authState,getUser:()=>currentUser,getError:()=>sessionError,isLoading:()=>authState===STATE.LOADING||authState===STATE.PROFILE_LOADING,isAuthenticated:hasIdentity,isReady:canWrite,subscribe};

/* ===== LOGIN: Google e e-mail/senha terminam no MESMO onAuthStateChanged -> mesma sessão -> mesmo users/{uid} ===== */
async function linkPendingGoogle(user,typedEmail){
  if(!pendingGoogle)return;
  const pending=pendingGoogle;pendingGoogle=null;
  if(pending.email&&String(typedEmail).toLowerCase()!==pending.email.toLowerCase()){accountMessage('O e-mail digitado é diferente do e-mail da conta Google; o Google não foi vinculado.',true);return;}
  try{await linkWithCredential(user,pending.credential);notify('Google vinculado à sua conta.');accountMessage('Google vinculado à sua conta.');}
  catch(e){surface(reportError('linkWithCredential',e));}       // a sessão já está ativa; só o vínculo falhou
}
async function submitAuth(mode){
  await authPersistenceReady;
  const email=($('#accountEmail')?.value||'').trim(),password=$('#accountPassword')?.value||'';
  if(!email||!password){accountMessage('Informe e-mail e senha.',true);return;}
  try{
    $('#accountSubmit').disabled=true;
    if(mode==='signup'){
      const c=await createUserWithEmailAndPassword(auth,email,password);
      const name=($('#inName')?.value||'').trim();
      if(name){try{await updateProfile(c.user,{displayName:name});}catch(e){reportError('updateProfile',e);}}
    }else{
      const c=await signInWithEmailAndPassword(auth,email,password);
      await linkPendingGoogle(c.user,email);
    }
    $('#accountModal').classList.remove('on');
  }catch(e){const info=reportError('submitAuth',e);window.firebaseLastAuthError=info.message;accountMessage(info.message,true);}
  finally{$('#accountSubmit').disabled=false;}
}
async function signInGoogle(){
  try{
    $('#accountGoogle').disabled=true;accountMessage('Abrindo o login do Google…');
    await signInWithPopup(auth,googleProvider);
    $('#accountModal').classList.remove('on');
  }catch(e){
    if(e&&e.code==='auth/account-exists-with-different-credential'){
      pendingGoogle={credential:GoogleAuthProvider.credentialFromError(e),email:e.customData?.email||''};
      const em=$('#accountEmail');if(em&&!em.value&&pendingGoogle.email)em.value=pendingGoogle.email;
      accountMessage('Esta conta já existe com e-mail e senha. Entre com e-mail e senha para vincular o Google.',true);
    }else{const info=reportError('signInGoogle',e);window.firebaseLastAuthError=info.message;accountMessage(info.message,true);}
  }finally{$('#accountGoogle').disabled=false;}
}
function bind(){
  updateAccountUI();
  $('#accountOpen')?.addEventListener('click',()=>{$('#accountModal').classList.add('on');accountMessage(currentUser?'Conta conectada.':'Entre para salvar seu progresso em qualquer celular.');});
  $('#accountClose')?.addEventListener('click',()=>$('#accountModal').classList.remove('on'));
  $('#accountSubmit')?.addEventListener('click',()=>submitAuth($('#accountMode').value));
  $('#accountGoogle')?.addEventListener('click',signInGoogle);
  $('#accountMode')?.addEventListener('change',e=>{const signup=e.target.value==='signup';$('#accountSubmit').textContent=signup?'Criar conta':'Entrar';$('#accountNameHint').hidden=!signup;});
  $('#accountForgot')?.addEventListener('click',async()=>{const email=($('#accountEmail')?.value||'').trim();if(!email){accountMessage('Digite seu e-mail primeiro.',true);return;}try{await sendPasswordResetEmail(auth,email);accountMessage('Link de recuperação enviado para seu e-mail.');}catch(e){accountMessage(reportError('sendPasswordResetEmail',e).message,true);}});
  $('#accountLogout')?.addEventListener('click',async()=>{try{await flushPending();await signOut(auth);}catch(e){surface(reportError('signOut',e));}});
  document.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('[data-cloud-retry]'))retryProfileLoad();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushPending();});
  window.addEventListener('chroma-state-changed',()=>syncToCloud());
}

/* ===== ÚNICO observador de autenticação ===== */
bind();
onAuthStateChanged(auth,user=>{
  const token=++sessionToken;                                  // invalida qualquer carregamento/sync da sessão anterior
  cancelSync();
  currentUser=user;lastPublishedSig='';
  const owner=localStorage.getItem(CACHE_OWNER);
  if(!user){
    if(owner)clearCloudCache();                                // logout: nada da conta anterior permanece
    setState(STATE.UNAUTHENTICATED);
    accountMessage('Você não está conectado a uma conta.');
    return;
  }
  if(owner&&owner!==user.uid)clearCloudCache();                // troca de conta: dados da anterior saem ANTES do novo perfil chegar
  setState(STATE.PROFILE_LOADING);
  loadAccount(user,token);
},err=>{
  sessionToken++;cancelSync();currentUser=null;
  const info=reportError('onAuthStateChanged',err);
  setState(STATE.AUTH_ERROR,info);accountMessage(info.message,true);
});

/* ===== SOCIAL / AMIGOS / CLÃ — dados permanentes no Firestore (identidade única: currentUser.uid) ===== */

function socialProfileFromLocal(uid){
  const name=localStorage.getItem(keys.name)||currentUser?.displayName||'Jogador';
  const username=(localStorage.getItem(keys.username)||usernameFromUser(currentUser||{})).toLowerCase();
  let rank='Prata I'; try{if(typeof rankedStats==='function'&&typeof rankedTier==='function'){const t=rankedTier(rankedStats(name).points);rank=t.name+' '+t.level;}}catch(e){reportError('socialProfileRank',e);}
  /* clanId/clanName NÃO são enviados aqui: pertencem às transações de clã (e a users/{uid}). Enviar null apagava o clã a cada login. */
  return {uid,username,usernameLower:username,name:name.slice(0,40),photo:localStorage.getItem(keys.photo)||'',rank,level:typeof levelFromXP==='function'?levelFromXP(Number(localStorage.getItem(keys.xp)||0)):1};
}
const socialSig=p=>JSON.stringify([p.username,p.name,p.photo,p.rank,p.level]);
async function publishSocialProfile(){
  assertWritable();
  const s=snapshot();
  if(publishInFlight&&publishInFlight.token===s.token)return publishInFlight.promise;
  const promise=(async()=>{
    const p=socialProfileFromLocal(s.uid), ref=doc(db,'publicProfiles',s.uid);
    const [old,mine]=await Promise.all([getDoc(ref),getDoc(doc(db,'users',s.uid))]);
    if(!isCurrent(s))throw staleError();
    const prev=old.exists()?old.data():null, myClan=mine.exists()?(mine.data().clanId||null):null;
    const payload={...p,createdAt:prev?(prev.createdAt||serverTimestamp()):serverTimestamp(),updatedAt:serverTimestamp()};
    if(myClan!==((prev&&prev.clanId)||null)){                      // users/{uid} é a fonte de verdade do clã: realinha o perfil público
      payload.clanId=myClan;payload.clanName=null;
      if(myClan){const c=await getDoc(doc(db,'clans',myClan));if(c.exists())payload.clanName=c.data().name||null;}
    }
    if(!isCurrent(s))throw staleError();
    await setDoc(ref,payload,{merge:true});
    lastPublishedSig=socialSig(p);
    return p;
  })();
  publishInFlight={token:s.token,promise};
  try{return await promise;}finally{if(publishInFlight&&publishInFlight.promise===promise)publishInFlight=null;}
}
function rankedBoardPayload(uid){
  const local=localState(), name=String(local.name||currentUser?.displayName||'Jogador').slice(0,40);
  const list=Array.isArray(local.ranked)?local.ranked:[];
  const found=list.find(x=>String(x.name||'').toLowerCase()===name.toLowerCase())||{};
  const nonNegative=v=>Math.max(0,Math.floor(Number(v)||0));
  return {uid,name,username:String(local.username||usernameFromUser(currentUser||{})).slice(0,18),photo:String(local.photo||''),points:nonNegative(found.points),wins:nonNegative(found.wins),losses:nonNegative(found.losses),played:nonNegative(found.played),updatedAt:serverTimestamp()};
}
const rankedBoardSig=p=>JSON.stringify([p.uid,p.name,p.username,p.photo,p.points,p.wins,p.losses,p.played]);
async function publishRankedBoardIfChanged(s){
  if(!isCurrent(s)||!canWrite())return;
  const payload=rankedBoardPayload(s.uid),sig=rankedBoardSig(payload);
  if(sig===lastRankedBoardSig)return;
  await setDoc(doc(db,'rankedBoard',s.uid),payload,{merge:true});
  if(!isCurrent(s))throw staleError();
  lastRankedBoardSig=sig;
}
async function readRankedBoard(){
  const s=ensureSocial();
  const snap=await getDocs(query(collection(db,'rankedBoard'),orderBy('points','desc'),limit(100)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function listActiveEvents(){
  const s=ensureSocial();
  const snap=await getDocs(query(collection(db,'events'),where('active','==',true),limit(100)));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>toMillis(a.startsAt)-toMillis(b.startsAt));
}
function toMillis(value){return value?.toMillis?value.toMillis():value?.seconds?value.seconds*1000:Number(value)||0;}
async function eventParticipation(eventId){
  const s=ensureSocial(),ref=doc(db,'eventParticipants',String(eventId)+'__'+s.uid),snap=await getDoc(ref);
  return snap.exists();
}
async function eventParticipantCount(eventId){const s=ensureSocial();const snap=await getDocs(query(collection(db,'eventParticipants'),where('eventId','==',String(eventId)),limit(1000)));return snap.docs.length;}
async function joinEvent(eventId){
  const s=ensureSocial(),id=String(eventId),ref=doc(db,'eventParticipants',id+'__'+s.uid);
  await setDoc(ref,{eventId:id,uid:s.uid,name:String(localStorage.getItem(keys.name)||currentUser?.displayName||'Jogador').slice(0,40),joinedAt:serverTimestamp()});
  return true;
}
async function leaveEvent(eventId){const s=ensureSocial();await deleteDoc(doc(db,'eventParticipants',String(eventId)+'__'+s.uid));return true;}
async function publishIfChanged(s){
  if(!isCurrent(s)||!canWrite())return;
  if(socialSig(socialProfileFromLocal(s.uid))===lastPublishedSig)return;
  try{await publishSocialProfile();window.firebaseSocialError='';}
  catch(e){if(isCurrent(s)&&!(e&&e.code==='chroma/stale-session')){const info=backgroundFailure('publishSocialProfile',e,{what:'ao seu perfil público'});window.firebaseSocialError=info.message;}}
}
function ensureSocial(){assertWritable();return snapshot();}
function friendKey(a,b){return [a,b].sort().join('__');}
async function searchSocialPlayers(term){
  const s=ensureSocial(); const text=String(term||'').trim().toLowerCase().replace(/^@+/,''); if(text.length<2)return [];
  const q=query(collection(db,'publicProfiles'),where('usernameLower','>=',text),where('usernameLower','<=',text+'\uf8ff'),limit(12));
  const snap=await getDocs(q); return snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.uid!==s.uid);
}
async function socialRequests(){
  const s=ensureSocial();
  const [incoming,outgoing]=await Promise.all([
    getDocs(query(collection(db,'friendRequests'),where('toUid','==',s.uid),limit(50))),
    getDocs(query(collection(db,'friendRequests'),where('fromUid','==',s.uid),limit(50)))
  ]);
  const incomingDocs=incoming.docs.filter(d=>d.data().status==='pending'); const outgoingDocs=outgoing.docs.filter(d=>d.data().status==='pending');
  return {incoming:incomingDocs.map(d=>({id:d.id,...d.data()})),outgoing:outgoingDocs.map(d=>({id:d.id,...d.data()}))};
}
async function socialFriends(){
  const s=ensureSocial(); const snap=await getDocs(query(collection(db,'friendships'),where('participants','array-contains',s.uid),limit(100)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function sendSocialFriendRequest(target){
  const s=ensureSocial(); if(!target?.uid||target.uid===s.uid)throw new ChromaError('Jogador inválido.');
  const existing=await getDocs(query(collection(db,'friendRequests'),where('fromUid','==',s.uid),where('toUid','==',target.uid),where('status','==','pending'),limit(1)));
  if(!existing.empty)throw new ChromaError('Solicitação já enviada.');
  const reverse=await getDocs(query(collection(db,'friendRequests'),where('fromUid','==',target.uid),where('toUid','==',s.uid),where('status','==','pending'),limit(1)));
  if(!reverse.empty)throw new ChromaError('Este jogador já enviou uma solicitação.');
  const friendships=await getDocs(query(collection(db,'friendships'),where('participants','array-contains',s.uid),limit(100)));
  if(friendships.docs.some(d=>(d.data().participants||[]).includes(target.uid)))throw new ChromaError('Vocês já são amigos.');
  const me=await getDoc(doc(db,'publicProfiles',s.uid));
  const from=me.exists()?me.data():await publishSocialProfile();
  if(!isCurrent(s))throw staleError();
  const ref=await addDoc(collection(db,'friendRequests'),{fromUid:s.uid,toUid:target.uid,from:{username:from.username,name:from.name,photo:from.photo||'',rank:from.rank||'Prata I',level:Number(from.level||1)},to:{username:target.username,name:target.name,photo:target.photo||'',rank:target.rank||'Prata I',level:Number(target.level||1)},status:'pending',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return {id:ref.id};
}
async function respondSocialFriendRequest(requestId,accept){
  const s=ensureSocial(); const ref=doc(db,'friendRequests',requestId); let result;
  await runTransaction(db,async tx=>{
    const snap=await tx.get(ref); if(!snap.exists())throw new ChromaError('Solicitação não encontrada.');
    const r=snap.data(); if(r.toUid!==s.uid||r.status!=='pending')throw new ChromaError('Solicitação indisponível.');
    if(!accept){tx.update(ref,{status:'declined',updatedAt:serverTimestamp()});result={status:'declined'};return;}
    const fid=friendKey(r.fromUid,r.toUid),fref=doc(db,'friendships',fid);
    tx.set(fref,{participants:[r.fromUid,r.toUid],profiles:{[r.fromUid]:r.from,[r.toUid]:r.to},createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    tx.update(ref,{status:'accepted',updatedAt:serverTimestamp()}); result={status:'accepted',id:fid};
  }); return result;
}
async function removeSocialFriend(friendshipId){ensureSocial();await deleteDoc(doc(db,'friendships',friendshipId));}
async function socialGifts(){
  const s=ensureSocial();
  const snap=await getDocs(query(collection(db,'gifts'),where('recipientUid','==',s.uid),limit(100)));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>toMillis(b.createdAt)-toMillis(a.createdAt));
}
async function sendSocialGift(target,item){
  const s=ensureSocial();
  if(!target?.uid||target.uid===s.uid)throw new ChromaError('Escolha um amigo válido.');
  const catalog=window.CHROMA_SHOP_CATALOG||{};
  const itemId=String(item?.id||'');
  const itemName=String(item?.name||'').trim();
  if(!catalog[itemId]||!itemName)throw new ChromaError('Item de presente inválido.');
  const friendshipId=friendKey(s.uid,target.uid), friendRef=doc(db,'friendships',friendshipId);
  const senderRef=doc(db,'users',s.uid), giftRef=doc(collection(db,'gifts'));
  const senderName=String(localStorage.getItem(keys.name)||currentUser?.displayName||'Jogador').slice(0,40);
  await runTransaction(db,async tx=>{
    const [friendSnap,senderSnap]=await Promise.all([tx.get(friendRef),tx.get(senderRef)]);
    if(!friendSnap.exists()||(friendSnap.data().participants||[]).indexOf(target.uid)<0)throw new ChromaError('Você só pode enviar presentes para seus amigos.');
    const data=senderSnap.data()||{},shop={...(data.shop||{})},owned=Array.isArray(shop.owned)?shop.owned.slice():[];
    if(!owned.includes(itemId))throw new ChromaError('Esse item não está no seu inventário.');
    shop.owned=owned.filter(id=>id!==itemId);
    if(Array.isArray(data.cosmetics))data.cosmetics=shop.owned.slice();
    tx.update(senderRef,{shop,cosmetics:shop.owned,updatedAt:serverTimestamp()});
    tx.set(giftRef,{senderUid:s.uid,recipientUid:target.uid,senderName,recipientName:String(target.name||target.username||'Jogador').slice(0,40),itemId,itemName,friendshipId,status:'pending',createdAt:serverTimestamp()});
  });
  return {id:giftRef.id};
}
async function redeemSocialGift(giftId){
  const s=ensureSocial(); const giftRef=doc(db,'gifts',String(giftId)),userRef=doc(db,'users',s.uid); let itemId='';
  await runTransaction(db,async tx=>{
    const [giftSnap,userSnap]=await Promise.all([tx.get(giftRef),tx.get(userRef)]);
    if(!giftSnap.exists())throw new ChromaError('Presente não encontrado.');
    const gift=giftSnap.data(); if(gift.recipientUid!==s.uid||gift.status!=='pending')throw new ChromaError('Este presente já foi resgatado ou não está disponível.');
    const data=userSnap.data()||{},shop={...(data.shop||{})},owned=Array.isArray(shop.owned)?shop.owned.slice():[];
    itemId=String(gift.itemId||''); if(!itemId)throw new ChromaError('Presente inválido.');
    if(!owned.includes(itemId))owned.push(itemId);
    shop.owned=owned; if(Array.isArray(data.cosmetics))data.cosmetics=owned.slice();
    tx.update(userRef,{shop,cosmetics:owned,updatedAt:serverTimestamp()});
    tx.update(giftRef,{status:'redeemed',redeemedBy:s.uid,redeemedAt:serverTimestamp()});
  });
  return {itemId};
}
async function readSocialPublicProfile(uid){ensureSocial();const p=await getDoc(doc(db,'publicProfiles',uid));if(!p.exists())throw new ChromaError('Perfil não encontrado.');return {uid,...p.data()};}
async function createSocialClan(name,icon='shield'){
  const s=ensureSocial(); const clean=String(name||'').trim().replace(/\s+/g,' '); if(clean.length<3||clean.length>24||!/^[\p{L}\p{N} _-]+$/u.test(clean))throw new ChromaError('Use um nome de clã entre 3 e 24 caracteres.');
  const me=await getDoc(doc(db,'publicProfiles',s.uid)); if(!me.exists())await publishSocialProfile();
  const myUser=await getDoc(doc(db,'users',s.uid)); if((myUser.data()?.clanId))throw new ChromaError('Você já está em um clã.');
  const dup=await getDocs(query(collection(db,'clans'),where('nameLower','==',clean.toLowerCase()),limit(1))); if(!dup.empty)throw new ChromaError('Esse nome de clã já está em uso.');
  if(!isCurrent(s))throw staleError();
  const clan={name:clean,nameLower:clean.toLowerCase(),icon:['shield','sparkles','flame','crown','star'].includes(icon)?icon:'shield',leaderId:s.uid,level:1,xp:0,xpToNext:100,currencyName:'Fragmentos do Clã',memberCount:1,members:{[s.uid]:{uid:s.uid,role:'leader',joinedAt:serverTimestamp(),contributionXp:0,clanCoins:0}},missions:[{id:'clan-games-10',title:'Primeira expedição',description:'O clã deve completar 10 partidas.',target:10,progress:0,reward:{coins:120,label:'120 Fragmentos do Clã'},completed:false},{id:'clan-games-25',title:'Força da comunidade',description:'O clã deve completar 25 partidas.',target:25,progress:0,reward:{coins:300,label:'300 Fragmentos do Clã + recompensa cosmética para todos'},completed:false},{id:'clan-wins-10',title:'Vitórias compartilhadas',description:'O clã deve conquistar 10 vitórias.',target:10,progress:0,reward:{coins:450,label:'450 Fragmentos do Clã + Poção de XP · 30 min para todos'},completed:false}],rewards:[],events:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
  let cid; await runTransaction(db,async tx=>{const ref=doc(collection(db,'clans'));cid=ref.id;tx.set(ref,clan);tx.update(doc(db,'users',s.uid),{clanId:cid,clanRole:'leader',updatedAt:serverTimestamp()});tx.set(doc(db,'publicProfiles',s.uid),{clanId:cid,clanName:clean,updatedAt:serverTimestamp()},{merge:true});});
  return {id:cid,...clan};
}
async function listSocialClans(term=''){
  ensureSocial(); const text=String(term||'').trim().toLowerCase(); const snap=text?await getDocs(query(collection(db,'clans'),where('nameLower','>=',text),where('nameLower','<=',text+'\uf8ff'),limit(20))):await getDocs(query(collection(db,'clans'),orderBy('createdAt','desc'),limit(20))); return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function getSocialClan(id){ensureSocial();const c=await getDoc(doc(db,'clans',id));if(!c.exists())throw new ChromaError('Clã não encontrado.');return {id:c.id,...c.data()};}
async function joinSocialClan(id){const s=ensureSocial();await runTransaction(db,async tx=>{const cref=doc(db,'clans',id),uref=doc(db,'users',s.uid),pref=doc(db,'publicProfiles',s.uid);const [cs,us]=await Promise.all([tx.get(cref),tx.get(uref)]);if(!cs.exists())throw new ChromaError('Clã não encontrado.');if(us.data()?.clanId)throw new ChromaError('Você já está em um clã.');const c=cs.data();tx.update(cref,{['members.'+s.uid]:{uid:s.uid,role:'member',joinedAt:serverTimestamp(),contributionXp:0,clanCoins:0},memberCount:Number(c.memberCount||0)+1,updatedAt:serverTimestamp()});tx.update(uref,{clanId:id,clanRole:'member',updatedAt:serverTimestamp()});tx.set(pref,{clanId:id,clanName:c.name,updatedAt:serverTimestamp()},{merge:true});});}
async function leaveSocialClan(id){const s=ensureSocial();await runTransaction(db,async tx=>{const cref=doc(db,'clans',id),uref=doc(db,'users',s.uid),pref=doc(db,'publicProfiles',s.uid),cs=await tx.get(cref);if(!cs.exists())throw new ChromaError('Clã não encontrado.');const c=cs.data(),count=Number(c.memberCount||Object.keys(c.members||{}).length||0);if(c.leaderId===s.uid&&count>1)throw new ChromaError('O líder precisa transferir a liderança antes de sair.');if(c.leaderId===s.uid&&count<=1){tx.delete(cref);}else{tx.update(cref,{['members.'+s.uid]:null,memberCount:Math.max(0,count-1),updatedAt:serverTimestamp()});}tx.update(uref,{clanId:null,clanRole:null,updatedAt:serverTimestamp()});tx.set(pref,{clanId:null,clanName:null,updatedAt:serverTimestamp()},{merge:true});});}
async function buySocialClanItem(clanId,item){
  const s=ensureSocial(),catalog=window.CHROMA_CLAN_SHOP_CATALOG||{},valid=catalog[item?.id];
  if(!valid||Number(valid.price)!==Number(item?.price))throw new ChromaError('Item da loja do clã inválido.');
  const cref=doc(db,'clans',String(clanId)),uref=doc(db,'users',s.uid);let nextUser;
  await runTransaction(db,async tx=>{
    const [cs,us]=await Promise.all([tx.get(cref),tx.get(uref)]);if(!cs.exists()||!us.exists())throw new ChromaError('Clã ou perfil não encontrado.');
    const c=cs.data(),u=us.data(),member=c.members?.[s.uid];if(u.clanId!==clanId||!member)throw new ChromaError('Você não pertence a este clã.');
    const balance=Number(member.clanCoins||0);if(balance<Number(valid.price))throw new ChromaError('Fragmentos do Clã insuficientes.');
    const shop={...defaultShop(),...(u.shop||{})};
    if(valid.type==='potion'){shop.potions=[...(shop.potions||[]),{id:'xp2',minutes:Number(valid.minutes||30),receivedAt:Date.now(),source:'clan'}];}
    else {shop.owned=Array.isArray(shop.owned)?shop.owned.slice():[];if(shop.owned.includes(valid.id))throw new ChromaError('Você já possui este cosmético.');shop.owned.push(valid.id);}
    const members={...(c.members||{}),[s.uid]:{...member,clanCoins:balance-Number(valid.price)}};
    tx.update(cref,{members,updatedAt:serverTimestamp()});nextUser={...u,shop,cosmetics:shop.owned||u.cosmetics||[],updatedAt:serverTimestamp()};tx.set(uref,nextUser,{merge:true});
  });
  return applyWritten(nextUser,s);
}
window.chromaSocial={publishSocialProfile,searchPlayers:searchSocialPlayers,requests:socialRequests,friends:socialFriends,sendRequest:sendSocialFriendRequest,respondRequest:respondSocialFriendRequest,removeFriend:removeSocialFriend,publicProfile:readSocialPublicProfile,gifts:socialGifts,sendGift:sendSocialGift,redeemGift:redeemSocialGift,createClan:createSocialClan,listClans:listSocialClans,getClan:getSocialClan,joinClan:joinSocialClan,leaveClan:leaveSocialClan,buyClanItem:buySocialClanItem,isReady:()=>canWrite()};
