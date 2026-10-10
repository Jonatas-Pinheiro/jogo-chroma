'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../features/chroma-game-engine.js');

const now = () => 1_000_000;
const random = () => 0;
const card = (id, c, v) => ({ id, c, v });

test('timeout aplica exatamente o acúmulo e só resolve uma vez para a mesma época', () => {
  const state = Engine.createMatch({ mode: 'classic', playerCount: 2, random, now });
  const player = state.players[state.turn];
  state.pending = 113;
  state.draw = Array.from({ length: 250 }, (_, index) => card(`penalty-${index}`, 'g', '2'));
  const epoch = state.turnEpoch;
  const handSize = player.hand.length;
  assert.equal(Engine.resolveExpiredTurn(state, epoch, { now }), true);
  assert.equal(player.hand.length, handSize + 113);
  assert.equal(state.pending, 0);
  assert.equal(state.turnCount, 1);
  assert.equal(Engine.resolveExpiredTurn(state, epoch, { now }), false);
  assert.equal(player.hand.length, handSize + 113);
});

test('repetir a mesma ação recebida não joga a carta nem avança o turno duas vezes', () => {
  for (const repetitions of [10, 50, 100, 250]) {
    const state = Engine.createMatch({ mode: 'classic', playerCount: 2, random, now });
    const player = state.players[state.turn];
    state.discard = [card('top', 'r', '5')];
    state.color = 'r';
    player.hand = [card('play-once', 'r', '7'), card('keep', 'b', '8')];
    const action = { type: 'play', cardId: 'play-once', _id: 'same-event' };
    for (let index = 0; index < repetitions; index += 1) {
      assert.equal(Engine.act(state, player.id, action, { now }), null);
    }
    assert.equal(state.discard.filter(item => item.id === 'play-once').length, 1);
    assert.equal(player.hand.some(item => item.id === 'play-once'), false);
    assert.equal(state.turnCount, 1);
  }
});
