'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

// Testa funções REAIS do script inline, sem duplicar a lógica em um modelo.
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const section=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`Trecho de produção não encontrado: ${start}`);
  return html.slice(a,b);
};
const engine=[
  section('const MIN_PLAYERS=2','const QUICK_MESSAGES='),
  html.match(/^const CNAME=.*;$/m)?.[0],
  section('function makeDeck(', 'function clampRoomOptions('),
  section('function teamConfig(', 'function removePlayer('),
  section('function scheduleBot(', '/* ---------- estado enviado'),
  section('function viewFor(', 'function broadcast(')
].join('\n');
function harness(mode='eventos',stack=true,players=2){
  const errors=[];
  const context=vm.createContext({
    console:{warn:(...a)=>errors.push(a),error:(...a)=>errors.push(a),log(){ }},
    window:{firebaseCurrentUserUid:null},localStorage:{getItem:()=>''},
    setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
    eventTrace:[]
  });
  vm.runInContext(`let room=null,clockTimer=null,botTimer=null;const conns={};
    function scoreTournamentRound(){}function safeFrameClass(){return ''}
    function safeNameEffect(){return ''}function showEyeView(){}
    function broadcast(){}
    ${engine}
    const originalLog=log;
    log=function(message){if(message.startsWith('EVENTO: '))eventTrace.push(message);originalLog(message)};
  `,context);
  vm.runInContext(`room=newRoom('TESTE','Host');room.opts.mode='${mode}';room.opts.stack=${stack};
    room.players[0].bot=true;room.players[0].botDifficulty='master';
    for(let i=1;i<${players};i++)room.players.push({id:'p'+i,name:'Bot '+i,hand:[],bot:true,botDifficulty:'master',wins:0,called:false,shield:false,team:null});
    startRound();`,context);
  const run=code=>vm.runInContext(code,context);
  return {run,errors,context};
}
const card=(id,c,v)=>`{id:'${id}',c:'${c}',v:'${v}'}`;
function ready(h,first,second){
  h.run(`room.discard=[${card('top','r','5')}];room.color='r';room.turn=0;
    room.players[0].hand=[${first},${card('f0','g','4')}];
    room.players[1].hand=[${second},${card('f1','b','4')}];`);
}
test('baralho por modo: quatro Escudos coloridos, quatro Espelhos apenas com acúmulo',()=>{
  const h=harness('maldita',true);
  assert.equal(h.run("makeDeck('maldita',false,true).filter(c=>c.v==='shield').length"),4);
  assert.equal(h.run("makeDeck('maldita',false,true).filter(c=>c.v==='mirror').length"),4);
  assert.equal(h.run("makeDeck('eventos',false,false).filter(c=>c.v==='mirror').length"),0);
  assert.equal(h.run("makeDeck('classic',false,true).filter(c=>c.v==='shield').length"),0);
  assert.equal(h.run("makeDeck('caos',false,true).filter(c=>c.v==='shield').length"),4);
  assert.equal(h.run("makeDeck('supercaos',false,true).filter(c=>c.v==='mirror').length"),4);
});
test('Escudo absorve +N sem acúmulo, mas a pessoa perde a vez',()=>{
  const h=harness('maldita',false);
  ready(h,card('p','r','+2'),card('p2','y','7'));
  h.run('room.players[1].shield=true');
  assert.equal(h.run("doAct('host',{type:'play',cardId:'p'})"),null);
  assert.equal(h.run('room.players[1].hand.length'),2);
  assert.equal(h.run('room.players[1].shield'),false);
  assert.equal(h.run('room.turn'),0);
  assert.equal(h.run('room.pending'),0);
});
test('Espelho reflete +2 em duas pessoas; escudo no jogador anterior absorve ao comprar',()=>{
  const h=harness('maldita',true);
  ready(h,card('plus','r','+2'),card('esp','w','mirror'));
  assert.equal(h.run("doAct('host',{type:'play',cardId:'plus'})"),null);
  assert.equal(h.run('room.pending'),2);
  assert.equal(h.run("legalCards(room.players[1]).some(c=>c.v==='mirror')"),true);
  h.run('room.players[0].shield=true');
  assert.equal(h.run("doAct('p1',{type:'play',cardId:'esp',color:'b'})"),null);
  assert.equal(h.run('room.turn'),0);
  assert.equal(h.run('room.pending'),2);
  assert.equal(h.run('room.dir'),1);
  assert.equal(h.run("doAct('host',{type:'draw'})"),null);
  assert.equal(h.run('room.pending'),0);
  assert.equal(h.run('room.players[0].shield'),false);
  assert.equal(h.run('room.players[0].hand.length'),1);
  assert.equal(h.run('room.turn'),1);
});
test('Espelho devolve +99 inteiro, sem duplicar nem inverter',()=>{
  const h=harness('supercaos',true);
  ready(h,card('plus','w','+99'),card('esp','w','mirror'));
  assert.equal(h.run("doAct('host',{type:'play',cardId:'plus',color:'g'})"),null);
  assert.equal(h.run('room.pending'),99);
  assert.equal(h.run("doAct('p1',{type:'play',cardId:'esp',color:'r'})"),null);
  assert.equal(h.run('room.pending'),99);
  assert.equal(h.run('room.turn'),0);
  assert.equal(h.run('room.dir'),1);
  h.run("doAct('host',{type:'draw'})");
  assert.equal(h.run('room.pending'),0);
  assert.equal(h.run('room.players[0].hand.length'),100);
});
test('timeout consome o snapshot de +99 uma única vez; Escudo só absorve acúmulo',()=>{
  const h=harness('supercaos',true);
  h.run('room.pending=99;room.players[0].shield=true;room.turn=0');
  const old=h.run('room.turnEpoch'),count=h.run('room.players[0].hand.length');
  assert.equal(h.run(`resolveExpiredTurn(${old})`),true);
  assert.equal(h.run(`resolveExpiredTurn(${old})`),false);
  assert.equal(h.run('room.pending'),0);
  assert.equal(h.run('room.players[0].hand.length'),count);
  assert.equal(h.run('room.players[0].shield'),false);
  h.run('room.pending=0;room.turn=0;room.players[0].shield=true');
  const next=h.run('room.turnEpoch'),before=h.run('room.players[0].hand.length');
  h.run(`resolveExpiredTurn(${next})`);
  assert.equal(h.run('room.players[0].hand.length'),before+1);
  assert.equal(h.run('room.players[0].shield'),true);
});
test('Cor Maldita cobra após o efeito; não cobra nem bloqueia vitória com última carta',()=>{
  const h=harness('maldita',false);
  ready(h,card('curse','r','2'),card('other','y','1'));
  h.run("room.cursedColor='r';room.players[0].shield=true;");
  assert.equal(h.run("doAct('host',{type:'play',cardId:'curse'})"),null);
  assert.equal(h.run('room.players[0].hand.length'),2);
  assert.equal(h.run('room.players[0].shield'),true);
  assert.equal(h.run('room.vulnerable'),null);
  h.run(`room.turn=0;room.players[0].hand=[${card('last','r','9')}];room.color='r';room.cursedColor='r'`);
  assert.equal(h.run("doAct('host',{type:'play',cardId:'last'})"),null);
  assert.equal(h.run('room.phase'),'ended');
  assert.equal(h.run('room.players[0].hand.length'),0);
  assert.equal(h.run('room.winner'),'host');
});
test('Eventos só no início livre, sem repetição e sem zerar as mãos; espectadores não recebem cartas',()=>{
  const h=harness('eventos',true,3);
  h.run('room.turnCount=6;room.nextEventAt=6;room.pending=2;beginTurn()');
  assert.equal(h.run('room.lastEvent'),null);
  h.run('room.pending=0;room.drawnId="carta-comprada";room.turnCount=7;beginTurn()');
  assert.equal(h.run('room.lastEvent'),null);
  h.run('room.drawnId=null;room.turnCount=8;beginTurn()');
  assert.equal(h.context.eventTrace.length,1);
  for(let i=0;i<17;i++){
    h.run(`room.turnCount=room.nextEventAt;beginTurn()`);
  }
  const ids=h.context.eventTrace.map(text=>text.split('!')[0]);
  for(let i=1;i<ids.length;i++)assert.notEqual(ids[i],ids[i-1]);
  assert.equal(h.run('room.players.every(p=>p.hand.length>=1)'),true);
  h.run('room.players[0].shield=true;eventRain()');
  assert.equal(h.run('room.players[0].shield'),false);
  const spectator=h.run('spectatorView()');
  assert.equal(spectator.hand.length,0);
  assert.equal(spectator.legal.length,0);
  assert.equal(spectator.drawnId,null);
  assert.equal(spectator.players.every(p=>!Object.hasOwn(p,'hand')),true);
  assert.equal(typeof spectator.lastEvent,'string');
  assert.equal(h.errors.length,0);
});
test('Treinamento simulado: partidas completas contra bots em Cor Maldita e Eventos Aleatórios',()=>{
  for(const mode of ['maldita','eventos']){
    const h=harness(mode,true,4);
    let steps=0;
    while(h.run("room.phase==='playing'")&&steps++<5000)h.run('botMove()');
    assert.equal(h.run('room.phase'),'ended',`${mode}: partida não terminou em 5000 jogadas`);
    assert.equal(h.errors.length,0,`${mode}: erro no console`);
    assert.ok(steps>2,`${mode}: jogadas suficientes`);
  }
});
