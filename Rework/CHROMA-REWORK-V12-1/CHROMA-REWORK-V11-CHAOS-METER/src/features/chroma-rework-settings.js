(() => {
  'use strict';

  const KEY = 'chroma-rework-visual-settings-v1';
  const root = document.documentElement;
  const panel = document.getElementById('appearanceSettings');
  if (!root || !panel) return;

  const profiles = new Set(['pc', 'tablet', 'phone']);
  const themes = new Set(['dark', 'light']);
  const cursors = new Set(['system', 'kenney-outline', 'kenney-shaded']);

  function detectProfile() {
    if (window.matchMedia?.('(pointer: fine) and (min-width: 900px)').matches) return 'pc';
    if (window.innerWidth >= 640) return 'tablet';
    return 'phone';
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return {
        theme: themes.has(saved?.theme) ? saved.theme : 'dark',
        profile: profiles.has(saved?.profile) ? saved.profile : detectProfile(),
        cursor: cursors.has(saved?.cursor) ? saved.cursor : 'system',
      };
    } catch {
      return { theme: 'dark', profile: detectProfile(), cursor: 'system' };
    }
  }

  let settings = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* A interface funciona sem armazenamento local. */ }
  }

  function apply() {
    root.dataset.theme = settings.theme;
    root.dataset.deviceProfile = settings.profile;
    root.dataset.cursorStyle = settings.cursor;
    panel.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === settings.theme));
    });
    panel.querySelectorAll('[data-profile-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.profileChoice === settings.profile));
    });
    const cursorSelect = panel.querySelector('#cursorStyle');
    if (cursorSelect) cursorSelect.value = settings.cursor;
    window.dispatchEvent(new CustomEvent('chroma-visual-settings-change', { detail: { ...settings } }));
  }

  panel.addEventListener('click', event => {
    const themeButton = event.target.closest('[data-theme-choice]');
    if (themeButton && themes.has(themeButton.dataset.themeChoice)) {
      settings.theme = themeButton.dataset.themeChoice;
      save();
      apply();
      return;
    }
    const profileButton = event.target.closest('[data-profile-choice]');
    if (profileButton && profiles.has(profileButton.dataset.profileChoice)) {
      settings.profile = profileButton.dataset.profileChoice;
      save();
      apply();
    }
  });

  panel.querySelector('#cursorStyle')?.addEventListener('change', event => {
    if (!cursors.has(event.target.value)) return;
    settings.cursor = event.target.value;
    save();
    apply();
  });

  apply();
})();
