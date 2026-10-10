/*
 * Ponte JavaScript-only entre a camada funcional portada do CHROMA Atual e o
 * shell visual do CHROMA Rework. Não injeta markup e não altera estilos.
 * Os módulos originais ficam disponíveis em src/current/ para integração por
 * fluxo; a ponte expõe apenas estado local seguro para os componentes atuais.
 */
(() => {
  'use strict';
  const KEYS = Object.freeze({ coins: 'chroma-coins', xp: 'chroma-xp', shop: 'chroma-shop', missions: 'chroma-missions' });
  const readJson = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('chroma-state-changed')); return true; }
    catch { return false; }
  };
  const readNumber = (key, fallback = 0) => {
    try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) ? value : fallback; }
    catch { return fallback; }
  };
  const writeNumber = (key, value) => {
    try { localStorage.setItem(key, String(Math.max(0, Math.floor(Number(value) || 0)))); window.dispatchEvent(new Event('chroma-state-changed')); return true; }
    catch { return false; }
  };
  const api = {
    keys: KEYS,
    getCoins: () => readNumber(KEYS.coins),
    setCoins: value => writeNumber(KEYS.coins, value),
    addCoins: value => { const next = readNumber(KEYS.coins) + Math.max(0, Math.floor(Number(value) || 0)); writeNumber(KEYS.coins, next); return next; },
    getXp: () => readNumber(KEYS.xp),
    setXp: value => writeNumber(KEYS.xp, value),
    addXp: value => { const next = readNumber(KEYS.xp) + Math.max(0, Math.floor(Number(value) || 0)); writeNumber(KEYS.xp, next); return next; },
    getShop: () => readJson(KEYS.shop, { owned: [], equipped: {}, potions: [] }),
    setShop: value => writeJson(KEYS.shop, value),
    getMissions: () => readJson(KEYS.missions, { daily: {}, weekly: {} }),
    setMissions: value => writeJson(KEYS.missions, value),
    emit: () => window.dispatchEvent(new Event('chroma-state-changed')),
  };
  window.chromaCurrent = Object.freeze(api);
})();
