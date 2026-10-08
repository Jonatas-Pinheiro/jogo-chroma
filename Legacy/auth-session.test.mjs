// Testes executáveis da camada de sessão (firebase-auth.js) contra um Firebase FALSO em memória (auth-test-hooks.mjs).
// Provam a lógica de estados/sincronização/erros. NÃO provam regras do Firestore, popup do Google nem rede real.
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./auth-test-hooks.mjs', import.meta.url);

let inst=0;const logs=[];
const realWarn=console.warn,realError=console.error;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=3000,label='condição'){const t=Date.now();while(Date.now()-t<ms){if(await fn())return;await sleep(10);}throw new Error('timeout aguardando '+label);}

function makeEl(){const set=new Set();const h={};return{textContent:'',className:'',disabled:false,hidden:false,value:'',innerHTML:'',dataset:{},handlers:h,
  classList:{add:c=>set.add(c),remove:c=>set.delete(c),toggle:(c,on)=>{if(on===undefined?!set.has(c):on)set.add(c);else set.delete(c);},contains:c=>set.has(c)},
  addEventListener(t,fn){(h[t]=h[t]||[]).push(fn);}};}
function setupDom(){
  const et=new EventTarget(),els=new Map(),docEt=new EventTarget();
  globalThis.window=globalThis;
  globalThis.addEventListener=et.addEventListener.bind(et);globalThis.dispatchEvent=et.dispatchEvent.bind(et);
  const store=new Map();
  globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k),_s:store};
  globalThis.location={hostname:'chroma.example',search:''};
  globalThis.document={visibilityState:'visible',documentElement:makeEl(),addEventListener:docEt.addEventListener.bind(docEt),_fire:(t,ev)=>docEt.dispatchEvent(Object.assign(new Event(t),ev||{})),
    querySelector:s=>{if(!els.has(s)){const e=makeEl();if(s==='#accountMode')e.value='signin';els.set(s,e);}return els.get(s);}};
  globalThis._docEt=docEt;globalThis.toasts=[];globalThis.renderCalls=0;
  window.toast=m=>toasts.push(m);window.renderSocial=()=>{renderCalls++;};
  globalThis.levelFromXP=x=>1+Math.floor(x/100);
  console.warn=(...a)=>logs.push(['warn',...a]);console.error=(...a)=>logs.push(['error',...a]);
}
function makeFb(prev,persisted){
  const fb={store:prev?prev.store:new Map(),accounts:prev?prev.accounts:new Map(),observers:[],persistedUser:persisted||null,restore:true,auth:{currentUser:null},
    holds:[],fails:[],calls:[],writes:[],linked:[],autoId:prev?prev.autoId:0,sdIn:0,sdMax:0,setDocDelay:0,popupError:null,googleUser:null,linkError:null,failPersistence:false};
  fb.emit=u=>{fb.auth.currentUser=u;for(const o of fb.observers)o.cb(u);};
  fb.fail=(op,path,code,times=1,message)=>fb.fails.push({op,path,code,times,message});
  fb.hold=(op,path)=>{let release;const promise=new Promise(r=>release=r);fb.holds.push({op,path,promise,used:false});return{release};};
  fb.seedUser=(uid,o={})=>fb.store.set('users/'+uid,{uid,email:uid+'@x.com',username:o.username||'user'+uid,coins:o.coins??0,xp:o.xp??0,level:1,rank:'Prata I',cosmetics:[],equipped:{},shop:{owned:[],equipped:{profile:'',cards:'','name-effect':'','profile-theme':'','profile-badge':''},potions:[]},name:o.name||'',photo:'',gender:'',streak:{day:0,lastClaim:null},levelRewards:[],redeemedCodes:[],missions:null,ranking:[],ranked:[],mailRead:[],friends:{friends:[],requests:[],sent:[]},gameStats:{},showcaseAchievements:[],cardsPlayed:0,flags:{psicopata:false},createdAt:{__ts:true},updatedAt:{__ts:true},...(o.extra||{})});
  return fb;
}
async function boot({persisted=null,keep=false}={}){
  const prev=keep?globalThis.__fb:null;
  globalThis.__fb=makeFb(prev,persisted);setupDom();
  await import('./firebase-auth.js?i='+(++inst));
  const seen=[],viol=[];
  window.chromaCloud.subscribe(i=>{seen.push(i.state);if((i.state==='AUTHENTICATED')!==i.canWrite)viol.push(i);});
  return{fb:globalThis.__fb,seen,viol,states:()=>window.firebaseAuthState};
}
const user=(uid,email)=>({uid,email:email||uid+'@x.com',displayName:null});
const click=(sel)=>document.querySelector(sel).handlers.click[0]();
const ready=()=>window.firebaseAuthState==='AUTHENTICATED';
const lsKeys=['chroma-coins','chroma-xp','chroma-shop','chroma-name','chroma-username','chroma-friends'];

