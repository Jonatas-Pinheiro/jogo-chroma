/* CHROMA — cosméticos e Loja. Sem dependências, build ou estado remoto presumido. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const fmt = value => Math.max(0, Number(value) || 0).toLocaleString('pt-BR');
  const NAME_EFFECTS = ['name-effect-gold', 'name-effect-diamond', 'name-effect-flame', 'name-effect-ice'];
  const CARD_SKINS = ['cosmetic-card-gold', 'cosmetic-card-ember', 'cosmetic-card-stone'];
  const TABLE_SKINS = ['table-skin-gallery', 'table-skin-tunnel', 'table-skin-pit'];
  const AVATAR_SKINS = ['avatar-miner', 'avatar-captain', 'avatar-apprentice'];
  const FRAME_SKINS = ['profile-frame-gold', 'profile-frame-void', 'profile-frame-fire'];
  // Itens antigos de avatar continuam válidos no inventário e podem ser presenteados;
  // apenas a categoria pública de compra deixa de ser exibida na Loja.
  const AVATAR_ITEMS = [
      { id: 'avatar-miner', type: 'avatar', name: 'Mineiro', rarity: 'Raro', price: 400, desc: 'Capacete pronto para descer à mina.', kind: 'avatar', skin: AVATAR_SKINS[0], symbol: 'M' },
      { id: 'avatar-captain', type: 'avatar', name: 'Capitão', rarity: 'Épico', price: 900, desc: 'Uma presença de liderança em qualquer partida.', kind: 'avatar', skin: AVATAR_SKINS[1], symbol: 'C' },
      { id: 'avatar-apprentice', type: 'avatar', name: 'Aprendiz', rarity: 'Comum', price: 150, desc: 'O primeiro passo de uma nova jornada.', kind: 'avatar', skin: AVATAR_SKINS[2], symbol: 'A' },
    ];
  const CATALOG = {
    'Cartas': [
      { id: 'back-gold', type: 'cards', name: 'Veio dourado', rarity: 'Lendário', price: 1200, desc: 'Verso escuro com veios de ouro e acabamento metálico.', kind: 'card', skin: CARD_SKINS[0], colors: ['#7a4a12', '#ffd36b'] },
      { id: 'back-ember', type: 'cards', name: 'Brasa', rarity: 'Épico', price: 800, desc: 'Um rastro de calor sobre pedra vulcânica.', kind: 'card', skin: CARD_SKINS[1], colors: ['#7a1f14', '#ff9a5c'] },
      { id: 'back-stone', type: 'cards', name: 'Pedra', rarity: 'Raro', price: 300, desc: 'Rochas cinzentas e um corte de luz mineral.', kind: 'card', skin: CARD_SKINS[2], colors: ['#4d4137', '#cdbba5'] },
    ],
    'Mesas': [
      { id: 'table-gallery', type: 'table', name: 'Galeria', rarity: 'Épico', price: 900, desc: 'Madeira escura com friso de ouro discreto.', kind: 'table', skin: TABLE_SKINS[0], colors: ['#3b2a1c', '#e9a825'] },
      { id: 'table-tunnel', type: 'table', name: 'Túnel', rarity: 'Raro', price: 350, desc: 'Pedra fria e trilhos de aço na mesa.', kind: 'table', skin: TABLE_SKINS[1], colors: ['#2a2f36', '#8aa0b5'] },
      { id: 'table-pit', type: 'table', name: 'Poço', rarity: 'Comum', price: 120, desc: 'Madeira simples, feita para quem está começando.', kind: 'table', skin: TABLE_SKINS[2], colors: ['#33261b', '#7a5c3e'] },
    ],
    'Molduras': [
      { id: 'frame-gold', type: 'profile', name: 'Moldura Dourada', rarity: 'Épico', price: 180, desc: 'Um aro dourado destaca o retrato do jogador.', kind: 'frame', skin: FRAME_SKINS[0], symbol: 'A' },
      { id: 'frame-void', type: 'profile', name: 'Moldura Vazio', rarity: 'Raro', price: 220, desc: 'Um halo violeta inspirado na Singularidade.', kind: 'frame', skin: FRAME_SKINS[1], symbol: 'A' },
      { id: 'frame-fire', type: 'profile', name: 'Moldura Brasa', rarity: 'Raro', price: 190, desc: 'Metal aquecido em tons de laranja e vermelho.', kind: 'frame', skin: FRAME_SKINS[2], symbol: 'A' },
    ],
    'Efeitos de Nome': [
      { id: 'name-gold', type: 'name-effect', name: 'Nome Dourado', rarity: 'Épico', price: 180, desc: 'Aplica dourado legível ao nome do jogador no perfil e durante a partida.', kind: 'name', skin: NAME_EFFECTS[0] },
      { id: 'name-diamond', type: 'name-effect', name: 'Nome Diamante', rarity: 'Mítico', price: 240, desc: 'Um brilho frio de cristal diferencia seu nome na mesa.', kind: 'name', skin: NAME_EFFECTS[1] },
      { id: 'name-flame', type: 'name-effect', name: 'Nome Flamejante', rarity: 'Mítico', price: 280, desc: 'Tons de brasa destacam seu nome sem animação contínua.', kind: 'name', skin: NAME_EFFECTS[2] },
      { id: 'name-ice', type: 'name-effect', name: 'Nome Gelo', rarity: 'Raro', price: 200, desc: 'Um azul-gelo limpo destaca o nome do jogador.', kind: 'name', skin: NAME_EFFECTS[3] },
    ],
  };
  const ITEMS = [...Object.values(CATALOG).flat(), ...AVATAR_ITEMS];
  const BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item]));
  const DEFAULT_EQUIPPED = { profile: '', cards: '', 'name-effect': '', avatar: '', table: '', 'profile-theme': '', 'profile-badge': '' };

  // O Firebase usa este catálogo para validar id, preço e tipo antes da transação.
  window.CHROMA_SHOP_CATALOG = Object.fromEntries(ITEMS.map(item => [item.id, {
    id: item.id, name: item.name, price: item.price, type: item.type, levelOnly: null,
  }]));

  function readStore() {
    try {
      const stored = JSON.parse(localStorage.getItem('chroma-shop') || '{}');
      return {
        ...stored,
        owned: Array.isArray(stored.owned) ? stored.owned : [],
        equipped: { ...DEFAULT_EQUIPPED, ...(stored.equipped || {}) },
        potions: Array.isArray(stored.potions) ? stored.potions : [],
      };
    } catch {
      return { owned: [], equipped: { ...DEFAULT_EQUIPPED }, potions: [] };
    }
  }

  function readBalance() {
    try { return Math.max(0, Math.floor(Number(localStorage.getItem('chroma-coins')) || 0)); }
    catch { return 0; }
  }

  function cloudMode() {
    const cloud = window.chromaCloud;
    if (cloud?.canWrite?.()) return 'firebase';
    if (!cloud) return 'local';
    const state = cloud.getAuthState?.();
    if (state === 'UNAUTHENTICATED') return 'local';
    if (!state) return 'local';
    return 'blocked';
  }

  function updateStoreStatus() {
    const note = $('#shopStorage');
    if (!note) return;
    const mode = cloudMode();
    if (mode === 'firebase') note.textContent = 'Conta pronta: compras e equipamentos serão gravados na conta Firebase.';
    else if (mode === 'local') note.textContent = 'Prévia local: compras ficam salvas neste dispositivo e não sincronizam com Firebase.';
    else note.textContent = 'Sessão em verificação ou indisponível. Nenhuma compra será gravada até a conta estar pronta.';
  }

  function preview(item, compact = false) {
    if (item.kind === 'name') return `<span class="shop-name-preview ${item.skin}">${escapeHtml(localStorage.getItem('chroma-name') || 'Jogador')}</span>`;
    if (item.kind === 'avatar' || item.kind === 'frame') return `<span class="shop-avatar ${item.skin}">${escapeHtml(item.symbol || 'A')}</span>`;
    if (item.kind === 'card') return `<span class="shop-card-preview ${item.skin}" style="--preview-a:${item.colors[0]};--preview-b:${item.colors[1]}"><b>C</b></span>`;
    return `<span class="shop-table-preview ${item.skin}" style="--preview-a:${item.colors[0]};--preview-b:${item.colors[1]}"></span>`;
  }

  function updateBalanceHud(balance) {
    $$('.bal').forEach(pill => {
      const amount = pill.querySelector('span');
      if (amount) amount.textContent = fmt(balance);
      else {
        const text = [...pill.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
        if (text) text.textContent = fmt(balance);
      }
    });
  }

  let activeCategory = 'Cartas';
  let selectedIndex = 0;
  let balance = readBalance();

  function render() {
    const category = CATALOG[activeCategory] ? activeCategory : 'Cartas';
    const items = CATALOG[category];
    selectedIndex = Math.min(Math.max(0, selectedIndex), items.length - 1);
    const selected = items[selectedIndex];
    const store = readStore();
    const isOwned = store.owned.includes(selected.id);
    const isEquipped = store.equipped[selected.type] === selected.id;
    const enough = balance >= selected.price;
    const rarityColor = selected.rarity === 'Lendário' || selected.rarity === 'Mítico' ? 'var(--rl)' : selected.rarity === 'Épico' ? 'var(--re)' : 'var(--rr)';

    $('#cats').innerHTML = Object.keys(CATALOG).map(name => `<button type="button" role="tab" data-c="${escapeHtml(name)}" aria-selected="${name === category}">${escapeHtml(name)}</button>`).join('');
    $('#cats').setAttribute('aria-label', 'Categorias de cosméticos');
    $$('.bal').forEach(pill => { /* atualiza o conteúdo sem substituir o ícone */ });
    updateBalanceHud(balance);
    $('#feat').innerHTML = `<div class="stage cut"><span class="rar" style="color:${rarityColor}">${escapeHtml(selected.rarity)}</span><span class="featured-cosmetic">${preview(selected)}</span></div>
      <div class="fi"><div><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.desc)}</p></div><span class="pr"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 7v10l8 5 8-5V7l-8-5Zm0 4.2 4 2.4v5.8l-4 2.5-4-2.5V8.6l4-2.4Z"/></svg>${fmt(selected.price)}</span></div>
      <button class="btn pri" id="buy" type="button" data-shop-buy="${selected.id}" ${!isOwned && !enough ? 'disabled' : ''}>${isEquipped ? 'DESEQUIPAR' : isOwned ? 'EQUIPAR' : enough ? 'COMPRAR' : 'FALTAM MOEDAS'}</button>`;
    $('#shelf').innerHTML = items.map((item, index) => {
      const owned = store.owned.includes(item.id);
      const equipped = store.equipped[item.type] === item.id;
      return `<button type="button" class="it${index === selectedIndex ? ' selected' : ''}" data-s="${index}" aria-pressed="${index === selectedIndex}">${preview(item, true)}<b>${escapeHtml(item.name)}</b><span>${equipped ? 'Equipado' : owned ? 'Seu' : fmt(item.price)}</span></button>`;
    }).join('');
    updateStoreStatus();
    applyCosmetics();
  }

  function saveLocal(nextStore, nextBalance = balance) {
    try {
      localStorage.setItem('chroma-coins', String(Math.max(0, Math.floor(nextBalance))));
      localStorage.setItem('chroma-shop', JSON.stringify(nextStore));
    } catch (error) {
      throw new Error('O armazenamento deste dispositivo não está disponível.');
    }
    balance = Math.max(0, Math.floor(nextBalance));
    window.dispatchEvent(new Event('chroma-state-changed'));
  }

  function notify(message, type = 'success') {
    window.chromaPreview?.notify?.(message, type);
  }

  async function purchase(item) {
    const mode = cloudMode();
    if (mode === 'blocked') { updateStoreStatus(); notify(window.chromaCloud?.getWriteMessage?.() || 'A conta ainda não está pronta para comprar.', 'error'); return; }
    if (balance < item.price) { notify('Moedas insuficientes para este cosmético.', 'error'); return; }
    const store = readStore();
    if (store.owned.includes(item.id)) { await equip(item); return; }
    try {
      if (mode === 'firebase') {
        await window.chromaCloud.purchaseShopItem({ id: item.id, price: item.price, type: item.type });
        balance = readBalance();
      } else {
        store.owned.push(item.id);
        saveLocal(store, balance - item.price);
      }
      render();
      notify(`${item.name} comprado. Agora você pode equipá-lo.`, 'success');
    } catch (error) {
      notify(window.chromaCloud?.describeError?.(error, 'concluir a compra') || error.message || 'Não foi possível concluir a compra.', 'error');
      if (mode === 'firebase') await window.chromaCloud?.restoreFromServer?.().catch(() => {});
      balance = readBalance();
      render();
    }
  }

  async function equip(item) {
    const mode = cloudMode();
    if (mode === 'blocked') { updateStoreStatus(); notify(window.chromaCloud?.getWriteMessage?.() || 'A conta ainda não está pronta para equipar.', 'error'); return; }
    const store = readStore();
    if (!store.owned.includes(item.id)) { notify('Compre este cosmético antes de equipá-lo.', 'error'); return; }
    const next = store.equipped[item.type] === item.id ? '' : item.id;
    try {
      if (mode === 'firebase') await window.chromaCloud.equipShopItem(item.id, item.type, next);
      else {
        store.equipped[item.type] = next;
        saveLocal(store, balance);
      }
      render();
      notify(next ? `${item.name} equipado.` : `${item.name} removido.`, 'success');
    } catch (error) {
      notify(window.chromaCloud?.describeError?.(error, 'equipar o cosmético') || error.message || 'Não foi possível equipar o cosmético.', 'error');
      if (mode === 'firebase') await window.chromaCloud?.restoreFromServer?.().catch(() => {});
      render();
    }
  }

  function applyCosmetics() {
    const store = readStore();
    const effect = BY_ID[store.equipped['name-effect']];
    const frame = BY_ID[store.equipped.profile];
    const avatar = BY_ID[store.equipped.avatar];
    const card = BY_ID[store.equipped.cards];
    const table = BY_ID[store.equipped.table];
    const effectClass = effect?.type === 'name-effect' ? effect.skin : '';
    const frameClass = frame?.type === 'profile' ? frame.skin : '';
    const avatarClass = avatar?.type === 'avatar' ? avatar.skin : '';
    const currentName = (localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || 'Jogador').trim();

    const knownNameEffects = new Set(NAME_EFFECTS);
    const ownNames = new Set([$('#systemHomeName'), $('#systemProfileName')].filter(Boolean));
    $$('#pl .pn, #pl .nm, #opps .pn, #opps .nm, #myTag .my-name, #endScore li span, #podium b').forEach(node => {
      const text = node.textContent.trim();
      if (node.closest('.you, [data-local-player="true"]') || text === currentName || text.startsWith(`${currentName} `)) ownNames.add(node);
    });
    ownNames.forEach(node => {
      node.classList.forEach(name => { if (knownNameEffects.has(name)) node.classList.remove(name); });
      if (effectClass) node.classList.add(effectClass);
    });

    $$('#hdHome .me .av, #prof .who .av, #pl .you .av, #opps [data-local-player="true"] .av').forEach(node => {
      node.classList.remove(...FRAME_SKINS, ...AVATAR_SKINS);
      if (frameClass) node.classList.add(frameClass);
      if (avatarClass && avatar) {
        node.classList.add(avatarClass);
        node.dataset.cosmeticAvatar = avatar.symbol || '•';
      } else delete node.dataset.cosmeticAvatar;
    });

    const gameTable = $('#game .table');
    if (gameTable) {
      gameTable.classList.remove(...TABLE_SKINS);
      if (table?.type === 'table') gameTable.classList.add(table.skin);
    }
    $$('#game .cd').forEach(node => {
      node.classList.remove(...CARD_SKINS);
      if (card?.type === 'cards') node.classList.add(card.skin);
    });
  }

  $('#cats').onclick = event => {
    const button = event.target.closest('[data-c]');
    if (!button || !CATALOG[button.dataset.c]) return;
    activeCategory = button.dataset.c;
    selectedIndex = 0;
    render();
    $('#cats [aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  $('#shelf').onclick = event => {
    const button = event.target.closest('[data-s]');
    if (!button) return;
    selectedIndex = Number(button.dataset.s) || 0;
    render();
  };
  $('#feat').onclick = event => {
    if (!event.target.closest('[data-shop-buy]')) return;
    const item = CATALOG[activeCategory]?.[selectedIndex];
    if (!item) return;
    const store = readStore();
    if (store.owned.includes(item.id)) { void equip(item); return; }
    $('#mp').innerHTML = preview(item);
    $('#mx').textContent = `${item.name} por ${fmt(item.price)} moedas.`;
    $('#ov').hidden = false;
    $('#yes').focus();
  };
  $('#no').onclick = () => { window.chromaHaptic?.('tap'); $('#ov').hidden = true; };
  $('#yes').onclick = async () => {
    const item = CATALOG[activeCategory]?.[selectedIndex];
    if (!item) return;
    $('#yes').disabled = true;
    $('#yes').textContent = 'AGUARDE…';
    await purchase(item);
    $('#ov').hidden = true;
    $('#yes').disabled = false;
    $('#yes').textContent = 'Comprar';
  };
  $('#ov').onclick = event => { if (event.target.id === 'ov') $('#ov').hidden = true; };
  $('#setBody').addEventListener('click', event => {
    if (event.target.closest('[data-ss]')) setTimeout(render, 0);
  });

  // Mantém a moeda exibida alinhada quando a sessão ou os módulos de progressão a atualizam.
  const previousPreview = window.chromaPreview || {};
  window.chromaPreview = {
    ...previousPreview,
    addCoins(amount) {
      const next = balance + Math.max(0, Math.floor(Number(amount) || 0));
      try { localStorage.setItem('chroma-coins', String(next)); } catch { /* A interface permanece funcional nesta sessão. */ }
      balance = next;
      previousPreview.notify?.(`+${fmt(Math.max(0, Math.floor(Number(amount) || 0)))} moedas.`, 'success');
      render();
      window.dispatchEvent(new Event('chroma-state-changed'));
    },
    setCoins(amount) { balance = Math.max(0, Math.floor(Number(amount) || 0)); updateBalanceHud(balance); render(); },
    refreshShop: render,
  };

  window.addEventListener('chroma-state-changed', () => {
    balance = readBalance();
    render();
    applyCosmetics();
  });
  const observeTargets = ['#pl', '#opps', '#game', '#prof', '#hdHome'];
  let applyQueued = false;
  const observer = new MutationObserver(() => {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(() => { applyQueued = false; applyCosmetics(); });
  });
  observeTargets.map(selector => $(selector)).filter(Boolean).forEach(target => observer.observe(target, { childList: true, subtree: true, characterData: true }));

  const applyAfterStartup = () => {
    requestAnimationFrame(applyCosmetics);
    setTimeout(applyCosmetics, 120);
  };
  if (document.readyState === 'complete') applyAfterStartup();
  else window.addEventListener('load', applyAfterStartup, { once: true });

  window.chromaShop = Object.freeze({ catalog: CATALOG, items: BY_ID, render, applyCosmetics, getState: readStore, equipItem: id => BY_ID[id] ? equip(BY_ID[id]) : Promise.resolve(false) });
  render();
  window.chromaSystems?.renderInventory?.();
})();
