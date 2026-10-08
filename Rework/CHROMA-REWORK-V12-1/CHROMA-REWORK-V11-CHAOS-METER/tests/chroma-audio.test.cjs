'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src/features/chroma-audio.js');
const source = fs.readFileSync(modulePath, 'utf8');

function bootAudio() {
  const instances = [];
  const listeners = Object.create(null);
  const storage = new Map();
  const buttonListeners = Object.create(null);
  const button = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { buttonListeners[name] = callback; },
  };
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.ended = false;
      this.currentTime = 0;
      this.volume = 1;
      this.playCalls = 0;
      this.pauseCalls = 0;
      instances.push(this);
    }
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); }
    pause() { this.pauseCalls += 1; this.paused = true; }
  }
  const document = {
    hidden: false,
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    getElementById(id) { return id === 'audioToggle' ? button : null; },
  };
  const context = {
    Audio: FakeAudio,
    document,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
    },
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: modulePath });
  return { audio: context.ChromaAudio, instances, listeners, storage, button, buttonListeners };
}

function durationOf(file) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
  assert.equal(result.status, 0, `ffprobe falhou em ${file}: ${result.stderr}`);
  return Number(result.stdout.trim());
}

test('música inicia após interação no Lobby e também no jogo, pausando ao sair desses contextos', () => {
  const env = bootAudio();
  const track = env.instances[0];
  env.audio.setMusicContext(true);
  assert.equal(track.playCalls, 0, 'a reprodução automática aguarda um gesto do usuário');
  env.listeners.pointerdown[0]();
  assert.equal(track.playCalls, 1);
  env.audio.setGameActive(true);
  env.audio.setGameScreenActive(true);
  assert.equal(track.paused, false, 'a trilha permanece ativa durante a partida');
  env.audio.setMusicContext(false);
  assert.equal(track.paused, true);
  env.audio.setMusicContext(true);
  assert.equal(track.playCalls, 2, 'a trilha volta ao abrir Lobby/partida');
});

test('controles independentes de volume e habilitação são persistidos', () => {
  const env = bootAudio();
  const track = env.instances[0];
  assert.equal(env.audio.getMusicVolume(), 0.19);
  assert.equal(env.audio.getSfxVolume(), 0.45);
  env.audio.setMusicVolume(0);
  assert.equal(env.audio.getMusicVolume(), 0);
  env.audio.setMusicVolume(0.63);
  env.audio.setSfxVolume(0.28);
  assert.equal(track.volume, 0.63);
  assert.equal(env.audio.getMusicVolume(), 0.63);
  assert.equal(env.audio.getSfxVolume(), 0.28);
  assert.equal(env.storage.get('chroma-music-volume'), '0.63');
  assert.equal(env.storage.get('chroma-sfx-volume'), '0.28');
  env.audio.setMusicEnabled(false);
  env.audio.setSfxEnabled(false);
  assert.equal(env.storage.get('chroma-music-enabled'), '0');
  assert.equal(env.storage.get('chroma-sfx-enabled'), '0');
});

