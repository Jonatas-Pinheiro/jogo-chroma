/* ===== ESTADO DA SALA — turno, compra, início de rodada, legalidade de jogadas, ranking local ===== */
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cardName(c){
  const v={skip:'Bloqueio',skip2:'Bloqueio Duplo',rev:'Inverter','+2':'+2','+4':'Coringa +4','+6':'+6','+10':'+10','+99':'+99',wild:'Coringa',swap:'Coringa Troca',eye:'Olho do Paizin',blackhole:'BURACO NEGRO',confuse:'Confusão'}[c.v]||c.v;
  return c.c==='w'?v:v+' '+CNAME[c.c].toLowerCase();
}
function newRoom(code,hostName,profile={}){
  return{
    code,phase:'lobby',opts:{stack:false,effects:false,ranked:false,mode:'classic',dumpColor:false,minutes:10,maxPlayers:4,turnSeconds:6},
    players:[{id:'host',name:hostName,photo:profile.photo||'',gender:profile.gender||'',frame:profile.frame||'',nameEffect:profile.nameEffect||'',hand:[],bot:false,wins:0,called:false,team:0}],
    tournament:{round:0,maxRounds:5,scores:{},finished:false,id:null},
    deckSerial:0,
    draw:[],discard:[],turn:0,dir:1,color:'r',pending:0,drawnId:null,vulnerable:null,winner:null,winnerTeam:null,turnEndsAt:null,endsAt:null,roundId:null,log:[],chat:[]
  };
}
const cur=()=>room.players[room.turn];
const byId=id=>room.players.find(p=>p.id===id);
function log(m){room.log.push(m);if(room.log.length>30)room.log.shift();}
function peekP(k){const n=room.players.length;return room.players[((room.turn+room.dir*k)%n+n)%n];}
function advance(k){const n=room.players.length;room.turn=((room.turn+room.dir*k)%n+n)%n;room.turnEndsAt=Date.now()+(Number(room.opts.turnSeconds)||TURN_SECONDS)*1000;}
function expireTurn(){
  if(!room||room.phase!=='playing'||!room.turnEndsAt||Date.now()<room.turnEndsAt)return;
  const p=cur();if(!p)return;
  room.vulnerable=null;room.drawnId=null;p.called=false;
  const penalty=drawCards(p,1);
  const limit=Number(room.opts.turnSeconds)||TURN_SECONDS;
  log(p.name+' ficou sem jogar em '+limit+' segundos e '+(penalty.length?'recebeu 1 carta aleatória de penalidade e passou a vez.':'passou a vez (o baralho estava vazio).'));
  advance(1);broadcast();
}

function refill(){
  const top=room.discard.pop();
  if((room.opts.mode==='caos'||room.opts.mode==='supercaos') && !room.discard.length){
    room.deckSerial=(room.deckSerial||0)+1;
    room.draw=shuffle(makeDeck(room.opts.mode,room.opts.dumpColor).map((c,i)=>({...c,id:'r'+room.deckSerial+'-'+i})));
    room.discard=top?[top]:[];
    return;
  }
  room.draw=shuffle(room.discard);
  room.discard=top?[top]:[];
}
function drawCards(p,n){
  const out=[];
  for(let k=0;k<n;k++){
    if(!room.draw.length)refill();
    if(!room.draw.length)break;
    const c=room.draw.pop();p.hand.push(c);out.push(c);
  }
  return out;
}
function startRound(){
  room.deckSerial=(room.deckSerial||0)+1;
  room.draw=shuffle(makeDeck(room.opts.mode,room.opts.dumpColor).map((c,i)=>({...c,id:'r'+room.deckSerial+'-'+i})));room.discard=[];
  room.players.forEach(p=>{p.hand=[];p.called=false;});
  for(let k=0;k<7;k++)room.players.forEach(p=>p.hand.push(room.draw.pop()));
  let c,guard=0;
  do{c=room.draw.pop();if(/^\d$/.test(c.v))break;room.draw.unshift(c);}while(++guard<200);
  room.discard.push(c);
  room.color=c.c;room.dir=1;room.pending=0;room.drawnId=null;room.vulnerable=null;room.winner=null;room.winnerTeam=null;
  room.turn=Math.floor(Math.random()*room.players.length);room.turnEndsAt=Date.now()+(Number(room.opts.turnSeconds)||TURN_SECONDS)*1000;
  room.roundId=room.code+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
  room.phase='playing';
  room.endsAt=Date.now()+room.opts.minutes*60000;
  clearInterval(clockTimer);
  clockTimer=setInterval(()=>{
    if(!room||room.phase!=='playing')return;
    if(room.turnEndsAt&&Date.now()>=room.turnEndsAt){expireTurn();return;}
    if(room.endsAt&&Date.now()>=room.endsAt){finishByTime();broadcast();}
  },100);
  room.log=[];room.chat=[];
  if(room.opts.mode==='tournament'){room.tournament.round++;room.tournament.id=room.code+'-'+Date.now();room.players.forEach(p=>{if(room.tournament.scores[p.id]==null)room.tournament.scores[p.id]=0;});}
  log('Rodada iniciada! '+cur().name+' começa.');
}
function isLegal(p,c){
  const top=room.discard[room.discard.length-1];
  if(room.pending>0)return room.opts.stack&&(c.v in PLUS);
  if(c.c==='w'){
    if(c.v==='+4'||c.v==='+6')return !p.hand.some(x=>x.c===room.color);
    return true;
  }
  return c.c===room.color||c.v===top.v;
}
function legalCards(p){
  if(room.drawnId){const c=p.hand.find(x=>x.id===room.drawnId);return c&&isLegal(p,c)?[c]:[];}
  return p.hand.filter(c=>isLegal(p,c));
}
function clampRoomOptions(minutes,maxPlayers,turnSeconds){
  return{minutes:Math.max(MIN_MINUTES,Math.min(MAX_MINUTES,Number(minutes)||10)),maxPlayers:Math.max(MIN_PLAYERS,Math.min(MAX_PLAYERS,Number(maxPlayers)||4)),turnSeconds:Math.max(1,Math.min(30,Number(turnSeconds)||6))};
}

