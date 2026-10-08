(() => {
  'use strict';

  const types = new Set(['error', 'warning', 'success']);
  const icons = {
    error: '<span class="chroma-toast__icon" aria-hidden="true"><svg class="chroma-toast__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="11" rx="2"></rect><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path><path d="M12 14.5v3"></path></svg></span>',
    warning: '<span class="chroma-toast__icon" aria-hidden="true"><svg class="chroma-toast__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.8 20h18.4L12 3Z"></path><path d="M12 9v5"></path><path d="M12 17.5h.01"></path></svg></span>',
    success: '<span class="chroma-toast__icon" aria-hidden="true"><svg class="chroma-toast__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m7.5 12.2 3 3 6-6.2"></path></svg></span>',
  };

  function clearChromaToast() {
    const node = document.querySelector('[data-chroma-toast]');
    if (!node) return false;
    clearTimeout(node._dismissTimer);
    clearTimeout(node._removeTimer);
    node.remove();
    return true;
  }

  function inferType(message) {
    const text = String(message ?? '').toLocaleLowerCase('pt-BR');
    if (/(sem internet|sem conex[aã]o|offline|falha|erro|bloquead|impedid|n[aã]o foi poss[ií]vel|espectadores n[aã]o)/i.test(text)) return 'error';
    if (/(conclu[ií]d|equipad|comprad|compra conclu[ií]da|coletad|reivindicad|registrad|enviad|recebid|escolhid|desbloquead|ativad|conquistad|salv[oa]|pront[oa])/i.test(text)) return 'success';
    return 'warning';
  }

  function showChromaToast(message, requestedType) {
    const text = String(message ?? '').trim();
    if (!text || !document.body) return null;
    if (document.querySelector('#game.scr.on')) {
      clearChromaToast();
      return null;
    }

    const type = types.has(requestedType) ? requestedType : inferType(text);
    let node = document.querySelector('[data-chroma-toast]');
    if (!node) {
      node = document.createElement('div');
      node.dataset.chromaToast = 'true';
      document.body.append(node);
    }

    clearTimeout(node._dismissTimer);
    clearTimeout(node._removeTimer);
    node.className = `chroma-toast chroma-toast--${type}`;
    node.classList.remove('is-leaving');
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    node.setAttribute('aria-atomic', 'true');
    node.innerHTML = `${icons[type]}<span class="chroma-toast__message"></span>`;
    node.querySelector('.chroma-toast__message').textContent = text;

    node._dismissTimer = setTimeout(() => {
      if (!node.isConnected) return;
      node.classList.add('is-leaving');
      node._removeTimer = setTimeout(() => node.remove(), 160);
    }, 3200);
    return node;
  }

  showChromaToast.clear = clearChromaToast;
  window.chromaToast = showChromaToast;
})();
