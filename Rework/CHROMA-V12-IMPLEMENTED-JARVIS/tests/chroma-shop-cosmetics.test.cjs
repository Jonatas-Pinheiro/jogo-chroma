'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const shop = fs.readFileSync(path.join(root, 'src/features/chroma-shop.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/chroma-shop.css'), 'utf8');

test('Loja remove apenas a categoria Avatares e mantém os cosméticos de avatar no catálogo interno', () => {
  for (const category of ['Cartas', 'Mesas', 'Molduras', 'Efeitos de Nome']) {
    assert.match(shop, new RegExp(`'${category.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'\\s*:`));
    assert.match(html, new RegExp(`data-c="${category.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"`));
  }
  assert.doesNotMatch(shop, /['"]Avatares['"]\s*:/);
  assert.doesNotMatch(html, /data-c="Avatares"/);
  for (const id of ['avatar-miner', 'avatar-captain', 'avatar-apprentice']) assert.ok(shop.includes(id));
  assert.match(shop, /AVATAR_ITEMS/);
  assert.match(shop, /name: item\.name/);
});

test('compras e equipamentos usam a moeda existente e preservam o armazenamento local ou a transação Firebase', () => {
  assert.match(shop, /localStorage\.setItem\('chroma-coins'/);
  assert.match(shop, /localStorage\.setItem\('chroma-shop'/);
  assert.match(shop, /chromaCloud\.purchaseShopItem/);
  assert.match(shop, /chromaCloud\.equipShopItem/);
  assert.match(shop, /store\.equipped\[item\.type\] = next/);
  assert.match(shop, /window\.CHROMA_SHOP_CATALOG/);
  assert.match(shop, /não sincronizam com Firebase/);
});

test('efeitos de nome têm catálogo, visualização e aplicação ao jogador', () => {
  for (const id of ['name-gold', 'name-diamond', 'name-flame', 'name-ice']) assert.ok(shop.includes(id));
  for (const klass of ['name-effect-gold', 'name-effect-diamond', 'name-effect-flame', 'name-effect-ice']) {
    assert.ok(shop.includes(klass));
    assert.match(css, new RegExp(`\\.${klass}\\s*\\{`));
  }
  assert.match(shop, /#systemHomeName/);
  assert.match(shop, /#systemProfileName/);
  assert.match(shop, /applyCosmetics\(\)/);
});

test('Mina de Ouro e Singularidade têm narrativas curtas sob o título sazonal', () => {
  assert.match(html, /<h1 id="sName">Mina de Ouro<\/h1><p class="season-story" id="sStory">/);
  assert.match(html, /Cada jogada empurra o universo ao colapso\./);
  assert.match(html, /Uma corrida pelos veios raros da mina\./);
});

test('interface da Loja inclui a folha responsiva e não adiciona etapa de build', () => {
  assert.match(html, /src\/styles\/chroma-shop\.css/);
  assert.match(html, /src\/features\/chroma-shop\.js/);
  assert.match(css, /max-width: 420px/);
  assert.match(css, /min-width: 600px/);
  assert.match(css, /min-width: 900px/);
  assert.equal(fs.existsSync(path.join(root, 'package.json')), false);
});
