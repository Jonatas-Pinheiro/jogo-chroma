(() => {
  'use strict';

  const MUSIC_URL = 'assets/audio/main-theme.mp3';
  const SFX_ROOT = 'assets/audio/kenney-casino/Audio/';
  const DEFAULT_MUSIC_VOLUME = 0.19;
  const DEFAULT_SFX_VOLUME = 0.45;
  const MUTE_KEY = 'chroma-audio-muted';
  const MUSIC_ENABLED_KEY = 'chroma-music-enabled';
  const SFX_ENABLED_KEY = 'chroma-sfx-enabled';
  const MUSIC_VOLUME_KEY = 'chroma-music-volume';
  const SFX_VOLUME_KEY = 'chroma-sfx-volume';
  const CARD_PLACE_FILES = ['card-place-1.ogg', 'card-place-2.ogg', 'card-place-3.ogg', 'card-place-4.ogg'];
  // A sequência completa dura cerca de 2 s e toca apenas ao iniciar partida nova.
  const MATCH_START_FILES = ['card-fan-1.ogg', 'card-fan-2.ogg'];
  const pools = new Map();
  const readBoolean = (key, fallback) => {
    try { const value = localStorage.getItem(key); return value == null ? fallback : value === '1'; }
    catch { return fallback; }
  };
  const readVolume = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      if (stored == null || stored === '') return fallback;
      const value = Number(stored);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    } catch { return fallback; }
  };

  let muted = readBoolean(MUTE_KEY, false);
  let musicEnabled = readBoolean(MUSIC_ENABLED_KEY, true);
  let sfxEnabled = readBoolean(SFX_ENABLED_KEY, true);
  let musicVolume = readVolume(MUSIC_VOLUME_KEY, DEFAULT_MUSIC_VOLUME);
  let sfxVolume = readVolume(SFX_VOLUME_KEY, DEFAULT_SFX_VOLUME);
  let unlocked = false;
  let gameActive = false;
  let gameScreenActive = false;
  let musicContextActive = false;
  let randomCursor = 0;
  const track = new Audio(MUSIC_URL);
  track.loop = true;
  track.preload = 'none';
  track.volume = musicVolume;

  function save(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* O som segue disponível sem persistência. */ }
  }

  function syncToggle() {
    const button = document.getElementById('audioToggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Ativar sons' : 'Silenciar sons');
    button.title = muted ? 'Ativar sons' : 'Silenciar sons';
    button.innerHTML = muted
      ? '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>'
      : '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  }

  function safelyPlay(media) {
    try {
      const result = media.play();
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return true;
    } catch { return false; }
  }

  function startMusic() {
    if (!unlocked || muted || !musicEnabled || !musicContextActive || !track.paused) return;
    track.volume = musicVolume;
    safelyPlay(track);
  }

  function pauseMusic() {
    try { track.pause(); } catch { /* Sem reprodução ativa. */ }
  }

  function stopMusic() {
    pauseMusic();
    try { track.currentTime = 0; } catch { /* A faixa ainda pode não ter sido carregada. */ }
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    startMusic();
  }

  function choose(list) {
    if (list.length === 1) return list[0];
    const index = randomCursor++ % list.length;
    return list[index];
  }

  function samplePool(file) {
    if (!pools.has(file)) {
      pools.set(file, [new Audio(SFX_ROOT + file), new Audio(SFX_ROOT + file)]);
      pools.get(file).forEach(audio => { audio.preload = 'none'; });
    }
    return pools.get(file);
  }

  function playAllowedSfx(file, level = 0.3, onEnded = null, playbackRate = 1) {
    if (muted || !sfxEnabled || !unlocked) return false;
    const pool = samplePool(file);
    const audio = pool.find(item => item.paused || item.ended) || pool[0];
    try { audio.pause(); audio.currentTime = 0; } catch { /* O som ainda pode estar carregando. */ }
    audio.volume = Math.max(0, Math.min(1, level * sfxVolume));
    audio.playbackRate = playbackRate;
    audio.onended = typeof onEnded === 'function' ? onEnded : null;
    return safelyPlay(audio) ? audio : null;
  }

  function playUi() {
    // Sons de navegação e botões não fazem parte da lista autorizada.
    return false;
  }

  function gameAction(action) {
    if (action === 'play') playAllowedSfx(choose(CARD_PLACE_FILES), 0.3);
    else if (action === 'roundStart') {
      playAllowedSfx(MATCH_START_FILES[0], 0.3, () => playAllowedSfx(MATCH_START_FILES[1], 0.3), 1.05);
    }
  }

  function finish() {
    pauseMusic();
    gameActive = false;
  }

  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('touchend', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseMusic();
    else startMusic();
  });
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button, [role="button"]');
    if (!button || button.disabled || button.id === 'audioToggle') return;
    const actionButton = button.closest('#hand [data-card-id], #drawPile, #play, #passBtn, #chromaBtn, #catchBtn, #colorPick [data-color], #targetChoices [data-target-id]');
    if (actionButton) return;
    const inGame = button.closest('#game');
    if (inGame && !button.closest('#quickMenu, #pauseOv, #endOv, #colorPick, #targetPick, #spectatorLog') && !['pauseGame', 'resumeMatch', 'leaveMatch', 'nextRound', 'quickOpen', 'stackToggle', 'audioToggle'].includes(button.id)) return;
    playUi(button.dataset.hapticKind === 'important' || button.classList.contains('pri') ? 'confirm' : 'tap');
  });

  document.getElementById('audioToggle')?.addEventListener('click', () => {
    muted = !muted;
    save(MUTE_KEY, muted);
    syncToggle();
    if (muted) pauseMusic(); else startMusic();
  });

  window.ChromaAudio = {
    setGameActive(value) { gameActive = Boolean(value); if (gameActive) startMusic(); },
    setGameScreenActive(value) { gameScreenActive = Boolean(value); },
    setMusicContext(value) { musicContextActive = Boolean(value); if (musicContextActive) startMusic(); else pauseMusic(); },
    stopMusic,
    playUi,
    gameAction,
    finish,
    isMuted() { return muted; },
    isMusicEnabled() { return musicEnabled; },
    isSfxEnabled() { return sfxEnabled; },
    getMusicVolume() { return musicVolume; },
    getSfxVolume() { return sfxVolume; },
    setMuted(value) {
      muted = Boolean(value); save(MUTE_KEY, muted); syncToggle();
      if (muted) pauseMusic(); else startMusic();
    },
    setMusicEnabled(value) {
      musicEnabled = Boolean(value); save(MUSIC_ENABLED_KEY, musicEnabled);
      if (musicEnabled) startMusic(); else pauseMusic();
    },
    setSfxEnabled(value) { sfxEnabled = Boolean(value); save(SFX_ENABLED_KEY, sfxEnabled); },
    setMusicVolume(value) {
      musicVolume = Math.max(0, Math.min(1, Number(value) || 0));
      try { localStorage.setItem(MUSIC_VOLUME_KEY, String(musicVolume)); } catch { /* Preferência apenas nesta sessão. */ }
      track.volume = musicVolume;
    },
    setSfxVolume(value) {
      sfxVolume = Math.max(0, Math.min(1, Number(value) || 0));
      try { localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume)); } catch { /* Preferência apenas nesta sessão. */ }
    },
  };

  syncToggle();
})();
