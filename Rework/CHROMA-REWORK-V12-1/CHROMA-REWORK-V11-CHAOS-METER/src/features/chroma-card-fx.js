/* ==========================================================
   CHROMA · animações das cartas
   Como funciona (resumo):
   1) O jogo chama before() ANTES de redesenhar a tela e after() DEPOIS.
   2) Aqui comparamos "como estava" com "como ficou" e descobrimos o
      que aconteceu: carta comprada, carta jogada, quem jogou...
   3) Para cada coisa, rodamos uma animação curta (Web Animations API).
   Nada aqui muda as regras do jogo: só o visual.
   ========================================================== */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const app = $('#app');
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  // Lembra como a mesa estava no último desenho
  let prev = null;

  // Texto que aparece sobre cartas especiais
  const BADGES = {
    '+2': '+2', '+4': '+4', '+6': '+6', '+10': '+10', '+99': '+99',
    skip: 'PULOU!', skip2: '2× PULO!', rev: 'INVERTEU!', swap: 'TROCA!',
    mirror: 'ESPELHO!', shield: 'ESCUDO!', eye: 'OLHO!', confuse: 'CONFUSÃO!',
    blackhole: 'BURACO NEGRO!',
  };

  // Respeita "Reduzir movimento" (classe .calm) e a preferência do sistema
  function canAnimate() {
    if (typeof Element.prototype.animate !== 'function') return false;
    if (app && app.classList.contains('calm')) return false;
    return !(reducedQuery && reducedQuery.matches);
  }

  const center = rect => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

  // ---------- 1) Foto da mão ANTES do redesenho ----------
  function before() {
    const handRects = new Map();
    document.querySelectorAll('#hand [data-card-id]').forEach(el => {
      handRects.set(el.dataset.cardId, el.getBoundingClientRect());
    });
    return { handRects };
  }

  // ---------- Peças de animação ----------

  // Faz um elemento "viajar" de uma posição (rect) até onde ele está agora
  function flyFrom(el, fromRect, { delay = 0, duration = 420, spin = 0 } = {}) {
    const to = el.getBoundingClientRect();
    if (!to.width || !fromRect.width) return;
    const a = center(fromRect);
    const b = center(to);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const s = fromRect.width / to.width;
    el.animate([
      { translate: `${dx}px ${dy}px`, scale: s, rotate: `${spin}deg`, opacity: 0 },
      { translate: `${dx * .7}px ${dy * .7}px`, scale: s + (1 - s) * .3, rotate: `${spin * .7}deg`, opacity: 1, offset: .12 },
      { translate: '0px 0px', scale: 1, rotate: '0deg', opacity: 1 },
    ], { duration, delay, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  }

  // Cria uma cópia da carta presa à tela (fixed), para poder voar por cima de tudo
  function makeGhost(source, rect, faceDown) {
    let ghost;
    if (faceDown) {
      ghost = document.createElement('div');
      ghost.className = 'cd bk';
      ghost.innerHTML = '<b class="v">C</b>';
    } else {
      ghost = source.cloneNode(true);
      ghost.removeAttribute('aria-label');
    }
    ghost.classList.add('fx-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.setProperty('--cw', `${rect.width}px`);
    document.body.appendChild(ghost);
    return ghost;
  }

  // Fantasma voa de fromRect até toRect
  function flyGhost(ghost, fromRect, toRect, { delay = 0, duration = 420, spin = 0, endScale = 1, endOpacity = 1 } = {}) {
    const a = center(fromRect);
    const b = center(toRect);
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const s = fromRect.width / toRect.width;
    const anim = ghost.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(${s})`, opacity: 0 },
      { transform: `translate(${dx * .8}px, ${dy * .8}px) rotate(${spin * .8}deg) scale(${s + (1 - s) * .2})`, opacity: 1, offset: .1 },
      { transform: `translate(${dx * .12}px, ${dy * .12 - 12}px) rotate(${spin * .1}deg) scale(${endScale * 1.08})`, opacity: 1, offset: .78 },
      { transform: `translate(0px, 0px) rotate(0deg) scale(${endScale})`, opacity: endOpacity },
    ], { duration, delay, easing: 'cubic-bezier(.25,.7,.3,1)', fill: 'both' });
    return anim;
  }

  // Carta jogada: voa até a mesa e, ao chegar, mostra o impacto
  function landOnTable(topEl, fromRect, spin, card, color) {
    const to = topEl.getBoundingClientRect();
    if (!to.width || !fromRect.width) return;
    const ghost = makeGhost(topEl, to, false);
    topEl.style.visibility = 'hidden'; // esconde a carta real até a cópia chegar
    const done = () => {
      ghost.remove();
      topEl.style.visibility = '';
      impact(topEl, card, color);
    };
    const anim = flyGhost(ghost, fromRect, to, { duration: 400, spin });
    anim.onfinish = done;
    anim.oncancel = done;
  }

  // Efeito quando a carta encosta na mesa
  function impact(el, card, color) {
    if (!el.isConnected) return;
    el.animate([{ scale: 1.14 }, { scale: 1 }], { duration: 240, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    el.animate([
      { boxShadow: `0 6px 0 #0008, 0 0 0 0 ${color}` },
      { boxShadow: `0 6px 0 #0008, 0 0 0 24px transparent` },
    ], { duration: 460, easing: 'ease-out' });
    special(el, card);
  }

  // Efeitos extras para cartas especiais
  function special(el, card) {
    const text = BADGES[card.v];
    if (!text) return;
    if (card.v === 'rev') {
      el.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 520, easing: 'ease-out' });
    } else if (card.v === 'skip' || card.v === 'skip2' || card.v === 'blackhole') {
      el.animate([
        { translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' },
        { translate: '-4px 0' }, { translate: '0 0' },
      ], { duration: 320 });
    }
    const plus = Number.parseInt(card.v.replace('+', ''), 10);
    if (Number.isFinite(plus) && String(card.v).startsWith('+')) {
      const amp = Math.min(3 + plus / 3, 9); // quanto maior a compra, mais forte a tremida
      $('.table')?.animate([
        { translate: '0 0' }, { translate: `${-amp}px 0` }, { translate: `${amp}px 0` },
        { translate: `${-amp / 2}px 0` }, { translate: '0 0' },
      ], { duration: 300, easing: 'ease-in-out' });
    }
    showBadge(text);
  }

  function showBadge(text) {
    const disc = $('#disc');
    if (!disc) return;
    disc.querySelectorAll('.fx-badge').forEach(old => old.remove());
    const badge = document.createElement('span');
    badge.className = 'fx-badge';
    badge.textContent = text;
    badge.setAttribute('aria-hidden', 'true');
    disc.appendChild(badge);
    const anim = badge.animate([
      { opacity: 0, transform: 'scale(.5)' },
      { opacity: 1, transform: 'scale(1.15)', offset: .25 },
      { opacity: 1, transform: 'scale(1)', offset: .7 },
      { opacity: 0, transform: 'translateY(-14px) scale(1)' },
    ], { duration: 950, easing: 'ease-out', fill: 'both' });
    anim.onfinish = anim.oncancel = () => badge.remove();
  }

  // O monte "dá um solavanco" quando alguém compra
  function kickPile() {
    $('#drawPile')?.animate([{ scale: 1 }, { scale: .93 }, { scale: 1 }], { duration: 220 });
  }

  // ---------- 2) Comparação DEPOIS do redesenho ----------
  // Quando a partida começa, o jogo desenha as cartas ANTES de mostrar a tela.
  // Escondida, a tela não tem tamanho para medir; então esperamos ela aparecer.
  let waitingFrame = 0;
  let latest = null;
  function waitUntilVisible() {
    if (waitingFrame) return;
    let tries = 0;
    const check = () => {
      waitingFrame = 0;
      const game = $('#game');
      if (game && game.offsetWidth) {
        const call = latest;
        latest = null;
        if (call) after(call.snap, call.match, call.ctx);
      } else if (++tries < 60) {
        waitingFrame = requestAnimationFrame(check);
      } else {
        latest = null;
      }
    };
    waitingFrame = requestAnimationFrame(check);
  }

  function after(snap, match, ctx = {}) {
    if (!match) return;
    const game = $('#game');
    // Tela escondida: guarda o pedido e tenta de novo quando ela aparecer.
    // (Não gasta o "estado anterior", por isso a distribuição ainda será animada.)
    if (!game || !game.offsetWidth) {
      latest = { snap, match, ctx };
      waitUntilVisible();
      return;
    }

    const handEls = [...document.querySelectorAll('#hand [data-card-id]')];
    const ids = new Set(handEls.map(el => el.dataset.cardId));
    const counts = new Map(match.players.map(player => [player.id, player.hand.length]));
    const top = match.discard[match.discard.length - 1];
    const topKey = top ? `${top.id}|${top.c}|${top.v}` : '';
    const last = prev || { ids: new Set(), counts: new Map(), topKey: '', selectedId: null };
    prev = { ids, counts, topKey, selectedId: ctx.selectedId || null };

    if (!canAnimate()) return;

    const pileRect = $('#drawPile')?.getBoundingClientRect();
    const color = getComputedStyle(document.documentElement).getPropertyValue(`--${match.color}`).trim() || '#ffb81c';

    // a) Cartas novas na mão do jogador: voam do monte (várias = distribuição, com atraso entre elas)
    const fresh = handEls.filter(el => !last.ids.has(el.dataset.cardId));
    if (fresh.length && pileRect && pileRect.width) {
      fresh.forEach((el, index) => {
        flyFrom(el, pileRect, { delay: Math.min(index, 10) * 70, duration: 440, spin: -10 });
      });
      kickPile();
    }

    // b) Carta jogada por alguém: voa da mão (jogador) ou do avatar (bot) até a mesa
    const topEl = $('#disc .cd');
    if (top && topEl && topKey !== last.topKey && last.topKey) {
      const mine = snap?.handRects.get(top.id);
      if (mine) {
        landOnTable(topEl, mine, (Math.random() - .5) * 16, top, color);
      } else {
        const player = match.players.find(p => p.id !== ctx.humanId && (last.counts.get(p.id) ?? 0) > p.hand.length);
        const source = player && $(`#opps [data-player-id="${CSS.escape(String(player.id))}"]`);
        const rect = source?.getBoundingClientRect();
        if (rect && rect.width) landOnTable(topEl, rect, (Math.random() < .5 ? -1 : 1) * (10 + Math.random() * 10), top, color);
      }
    }

    // c) Bots que compraram cartas: costas de carta voam do monte até eles
    if (pileRect && pileRect.width) {
      let order = 0;
      for (const player of match.players) {
        if (player.id === ctx.humanId) continue;
        const gained = player.hand.length - (last.counts.get(player.id) ?? 0);
        if (gained <= 0) continue;
        const target = $(`#opps [data-player-id="${CSS.escape(String(player.id))}"]`)?.getBoundingClientRect();
        if (!target || !target.width) continue;
        const total = gained >= 5 ? 3 : Math.min(gained, 4); // distribuição inicial mostra poucas cartas
        for (let k = 0; k < total; k += 1) {
          const ghost = makeGhost(null, pileRect, true);
          const anim = flyGhost(ghost, pileRect, target, { delay: order * 45 + k * 95, duration: 420, spin: 14, endScale: .3, endOpacity: .2 });
          anim.onfinish = anim.oncancel = () => ghost.remove();
        }
        order += 1;
        kickPile();
      }
    }

    // d) Seleção de carta na mão: "sobe" com elasticidade (ou "desce" ao desmarcar)
    if (ctx.selectedId !== last.selectedId) {
      const pick = id => id && handEls.find(el => el.dataset.cardId === id && !fresh.includes(el));
      pick(ctx.selectedId)?.animate([{ translate: '0 14px' }, { translate: '0 0' }], { duration: 240, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      pick(last.selectedId)?.animate([{ translate: '0 -14px' }, { translate: '0 0' }], { duration: 200, easing: 'ease-out' });
    }
  }

  // Carta que não pode ser jogada: chacoalha (a animação em si fica no CSS: .nope)
  function reject(el) {
    if (!el) return;
    el.classList.remove('nope');
    void el.offsetWidth; // força o navegador a "reiniciar" a animação
    el.classList.add('nope');
    el.addEventListener('animationend', () => el.classList.remove('nope'), { once: true });
  }

  // Zera a memória (use ao sair da partida)
  function reset() { prev = null; }

  window.ChromaCardFx = { before, after, reject, reset };
})();
