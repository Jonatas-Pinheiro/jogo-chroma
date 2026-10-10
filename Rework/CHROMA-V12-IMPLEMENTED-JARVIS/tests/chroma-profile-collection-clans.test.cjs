'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const systems = fs.readFileSync(path.join(root, 'src/features/chroma-systems.js'), 'utf8');
const shop = fs.readFileSync(path.join(root, 'src/features/chroma-shop.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src/current/firebase-auth.js'), 'utf8');
const clans = fs.readFileSync(path.join(root, 'src/features/chroma-social-clans.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/chroma-systems.css'), 'utf8');

test('modal de perfil é acessível e expõe UID somente da sessão atual', () => {
  assert.match(html, /id="profileCustomizeModal"[^>]*hidden/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="profileCustomizeTitle"/);
  assert.match(html, /id="profileNameForm"[^>]*hidden/);
  assert.match(systems, /window\.chromaCloud\?\.getUser\?\.\(\)\?\.uid/);
  assert.match(systems, /window\.chromaSocial\.publishSocialProfile\(\)/);
  assert.match(systems, /document\.addEventListener\('keydown',[\s\S]*event\.key === 'Escape'[\s\S]*closeProfileCustomize\(\)/);
  assert.match(systems, /Apelido salvo somente neste dispositivo/);
  assert.match(systems, /Não foi possível atualizar o perfil/);
});

test('personalização lista cosméticos do catálogo e só equipa itens no inventário', () => {
  assert.match(systems, /Object\.values\(api\?\.items \|\| \{\}\)/);
  assert.match(systems, /data-profile-equip=/);
  assert.match(systems, /data-profile-shop=/);
  assert.match(systems, /Itens bloqueados não podem ser equipados/);
  assert.match(shop, /const owned = new Set\(store\.owned\.map\(String\)\)/);
  assert.match(shop, /owned\.has\(store\.equipped\.profile\)/);
  assert.match(shop, /openItem\(id\)/);
});

test('coleção visual deriva progresso, propriedade, filtros e aquisição do estado real', () => {
  assert.match(html, /id="collectionProgress"/);
  assert.match(html, /id="collectionTabs"/);
  assert.match(systems, /levelFromXP\(xp\)/);
  assert.match(systems, /new Set\(Array\.isArray\(state\.owned\)/);
  assert.match(systems, /shopCategoryFor\(api, selected\.id\)/);
  assert.match(systems, /AQUISIÇÃO INDISPONÍVEL NESTA LOJA/);
  assert.match(systems, /openCollectionShopItem\(itemId\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});

test('avatar e moldura possuídos são publicados no perfil público e reutilizados em amizades e clãs', () => {
  assert.match(auth, /ownedSocialCosmeticId\('avatar','avatar'\)/);
  assert.match(auth, /ownedSocialCosmeticId\('profile','profile'\)/);
  assert.match(auth, /safePublicCosmetic\(data\.avatarId,'avatar'\)/);
  assert.match(auth, /safePublicCosmetic\(data\.profileFrameId,'profile'\)/);
  assert.match(auth, /p\.avatarId,p\.profileFrameId/);
  assert.match(shop, /await social\.publishSocialProfile\(\)/);
  assert.match(shop, /o equipamento continua salvo na conta/);
  assert.match(systems, /cosmetics\.previewItem\?\.\(avatarItem\.id, true\)/);
  assert.match(systems, /profile\?\.profileFrameId/);
  assert.match(clans, /memberAvatar\(profile, display\)/);
  assert.match(css, /\.friend-avatar-cosmetic \.shop-avatar/);
  assert.match(css, /\.friend-avatar\.profile-frame-gold/);
});

test('painel de clã mostra ID e descrição persistidos sem inventar presença online', () => {
  assert.match(clans, /const description = String\(clan\.description \|\| ''\)\.trim\(\)/);
  assert.match(clans, /ID DO CLÃ/);
  assert.match(clans, /Nenhuma descrição cadastrada/);
  assert.match(clans, /memberAvatar\(profile, display\)/);
  assert.match(clans, /presença online ou em partida não é fornecida/);
  assert.doesNotMatch(clans, /Online|Offline/);
});
