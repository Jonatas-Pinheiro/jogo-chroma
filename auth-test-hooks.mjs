// Hooks do Node usados SOMENTE por auth-session.test.mjs: trocam os imports https://www.gstatic.com/firebasejs/... por
// stubs em memória (Auth + Firestore falsos, com injeção de falhas). Nenhuma chamada real ao Firebase é feita.
const STUBS={
'firebase-app.js':`export const initializeApp=()=>({});`,
'firebase-auth.js':`
const fb=()=>globalThis.__fb;
export const getAuth=()=>fb().auth;
export const setPersistence=async()=>{if(fb().failPersistence)throw Object.assign(new Error('persistence'),{name:'FirebaseError',code:'auth/internal-error'});};
export const browserLocalPersistence={};
export const onAuthStateChanged=(auth,cb,errCb)=>{const f=fb();f.observers.push({cb,errCb});setTimeout(()=>{if(f.restore)cb(f.persistedUser||null);},0);return()=>{};};
const err=(code,extra={})=>Object.assign(new Error('Firebase: Error ('+code+').'),{name:'FirebaseError',code},extra);
export const signInWithEmailAndPassword=async(auth,email,pw)=>{const a=fb().accounts.get(email);if(!a||a.password!==pw)throw err('auth/invalid-credential');fb().persistedUser=a.user;fb().emit(a.user);return{user:a.user};};
export const createUserWithEmailAndPassword=async(auth,email,pw)=>{if(fb().accounts.has(email))throw err('auth/email-already-in-use');const user={uid:'uid-new-'+(++fb().autoId),email,displayName:null};fb().accounts.set(email,{password:pw,user});fb().persistedUser=user;fb().emit(user);return{user};};
export class GoogleAuthProvider{static credentialFromError(e){return e.credential;}}
export const signInWithPopup=async()=>{if(fb().popupError)throw fb().popupError;const u=fb().googleUser;fb().persistedUser=u;fb().emit(u);return{user:u};};
export const linkWithCredential=async(user,cred)=>{fb().linked.push({uid:user.uid,cred});if(fb().linkError)throw fb().linkError;return{user};};
export const signOut=async()=>{fb().persistedUser=null;fb().emit(null);};
export const sendPasswordResetEmail=async()=>{};
export const updateProfile=async(u,p)=>{Object.assign(u,p);};`,
'firebase-firestore.js':`
const fb=()=>globalThis.__fb;
const clone=v=>v===undefined?undefined:structuredClone(v);
export const serverTimestamp=()=>({__ts:true});
export const getFirestore=()=>({});
const mk=p=>({path:p,id:p.split('/').pop()});
export const collection=(db,...s)=>({kind:'col',path:s.join('/')});
export const doc=(base,...s)=>base&&base.kind==='col'&&s.length===0?mk(base.path+'/auto'+(++fb().autoId)):mk(s.join('/'));
async function gate(op,path){const f=fb();f.calls.push({op,path});
  for(const h of f.holds){if(!h.used&&h.op===op&&path.includes(h.path)){h.used=true;await h.promise;break;}}
  const i=f.fails.findIndex(x=>x.op===op&&path.includes(x.path)&&x.times>0);
  if(i>=0){const x=f.fails[i];x.times--;throw Object.assign(new Error(x.message||('Firestore: '+x.code)),{name:'FirebaseError',code:x.code});}}
const snapOf=p=>({id:p.split('/').pop(),exists:()=>fb().store.has(p),data:()=>clone(fb().store.get(p))});
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v)&&!v.__ts;
function mergeInto(t,s){for(const [k,v] of Object.entries(s)){if(isObj(v)&&isObj(t[k]))mergeInto(t[k],v);else t[k]=clone(v);}return t;}
function setPath(o,path,val){const ks=path.split('.');let c=o;for(let i=0;i<ks.length-1;i++){if(!isObj(c[ks[i]]))c[ks[i]]={};c=c[ks[i]];}c[ks[ks.length-1]]=clone(val);}
function applySet(path,data,opts){const f=fb();const cur=f.store.get(path);f.writes.push({path,data:clone(data)});f.store.set(path,opts&&opts.merge&&cur?mergeInto(clone(cur),data):clone(data));}
function applyUpdate(path,data){const f=fb();const cur=f.store.get(path);if(!cur)throw Object.assign(new Error('not-found'),{name:'FirebaseError',code:'not-found'});const n=clone(cur);for(const [k,v] of Object.entries(data)){if(k.includes('.'))setPath(n,k,v);else n[k]=clone(v);}f.writes.push({path,data:clone(data)});f.store.set(path,n);}
export const getDoc=async r=>{await gate('getDoc',r.path);return snapOf(r.path);};
export const setDoc=async(r,data,opts)=>{const f=fb();f.sdIn++;f.sdMax=Math.max(f.sdMax,f.sdIn);try{await gate('setDoc',r.path);if(f.setDocDelay)await new Promise(x=>setTimeout(x,f.setDocDelay));applySet(r.path,data,opts);}finally{f.sdIn--;}};
export const addDoc=async(c,data)=>{await gate('addDoc',c.path);const p=c.path+'/auto'+(++fb().autoId);applySet(p,data);return mk(p);};
export const deleteDoc=async r=>{await gate('deleteDoc',r.path);fb().store.delete(r.path);};
export const runTransaction=async(db,fn)=>{await gate('runTransaction','tx');const ops=[];
  const tx={get:async r=>{await gate('txGet',r.path);return snapOf(r.path);},set:(r,d,o)=>ops.push(()=>applySet(r.path,d,o)),update:(r,d)=>ops.push(()=>applyUpdate(r.path,d))};
  const out=await fn(tx);for(const o of ops)o();return out;};
export const query=(col,...cs)=>({col,cs});
export const where=(f,op,v)=>({k:'w',f,op,v});
export const orderBy=f=>({k:'o',f});
export const limit=n=>({k:'l',n});
export const getDocs=async q=>{await gate('getDocs',q.col.path);const f=fb();
  let docs=[...f.store.entries()].filter(([p])=>p.startsWith(q.col.path+'/')&&!p.slice(q.col.path.length+1).includes('/'));
  for(const c of q.cs){if(c.k==='w')docs=docs.filter(([p,d])=>{const v=d[c.f];return c.op==='=='?v===c.v:c.op==='>='?v>=c.v:c.op==='<='?v<=c.v:c.op==='array-contains'?Array.isArray(v)&&v.includes(c.v):false;});if(c.k==='l')docs=docs.slice(0,c.n);}
  return{empty:docs.length===0,docs:docs.map(([p])=>snapOf(p))};};`
};
export async function resolve(spec,ctx,next){
  if(spec.startsWith('https://www.gstatic.com/firebasejs/'))return{url:'stub:'+spec.split('/').pop(),shortCircuit:true};
  return next(spec,ctx);
}
export async function load(url,ctx,next){
  if(url.startsWith('stub:'))return{format:'module',source:STUBS[url.slice(5)],shortCircuit:true};
  return next(url,ctx);
}
