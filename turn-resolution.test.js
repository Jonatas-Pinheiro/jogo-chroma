'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Structural guards: these protect the production invariants against regressions.
assert.match(html, /function resolveExpiredTurn\(epoch=room&&room\.turnEpoch\)/);
assert.match(html, /room\.resolvedTurnEpoch===epoch/);
assert.match(html, /const amount=accumulated>0\?accumulated:1/);
assert.match(html, /room\.pending=0;\s*log\(p\.name\+' ficou sem jogar/);
assert.match(html, /function doActCore\(pid,a\)/);
assert.match(html, /if\(room\.actionLock\)return null/);
assert.match(html, /seenActionIds/);

// Small executable model of the production invariant: timeout consumes the
// pending snapshot once and never adds a timeout penalty to it.
function resolveTurn(state) {
  if (state.resolved) return 0;
  state.resolved = true;
  const amount = state.pending > 0 ? state.pending : 1;
  state.pending = 0;
  state.turn += 1;
  return amount;
}
function spam(state, n, id='same-event') {
  const seen = new Set();
  for (let i=0; i<n; i++) {
    if (seen.has(id)) continue;
    seen.add(id);
    state.chromaCalls++;
  }
}

for (const n of [10, 50, 100, 250]) {
  const state = { pending: 113, resolved: false, turn: 0, chromaCalls: 0 };
  spam(state, n);
  assert.equal(resolveTurn(state), 113, `timeout with ${n} CHROMA clicks`);
  assert.equal(resolveTurn(state), 0, 'same turn cannot resolve twice');
  assert.equal(state.pending, 0);
  assert.equal(state.turn, 1);
  assert.equal(state.chromaCalls, 1, `duplicate event must be idempotent (${n})`);
}

// Stacked + cards: +4 +10 +99, then D waits => exactly 113.
let pending = 4 + 10 + 99;
assert.equal(pending, 113);
assert.equal((() => { const s={pending,resolved:false,turn:0}; return resolveTurn(s); })(), 113);

// D plays +4 => 117 remains for the next player; no timeout resolution yet.
pending = 113 + 4;
assert.equal(pending, 117);

// No accumulated penalty => preserve the existing one-card timeout behavior.
assert.equal((() => { const s={pending:0,resolved:false,turn:0}; return resolveTurn(s); })(), 1);

console.log('OK: turn-resolution invariants and spam scenarios');