function rankTier(rating){let t=RANK_TIERS[0];for(const x of RANK_TIERS)if(rating>=x.min)t=x;return t;}
function rankedTier(points){let t=RANKED_TIERS[0];for(const x of RANKED_TIERS)if(points>=x.min)t=x;return t;}
function readRank(){try{return JSON.parse(localStorage.getItem('chroma-ranking')||'[]')}catch(e){return []}}
function writeRank(a){try{localStorage.setItem('chroma-ranking',JSON.stringify(a))}catch(e){}}

const ACHIEVEMENTS=[
  {ico:'',image:'CONQUISTA-PRIMEIRA-PARTIDA.png',name:'Estreante',desc:'Jogue sua primeira partida',check:s=>s.played>=1},
  {ico:'',image:'CONQUISTA-VITORIOSO.png',name:'Primeira Vitória',desc:'Vença uma partida',check:s=>s.wins>=1},
  {ico:'',image:'CONQUISTA-QUINZE-PARTIDAS.png',name:'Quinze Partidas',desc:'Jogue 15 partidas',check:s=>s.played>=15},
  {ico:'',name:'Veterano',desc:'Jogue 25 partidas',check:s=>s.played>=25},
  {ico:'',image:'CONQUISTA-MIL-CARTAS.png',name:'Mil Cartas',desc:'Jogue 1.000 cartas',rainbow:true,check:s=>s.cardsPlayed>=1000},
  {ico:'',name:'Sanguinário',desc:'Vença 10 partidas',check:s=>s.wins>=10},
  {ico:'',name:'Prata',desc:'Alcance a patente Prata',check:s=>s.rating>=400},
  {ico:'',name:'Ouro',desc:'Alcance a patente Ouro',check:s=>s.rating>=800},
  {ico:'',name:'Platina',desc:'Alcance a patente Platina',check:s=>s.rating>=1200},
  {ico:'',name:'Grão-Mestre',desc:'Chegue ao topo do ranking',check:s=>s.rating>=3000},
  {ico:'',image:'CONQUISTA-PSICOPATA.png',name:'Psicopata',desc:'Pessoas que jogam no modo claro são estranhas.',check:(s,f)=>f.psicopata},
];
function myFlags(){
  let psicopata=false;try{psicopata=localStorage.getItem('chroma-flag-psicopata')==='1';}catch(e){}
  return {psicopata};
}
function myRankStats(){
  let name='';try{name=localStorage.getItem('chroma-name')||'';}catch(e){}
  const p=name?readRank().find(x=>x.name.toLowerCase()===name.toLowerCase()):null;
  let cardsPlayed=0;try{cardsPlayed=Number(localStorage.getItem('chroma-cards-played')||0)||0;}catch(e){};
  return Object.assign({rating:0,wins:0,losses:0,played:0,cardsPlayed},p||{});
}
