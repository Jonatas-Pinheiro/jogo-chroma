'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cardsCss = fs.readFileSync(path.join(root, 'src/styles/chroma-cards.css'), 'utf8');
const gameJs = fs.readFileSync(path.join(root, 'src/features/chroma-game.js'), 'utf8');

test('curingas da mão mantêm cor e brilho da mesa sem perder o estado não jogável', () => {
  assert.match(cardsCss, /#hand\s+\.c-w\s*,\s*#disc\s+\.c-w\s*\{/);
  assert.match(cardsCss, /#hand\.hand\s+\.cd\.c-w\s*\{[^}]*appearance:\s*none\s*;/);
  assert.match(cardsCss, /\.hand\s+\.off\.c-w\s*\{\s*filter:\s*none\s*;/);
  assert.match(cardsCss, /\.hand\s+\.off\s*\{\s*filter:\s*brightness\(/);
  assert.match(cardsCss, /#hand\.hand\s+\.cd:not\(\.off\):not\(\.sel\):hover/);
  assert.match(cardsCss, /#hand\.hand\s+\.cd\.sel\s*,\s*#hand\.hand\s+\.cd\[aria-pressed="true"\]/);
  assert.match(gameJs, /canPlay\s*\?\s*''\s*:\s*' off'/);
  assert.match(gameJs, /aria-disabled="true"/);
  assert.match(gameJs, /if\s*\(button\.getAttribute\('aria-disabled'\)\s*===\s*'true'\)/);
});

test('a dock preserva cinco destinos e a coleção visual só é aberta pelo perfil', () => {
  const dock = html.match(/<nav class="dock" id="dock"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(dock, 'dock principal precisa existir');
  const buttons = [...dock.matchAll(/<button\b[^>]*data-go="([^"]+)"[^>]*>[\s\S]*?<span class="dock-label">([^<]+)<\/span>[\s\S]*?<\/button>/g)];
  assert.equal(buttons.length, 5, 'a dock mantém os cinco destinos originais');
  assert.deepEqual(buttons.map((match) => match[1]), ['home', 'rank', 'shop', 'soc', 'prof']);
  assert.deepEqual(buttons.map((match) => match[2]), ['Início', 'Ranking', 'Loja', 'Social', 'Perfil']);
  assert.doesNotMatch(dock, /data-go="characters"/, 'a coleção não adiciona um sexto atalho ao dock');
  assert.match(html, /\$\('#dock'\)\.hidden\s*=\s*!\[[^\]]*'characters'[^\]]*\]\.includes\(id\)/);
  const screenStart = html.indexOf('<section class="scr col" id="characters"');
  const overlayStart = html.indexOf('<div class="ov profile-customize-overlay"', screenStart);
  const screen = screenStart >= 0 && overlayStart > screenStart ? html.slice(screenStart, overlayStart) : '';
  assert.ok(screen, 'a tela de coleção visual precisa existir');
  assert.match(html, /data-go="characters"[^>]*>ABRIR COLEÇÃO/);
  assert.match(screen, /id="collectionProgress"/);
  assert.match(screen, /id="collectionTabs"/);
  assert.match(screen, /id="collectionPreview"/);
  assert.match(screen, /id="collectionGrid"/);
  assert.match(screen, /não tem atributos ou habilidades de personagens nesta versão/i);
  assert.doesNotMatch(screen, /HP|skills|499\.000|Lv\.1/i, 'não inventa estatísticas, níveis ou preços de personagem');
});

test('a dock usa colunas flexíveis e rótulos que podem quebrar em telas estreitas', () => {
  assert.match(html, /\.dock button\s*\{[^}]*flex:1 1 0;[^}]*min-width:0;[^}]*min-height:52px/s);
  assert.match(html, /\.dock \.dock-label\s*\{[^}]*overflow-wrap:anywhere/s);
});
