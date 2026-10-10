(() => {
  'use strict';

  const STORAGE_KEY = 'chroma-feedback-tatil-v1';
  const DURATIONS = { navigation: 8, tap: 10, important: 18 };
  const selectedBeforeClick = new WeakMap();

  function readPreference() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? null : saved === 'true';
    } catch {
      return null;
    }
  }

  let enabled = readPreference();
  if (enabled === null) {
    const switchControl = document.querySelector('#setBody [data-k="vb"]');
    if (switchControl) enabled = switchControl.getAttribute('aria-checked') === 'true';
  }
  let lastPulseAt = -Infinity;

  function setEnabled(value) {
    enabled = Boolean(value);
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* A interface continua utilizável se o armazenamento estiver indisponível. */ }
    return enabled;
  }

  function useDefault(value) {
    if (enabled === null) enabled = Boolean(value);
    return enabled;
  }

  function feedback(kind = 'tap') {
    if (enabled !== true) return false;
    try {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
      const now = Date.now();
      if (now - lastPulseAt < 80) return false;
      const duration = DURATIONS[kind] || DURATIONS.tap;
      lastPulseAt = now;
      return navigator.vibrate(duration);
    } catch {
      return false;
    }
  }

  function clickedControl(event) {
    const target = event.target;
    const element = target && typeof target.closest === 'function' ? target : target?.parentElement;
    return element?.closest('button, [role="button"], [role="tab"], [role="switch"]') || null;
  }

  function isVisible(control) {
    if (!control.isConnected || control.closest('[hidden], [aria-hidden="true"]')) return false;
    try { return typeof control.getClientRects !== 'function' || control.getClientRects().length > 0; }
    catch { return false; }
  }

  document.addEventListener('click', event => {
    const control = clickedControl(event);
    if (!control) return;
    selectedBeforeClick.set(event, control.getAttribute('aria-selected') === 'true' || control.getAttribute('aria-pressed') === 'true');
  }, true);

  document.addEventListener('click', event => {
    const control = clickedControl(event);
    if (!control || !isVisible(control) || control.disabled || control.getAttribute('aria-disabled') === 'true' || event.defaultPrevented) return;
    if (control.matches('[data-go], [data-screen], [data-reaction]')) return;
    if ((control.matches('[role="tab"], [aria-pressed]')) && selectedBeforeClick.get(event)) return;
    if (control.classList.contains('nope')) return;
    feedback(control.dataset.hapticKind || 'tap');
  });

  window.chromaHaptic = feedback;
  window.chromaHaptic.isEnabled = () => enabled === true;
  window.chromaHaptic.getPreference = () => enabled;
  window.chromaHaptic.setEnabled = setEnabled;
  window.chromaHaptic.useDefault = useDefault;
})();
