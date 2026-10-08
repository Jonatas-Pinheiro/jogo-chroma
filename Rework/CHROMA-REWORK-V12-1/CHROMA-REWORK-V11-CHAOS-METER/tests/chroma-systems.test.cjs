'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src/features/chroma-systems.js');
const source = fs.readFileSync(modulePath, 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const clansSource = fs.readFileSync(path.join(root, 'src/features/chroma-social-clans.js'), 'utf8');

function bootSystems(seed = {}, options = {}) {
  const storage = new Map(Object.entries(seed));
  const listeners = Object.create(null);
  const intervalCallbacks = [];
  const requiredButtons = { '#claim': {}, '#prem': {} };
  const accountClicks = [];
  const accountButton = options.googleAuth ? { dataset: {}, addEventListener(name, callback) { if (name === 'click') accountClicks.push(callback); } } : null;
  if (accountButton) Object.assign(requiredButtons, { '#accountStatus': {}, '#accountGoogle': accountButton, '#accountLogout': { addEventListener() {} }, '#accountMsg': {} });
  const document = {
    body: { insertAdjacentHTML() {} },
    documentElement: { dataset: { season: '1' } },
    querySelector(selector) { return requiredButtons[selector] || null; },
    querySelectorAll() { return []; },
    addEventListener(name, callback) { (listeners[name] ||= []).push(callback); },
    dispatchEvent(event) { for (const callback of listeners[event.type] || []) callback(event); },
  };
  const window = { dispatchEvent() {} };
  if (options.googleAuth) {
    window.chromaCloud = { canWrite: () => false, getUser: () => null };
    window.chromaAuth = { signInGoogle: options.googleAuth, getState: () => 'UNAUTHENTICATED', subscribe() {} };
  }
  const context = {
    document,
    window,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
    },
    Event: class Event { constructor(type) { this.type = type; } },
    Date,
    setInterval(callback) { intervalCallbacks.push(callback); return intervalCallbacks.length; },
    clearInterval() {},
    console,
  };
  vm.runInNewContext(source, context, { filename: modulePath });
  intervalCallbacks.forEach(callback => callback());
  return { systems: window.chromaSystems, storage, document, listeners, accountButton, accountClicks };
}

test('perfil local novo inicia progresso, passe, moedas e amizades em zero/vazio', () => {
  const env = bootSystems({
    'chroma-xp': '840',
    'chroma-cards-played': '27',
    'chroma-coins': '2480',
    'chroma-game-stats': JSON.stringify({ played: 12, wins: 8 }),
    'chroma-battle-pass': JSON.stringify({ season: 's1', xp: 840, claimed: [1] }),
    'chroma-friends': JSON.stringify({ friends: ['jogador_antigo'] }),
  });
  assert.equal(env.systems.getStats().played, 0);
  assert.equal(env.systems.getStats().wins, 0);
  assert.equal(env.systems.getPass().xp, 0);
  assert.deepEqual(Array.from(env.systems.getFriends().friends), []);
  assert.equal(env.storage.get('chroma-xp'), undefined);
  assert.equal(env.storage.get('chroma-cards-played'), undefined);
  assert.equal(env.storage.get('chroma-coins'), '0');
  assert.equal(env.storage.get('chroma-systems-v1-initialized'), '1');
});

test('perfil já identificado por UID mantém os dados locais espelhados da conta remota', () => {
  const env = bootSystems({
    'chroma-cache-owner': 'firebase-user-123',
    'chroma-xp': '840',
    'chroma-cards-played': '27',
    'chroma-coins': '2480',
    'chroma-game-stats': JSON.stringify({ played: 12, wins: 8 }),
    'chroma-battle-pass': JSON.stringify({ season: 's1', xp: 840, claimed: [1] }),
    'chroma-friends': JSON.stringify({ friends: ['jogador_antigo'] }),
  });
  assert.equal(env.systems.getStats().played, 12);
  assert.equal(env.systems.getStats().wins, 8);
  assert.equal(env.systems.getPass().xp, 840);
  assert.deepEqual(Array.from(env.systems.getFriends().friends), ['jogador_antigo']);
  assert.equal(env.storage.get('chroma-xp'), '840');
  assert.equal(env.storage.get('chroma-cards-played'), '27');
  assert.equal(env.storage.get('chroma-coins'), '2480');
});