test('card-fan-1 e card-fan-2 tocam em sequência somente no início da partida', () => {
  const env = bootAudio();
  env.listeners.pointerdown[0]();
  env.audio.setGameActive(true);
  env.audio.setGameScreenActive(true);
  ['select', 'draw', 'pass', 'error', 'chroma', 'catch'].forEach(action => env.audio.gameAction(action));
  env.audio.playUi('tap');
  env.audio.finish(true);
  assert.equal(env.instances.length, 1, 'ações fora da lista autorizada não criam canais de SFX');
  env.audio.gameAction('roundStart');
  const firstFan = env.instances.find(item => path.basename(item.src) === 'card-fan-1.ogg');
  assert.ok(firstFan);
  assert.equal(firstFan.playCalls, 1);
  assert.equal(firstFan.playbackRate, 1.05);
  assert.equal(env.instances.filter(item => path.basename(item.src) === 'card-fan-2.ogg' && item.playCalls > 0).length, 0, 'o segundo clipe aguarda o fim do primeiro');
  firstFan.onended();
  const played = env.instances.filter(item => item.playCalls > 0 && item !== env.instances[0]);
  assert.equal(played.length, 2);
  assert.equal(played.reduce((sum, item) => sum + item.playCalls, 0), 2);
  assert.deepEqual(played.map(item => path.basename(item.src)).sort(), ['card-fan-1.ogg', 'card-fan-2.ogg']);
  for (const item of played) {
    assert.ok(item.src.includes('assets/audio/kenney-casino/Audio/'), `origem inesperada: ${item.src}`);
    assert.ok(item.volume <= 0.2, `volume SFX excessivo: ${item.volume}`);
  }
  assert.match(source, /const MATCH_START_FILES\s*=\s*\['card-fan-1\.ogg', 'card-fan-2\.ogg'\]/);
  assert.doesNotMatch(source, /card-slide|card-shove|card-shuffle|chip-lay|chips-|dice-|die-throw/i);
  assert.equal((fs.readFileSync(path.join(root, 'src/features/chroma-game.js'), 'utf8').match(/gameAction\('roundStart'\)/g) || []).length, 1, 'o gancho de início aparece somente na criação de partida nova');
  const fan1Duration = durationOf(path.join(root, 'assets/audio/kenney-casino/Audio/card-fan-1.ogg'));
  const fan2Duration = durationOf(path.join(root, 'assets/audio/kenney-casino/Audio/card-fan-2.ogg'));
  const totalDuration = fan1Duration / 1.05 + fan2Duration;
  assert.ok(totalDuration >= 1 && totalDuration <= 2, `card-fan-1 + card-fan-2 duram ${totalDuration}s, fora de 1–2s`);
});

test('som de colocação alterna exclusivamente entre os quatro card-place e é silenciado pelas preferências', () => {
  const env = bootAudio();
  env.listeners.pointerdown[0]();
  ['play', 'play', 'play', 'play'].forEach(action => env.audio.gameAction(action));
  const played = env.instances.filter(item => item.playCalls > 0 && item !== env.instances[0]);
  assert.equal(new Set(played.map(item => path.basename(item.src))).size, 4);
  assert.deepEqual(Array.from(new Set(played.map(item => path.basename(item.src)))).sort(), ['card-place-1.ogg', 'card-place-2.ogg', 'card-place-3.ogg', 'card-place-4.ogg']);
  assert.ok(played.every(item => item.volume <= 0.2));
  env.audio.setMuted(true);
  const previousCalls = env.instances.reduce((sum, item) => sum + item.playCalls, 0);
  env.audio.gameAction('play');
  assert.equal(env.instances.reduce((sum, item) => sum + item.playCalls, 0), previousCalls);
  assert.equal(env.storage.get('chroma-audio-muted'), '1');
  assert.equal(env.button.attributes['aria-label'], 'Ativar sons');
});

test('todos os efeitos declarados existem e a trilha entregue está conectada', () => {
  const referenced = [...source.matchAll(/['"]([a-z][a-z0-9-]+\.ogg)['"]/g)].map(match => match[1]);
  assert.ok(referenced.length > 0);
  for (const file of new Set(referenced)) {
    assert.ok(fs.existsSync(path.join(root, 'assets/audio/kenney-casino/Audio', file)), `arquivo ausente: ${file}`);
  }
  assert.ok(fs.existsSync(path.join(root, 'assets/audio/kenney-casino/Audio/card-fan-1.ogg')));
  assert.ok(fs.existsSync(path.join(root, 'assets/audio/main-theme.mp3')));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="audioToggle"/);
  assert.match(html, /chroma-systems\.js/);
  assert.match(html, /firebase-auth\.js/);
  const systems = fs.readFileSync(path.join(root, 'src/features/chroma-systems.js'), 'utf8');
  assert.match(systems, /id="musicVolume"/);
  assert.doesNotMatch(systems, /musicVolumeGame/);
});
