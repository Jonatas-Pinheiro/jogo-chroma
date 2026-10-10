'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../features/chroma-game-engine.js');

const now = () => 1_000_000;
const randomZero = () => 0;
const card = (id, c, v) => ({ id, c, v });

function match(mode, players = 4) {
  const state = Engine.createMatch({ mode, playerCount: players, random: randomZero, now });
  state.players.forEach(player => { player.bot = true; player.shield = false; });
  return state;
}

test('modos preservam baralho, escudos e Espelho condicionados às regras originais', () => {
  assert.equal(Engine.makeDeck('maldita', false, true).filter(item => item.v === 'shield').length, 4);
  assert.equal(Engine.makeDeck('maldita', false, true).filter(item => item.v === 'mirror').length, 4);
  assert.equal(Engine.makeDeck('eventos', false, false).filter(item => item.v === 'mirror').length, 0);
  assert.equal(Engine.makeDeck('classic', false, true).filter(item => item.v === 'shield').length, 0);
  assert.equal(Engine.makeDeck('caos', false, true).filter(item => item.v === 'shield').length, 4);
  assert.equal(Engine.makeDeck('supercaos', false, true).filter(item => item.v === 'mirror').length, 4);
});

test('Cor Maldita inicial reflete o motor e continua cobrando a carta da cor atual', () => {
  const state = match('maldita', 2);
  assert.equal(state.cursedColor, 'r');
  assert.equal(state.lastEventInfo, null);
  state.turn = 0;
  state.discard = [card('top', 'r', '5')];
  state.color = 'r';
  state.players[0].hand = [card('cursed', 'r', '7'), card('keep', 'b', '8')];
  state.draw = [card('penalty', 'g', '3')];
  assert.equal(Engine.act(state, state.players[0].id, { type: 'play', cardId: 'cursed' }, { now } ), null);
  assert.equal(state.players[0].stats.drawn, 1);
  assert.equal(state.players[0].hand.length, 2);
});

test('evento aleatório registra resultado real no estado serializável e substitui o evento anterior', () => {
  const state = match('eventos', 3);
  state.lastEvent = null;
  state.turnCount = 6;
  state.nextEventAt = 6;
  Engine.beginTurn(state, now, randomZero);
  assert.equal(state.lastEventInfo.id, 'rain');
  assert.equal(state.lastEventInfo.name, 'Chuva de cartas');
  assert.equal(state.lastEventInfo.effectType, 'instant');
  assert.equal(state.lastEventInfo.status, 'applied');
  assert.match(state.lastEventInfo.result, /carta\(s\) comprada\(s\)/);
  assert.equal(Object.hasOwn(state.lastEventInfo, 'duration'), false);
  const synced = JSON.parse(JSON.stringify(state));
  assert.deepEqual(synced.lastEventInfo, state.lastEventInfo);

  state.turnCount = 12;
  state.nextEventAt = 12;
  state.lastEvent = 'rain';
  const directionBefore = state.direction;
  Engine.beginTurn(state, now, randomZero);
  assert.equal(state.lastEventInfo.id, 'reverse');
  assert.equal(state.lastEventInfo.effectType, 'state-change');
  assert.equal(state.direction, -directionBefore);
  const directionAfter = state.direction;
  Engine.beginTurn(state, now, randomZero);
  assert.equal(state.direction, directionAfter, 'redesenhar ou receber o mesmo estado não reaplica o evento');
});

test('eventos instantâneos e alterações de estado não ganham uma duração fictícia', () => {
  const state = match('eventos', 2);
  state.lastEvent = 'rain';
  state.turnCount = 6;
  state.nextEventAt = 6;
  Engine.beginTurn(state, now, randomZero);
  assert.equal(state.lastEventInfo.id, 'reverse');
  assert.equal(state.lastEventInfo.effectType, 'state-change');
  assert.equal(Object.hasOwn(state.lastEventInfo, 'duration'), false);
  assert.match(state.lastEventInfo.description, /sentido.*invertido/i);
});

test('partidas de treinamento terminam nos modos Clássico, Caos, Super Caos, Cor Maldita e Eventos Aleatórios', () => {
  for (const mode of ['classic', 'caos', 'supercaos', 'maldita', 'eventos']) {
    const state = match(mode, 4);
    let steps = 0;
    while (state.phase === 'playing' && steps++ < 5000) Engine.botMove(state, { random: randomZero, now });
    assert.equal(state.phase, 'ended', `${mode}: partida não terminou em 5000 ações`);
    assert.ok(steps > 2, `${mode}: ações suficientes para uma partida`);
  }
});
