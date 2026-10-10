'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const inputJs = fs.readFileSync(path.join(root, 'src/features/chroma-rework-inputs.js'), 'utf8');
const settingsJs = fs.readFileSync(path.join(root, 'src/features/chroma-rework-settings.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/chroma-rework.css'), 'utf8');

function localFile(relative, from = root) {
  const clean = relative.split(/[?#]/)[0];
  return fs.existsSync(path.resolve(from, clean));
}

test('todas as imagens, scripts e folhas de estilo locais do HTML existem', () => {
  const refs = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map(match => match[1]);
  const missing = refs.filter(ref => !ref.startsWith('#') && !/^(?:https?:|data:|mailto:|javascript:)/i.test(ref) && !localFile(ref));
  assert.deepEqual(missing, []);
});

test('URLs locais do CSS de rework apontam para assets existentes', () => {
  const urls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/gi)].map(match => match[1]);
  const missing = urls.filter(url => !/^(?:https?:|data:|#)/i.test(url) && !localFile(url, path.join(root, 'src/styles')));
  assert.deepEqual(missing, []);
});

test('todos os 30 botões de emote usam apenas PNGs Style 1', () => {
  const buttons = [...html.matchAll(/data-emote-src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(buttons.length, 30);
  assert.ok(buttons.every(ref => /^assets\/chroma-ui\/emotes\/style-1\/emote_[a-zA-Z0-9_]+\.png$/.test(ref)));
  assert.ok(buttons.every(ref => localFile(ref)));
  assert.equal(fs.readdirSync(path.join(root, 'assets/chroma-ui/emotes/style-1')).filter(name => name.endsWith('.png')).length, 30);
});

test('o spritesheet de interface usa imagens locais do pacote nos 20 símbolos principais', () => {
  const replaced = [...html.matchAll(/<symbol id="(?:i-[^"]+|s-[^"]+)"[^>]*><image[^>]+href="(assets\/chroma-ui\/icons\/[^\"]+)"/g)];
  assert.equal(replaced.length, 20);
  assert.ok(replaced.every(match => localFile(match[1])));
});

test('preferências de tema/perfil/ponteiro são válidas e persistidas localmente', () => {
  for (const profile of ['pc', 'tablet', 'phone']) assert.match(html, new RegExp(`data-profile-choice="${profile}"`));
  for (const theme of ['dark', 'light']) assert.match(html, new RegExp(`data-theme-choice="${theme}"`));
  assert.match(settingsJs, /localStorage\.getItem\(KEY/);
  assert.match(settingsJs, /localStorage\.setItem\(KEY/);
  assert.match(settingsJs, /dataset\.deviceProfile/);
  assert.match(settingsJs, /dataset\.theme/);
  assert.match(settingsJs, /dataset\.cursorStyle/);
});

test('legenda de teclado fica só no perfil PC e legenda de controle depende de conexão', () => {
  assert.match(css, /\.input-legend\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /html\[data-device-profile="pc"\]\s+#inputLegend\s*\{\s*display:\s*flex;\s*\}/);
  assert.match(html, /id="controllerLegend"[^>]*\shidden/);
  assert.match(inputJs, /controllerLegend\.hidden\s*=\s*!pad/);
});

test('atalhos PC e entrada de controle usam ações existentes e detecção de conexão', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', "key === 'd'", "key === 'n'", "key === 'c'", "key === 'p'", "event.key === 'Enter'"]) assert.ok(inputJs.includes(key), `missing ${key}`);
  for (const id of ['#drawPile', '#passBtn', '#chromaBtn', '#pauseGame', '#play', '#cancelTarget']) assert.ok(inputJs.includes(id), `missing action ${id}`);
  assert.match(inputJs, /navigator\.getGamepads/);
  assert.match(inputJs, /gamepadconnected/);
  assert.match(inputJs, /gamepaddisconnected/);
  assert.match(inputJs, /pcProfile\(\)/);
  assert.match(inputJs, /isTextEntry\(event\.target\)/);
  assert.match(inputJs, /function moveQuickReaction/);
});

test('cursores personalizados ficam limitados a ponteiros precisos', () => {
  const gate = '@media (hover: hover) and (pointer: fine)';
  const start = css.indexOf(gate);
  assert.notEqual(start, -1);
  const end = css.indexOf('\n}', start);
  const customRules = css.slice(start, end);
  assert.doesNotMatch(css.slice(0, start), /cursor:\s*url/i);
  for (const cursor of ['pointer-outline.png', 'pointer-shaded.png', 'hand-outline.png', 'hand-shaded.png']) assert.ok(css.includes(cursor));
  assert.equal((customRules.match(/cursor:\s*url/gi) || []).length, 4);
});
