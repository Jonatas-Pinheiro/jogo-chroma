(function attachChromaChaosMeter(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChromaChaosMeter = api;
})(typeof window !== 'undefined' ? window : globalThis, function createChaosMeterApi(root) {
  'use strict';

  const BANDS = Object.freeze([
    Object.freeze({ key: 'stable', label: 'ESTÁVEL', min: 0, max: 19 }),
    Object.freeze({ key: 'unstable', label: 'INSTÁVEL', min: 20, max: 39 }),
    Object.freeze({ key: 'critical', label: 'CRÍTICO', min: 40, max: 79 }),
    Object.freeze({ key: 'overload', label: 'SOBRECARGA', min: 80, max: 149 }),
    Object.freeze({ key: 'collapse', label: 'COLAPSO!', min: 150, max: Infinity }),
  ]);
  const QUALITY_LEVELS = new Set(['ultra-leve', 'leve', 'padrao', 'ultra']);
  const $ = (selector, element) => element?.querySelector?.(selector) || null;
  const finitePending = value => Math.max(0, Math.floor(Number(value) || 0));

  function bandFor(value) {
    const pending = finitePending(value);
    return BANDS.find(band => pending >= band.min && pending <= band.max) || BANDS[0];
  }

  function graphicsQuality(environment = root, element = null) {
    const body = environment?.document?.body || element?.ownerDocument?.body;
    if (body?.classList?.contains('lightweight') || body?.classList?.contains('quality-ultra-leve')) return 'ultra-leve';
    let saved = '';
    try {
      saved = environment?.localStorage?.getItem('chroma-quality') || '';
      if (!saved && environment?.localStorage?.getItem('chroma-light') === '1') saved = 'ultra-leve';
    } catch { /* Preferência indisponível: usar o modo padrão sem bloquear a partida. */ }
    return QUALITY_LEVELS.has(saved) ? saved : 'padrao';
  }

  function mount(element, options = {}) {
    const environment = options.environment || root;
    if (!element) return { update() {}, quality: () => graphicsQuality(environment) };

    const row = options.row || element.closest?.('.chaos-meter-row') || element.parentElement;
    const game = options.game || element.closest?.('#game') || null;
    const valueNode = $(options.valueSelector || '.chaos-meter__value', element);
    const stateNode = $(options.stateSelector || '.chaos-meter__state', element);
    const fillNode = $(options.fillSelector || '.chaos-meter__fill', element);
    const timers = new Set();
    const schedule = (callback, delay) => {
      const timer = (environment?.setTimeout || setTimeout).call(environment, () => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
      return timer;
    };
    const cancelTimers = () => {
      for (const timer of timers) (environment?.clearTimeout || clearTimeout).call(environment, timer);
      timers.clear();
    };
    let previousPending = null;
    let previousLog = '';
    let latest = null;
    let collapsing = false;
    let collapseId = null;
    let releaseScheduled = false;

    function clearCollapseClasses() {
      element.classList.remove('is-collapsing', 'is-breaking', 'is-releasing');
      delete element.dataset.stage;
    }

    function cancelCollapse() {
      cancelTimers();
      collapsing = false;
      collapseId = null;
      releaseScheduled = false;
      clearCollapseClasses();
    }

    function paint(pending, forcedBand = null) {
      const band = forcedBand || bandFor(pending);
      const shown = finitePending(pending);
      const percent = Math.max(0, Math.min(100, (shown / 150) * 100));
      const intensity = shown >= 130 ? 'near-max' : shown >= 100 ? 'high' : shown >= 60 ? 'rising' : 'base';
      if (element.dataset.level !== band.key) element.dataset.level = band.key;
      if (element.dataset.intensity !== intensity) element.dataset.intensity = intensity;
      const width = `${percent}%`;
      if (fillNode && fillNode.style.width !== width) fillNode.style.width = width;
      if (stateNode && stateNode.textContent !== band.label) stateNode.textContent = band.label;
      const number = String(shown);
      if (valueNode && valueNode.textContent !== number) valueNode.textContent = number;
      const ariaNow = String(Math.min(shown, 150));
      if (element.getAttribute('aria-valuenow') !== ariaNow) element.setAttribute('aria-valuenow', ariaNow);
      const ariaText = `${shown}, ${band.label.toLocaleLowerCase('pt-BR')}`;
      if (element.getAttribute('aria-valuetext') !== ariaText) element.setAttribute('aria-valuetext', ariaText);
    }

    function pulse(className) {
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
    }

    function beginCollapse(id) {
      cancelTimers();
      collapsing = true;
      collapseId = String(id);
      releaseScheduled = false;
      element.dataset.level = 'collapse';
      element.dataset.intensity = 'near-max';
      element.dataset.stage = 'charge';
      element.classList.add('is-collapsing');
      element.classList.remove('is-breaking', 'is-releasing');
      if (fillNode && fillNode.style.width !== '100%') fillNode.style.width = '100%';
      if (valueNode && valueNode.textContent !== '150+') valueNode.textContent = '150+';
      if (stateNode && stateNode.textContent !== 'SOBRECARGA') stateNode.textContent = 'SOBRECARGA';
      if (element.getAttribute('aria-valuenow') !== '150') element.setAttribute('aria-valuenow', '150');
      if (element.getAttribute('aria-valuetext') !== '150 ou mais, tensão antes do colapso') {
        element.setAttribute('aria-valuetext', '150 ou mais, tensão antes do colapso');
      }

      schedule(() => { if (collapsing && collapseId === String(id)) element.dataset.stage = 'tension'; }, 150);
      schedule(() => {
        if (!collapsing || collapseId !== String(id)) return;
        element.dataset.stage = 'rupture';
        element.classList.add('is-breaking');
      }, 300);
      schedule(() => {
        if (!collapsing || collapseId !== String(id)) return;
        element.dataset.stage = 'collapse-label';
        if (stateNode) stateNode.textContent = 'COLAPSO!';
      }, 450);
    }

    function startRelease(id, delay = 400) {
      if (!collapsing || collapseId !== String(id) || releaseScheduled) return;
      releaseScheduled = true;
      element.dataset.stage = 'consequence';
      if (element.getAttribute('aria-valuetext') !== 'Punição de +150 aplicada; retorno à estabilidade') {
        element.setAttribute('aria-valuetext', 'Punição de +150 aplicada; retorno à estabilidade');
      }
      schedule(() => {
        if (!collapsing || collapseId !== String(id)) return;
        element.dataset.stage = 'release';
        element.classList.add('is-releasing');
        if (fillNode && fillNode.style.width !== '0%') fillNode.style.width = '0%';
        if (valueNode && valueNode.textContent !== '0') valueNode.textContent = '0';
        if (element.getAttribute('aria-valuenow') !== '0') element.setAttribute('aria-valuenow', '0');
        if (element.getAttribute('aria-valuetext') !== 'Acúmulo zerado; retornando ao estado estável') {
          element.setAttribute('aria-valuetext', 'Acúmulo zerado; retornando ao estado estável');
        }
      }, delay);
      schedule(() => {
        if (!collapsing || collapseId !== String(id)) return;
        collapsing = false;
        collapseId = null;
        releaseScheduled = false;
        clearCollapseClasses();
        if (latest && latest.mode === 'supercaos' && latest.phase === 'playing') paint(latest.pending);
      }, delay + 400);
    }

    function update(snapshot = {}) {
      latest = {
        mode: snapshot.mode,
        phase: snapshot.phase || 'playing',
        pending: finitePending(snapshot.pending),
        log: String(snapshot.log || ''),
        collapse: snapshot.collapse && typeof snapshot.collapse === 'object' ? snapshot.collapse : null,
      };
      const visible = latest.mode === 'supercaos' && latest.phase !== 'ended' && latest.phase !== 'betweenRounds';
      if (row && row !== element) row.hidden = !visible;
      element.hidden = !visible;
      if (!visible) {
        cancelCollapse();
        previousPending = null;
        previousLog = '';
        if (game) game.classList.remove('chaos-overload');
        return;
      }

      const quality = graphicsQuality(environment, element);
      if (element.dataset.quality !== quality) element.dataset.quality = quality;
      if (game) {
        if (game.dataset.graphicsQuality !== quality) game.dataset.graphicsQuality = quality;
        game.classList.toggle('chaos-overload', latest.pending >= 80 && latest.pending < 150);
      }

      const collapse = latest.collapse;
      const activeCollapse = collapse && (collapse.status === 'awaiting' || collapse.status === 'resolved');
      if (activeCollapse) {
        const id = String(collapse.id || 'collapse');
        const startedNow = !collapsing || collapseId !== id;
        if (startedNow) beginCollapse(id);
        if (collapse.status === 'resolved') startRelease(id, startedNow ? 1100 : 400);
      } else if (collapse?.status === 'complete') {
        if (collapsing && collapseId === String(collapse.id)) {
          cancelCollapse();
          paint(latest.pending);
        }
      } else if (collapsing) {
        cancelCollapse();
      }

      if (!activeCollapse && !collapsing) {
        const logChanged = latest.log !== previousLog;
        const rose = previousPending !== null && latest.pending > previousPending;
        const mirror = previousPending !== null && logChanged && latest.pending > 0 && /espelho/i.test(latest.log);
        paint(latest.pending);
        if (rose) {
          const delta = latest.pending - previousPending;
          const heavy = delta >= 40 || /\+99/.test(latest.log);
          element.dataset.impact = heavy ? 'heavy' : delta >= 10 ? 'medium' : 'light';
          pulse('is-hit');
          if (heavy || delta >= 10 || mirror) pulse('is-wave');
        } else if (mirror) {
          element.dataset.impact = 'medium';
          pulse('is-wave');
        }
      }

      previousPending = latest.pending;
      previousLog = latest.log;
    }

    return { update, quality: () => graphicsQuality(environment, element), destroy: cancelCollapse };
  }

  return Object.freeze({ BANDS, bandFor, graphicsQuality, mount });
});
