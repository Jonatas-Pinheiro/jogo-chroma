/* ===== CONFIG & ESTADO GLOBAL — constantes do jogo, variáveis de sessão, helpers $/esc ===== */
'use strict';
/* =====================================================================
   CHROMA — jogo de cartas online (P2P via PeerJS)
   O host da sala roda o jogo; os outros jogadores se conectam a ele.
   ===================================================================== */
const APP='chroma-v1-';
const ICE=[
  {urls:'stun:stun.l.google.com:19302'},
  {urls:'stun:stun1.l.google.com:19302'},
  {urls:'stun:global.stun.twilio.com:3478'}
];
// Se algum amigo não conseguir entrar (comum em 4G/CGNAT), adicione um servidor TURN aqui:
// ICE.push({urls:'turn:SEU_SERVIDOR:3478',username:'usuario',credential:'senha'});

const MIN_PLAYERS=2,MAX_PLAYERS=10,MIN_MINUTES=5,MAX_MINUTES=20,TURN_SECONDS=6;
const COLORS=['r','y','g','b'];
  const PLUS={'+2':2,'+4':4,'+6':6,'+10':10,'+99':99};
  const MODES={classic:'Clássico',caos:'Caos',supercaos:'Super Caos',tournament:' Torneio',team2x2:'2×2 · Duplas',team3x3:'3×3 · Trios'};
  const QUICK_MESSAGES=['Boa jogada!','Vamos lá!','Cuidado!','Não acredito!','Foi por pouco!','CHROMA!','GG!'];
const TOURNAMENT_POINTS=[100,75,55,40,30,20,10,5];
const RANK_TIERS=[{name:'Bronze',icon:'',min:0,next:400},{name:'Prata',icon:'',min:400,next:800},{name:'Ouro',icon:'',min:800,next:1200},{name:'Platina',icon:'',min:1200,next:1700},{name:'Diamante',icon:'',min:1700,next:2300},{name:'Mestre',icon:'',min:2300,next:3000},{name:'Grão-Mestre',icon:'',min:3000,next:null}];
const RANK_IMAGE_BY_NAME={Prata:'PRATA.png',Ametista:'AMETISTA.png',Ouro:'OURO.png',Diamante:'DIAMANTE.png',Dominador:'DOMINADOR.png',Soberano:'SOBERANO.png'};
const RANKED_TIERS=[
  {name:'Prata',level:'I',min:0,next:40},{name:'Prata',level:'II',min:40,next:85},{name:'Prata',level:'III',min:85,next:135},{name:'Prata',level:'IV',min:135,next:190},
  {name:'Ametista',level:'I',min:190,next:250},{name:'Ametista',level:'II',min:250,next:320},{name:'Ametista',level:'III',min:320,next:400},{name:'Ametista',level:'IV',min:400,next:490},
  {name:'Ouro',level:'I',min:490,next:590},{name:'Ouro',level:'II',min:590,next:700},{name:'Ouro',level:'III',min:700,next:820},{name:'Ouro',level:'IV',min:820,next:950},
  {name:'Diamante',level:'I',min:950,next:1090},{name:'Diamante',level:'II',min:1090,next:1240},{name:'Diamante',level:'III',min:1240,next:1400},{name:'Diamante',level:'IV',min:1400,next:1580},
  {name:'Dominador',level:'I',min:1580,next:1770},{name:'Dominador',level:'II',min:1770,next:1970},{name:'Dominador',level:'III',min:1970,next:2180},{name:'Dominador',level:'IV',min:2180,next:2420},
  {name:'Soberano',level:'I',min:2420,next:2680},{name:'Soberano',level:'II',min:2680,next:2960},{name:'Soberano',level:'III',min:2960,next:3260},{name:'Soberano',level:'IV',min:3260,next:null}
];
const CNAME={r:'Vermelho',y:'Amarelo',g:'Verde',b:'Azul'};
const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BOT_NAMES=['Bia','Caio','Dudu','Lia','Zeca','Nina','Theo','Rafa'];
let BOT_MIN=900, BOT_VAR=800;

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let room=null, peer=null, isHost=false, hostConn=null, myId=null, view=null;
let botTimer=null, toastT=null, colorCb=null, joined=false, clockTimer=null;
let pingMs=null, pingUpdatedAt=0, hostRtts={}, pingTimer=null;
let lastTop=null, prevIds=new Set(), wasMyTurn=false;
let quickChatCooldownUntil=0;
let turnWarningKey='';
let eyeTargetCb=null,eyeViewTimer=null;
const CHAT_BUBBLE_MS=4000;
const conns={};

/* ---------------------------------------------------------------
   SOM (sintetizado com WebAudio, sem arquivos) E ANIMAÇÕES DE CARTA
--------------------------------------------------------------- */
const RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
let muted=false,musicVolume=.35,sfxVolume=.9;
try{
  muted=localStorage.getItem('chroma-mute')==='1';
  musicVolume=Math.max(0,Math.min(1,Number(localStorage.getItem('chroma-music-volume'))));
  sfxVolume=Math.max(0,Math.min(1,Number(localStorage.getItem('chroma-sfx-volume'))));
  if(!Number.isFinite(musicVolume))musicVolume=muted?0:.35;
  if(!Number.isFinite(sfxVolume))sfxVolume=muted?0:.9;
}catch(e){}
let actx=null,master=null,nbuf=null;
