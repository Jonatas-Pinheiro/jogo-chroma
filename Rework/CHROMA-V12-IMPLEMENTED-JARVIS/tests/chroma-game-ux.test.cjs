const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'src/features/chroma-game.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'src/features/chroma-game-engine.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles/chroma-cards.css'), 'utf8');

test('a mesa inclui indicadores persistentes acessíveis e status de anúncio separado', () => {
  assert.match(html, /id="cursedIndicator"[^>]*hidden/);
  assert.match(html, /id="eventIndicator"[^>]*hidden/);
  assert.match(html, /id="gameRuleAnnouncement" aria-live="polite"/);
  assert.match(game, /match\.mode === 'maldita'/);
  assert.match(game, /Engine\.COLOR_NAMES\[curseColor\]/);
  assert.match(game, /match\.mode === 'eventos'/);
  assert.match(game, /match\.lastEventInfo/);
  assert.match(game, /ÚLTIMO EVENTO/);
  assert.doesNotMatch(game, /match\.modeNotice\?\.epoch/);
});

test('Cor Maldita e eventos usam dados do motor; eventos sem duração não são chamados de ativos', () => {
  assert.match(engine, /cursedColor: null/);
  assert.match(engine, /lastEventInfo: null/);
  assert.match(engine, /effectType: details\.effectType/);
  assert.match(engine, /result: outcome\.result/);
  assert.match(game, /Troca em <b>\$\{turns\}<\/b>/);
  assert.match(game, /EFEITO INSTANTÂNEO/);
  assert.match(game, /MUDANÇA APLICADA/);
  assert.doesNotMatch(game, /EVENTO ATIVO/);
  assert.doesNotMatch(engine, /duration:\s*\d/);
});

test('a UI filtra somente o histórico visível e preserva os registros do motor/espectador', () => {
  assert.match(game, /visible = match\.log\.filter/);
  assert.match(game, /spectatorItems\.innerHTML = visible\.slice\(-8\)/);
  assert.doesNotMatch(game, /spectatorItems\.innerHTML = match\.log/);
  assert.match(engine, /state\.log\.push\(String\(message\)\)/);
  assert.match(engine, /if \(state\.log\.length > 30\) state\.log\.shift\(\)/);
  assert.match(game, /return JSON\.parse\(JSON\.stringify\(match\)\)/);
});

test('indicadores adaptam a telas estreitas e respeitam movimento reduzido', () => {
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /#game \.rule-copy small \{ font-size: 10px; \}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /game-rule-indicator\.is-updated/);
  assert.match(styles, /\.calm #game \.game-rule-indicator\.is-updated/);
});
