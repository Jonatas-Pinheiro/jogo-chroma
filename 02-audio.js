/* ===== ÁUDIO — música ambiente e efeitos sonoros (Web Audio API) ===== */
let music=null,musicMode=null;
const MUSIC_BY_MODE={classic:'CLASSICO.mp3',caos:'ULTIMOS-MINUTOS.mp3',supercaos:'ULTIMOS-MINUTOS.mp3'};
function stopMusic(){
  if(!music)return;
  music.pause();music.currentTime=0;music=null;musicMode=null;
}
function syncMusic(mode,playing=true){
  const src=playing?MUSIC_BY_MODE[mode]:null;
  if(!src){stopMusic();return;}
  if(music&&musicMode===mode){music.volume=musicVolume;return;}
  stopMusic();
  music=new Audio(src);music.loop=true;music.volume=musicVolume;musicMode=mode;
  const p=music.play();if(p&&p.catch)p.catch(()=>{});
}
function setMusicVolume(v){musicVolume=Math.max(0,Math.min(1,Number(v)||0));try{localStorage.setItem('chroma-music-volume',String(musicVolume));}catch(e){}if(music)music.volume=musicVolume;}
function setSfxVolume(v){sfxVolume=Math.max(0,Math.min(1,Number(v)||0));try{localStorage.setItem('chroma-sfx-volume',String(sfxVolume));}catch(e){}if(master)master.gain.value=sfxVolume;}
function syncAudioVolumes(){const m=$('#musicVolume'),s=$('#sfxVolume');if(m)m.value=String(Math.round(musicVolume*100));if(s)s.value=String(Math.round(sfxVolume*100));}
function audio(){
  if(!actx){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    try{actx=new AC();master=actx.createGain();master.gain.value=sfxVolume;master.connect(actx.destination);}
    catch(e){actx=null;return null;}
  }
  if(actx.state==='suspended'){try{actx.resume();}catch(e){}}
  return actx;
}
function tone(freq,dur,o={}){
  const a=audio();if(!a||sfxVolume<=0)return;
  const t=a.currentTime+(o.at||0),osc=a.createOscillator(),g=a.createGain();
  osc.type=o.type||'sine';osc.frequency.setValueAtTime(freq,t);
  if(o.slide)osc.frequency.exponentialRampToValueAtTime(Math.max(40,freq+o.slide),t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(o.vol||.15,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(g);g.connect(master);osc.start(t);osc.stop(t+dur+.03);
}
function noise(dur,o={}){
  const a=audio();if(!a||sfxVolume<=0)return;
  if(!nbuf){nbuf=a.createBuffer(1,a.sampleRate,a.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const t=a.currentTime+(o.at||0),src=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();
  src.buffer=nbuf;f.type='bandpass';f.Q.value=o.q||1;f.frequency.setValueAtTime(o.freq||1500,t);
  if(o.sweep)f.frequency.exponentialRampToValueAtTime(o.sweep,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(o.vol||.2,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(f);f.connect(g);g.connect(master);src.start(t,Math.random()*.4,dur+.05);src.stop(t+dur+.05);
}
const sfx={
  play(at=0){noise(.09,{vol:.4,at,freq:1700,q:.7});tone(160,.13,{vol:.32,at,slide:-100});},
  draw(at=0){noise(.17,{vol:.24,at,freq:800,sweep:2800,q:1.2});},
  deal(at=0){for(let i=0;i<7;i++)noise(.07,{vol:.16,at:at+i*.07,freq:2200,q:1});},
  turn(at=0){tone(660,.18,{vol:.15,at});tone(990,.3,{vol:.13,at:at+.11});},
  skip(at=0){tone(560,.24,{type:'square',vol:.07,at,slide:-340});},
  rev(at=0){tone(300,.18,{type:'triangle',vol:.16,at,slide:600});tone(900,.2,{type:'triangle',vol:.14,at:at+.16,slide:-600});},
  plus2(at=0){tone(260,.09,{type:'square',vol:.08,at});tone(260,.09,{type:'square',vol:.08,at:at+.11});},
  plus4(at=0){for(let i=0;i<4;i++)tone(320-i*35,.1,{type:'sawtooth',vol:.08,at:at+i*.09});},
  wild(at=0){[523,659,784,1047].forEach((f,i)=>tone(f,.16,{type:'triangle',vol:.14,at:at+i*.06}));},
  chroma(at=0){[523,659,784].forEach((f,i)=>tone(f,.14,{type:'triangle',vol:.16,at:at+i*.07}));tone(1047,.4,{type:'triangle',vol:.16,at:at+.22});},
  alert(at=0){tone(880,.09,{type:'square',vol:.06,at});tone(880,.09,{type:'square',vol:.06,at:at+.14});},
  turnWarning(at=0){tone(880,.1,{type:'square',vol:.09,at});tone(1175,.16,{type:'square',vol:.1,at:at+.13});},
  buzz(at=0){tone(170,.28,{type:'sawtooth',vol:.13,at,slide:-50});},
  win(at=0){[523,659,784,1047,1319].forEach((f,i)=>tone(f,.28,{type:'triangle',vol:.16,at:at+i*.11}));},
  lose(at=0){[392,349,294,220].forEach((f,i)=>tone(f,.3,{vol:.14,at:at+i*.14}));},
  err(at=0){tone(180,.14,{type:'square',vol:.07,at,slide:-50});},
  join(at=0){tone(600,.1,{vol:.14,at});tone(800,.14,{vol:.14,at:at+.09});},
  chat(at=0){tone(740,.08,{type:'sine',vol:.12,at});tone(988,.14,{type:'triangle',vol:.13,at:at+.07});},
  click(){tone(720,.04,{vol:.05});}
};
function cardSfx(c){
  sfx.play();
  if(c.v==='skip')sfx.skip(.05);else if(c.v==='rev')sfx.rev(.05);
  else if(c.v==='+2')sfx.plus2(.05);else if(c.v==='+4')sfx.plus4(.05);
  else if(c.v==='wild')sfx.wild(.05);
}
function warn(msg){toast(msg);sfx.err();}

/* ---- cartas voando (clones em position:fixed, animados com WAAPI) ---- */
