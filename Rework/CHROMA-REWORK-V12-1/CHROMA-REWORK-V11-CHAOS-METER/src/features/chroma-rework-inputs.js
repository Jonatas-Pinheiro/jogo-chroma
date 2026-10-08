(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const game = $('#game');
  const controllerLegend = $('#controllerLegend');
  if (!game || !controllerLegend) return;

  const visible = element => Boolean(element && !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  const isTextEntry = target => Boolean(target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]'));
  const gameActive = () => game.classList.contains('on');
  const pcProfile = () => document.documentElement.dataset.deviceProfile === 'pc';
  const safeGameLayers = new Set(['colorPick', 'targetPick', 'pauseOv', 'endOv']);
  const anyBlockingOverlay = () => [...document.querySelectorAll('.ov')]
    .some(layer => visible(layer) && !safeGameLayers.has(layer.id));
  const modal = () => ['#colorPick', '#targetPick', '#pauseOv', '#endOv'].map($).find(visible) || null;
  const clickIfReady = selector => {
    const button = $(selector);
    if (!button || button.hidden || button.disabled) return false;
    button.click();
    return true;
  };

  function selectModalControl(direction) {
    const dialog = modal();
    if (!dialog || !['colorPick', 'targetPick'].includes(dialog.id)) return false;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), [role="button"]:not([aria-disabled="true"])')];
    if (!controls.length) return false;
    let index = controls.indexOf(document.activeElement);
    index = index < 0 ? (direction > 0 ? 0 : controls.length - 1) : (index + direction + controls.length) % controls.length;
    controls[index].focus();
    return true;
  }

  function moveHand(direction) {
    if (!gameActive() || game.classList.contains('spectator') || modal() || anyBlockingOverlay()) return false;
    const cards = [...document.querySelectorAll('#hand [data-card-id]')]
      .filter(card => !card.disabled && card.getAttribute('aria-disabled') !== 'true');
    if (!cards.length) return false;
    const current = cards.findIndex(card => card.getAttribute('aria-pressed') === 'true');
    const nextIndex = current < 0
      ? (direction > 0 ? 0 : cards.length - 1)
      : (current + direction + cards.length) % cards.length;
    cards[nextIndex].click();
    return true;
  }

  function moveQuickReaction(direction) {
    const menu = $('#quickMenu');
    if (!visible(menu)) return false;
    const reactions = [...menu.querySelectorAll('[data-reaction]')];
    if (!reactions.length) return false;
    let index = reactions.indexOf(document.activeElement);
    index = index < 0 ? (direction > 0 ? 0 : reactions.length - 1) : (index + direction + reactions.length) % reactions.length;
    reactions[index].focus();
    reactions[index].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function closeSafeLayer() {
    if (visible($('#targetPick'))) return clickIfReady('#cancelTarget');
    if (visible($('#pauseOv'))) return clickIfReady('#resumeMatch');
    if (visible($('#quickMenu'))) return clickIfReady('#quickOpen');
    if (visible($('#endOv'))) return clickIfReady('#endClose');
    if (visible($('#colorPick'))) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return true;
    }
    return false;
  }

  function onKeyDown(event) {
    if (!pcProfile() || !gameActive() || event.ctrlKey || event.metaKey || event.altKey || isTextEntry(event.target)) return;
    if (event.key === 'Escape') {
      // O módulo do jogo já limpa seletores de carta/cor; este bloco cobre menu e pausa.
      if (visible($('#targetPick')) || visible($('#pauseOv'))) {
        if (closeSafeLayer()) event.preventDefault();
      }
      return;
    }
    if (anyBlockingOverlay() || visible($('#quickMenu'))) return;

    const activeModal = modal();
    if (activeModal?.id === 'pauseOv' && event.key.toLowerCase() === 'p') {
      if (clickIfReady('#resumeMatch')) event.preventDefault();
      return;
    }
    if (activeModal) {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        if (selectModalControl(-1)) event.preventDefault();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        if (selectModalControl(1)) event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (moveHand(event.key === 'ArrowRight' ? 1 : -1)) event.preventDefault();
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'd') {
      if (clickIfReady('#drawPile')) event.preventDefault();
    } else if (key === 'n') {
      if (clickIfReady('#passBtn')) event.preventDefault();
    } else if (key === 'c') {
      if (clickIfReady('#chromaBtn')) event.preventDefault();
    } else if (key === 'p') {
      if (visible($('#pauseOv'))) {
        if (clickIfReady('#resumeMatch')) event.preventDefault();
      } else if (!game.classList.contains('spectator') && clickIfReady('#pauseGame')) {
        event.preventDefault();
      }
    } else if (event.key === 'Enter') {
      const focusedCard = event.target?.closest?.('#hand [data-card-id]');
      if (focusedCard?.getAttribute('aria-pressed') === 'true' && clickIfReady('#play')) {
        event.preventDefault();
      } else if (!event.target?.closest?.('button, a, [role="button"]') && clickIfReady('#play')) {
        event.preventDefault();
      }
    }
  }

  document.addEventListener('keydown', onKeyDown);

  function getPads() {
    try { return navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : []; }
    catch { return []; }
  }

  let activePadIndex = -1;
  let frame = 0;
  let previousButtons = [];

  function refreshPads() {
    const pads = getPads().filter(pad => pad.connected);
    const pad = pads.find(item => item.index === activePadIndex) || pads[0] || null;
    activePadIndex = pad ? pad.index : -1;
    controllerLegend.hidden = !pad;
    const status = $('#controllerState');
    if (status) status.textContent = pad ? `Conectado: ${pad.id || 'controle'}` : 'Aguardando controle';
    if (pad && !frame) frame = requestAnimationFrame(pollPad);
    if (!pad) { previousButtons = []; frame = 0; }
  }

  function pressed(button) {
    return Boolean(button && (button.pressed || Number(button.value) > 0.55));
  }

  function gamepadAction(buttonIndex, pad) {
    if (!gameActive() || anyBlockingOverlay()) return;
    const layer = modal();
    if (buttonIndex === 14 || buttonIndex === 15) {
      const direction = buttonIndex === 15 ? 1 : -1;
      if (visible($('#quickMenu'))) moveQuickReaction(direction);
      else if (layer && ['colorPick', 'targetPick'].includes(layer.id)) selectModalControl(direction);
      else moveHand(direction);
      return;
    }
    if (layer && ['colorPick', 'targetPick'].includes(layer.id)) {
      if (buttonIndex === 0) {
        const controls = [...layer.querySelectorAll('button:not(:disabled)')];
        const selected = controls.includes(document.activeElement) ? document.activeElement : controls[0];
        selected?.click();
      } else if (buttonIndex === 1) closeSafeLayer();
      return;
    }
    if (layer?.id === 'pauseOv') {
      if (buttonIndex === 0 || buttonIndex === 1 || buttonIndex === 3) clickIfReady('#resumeMatch');
      return;
    }
    if (layer?.id === 'endOv') {
      if (buttonIndex === 0) clickIfReady('#endClose');
      return;
    }
    if (visible($('#quickMenu'))) {
      if (buttonIndex === 0) {
        const menu = $('#quickMenu');
        const reactions = [...menu.querySelectorAll('[data-reaction]')];
        const selected = reactions.includes(document.activeElement) ? document.activeElement : reactions[0];
        selected?.click();
      } else if (buttonIndex === 1) clickIfReady('#quickOpen');
      return;
    }
    if (buttonIndex === 0) clickIfReady('#play');       // A: jogar/confirmar
    else if (buttonIndex === 1) clickIfReady('#passBtn'); // B: passar quando permitido
    else if (buttonIndex === 2) clickIfReady('#drawPile'); // X: comprar
    else if (buttonIndex === 3 && !game.classList.contains('spectator')) clickIfReady('#pauseGame'); // Y: pausar
  }

  function pollPad() {
    frame = 0;
    const pad = getPads().find(item => item.index === activePadIndex && item.connected) || getPads().find(item => item.connected);
    if (!pad) { refreshPads(); return; }
    activePadIndex = pad.index;
    const indexes = [0, 1, 2, 3, 14, 15];
    indexes.forEach(index => {
      const now = pressed(pad.buttons?.[index]);
      if (now && !previousButtons[index]) gamepadAction(index, pad);
      previousButtons[index] = now;
    });
    frame = requestAnimationFrame(pollPad);
  }

  window.addEventListener('gamepadconnected', refreshPads);
  window.addEventListener('gamepaddisconnected', refreshPads);
  refreshPads();
})();