test('amizade em modo sem login é explícita, local e removível', () => {
  const env = bootSystems();
  assert.equal(env.systems.addFriendLocal('@Amiga_Teste'), true);
  assert.deepEqual(Array.from(env.systems.getFriends().friends), ['amiga_teste']);
  assert.equal(env.systems.addFriendLocal('amiga_teste'), false);
  env.document.dispatchEvent({ type: 'chroma-match-ended', detail: { spectator: false, roundComplete: true, roundId: 'partida-1', mode: 'classic', won: true, played: 11, drawn: 0 } });
  assert.equal(env.systems.getStats().played, 1);
  assert.equal(env.systems.getStats().wins, 1);
});

test('a tela de Clãs está integrada ao Firebase e não usa membros ou clãs fictícios', () => {
  assert.match(indexSource, /src\/features\/chroma-social-clans\.js/);
  assert.doesNotMatch(indexSource, /prévia local independente|let CL=|const CLS=/);
  for (const operation of ['getMyClan', 'listClans', 'createClan', 'joinClan', 'leaveClan', 'transferLeadership']) assert.ok(clansSource.includes(`window.chromaSocial.${operation}`) || clansSource.includes(`window.chromaSocial?.${operation}`) || clansSource.includes(`${operation}(`), `UI deve usar ${operation}`);
  assert.match(clansSource, /data-clan-join/);
  assert.match(clansSource, /clanCreateForm/);
  assert.match(clansSource, /data-clan-transfer/);
  assert.match(indexSource, /id="socialHint"[^>]+role="status"/);
  assert.match(source, /window\.chromaSocial\.sendRequest/);
});

test('partida concluída concede XP, atualiza passe/estatísticas uma vez e ignora evento repetido', () => {
  const env = bootSystems();
  const summary = { spectator: false, roundComplete: true, roundId: 'match-abc:1:started-at-1', mode: 'classic', won: true, played: 7, drawn: 0 };
  env.document.dispatchEvent({ type: 'chroma-match-ended', detail: summary });
  env.document.dispatchEvent({ type: 'chroma-match-ended', detail: summary });
  const stats = env.systems.getStats();
  assert.equal(stats.played, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.cleanHands, 1);
  assert.equal(stats.bestWinStreak, 1);
  assert.equal(env.storage.get('chroma-xp'), '100');
  assert.equal(env.storage.get('chroma-cards-played'), '7');
  assert.equal(env.systems.getPass().xp, 100);
  assert.deepEqual(JSON.parse(env.storage.get('chroma-systems-processed-rounds')), ['match-abc:1:started-at-1']);
});

test('botão Google dinâmico chama o login real disponibilizado pelo Firebase Auth', () => {
  let calls = 0;
  const env = bootSystems({}, { googleAuth() { calls += 1; } });
  assert.ok(env.accountButton);
  assert.equal(env.accountClicks.length, 1);
  env.accountClicks[0]();
  assert.equal(calls, 1);
});

test('login por e-mail abre Entrar e alterna no mesmo modal para Criar conta via Firebase Auth', () => {
  const auth = fs.readFileSync(path.join(root, 'src/current/firebase-auth.js'), 'utf8');
  assert.match(source, /Prefiro E-mail\/Senha/);
  assert.match(source, /id="authModalTitle">Entrar/);
  assert.match(source, /id="authEmail"[^>]+type="email"/);
  assert.match(source, /id="authPassword"[^>]+type="password"/);
  assert.match(source, /id="authModeLink">Criar conta/);
  assert.match(source, /signup \? 'Criar conta' : 'Entrar'/);
  assert.match(source, /auth\?\.createAccount : auth\?\.signInEmail/);
  assert.match(auth, /signInEmail,createAccount/);
  assert.match(auth, /signInWithEmailAndPassword\(auth,normalizedEmail,password\)/);
  assert.match(auth, /createUserWithEmailAndPassword\(auth,String\(email\|\|''\)\.trim\(\),password\)/);
});