const tests=[];const T=(n,f)=>tests.push([n,f]);

T('T01 sem login -> AUTH_LOADING -> UNAUTHENTICATED; recursos pedem login',async()=>{
  const {states,seen}=await boot();
  assert.equal(states(),'AUTH_LOADING');assert.equal(window.chromaCloud.canWrite(),false);
  await until(()=>states()==='UNAUTHENTICATED');
  assert.match(window.chromaCloud.getWriteMessage(),/Entre na sua conta/);
  assert.equal(window.chromaSocial.isReady(),false);
  await assert.rejects(()=>window.chromaSocial.requests(),e=>e.code==='chroma/unauthenticated'&&/Entre/.test(e.message));
  assert.match(document.querySelector('#accountStatus').textContent,/Progresso local/);
});
T('T02 login e-mail/senha: Auth -> UID -> perfil -> pronto, sem estado intermediário incorreto',async()=>{
  const {fb,seen,viol,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.accounts.set('a@x.com',{password:'123456',user:user('uidA','a@x.com')});
  document.querySelector('#accountEmail').value='a@x.com';document.querySelector('#accountPassword').value='123456';
  const hold=fb.hold('getDoc','users/uidA');
  await click('#accountSubmit');
  await until(()=>states()==='AUTHENTICATED_LOADING_PROFILE');
  assert.equal(window.firebaseCurrentUserUid,'uidA');            // identidade já vale durante o carregamento do perfil
  assert.equal(window.chromaCloud.canWrite(),false);
  assert.match(window.chromaCloud.getWriteMessage(),/Carregando seu perfil/);assert.doesNotMatch(window.chromaCloud.getWriteMessage(),/Entre na sua conta/);
  hold.release();await until(ready);
  assert.deepEqual(seen.filter((s,i)=>s!==seen[i-1]),['UNAUTHENTICATED','AUTHENTICATED_LOADING_PROFILE','AUTHENTICATED']);
  assert.equal(viol.length,0,'AUTHENTICATED com canWrite()==false (bug original) não pode ocorrer');
  assert.ok(fb.store.has('users/uidA'));assert.equal(fb.store.get('users/uidA').uid,'uidA');
  assert.equal(document.querySelector('#accountModal').classList.contains('on'),false);
});
T('T03 atualizar a página logado restaura a sessão sem duplicar perfil',async()=>{
  const {fb}=await boot();await until(()=>window.firebaseAuthState==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:50,username:'alice'});fb.emit(user('uidA'));await until(ready);
  const n=[...fb.store.keys()].filter(k=>k.startsWith('users/')).length;
  const b=await boot({persisted:user('uidA'),keep:true});
  assert.equal(b.states(),'AUTH_LOADING');                       // ainda verificando, não "deslogado"
  await until(ready);
  assert.equal(window.firebaseCurrentUserUid,'uidA');assert.equal(localStorage.getItem('chroma-coins'),'50');assert.equal(localStorage.getItem('chroma-username'),'alice');
  assert.equal([...b.fb.store.keys()].filter(k=>k.startsWith('users/')).length,n);
  assert.equal(b.viol.length,0);
});
T('T04 Google resulta na mesma arquitetura; vínculo com conta e-mail/senha existente sem duplicar',async()=>{
  const {fb,seen,viol,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.googleUser=user('uidG','g@x.com');await click('#accountGoogle');await until(ready);
  assert.deepEqual(seen.filter((s,i)=>s!==seen[i-1]),['UNAUTHENTICATED','AUTHENTICATED_LOADING_PROFILE','AUTHENTICATED']);
  assert.equal(viol.length,0);assert.ok(fb.store.has('users/uidG'));assert.ok(fb.store.has('publicProfiles/uidG'));
  // conta e-mail/senha existente + Google com o mesmo e-mail
  const b=await boot();await until(()=>b.states()==='UNAUTHENTICATED');
  b.fb.accounts.set('p@x.com',{password:'abcdef',user:user('uidP','p@x.com')});
  b.fb.popupError=Object.assign(new Error('x'),{code:'auth/account-exists-with-different-credential',customData:{email:'p@x.com'},credential:{id:'cred-google'}});
  await click('#accountGoogle');
  assert.equal(b.states(),'UNAUTHENTICATED');assert.match(document.querySelector('#accountMsg').textContent,/e-mail e senha/);
  assert.equal(document.querySelector('#accountEmail').value,'p@x.com');
  document.querySelector('#accountPassword').value='abcdef';await click('#accountSubmit');await until(ready);
  assert.deepEqual(b.fb.linked,[{uid:'uidP',cred:{id:'cred-google'}}]);
  assert.deepEqual([...b.fb.store.keys()].filter(k=>k.startsWith('users/')),['users/uidP']);   // um único perfil
  // e-mail diferente do Google: não vincula
  const c=await boot();await until(()=>c.states()==='UNAUTHENTICATED');
  c.fb.accounts.set('q@x.com',{password:'abcdef',user:user('uidQ','q@x.com')});
  c.fb.popupError=Object.assign(new Error('x'),{code:'auth/account-exists-with-different-credential',customData:{email:'outro@x.com'},credential:{id:'c2'}});
  await click('#accountGoogle');document.querySelector('#accountEmail').value='q@x.com';document.querySelector('#accountPassword').value='abcdef';
  await click('#accountSubmit');await until(ready);assert.equal(c.fb.linked.length,0);
});
T('T05/T06 Social e Clãs funcionam autenticado, com o mesmo UID, sem mensagem de deslogado',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{username:'alice'});fb.seedUser('uidB',{username:'bob'});
  fb.emit(user('uidA'));await until(ready);await until(()=>fb.store.has('publicProfiles/uidA'));
  assert.equal(fb.store.get('publicProfiles/uidA').usernameLower,'alice');
  assert.deepEqual(await window.chromaSocial.requests(),{incoming:[],outgoing:[]});assert.deepEqual(await window.chromaSocial.friends(),[]);
  const clan=await window.chromaSocial.createClan('Meu Clã','crown');
  assert.equal(fb.store.get('users/uidA').clanId,clan.id);assert.equal(fb.store.get('publicProfiles/uidA').clanId,clan.id);
  assert.equal((await window.chromaSocial.listClans()).length,1);
  // relogin: o clã NÃO pode sumir do perfil público (bug: clanId:null era reenviado a cada login)
  fb.emit(null);await until(()=>states()==='UNAUTHENTICATED');fb.emit(user('uidA'));await until(ready);
  await until(()=>fb.writes.filter(w=>w.path==='publicProfiles/uidA').length>=2);
  assert.equal(fb.store.get('publicProfiles/uidA').clanId,clan.id);assert.equal(fb.store.get('publicProfiles/uidA').clanName,'Meu Clã');
  // outro jogador entra e sai
  fb.emit(user('uidB'));await until(ready);await window.chromaSocial.joinClan(clan.id);
  assert.equal(fb.store.get('clans/'+clan.id).memberCount,2);await window.chromaSocial.leaveClan(clan.id);
  assert.equal(fb.store.get('clans/'+clan.id).memberCount,1);
  // pedido de amizade
  const found=await window.chromaSocial.searchPlayers('ali');assert.equal(found[0].uid,'uidA');
  await window.chromaSocial.sendRequest(found[0]);fb.emit(user('uidA'));await until(ready);
  const r=await window.chromaSocial.requests();assert.equal(r.incoming.length,1);assert.equal(r.incoming[0].fromUid,'uidB');
  assert.ok(renderCalls>0);
});
T('T07 permission-denied: erro REAL, sessão preservada, nunca "deslogado/internet"',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:10});fb.fail('getDoc','users/','permission-denied',1);
  fb.emit(user('uidA'));await until(()=>states()==='AUTHENTICATED_PROFILE_ERROR');
  const m=window.chromaCloud.getWriteMessage();
  assert.match(m,/recusou/);assert.match(m,/permission-denied/);assert.doesNotMatch(m,/internet|conex|conect|rede|Entre na sua conta|deslogad/i);
  assert.equal(window.chromaCloud.getUser().uid,'uidA');assert.equal(window.firebaseCurrentUserUid,'uidA');assert.equal(window.chromaCloud.canWrite(),false);
  assert.doesNotMatch(document.querySelector('#accountStatus').textContent,/Progresso local/);
  assert.ok(logs.some(l=>l[0]!=='x'&&String(l.slice(1).join(' ')).includes('permission-denied')),'erro precisa ir ao console');
  class ClickEv extends Event{constructor(t){super('click');this._t=t;}get target(){return this._t;}}   // clique no botão "Tentar novamente"
  _docEt.dispatchEvent(new ClickEv({closest:sel=>sel==='[data-cloud-retry]'?{}:null}));
  await until(ready);
  // falha de ESCRITA em sessão pronta: continua autenticado, mostra erro real, realinha com o servidor
  localStorage.setItem('chroma-coins','999');fb.fail('setDoc','users/uidA','permission-denied',1);
  window.dispatchEvent(new Event('chroma-state-changed'));
  await until(()=>toasts.some(t=>/recusou/.test(t)));
  assert.equal(window.firebaseAuthState,'AUTHENTICATED');assert.equal(window.chromaCloud.getUser().uid,'uidA');
  await until(()=>localStorage.getItem('chroma-coins')==='10',3000,'realinhamento com o servidor');
});
T('T08 unavailable/rede: falha de comunicação, sessão preservada, progresso local mantido e reenviado',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:10});fb.fail('getDoc','users/','unavailable',1);
  fb.emit(user('uidA'));await until(()=>states()==='AUTHENTICATED_PROFILE_ERROR');
  const m=window.chromaCloud.getWriteMessage();assert.match(m,/comunicar/);assert.doesNotMatch(m,/recusou|permiss|Entre na sua conta/i);
  assert.match(document.querySelector('#accountStatus').textContent,/sem comunicação/);
  await window.chromaCloud.retryProfileLoad();assert.equal(states(),'AUTHENTICATED');
  localStorage.setItem('chroma-coins','77');fb.fail('setDoc','users/uidA','unavailable',1);
  window.dispatchEvent(new Event('chroma-state-changed'));
  await until(()=>toasts.some(t=>/unavailable/.test(t)));
  assert.equal(localStorage.getItem('chroma-coins'),'77');assert.equal(states(),'AUTHENTICATED');
  await until(()=>fb.store.get('users/uidA').coins===77,6000,'reenvio automático após a rede voltar');
});
T('T09 alterar username salva no Firestore e mantém o estado local consistente',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{username:'alice'});fb.emit(user('uidA'));await until(ready);
  localStorage.setItem('chroma-username','novonome');await window.chromaCloud.persistState();
  assert.equal(fb.store.get('users/uidA').username,'novonome');
  assert.equal(fb.store.get('publicProfiles/uidA').usernameLower,'novonome');   // busca social passa a achar o nome novo
  assert.equal(localStorage.getItem('chroma-username'),'novonome');
  // falha real do servidor chega ao chamador com a causa (para o caller reverter e informar)
  fb.fail('setDoc','users/uidA','permission-denied',1);
  await assert.rejects(()=>window.chromaCloud.persistState(),e=>e.code==='permission-denied'&&/recusou/.test(window.chromaCloud.describeError(e,'salvar o nome')));
});
T('T10 comprar/equipar/debitar usam o UID da sessão atual',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  window.CHROMA_SHOP_CATALOG={'frame-x':{id:'frame-x',price:30}};
  fb.seedUser('uidA',{coins:100});fb.seedUser('uidB',{coins:5});fb.emit(user('uidA'));await until(ready);
  fb.calls.length=0;
  await window.chromaCloud.purchaseShopItem({id:'frame-x',price:30});
  assert.equal(fb.store.get('users/uidA').coins,70);assert.ok(fb.store.get('users/uidA').shop.owned.includes('frame-x'));assert.equal(localStorage.getItem('chroma-coins'),'70');
  await window.chromaCloud.equipShopItem('frame-x','profile','frame-x');assert.equal(fb.store.get('users/uidA').shop.equipped.profile,'frame-x');
  await window.chromaCloud.debitCoins(10);assert.equal(fb.store.get('users/uidA').coins,60);
  assert.ok(fb.calls.filter(c=>c.op==='txGet').every(c=>c.path==='users/uidA'));assert.equal(fb.store.get('users/uidB').coins,5);
  await assert.rejects(()=>window.chromaCloud.debitCoins(9999),e=>/Moedas insuficientes/.test(window.chromaCloud.describeError(e)));
  // conta troca no meio da operação: resultado descartado, B intocada
  const h=fb.hold('txGet','users/uidA');const p=window.chromaCloud.debitCoins(1);await sleep(20);
  fb.emit(user('uidB'));await until(ready);h.release();
  await assert.rejects(p,e=>e.code==='chroma/stale-session');assert.equal(localStorage.getItem('chroma-coins'),'5');assert.equal(fb.store.get('users/uidB').coins,5);
});
T('T11 trocar de conta: dados da anterior NÃO aparecem na nova',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:100,username:'alice',name:'Alice'});fb.seedUser('uidB',{coins:7,username:'bob'});
  fb.emit(user('uidA'));await until(ready);assert.equal(localStorage.getItem('chroma-coins'),'100');
  const h=fb.hold('getDoc','users/uidB');fb.emit(user('uidB'));
  assert.equal(window.firebaseAuthState,'AUTHENTICATED_LOADING_PROFILE');
  for(const k of lsKeys)assert.equal(localStorage.getItem(k),null,k+' de A ainda visível enquanto B carrega');
  h.release();await until(ready);
  assert.equal(localStorage.getItem('chroma-coins'),'7');assert.equal(localStorage.getItem('chroma-username'),'bob');assert.equal(localStorage.getItem('chroma-name'),'');
});
T('T12 deslogar limpa e re-renderiza todo estado dependente da conta',async()=>{
  const {fb,states,seen}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:100,username:'alice'});fb.emit(user('uidA'));await until(ready);
  const before=renderCalls;await click('#accountLogout');await until(()=>states()==='UNAUTHENTICATED');
  for(const k of lsKeys)assert.equal(localStorage.getItem(k),null,k);
  assert.equal(window.firebaseCurrentUserUid,'');assert.equal(window.chromaSocial.isReady(),false);assert.equal(window.chromaCloud.getUser(),null);
  assert.ok(renderCalls>before);assert.equal(document.querySelector('#accountLogout').hidden,true);
  assert.match(window.chromaCloud.getWriteMessage(),/Entre na sua conta/);
});
T('T13 sessão antiga terminando depois de uma nova NÃO sobrescreve a conta atual',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:111,username:'alice'});fb.seedUser('uidB',{coins:222,username:'bob'});
  const h=fb.hold('getDoc','users/uidA');fb.emit(user('uidA'));fb.emit(user('uidB'));
  await until(ready);assert.equal(window.chromaCloud.getUser().uid,'uidB');assert.equal(localStorage.getItem('chroma-coins'),'222');
  h.release();await sleep(120);
  assert.equal(window.chromaCloud.getUser().uid,'uidB');assert.equal(window.firebaseAuthState,'AUTHENTICATED');
  assert.equal(localStorage.getItem('chroma-coins'),'222');assert.equal(localStorage.getItem('chroma-username'),'bob');
  assert.ok(!fb.writes.some(w=>w.path.endsWith('uidA')),'nada pode ser escrito para a conta antiga');
});
T('T14 sincronização: nada antes de pronto; debounce; fila serial; sem loop',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{coins:1});const h=fb.hold('getDoc','users/uidA');fb.emit(user('uidA'));
  await until(()=>states()==='AUTHENTICATED_LOADING_PROFILE');
  localStorage.setItem('chroma-coins','555');window.dispatchEvent(new Event('chroma-state-changed'));await sleep(600);
  assert.equal(fb.calls.filter(c=>c.op==='setDoc').length,0,'não pode salvar antes de o perfil carregar');
  h.release();await until(ready);await sleep(700);
  assert.equal(localStorage.getItem('chroma-coins'),'1','dado local antigo não pode vencer o remoto');assert.equal(fb.store.get('users/uidA').coins,1);
  fb.calls.length=0;fb.setDocDelay=40;
  for(let i=0;i<5;i++){localStorage.setItem('chroma-coins',String(10+i));window.dispatchEvent(new Event('chroma-state-changed'));}
  await sleep(900);assert.equal(fb.calls.filter(c=>c.op==='setDoc'&&c.path==='users/uidA').length,1,'debounce deve coalescer');assert.equal(fb.store.get('users/uidA').coins,14);
  await Promise.all([window.chromaCloud.persistState(),window.chromaCloud.persistState(),window.chromaCloud.persistState()]);
  assert.equal(fb.sdMax,1,'duas sincronizações simultâneas');
  fb.calls.length=0;await sleep(800);assert.equal(fb.calls.filter(c=>c.op==='setDoc').length,0,'loop de sincronização');
});
T('T15 classificação central de erros',async()=>{
  await boot();const c=window.chromaCloud.classifyError;
  const msg=code=>c(Object.assign(new Error('m'),{code})).message;
  for(const code of ['auth/invalid-credential','auth/user-not-found','auth/wrong-password','auth/email-already-in-use','auth/weak-password','auth/invalid-email','auth/popup-closed-by-user','auth/popup-blocked','auth/unauthorized-domain','auth/operation-not-allowed','permission-denied','unauthenticated','unavailable','deadline-exceeded','failed-precondition','network'])
    assert.ok(msg(code)&&!/Não foi possível (realizar|concluir) (esta )?(operação|alteração)/.test(msg(code)),code);
  assert.match(msg('auth/unauthorized-domain'),/chroma\.example/);
  assert.equal(c(Object.assign(new Error('m'),{code:'permission-denied'})).kind,'permission');
  assert.doesNotMatch(msg('permission-denied'),/internet|conex|rede|logad/i);
  assert.equal(c({code:'unavailable'}).retryable,true);assert.equal(c({code:'permission-denied'}).retryable,false);
  assert.match(msg('algo-novo'),/algo-novo/);assert.match(c(new TypeError('x is undefined')).message,/x is undefined/);
  assert.equal(c(new Error('Moedas insuficientes.')).message.includes('Moedas insuficientes.'),true);
});
T('T16 erro do observador -> AUTH_ERROR; falha de publicProfiles não derruba a sessão e não é engolida',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{});fb.emit(user('uidA'));await until(ready);await until(()=>fb.store.has('publicProfiles/uidA'));
  logs.length=0;toasts.length=0;fb.fail('setDoc','publicProfiles/uidA','permission-denied',1);
  localStorage.setItem('chroma-name','Novo Nome');await window.chromaCloud.persistState();
  assert.equal(states(),'AUTHENTICATED');assert.match(window.firebaseSocialError,/recusou/);assert.match(window.firebaseSocialError,/perfil público/);
  assert.ok(toasts.some(t=>/recusou/.test(t)));assert.ok(logs.some(l=>l.join(' ').includes('publishSocialProfile')));
  fb.observers[0].errCb(Object.assign(new Error('boom'),{code:'auth/internal-error'}));
  assert.equal(states(),'AUTH_ERROR');assert.match(window.firebaseAuthError,/Configuração do Firebase/);
});

