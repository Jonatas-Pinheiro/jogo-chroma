'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const systems = fs.readFileSync(path.join(root, 'src/features/chroma-systems.js'), 'utf8');
const firebase = fs.readFileSync(path.join(root, 'src/current/firebase-auth.js'), 'utf8');
const rulesNote = fs.readFileSync(path.join(root, 'FIREBASE-PRESENTES-REQUISITOS.md'), 'utf8');

test('lista Social usa menu hambúrguer e o modal expõe os quatro comandos pedidos', () => {
  assert.match(systems, /M4 6h16M4 12h16M4 18h16/);
  assert.match(html, /id="friendModal"[^]*role="dialog"/);
  for (const label of ['Enviar presente', 'Ver Perfil', 'Remover amizade', 'Dar apelido']) assert.ok(systems.includes(label));
  assert.match(systems, /friend-action-danger sol/);
  assert.match(systems, /data-friend-choice="remove-confirm"/);
});

test('apelidos são privados por UID e ficam acima do handle oficial', () => {
  assert.match(systems, /chroma-friend-nicknames:\$\{window\.chromaCloud\?\.getUser\?\.\(\)\?\.uid \|\| 'local'\}/);
  assert.match(systems, /friend-identity"><b>\$\{escapeHtml\(nickname\)\}<\/b><small>@\$\{escapeHtml\(username\)\}/);
  assert.match(systems, /O @usuário oficial continua logo abaixo/);
  assert.doesNotMatch(systems, /friendNicknames.*publicProfiles/s);
});

test('presente é transferido na transação e gera notificação em tempo real sem resgate', () => {
  assert.match(firebase, /onSnapshot\(giftsQuery/);
  assert.match(firebase, /tx\.update\(senderRef/);
  assert.match(firebase, /tx\.update\(recipientRef/);
  assert.match(firebase, /status:'delivered',notificationRead:false/);
  assert.match(firebase, /notificationRead:true,notificationReadAt/);
  assert.doesNotMatch(firebase, /redeemSocialGift|redeemGift/);
  assert.match(systems, /Parabéns! \$\{gift\.senderName[^]*vá resgatar agora!/);
  assert.match(systems, /restoreFromServer/);
  assert.match(systems, /window\.go\('inventory'\)/);
  assert.match(systems, /data-inventory-equip=/);
});

test('documentação informa que as regras do projeto Firebase não vieram na ZIP', () => {
  assert.match(rulesNote, /não contém `firestore\.rules`/);
  assert.match(rulesNote, /Cloud Function autenticada/);
  assert.match(rulesNote, /bloqueará/);
});