T('T17 publica rankedBoard com UID atual e expõe todos os jogadores',async()=>{
  const {fb,states}=await boot();await until(()=>states()==='UNAUTHENTICATED');
  fb.seedUser('uidA',{name:'Alice',username:'alice'});fb.emit(user('uidA'));await until(ready);
  localStorage.setItem('chroma-name','Alice');localStorage.setItem('chroma-ranked',JSON.stringify([{name:'Alice',points:42,wins:2,losses:1,played:3}]));await window.chromaCloud.persistState();
  assert.deepEqual(fb.store.get('rankedBoard/uidA'),{uid:'uidA',name:'Alice',username:'alice',photo:'',points:42,wins:2,losses:1,played:3,updatedAt:{__ts:true}});
  fb.store.set('rankedBoard/uidB',{uid:'uidB',name:'Bob',username:'bob',photo:'',points:99,wins:4,losses:0,played:4});
  assert.deepEqual((await window.chromaCloud.readRankedBoard()).map(x=>x.uid).sort(),['uidA','uidB']);
});
T('T18 eventos e participação usam o documento eventId__uid',async()=>{
  const {fb}=await boot();await until(()=>window.firebaseAuthState==='UNAUTHENTICATED');fb.seedUser('uidA',{name:'Alice'});fb.emit(user('uidA'));await until(ready);
  fb.store.set('events/e1',{title:'Guerra de Clãs',description:'Informativo',type:'clan-war',startsAt:1,endsAt:9999999999999,active:true});fb.store.set('events/e2',{title:'Oculto',active:false});
  assert.equal((await window.chromaCloud.listActiveEvents()).length,1);assert.equal(await window.chromaCloud.eventParticipation('e1'),false);await window.chromaCloud.joinEvent('e1');assert.equal(fb.store.get('eventParticipants/e1__uidA').uid,'uidA');assert.equal(await window.chromaCloud.eventParticipation('e1'),true);await window.chromaCloud.leaveEvent('e1');assert.equal(fb.store.has('eventParticipants/e1__uidA'),false);
});
let failed=0;
for(const [name,fn] of tests){
  logs.length=0;
  try{await fn();console.log('  PASS',name);}catch(e){failed++;console.log('  FAIL',name,'\n      ',e&&e.stack?e.stack.split('\n').slice(0,4).join('\n       '):e);}
}
console.warn=realWarn;console.error=realError;
console.log(failed?`\n${failed} teste(s) falharam`:`\nTodos os ${tests.length} testes passaram (Firebase simulado em memória)`);
process.exit(failed?1:0);
