(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const KEYS = {
    xp: 'chroma-xp', stats: 'chroma-game-stats', cards: 'chroma-cards-played',
    pass: 'chroma-battle-pass', friends: 'chroma-friends', processed: 'chroma-systems-processed-rounds',
  };
  const defaults = {
    gameStats: { played: 0, wins: 0, losses: 0, trainingWins: 0, chaosWins: 0, superChaosWins: 0, teamWins: 0, rankedPlayed: 0, winStreak: 0, bestWinStreak: 0, cleanHands: 0, tournamentWins: 0 },
    pass: { season: 's1', xp: 0, claimed: [], daily: { period: '', progress: {}, claimed: [] }, weekly: { period: '', progress: {}, claimed: [] } },
    friends: { friends: [], requests: [], sent: [] },
  };
  const read = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : fallback; }
    catch { return fallback; }
  };
  const number = (key, fallback = 0) => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  };
  const notifyChange = () => window.dispatchEvent(new Event('chroma-state-changed'));
  const save = (key, value, dispatch = true) => {
    try { localStorage.setItem(key, JSON.stringify(value)); if (dispatch) notifyChange(); return true; }
    catch { return false; }
  };
  const saveNumber = (key, value, dispatch = true) => {
    try { localStorage.setItem(key, String(Math.max(0, Math.floor(Number(value) || 0)))); if (dispatch) notifyChange(); return true; }
    catch { return false; }
  };
  const levelStart = level => 50 * Math.max(1, Math.floor(level)) * (Math.max(1, Math.floor(level)) - 1);
  const levelFromXP = xp => {
    let level = 1;
    while (level < 100 && xp >= levelStart(level + 1)) level += 1;
    return level;
  };
  const passLevel = xp => Math.min(12, Math.floor(Math.max(0, xp) / 100) + 1);
  const cleanUser = value => String(value || '').trim().replace(/^@+/, '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '').slice(0, 18);
  const authReady = () => Boolean(window.chromaCloud?.canWrite?.() && window.chromaSocial && window.chromaAuth?.isReady?.());
  let emailAuthMode = 'signin';

  function closeEmailAuthModal() {
    const modal = $('#accountModal');
    if (modal) modal.hidden = true;
  }

  function setEmailAuthMode(mode) {
    emailAuthMode = mode === 'signup' ? 'signup' : 'signin';
    const signup = emailAuthMode === 'signup';
    const title = $('#authModalTitle'); if (title) title.textContent = signup ? 'Criar conta' : 'Entrar';
    const submit = $('#authSubmit'); if (submit) submit.textContent = signup ? 'Criar conta' : 'Entrar';
    const prompt = $('#authSwitchPrompt'); if (prompt) prompt.textContent = signup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?';
    const link = $('#authModeLink'); if (link) { link.textContent = signup ? 'Entrar' : 'Criar conta'; link.href = signup ? '#sign-in' : '#create-account'; }
    const password = $('#authPassword'); if (password) password.autocomplete = signup ? 'new-password' : 'current-password';
    const message = $('#authModalMsg'); if (message) message.textContent = '';
  }

  function openEmailAuthModal(mode = 'signin', message = '') {
    const modal = $('#accountModal');
    if (!modal) return;
    setEmailAuthMode(mode);
    modal.hidden = false;
    const messageElement = $('#authModalMsg');
    if (messageElement) messageElement.textContent = message;
    $('#authEmail')?.focus();
  }

  function setupEmailAuthUi() {
    const modal = $('#accountModal');
    const link = $('#emailSignInOpen');
    const form = $('#emailAuthForm');
    if (!modal || !link || !form || modal.dataset.emailAuthBound === '1') return;
    modal.dataset.emailAuthBound = '1';
    link.addEventListener('click', event => { event.preventDefault(); openEmailAuthModal('signin'); });
    $('#authModalClose')?.addEventListener('click', closeEmailAuthModal);
    $('#authModeLink')?.addEventListener('click', event => {
      event.preventDefault();
      setEmailAuthMode(emailAuthMode === 'signin' ? 'signup' : 'signin');
      $('#authPassword')?.focus();
    });
    modal.addEventListener('click', event => { if (event.target === modal) closeEmailAuthModal(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeEmailAuthModal(); });
    window.addEventListener?.('chroma-email-auth-open', event => openEmailAuthModal(event.detail?.mode, event.detail?.message));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const email = $('#authEmail')?.value?.trim() || '';
      const password = $('#authPassword')?.value || '';
      const submit = $('#authSubmit');
      const message = $('#authModalMsg');
      const auth = window.chromaAuth;
      const authenticate = emailAuthMode === 'signup' ? auth?.createAccount : auth?.signInEmail;
      if (typeof authenticate !== 'function') {
        if (message) message.textContent = 'O Firebase Authentication ainda não está disponível. Aguarde um instante e tente novamente.';
        return;
      }
      if (submit) { submit.disabled = true; submit.textContent = emailAuthMode === 'signup' ? 'Criando conta…' : 'Entrando…'; }
      if (message) message.textContent = '';
      try {
        await authenticate.call(auth, email, password);
        closeEmailAuthModal();
        const passwordField = $('#authPassword'); if (passwordField) passwordField.value = '';
      } catch (error) {
        const friendly = window.chromaCloud?.describeError?.(error) || error?.message || 'Não foi possível autenticar. Tente novamente.';
        if (message) message.textContent = friendly;
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = emailAuthMode === 'signup' ? 'Criar conta' : 'Entrar'; }
      }
    });
  }

  function initializeFreshLocalProfile() {
    const marker = 'chroma-systems-v1-initialized';
    try {
      if (localStorage.getItem(marker) === '1') return;
      if (!localStorage.getItem('chroma-cache-owner')) {
        localStorage.setItem(KEYS.stats, JSON.stringify(defaults.gameStats));
        localStorage.setItem(KEYS.pass, JSON.stringify(defaults.pass));
        localStorage.setItem(KEYS.friends, JSON.stringify(defaults.friends));
        localStorage.removeItem(KEYS.xp);
        localStorage.removeItem(KEYS.cards);
        localStorage.setItem('chroma-coins', '0');
      }
      localStorage.setItem(marker, '1');
    } catch { /* Se o armazenamento estiver indisponível, os padrões em memória continuam zerados. */ }
  }

  let cloudState = 'loading';
  let socialRequestToken = 0;
  let socialSearchToken = 0;
  let lastSocialError = '';

  function getStats() {
    const stored = read(KEYS.stats, {});
    return { ...defaults.gameStats, ...stored };
  }

  function getPass() {
    const stored = read(KEYS.pass, {});
    return { ...defaults.pass, ...stored, claimed: Array.isArray(stored.claimed) ? stored.claimed : [], daily: { ...defaults.pass.daily, ...(stored.daily || {}) }, weekly: { ...defaults.pass.weekly, ...(stored.weekly || {}) } };
  }

  function getFriends() {
    const stored = read(KEYS.friends, {});
    const unique = list => [...new Set((Array.isArray(list) ? list : []).map(cleanUser).filter(name => name.length >= 3))];
    return { friends: unique(stored.friends), requests: unique(stored.requests), sent: unique(stored.sent) };
  }

  function updateHomeAndProfile() {
    const xp = number(KEYS.xp), level = levelFromXP(xp), levelBase = levelStart(level);
    const levelNext = levelStart(level + 1), levelProgress = Math.max(0, xp - levelBase);
    const needed = Math.max(100, levelNext - levelBase);
    const stats = getStats();
    const played = Math.max(0, Number(stats.played) || 0);
    const wins = Math.max(0, Number(stats.wins) || 0);
    const rate = played ? Math.round((wins / played) * 100) : 0;
    const pass = getPass(), season = String(document.documentElement.dataset.season || '1');
    const profileUid = String(window.chromaCloud?.getUser?.()?.uid || '');
    const bpLevel = passLevel(Number(pass.xp) || 0), bpBase = (bpLevel - 1) * 100, bpProgress = Math.max(0, Number(pass.xp || 0) - bpBase);
    const values = {
      '#systemHomeName': localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || 'Jogador',
      '#systemHomeLevel': `Nível ${level}`,
      '#systemHomeCoins': String(number('chroma-coins')),
      '#systemProfileName': localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || 'Jogador',
      '#systemProfileId': profileUid ? `ID ${profileUid}` : 'ID estável disponível ao conectar uma conta',
      '#systemProfileRank': `Nível ${level}`,
      '#systemProfileLevel': `Nível ${level}`,
      '#systemProfileXpText': `${levelProgress} / ${needed} XP`,
      '#systemPlayed': String(played), '#systemWins': String(wins), '#systemRate': `${rate}%`,
      '#systemPassLevel': `Nível ${bpLevel}`,
      '#systemPassXp': `${bpProgress} / 100 XP`,
      '#systemPassNext': `${Math.max(0, 100 - bpProgress)} XP para o próximo nível`,
      '#homePassLevel': `Nível ${bpLevel}`,
      '#homePassXp': `${Number(pass.xp) || 0} XP`,
    };
    Object.entries(values).forEach(([selector, text]) => { const element = $(selector); if (element) element.textContent = text; });
    const fill = $('#systemProfileFill');
    if (fill) fill.style.width = `${Math.min(100, (levelProgress / needed) * 100)}%`;
    const passFill = $('#systemPassFill');
    if (passFill) passFill.style.width = `${Math.min(100, bpProgress)}%`;
    const homeFill = $('#homePassFill');
    if (homeFill) homeFill.style.width = `${Math.min(100, bpProgress)}%`;
    const coinPills = $$('.bal');
    coinPills.forEach(pill => { const text = [...pill.childNodes].find(node => node.nodeType === Node.TEXT_NODE); if (text) text.textContent = String(number('chroma-coins')); });
    window.chromaPreview?.setCoins?.(number('chroma-coins'));
    const ownedCount = getOwnedCosmetics().length;
    const profileCollection = $('#profileCollectionHeading');
    if (profileCollection) profileCollection.textContent = `Coleção: ${ownedCount} ${ownedCount === 1 ? 'item' : 'itens'}`;
    const profileCollectionLink = $('#profileCollectionLinkCount');
    if (profileCollectionLink) profileCollectionLink.textContent = `${ownedCount} ${ownedCount === 1 ? 'item' : 'itens'}`;
    const achievements = achievementData(stats);
    $$('#prof .ach > div').forEach((item, index) => {
      const achievement = achievements[index];
      if (!achievement) return;
      item.classList.toggle('lk', !achievement.complete);
      const label = item.querySelector('small');
      if (label) label.textContent = `${achievement.value} de ${achievement.target}`;
    });
    renderRankingSummary(stats);
    renderAchievementScreen(stats);
    updateOwnProfilePhoto();
    const homeName = $('#systemHomeName');
    if (homeName?.parentElement?.querySelector('small')) homeName.parentElement.querySelector('small').textContent = `Nível ${level}`;
    const seasonName = season === '2' ? 'Singularidade' : 'Mina de Ouro';
    const passSubtitle = $('#pSub');
    if (passSubtitle) passSubtitle.textContent = `${seasonName} · progresso local${authReady() ? ' e sincronizado' : ' neste dispositivo'}`;
    renderPass();
    if (!$('#profileCustomizeModal')?.hidden) renderProfileCustomize();
    if ($('.scr.on')?.id === 'characters') renderCharacterCollection();
  }

  function getOwnedCosmetics() {
    let state;
    try { state = window.chromaShop?.getState?.() || read('chroma-shop', { owned: [] }); }
    catch { state = read('chroma-shop', { owned: [] }); }
    const ids = Array.isArray(state.owned) ? state.owned.map(String) : [];
    const catalog = window.chromaShop?.items;
    return [...new Set(ids)].filter(id => !catalog || Boolean(catalog[id]));
  }

  function safePhotoURL(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try { const url = new URL(raw); return url.protocol === 'https:' && url.hostname ? url.href : ''; }
    catch { return ''; }
  }

  function avatarInitial(value) {
    const first = [...String(value || 'Jogador').trim()][0] || 'J';
    return first.toLocaleUpperCase('pt-BR');
  }

  function profileAvatarMarkup(profile, name, uid, extraClass = '') {
    const label = String(name || profile?.name || profile?.username || 'Jogador');
    const cosmetics = window.chromaShop;
    const avatarItem = cosmetics?.items?.[String(profile?.avatarId || '')];
    const avatarMarkup = avatarItem?.type === 'avatar' ? (cosmetics.previewItem?.(avatarItem.id, true) || '') : '';
    const frameItem = cosmetics?.items?.[String(profile?.profileFrameId || '')];
    const frameClass = frameItem?.type === 'profile' && /^profile-frame-(gold|void|fire)$/.test(frameItem.skin || '') ? frameItem.skin : '';
    const photo = avatarMarkup ? '' : safePhotoURL(profile?.photo);
    const profileUid = String(uid || profile?.uid || '');
    const classes = ['friend-avatar', extraClass, frameClass, avatarMarkup ? 'has-cosmetic-avatar' : '', photo ? 'has-photo' : ''].filter(Boolean).join(' ');
    const image = avatarMarkup ? `<span class="friend-avatar-cosmetic" aria-hidden="true">${avatarMarkup}</span>` : `${escapeHtml(avatarInitial(label))}${photo ? `<img class="friend-avatar-image" src="${escapeHtml(photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}`;
    return `<span class="${classes}" data-profile-uid="${escapeHtml(profileUid)}" role="img" aria-label="Avatar de ${escapeHtml(label)}">${image}</span>`;
  }

  function updateOwnProfilePhoto() {
    const photo = safePhotoURL(localStorage.getItem('chroma-profile-photo'));
    const uid = String(window.chromaCloud?.getUser?.()?.uid || '');
    $$('#hdHome .me .av, #prof .who .av').forEach(avatar => {
      let image = avatar.querySelector('.chroma-profile-photo');
      if (!photo) {
        image?.remove();
        avatar.classList.remove('has-profile-photo');
        if (!uid) delete avatar.dataset.profileUid;
        return;
      }
      if (!image) {
        image = document.createElement('img');
        image.className = 'chroma-profile-photo';
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        image.onerror = () => { avatar.classList.remove('has-profile-photo'); image.remove(); };
        avatar.append(image);
      }
      if (image.dataset.source !== photo) { image.dataset.source = photo; image.src = photo; }
      avatar.classList.add('has-profile-photo');
      if (uid) avatar.dataset.profileUid = uid;
    });
  }

  function achievementData(stats = getStats()) {
    const wins = Math.max(0, Number(stats.wins) || 0);
    const streak = Math.max(0, Number(stats.bestWinStreak) || 0);
    const cleanHands = Math.max(0, Number(stats.cleanHands) || 0);
    const tournaments = Math.max(0, Number(stats.tournamentWins) || 0);
    return [
      { title: 'Primeira vitória', detail: 'Vença uma partida registrada.', mark: 'I', value: Math.min(1, wins), target: 1 },
      { title: 'Ritmo constante', detail: 'Alcance uma sequência de cinco vitórias.', mark: '5', value: Math.min(5, streak), target: 5 },
      { title: 'Uma mão limpa', detail: 'Vença uma rodada sem comprar cartas.', mark: 'C', value: Math.min(1, cleanHands), target: 1 },
      { title: 'Campeão', detail: 'Vença um torneio registrado.', mark: '★', value: Math.min(1, tournaments), target: 1 },
    ].map(item => ({ ...item, complete: item.value >= item.target }));
  }

  function renderRankingSummary(stats = getStats()) {
    const grid = $('#rankHistory');
    if (!grid) return;
    const played = Math.max(0, Number(stats.played) || 0);
    const wins = Math.max(0, Number(stats.wins) || 0);
    const losses = Math.max(0, Number(stats.losses) || 0);
    const source = $('#rankSource');
    if (source) source.textContent = authReady() ? 'Conta Firebase · dados enviados pelo cliente, sem validação competitiva' : 'Histórico deste dispositivo · sem placar online';
    grid.innerHTML = [
      ['Partidas registradas', played], ['Vitórias registradas', wins], ['Derrotas registradas', losses],
    ].map(([label, value]) => `<div class="rank-history-stat"><small>${label}</small><b>${Number(value).toLocaleString('pt-BR')}</b></div>`).join('');
  }

  function renderAchievementScreen(stats = getStats()) {
    const host = $('#achievementList');
    if (!host) return;
    const [featured, ...items] = achievementData(stats);
    const progress = item => Math.min(100, Math.round((item.value / item.target) * 100));
    host.innerHTML = `<article class="achievement-feature${featured.complete ? '' : ' is-locked'}"><span class="achievement-mark">${featured.mark}</span><div><small>${featured.complete ? 'CONCLUÍDA' : 'PRÓXIMO MARCO'}</small><b>${featured.title}</b><span>${featured.detail}</span></div><strong>${featured.value} / ${featured.target}</strong></article><ul class="achievement-list">${items.map(item => `<li class="${item.complete ? 'is-complete' : 'is-locked'}"><span class="achievement-mark">${item.mark}</span><div><b>${item.title}</b><small>${item.detail}</small><i role="progressbar" aria-label="Progresso: ${item.title}" aria-valuemin="0" aria-valuemax="${item.target}" aria-valuenow="${item.value}"><b style="width:${progress(item)}%"></b></i></div><span>${item.complete ? 'Concluída' : `${item.value} / ${item.target}`}</span></li>`).join('')}</ul>`;
  }

  function renderPass() {
    const track = $('#trk');
    if (!track) return;
    const state = getPass();
    const level = passLevel(Number(state.xp) || 0);
    const claimed = new Set(state.claimed.map(Number));
    const currentLevel = Math.max(1, level);
    const header = '<div class="lvl th"><span>Gratuito</span><i></i><span>Premium · bloqueado</span></div>';
    const rows = Array.from({ length: 12 }, (_, index) => {
      const tier = index + 1, reward = tier * 25, ready = tier <= level && !claimed.has(tier), done = claimed.has(tier);
      const freeClass = done ? 'rc done' : ready ? 'rc rdy' : 'rc lk';
      const nodeClass = tier < currentLevel ? 'nd rch' : tier === currentLevel ? 'nd cur' : 'nd';
      return `<div class="lvl${tier <= level ? ' rch' : ''}"><div class="${freeClass}" aria-label="${done ? 'Resgatado' : ready ? 'Disponível' : 'Bloqueado'}">${done ? '✓' : `+${reward}`}<small>${done ? 'Resgatado' : 'moedas'}</small></div><span class="${nodeClass}"${tier === currentLevel ? ' id="cur7"' : ''}>${tier}</span><div class="rc lk" aria-label="Recompensa premium bloqueada"><span>Bloqueado</span><small>Premium</small></div></div>`;
    }).join('');
    const scrollTop = track.scrollTop;
    track.innerHTML = header + rows;
    track.scrollTop = scrollTop;
    const available = state.claimed.filter(value => Number(value) <= level).length;
    const pending = Array.from({ length: level }, (_, index) => index + 1).filter(value => !claimed.has(value)).length;
    const claim = $('#claim');
    if (claim) { claim.disabled = pending === 0; claim.textContent = pending ? `REIVINDICAR (${pending})` : 'NADA PARA REIVINDICAR'; }
    const premium = $('#prem');
    if (premium) { premium.disabled = true; premium.textContent = 'PREMIUM INDISPONÍVEL'; premium.title = 'O passe premium não foi conectado a uma compra nesta versão.'; }
    void available;
  }

  function claimPassRewards() {
    const state = getPass(), level = passLevel(Number(state.xp) || 0);
    const claimed = new Set(state.claimed.map(Number));
    const claimable = Array.from({ length: level }, (_, index) => index + 1).filter(tier => !claimed.has(tier));
    if (!claimable.length) return;
    const reward = claimable.reduce((sum, tier) => sum + tier * 25, 0);
    state.claimed = [...claimed, ...claimable].sort((a, b) => a - b);
    const coins = number('chroma-coins') + reward;
    save(KEYS.pass, state, false);
    saveNumber('chroma-coins', coins, false);
    notifyChange();
    updateHomeAndProfile();
    window.chromaPreview?.setCoins?.(coins);
    window.chromaToast?.(`Recompensas coletadas: +${reward} moedas.`, 'success');
  }

  function recordCompletedRound(summary) {
    if (!summary || summary.spectator || !summary.roundComplete) return;
    const roundId = String(summary.roundId || [summary.mode, summary.tournament?.round || 1, summary.winner, summary.turns, summary.durationMs].join(':'));
    const processed = read(KEYS.processed, []);
    if (Array.isArray(processed) && processed.includes(roundId)) return;
    const ledger = Array.isArray(processed) ? processed.slice(-99) : [];
    ledger.push(roundId);
    try { localStorage.setItem(KEYS.processed, JSON.stringify(ledger)); } catch { /* estatísticas continuam no estado principal */ }

    const stats = getStats();
    stats.played = Math.max(0, Number(stats.played) || 0) + 1;
    if (summary.won) {
      stats.wins = Math.max(0, Number(stats.wins) || 0) + 1;
      stats.winStreak = Math.max(0, Number(stats.winStreak) || 0) + 1;
      stats.bestWinStreak = Math.max(Number(stats.bestWinStreak) || 0, stats.winStreak);
    } else {
      stats.losses = Math.max(0, Number(stats.losses) || 0) + 1;
      stats.winStreak = 0;
    }
    if (summary.won && Number(summary.drawn) === 0) stats.cleanHands = (Number(stats.cleanHands) || 0) + 1;
    if (summary.won && summary.mode === 'tournament' && summary.tournament?.finished) stats.tournamentWins = (Number(stats.tournamentWins) || 0) + 1;
    if (summary.mode === 'caos' && summary.won) stats.chaosWins = (Number(stats.chaosWins) || 0) + 1;
    if (summary.mode === 'supercaos' && summary.won) stats.superChaosWins = (Number(stats.superChaosWins) || 0) + 1;
    if ((summary.mode === 'team2x2' || summary.mode === 'team3x3') && summary.won) stats.teamWins = (Number(stats.teamWins) || 0) + 1;
    const xpEarned = summary.won ? 100 : 50;
    const oldPass = getPass();
    const nextPass = { ...oldPass, xp: Math.max(0, Number(oldPass.xp) || 0) + xpEarned };
    save(KEYS.stats, stats, false);
    saveNumber(KEYS.cards, number(KEYS.cards) + Math.max(0, Number(summary.played) || 0), false);
    saveNumber(KEYS.xp, number(KEYS.xp) + xpEarned, false);
    save(KEYS.pass, nextPass, false);
    notifyChange();
    updateHomeAndProfile();
    window.chromaToast?.(`+${xpEarned} XP${summary.won ? ' · vitória' : ' · partida concluída'}`, 'success');
  }

  function socialElements() {
    return { incoming: $('#sRq'), friends: $('#sFr'), sent: $('#sSn'), incomingTitle: $('#lRq'), friendsTitle: $('#lFr'), sentTitle: $('#lSn'), results: $('#sRs'), resultsTitle: $('#lRs'), state: $('#sOn'), hint: $('#socialHint') };
  }

  let activeFriend = null;
  const nicknameStorageKey = () => `chroma-friend-nicknames:${window.chromaCloud?.getUser?.()?.uid || 'local'}`;
  function readFriendNicknames() { try { const value = JSON.parse(localStorage.getItem(nicknameStorageKey()) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } }
  function writeFriendNickname(key, value) {
    const nicknames = readFriendNicknames(), clean = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    if (clean) nicknames[key] = clean; else delete nicknames[key];
    try { localStorage.setItem(nicknameStorageKey(), JSON.stringify(nicknames)); return true; } catch { return false; }
  }
  function friendMenuButton(friend) {
    return `<button type="button" class="friend-menu-button" data-system-action="open-friend-menu" data-friendship-id="${escapeHtml(friend.friendshipId || '')}" data-friend-uid="${escapeHtml(friend.uid || '')}" data-friend-handle="${escapeHtml(friend.username || '')}" data-friend-name="${escapeHtml(friend.name || '')}" data-local-name="${escapeHtml(friend.localName || '')}" aria-label="Abrir ações de ${escapeHtml(friend.name || friend.username || 'amigo')}" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>`;
  }

  function socialAuthState() {
    return window.chromaAuth?.getState?.() || window.chromaCloud?.getAuthState?.() || window.firebaseAuthState || 'AUTH_LOADING';
  }

  function updateSocialGate(els, state = socialAuthState()) {
    if (!els.hint) return;
    if (authReady()) {
      els.hint.textContent = 'Busque por nome de usuário ou nome do perfil (mínimo de 2 caracteres).';
      return;
    }
    if (state === 'AUTH_LOADING' || state === 'AUTHENTICATED_LOADING_PROFILE' || state === 'loading') {
      els.hint.textContent = 'Conectando sua conta ao Firebase…';
      return;
    }
    if (state === 'AUTHENTICATED_PROFILE_ERROR') {
      const detail = window.chromaCloud?.getWriteMessage?.() || window.firebaseAuthError || 'O perfil não está disponível no Firebase.';
      els.hint.innerHTML = `<span>${escapeHtml(detail)}</span><button class="btn sec" type="button" data-system-action="retry-account">Tentar novamente</button>`;
      return;
    }
    if (state === 'AUTH_ERROR') {
      const detail = window.firebaseAuthError || 'A autenticação do Firebase falhou.';
      els.hint.innerHTML = `<span>${escapeHtml(detail)}</span><button class="btn sec" type="button" data-system-action="connect-account">Abrir conta</button>`;
      return;
    }
    if (state === 'UNAUTHENTICATED') {
      els.hint.innerHTML = '<span>Entre na sua conta para buscar jogadores reais e enviar pedidos de amizade.</span><button class="btn pri" type="button" data-system-action="connect-account">Ir para conta</button>';
      return;
    }
    els.hint.innerHTML = '<span>O Firebase não está pronto para buscar jogadores. Verifique a conexão e tente novamente.</span><button class="btn sec" type="button" data-system-action="connect-account">Abrir conta</button>';
  }

  function renderLocalSocial() {
    const els = socialElements();
    if (!els.friends) return;
    socialSearchToken += 1;
    const state = getFriends();
    const authState = socialAuthState();
    const badge = authState === 'AUTH_LOADING' || authState === 'AUTHENTICATED_LOADING_PROFILE' || authState === 'loading' ? 'CONECTANDO' : authState === 'AUTHENTICATED_PROFILE_ERROR' || authState === 'AUTH_ERROR' ? 'FALHA NO FIREBASE' : 'SEM CONTA';
    if (els.state) { els.state.textContent = badge; els.state.title = 'Busca e amizades online exigem uma conta conectada ao Firebase.'; }
    updateSocialGate(els, authState);
    if (els.incomingTitle) els.incomingTitle.hidden = els.incoming.hidden = true;
    if (els.sentTitle) els.sentTitle.hidden = els.sent.hidden = true;
    if (els.friendsTitle) els.friendsTitle.textContent = `Contatos locais · não online (${state.friends.length})`;
    const nicknames = readFriendNicknames();
    els.friends.innerHTML = state.friends.map(name => {
      const display = nicknames[name] || `@${name}`;
      return `<li>${profileAvatarMarkup({ username: name, name: display }, display, name)}<div class="friend-identity"><b>${escapeHtml(display)}</b><small>@${escapeHtml(name)} · Salvo somente neste dispositivo</small></div>${friendMenuButton({ username: name, name: display, localName: name })}</li>`;
    }).join('') || '<li><small>Entre na sua conta e busque um jogador para criar uma amizade online.</small></li>';
    if (els.results) {
      els.results.hidden = true;
      if (els.resultsTitle) els.resultsTitle.hidden = true;
    }
  }

  function renderRemoteSocial() {
    const els = socialElements();
    if (!els.friends || !authReady()) { renderLocalSocial(); return; }
    const token = ++socialRequestToken;
    socialSearchToken += 1;
    const uid = window.chromaCloud.getUser()?.uid;
    if (els.state) { els.state.textContent = 'FIREBASE'; els.state.title = 'Amizades e solicitações consultadas no Firebase.'; }
    updateSocialGate(els);
    if (els.friendsTitle) els.friendsTitle.textContent = 'Carregando amizades…';
    if (els.friends) els.friends.innerHTML = '<li><small>Atualizando seus amigos…</small></li>';
    Promise.all([window.chromaSocial.requests(), window.chromaSocial.friends()]).then(([requests, friendships]) => {
      if (token !== socialRequestToken) return;
      const incoming = requests?.incoming || [], outgoing = requests?.outgoing || [];
      if (els.incomingTitle) { els.incomingTitle.hidden = els.incoming.hidden = !incoming.length; els.incomingTitle.textContent = `Pedidos recebidos (${incoming.length})`; }
      els.incoming.innerHTML = incoming.map(request => {
        const profile = request.from || {};
        const name = profile.name || profile.username || 'Pedido de amizade';
        return `<li>${profileAvatarMarkup(profile, name, request.fromUid)}<div><b>@${escapeHtml(profile.username || 'jogador')}</b><small>${escapeHtml(profile.name || 'Pedido de amizade')}</small></div><span class="acts"><button class="btn sec" data-system-action="decline-request" data-id="${escapeHtml(request.id)}">Recusar</button><button class="btn pri" data-system-action="accept-request" data-id="${escapeHtml(request.id)}">Aceitar</button></span></li>`;
      }).join('');
      const nicknames = readFriendNicknames();
      const friendRows = friendships.map(friendship => {
        const otherUid = (friendship.participants || []).find(item => item !== uid);
        if (!otherUid) return null;
        const profileFresh = friendship.profileFreshByUid?.[otherUid] !== false;
        const profile = friendship.profiles?.[otherUid] || {};
        const username = profile.username || `jogador_${String(otherUid).slice(-6)}`;
        const officialName = profileFresh ? (profile.name || username) : username;
        const level = profileFresh ? Number(profile.level) : 0;
        const nickname = nicknames[otherUid] || officialName;
        return { sort: nickname, html: `<li data-profile-uid="${escapeHtml(otherUid)}">${profileAvatarMarkup(profileFresh ? profile : { ...profile, photo: '' }, nickname, otherUid)}<div class="friend-identity"><b>${escapeHtml(nickname)}</b><small>@${escapeHtml(username)}${Number.isFinite(level) && level > 0 ? ` · Nível ${level}` : ''}</small></div>${friendMenuButton({ friendshipId: friendship.id, uid: otherUid, username, name: officialName })}</li>` };
      }).filter(Boolean).sort((a, b) => a.sort.localeCompare(b.sort, 'pt-BR'));
      if (els.friendsTitle) els.friendsTitle.textContent = `Meus amigos (${friendRows.length})`;
      els.friends.innerHTML = friendRows.map(row => row.html).join('') || '<li><small>Nenhum amigo ainda. Busque um nome de usuário no Firebase.</small></li>';
      if (els.sentTitle) { els.sentTitle.hidden = els.sent.hidden = !outgoing.length; els.sentTitle.textContent = `Pedidos enviados (${outgoing.length})`; }
      els.sent.innerHTML = outgoing.map(request => {
        const profile = request.to || {};
        const name = profile.name || profile.username || 'jogador';
        return `<li>${profileAvatarMarkup(profile, name, request.toUid)}<div><b>@${escapeHtml(profile.username || 'jogador')}</b><small>Pedido pendente</small></div><button class="btn sec" data-system-action="cancel-request" data-id="${escapeHtml(request.id)}">Cancelar</button></li>`;
      }).join('');
      lastSocialError = '';
      if ($('#sq')?.value.trim()) void searchSocial();
    }).catch(error => {
      if (token !== socialRequestToken) return;
      lastSocialError = window.chromaCloud?.describeError?.(error) || error?.message || 'Não foi possível consultar suas amizades no Firebase.';
      if (els.incomingTitle) els.incomingTitle.hidden = els.incoming.hidden = true;
      if (els.sentTitle) els.sentTitle.hidden = els.sent.hidden = true;
      if (els.friendsTitle) els.friendsTitle.textContent = 'Amigos · erro de acesso';
      els.friends.innerHTML = `<li><div><small>${escapeHtml(lastSocialError)}</small></div><button class="btn sec" data-system-action="refresh-social">Tentar novamente</button></li>`;
    });
  }

  async function searchSocial() {
    const query = $('#sq')?.value.trim() || '', els = socialElements();
    if (!els.results) return;
    const token = ++socialSearchToken;
    if (!query) { els.results.hidden = true; if (els.resultsTitle) els.resultsTitle.hidden = true; return; }
    els.results.hidden = false;
    if (els.resultsTitle) { els.resultsTitle.hidden = false; els.resultsTitle.textContent = authReady() ? 'Resultados do Firebase' : 'Busca online indisponível'; }
    if (!authReady()) {
      els.results.innerHTML = '<li><small>Conecte sua conta para pesquisar perfis reais. Um contato local não envia pedido ao outro jogador.</small></li>';
      return;
    }
    if (query.replace(/^@+/, '').trim().length < 2) {
      els.results.innerHTML = '<li><small>Digite pelo menos 2 caracteres para buscar.</small></li>';
      return;
    }
    els.results.innerHTML = '<li><small>Buscando jogadores no Firebase…</small></li>';
    try {
      const results = await window.chromaSocial.searchPlayers(query);
      if (token !== socialSearchToken || query !== ($('#sq')?.value.trim() || '')) return;
      const [friends, requests] = await Promise.all([window.chromaSocial.friends(), window.chromaSocial.requests()]);
      if (token !== socialSearchToken || query !== ($('#sq')?.value.trim() || '')) return;
      const known = new Set((friends || []).flatMap(item => item.participants || []));
      const sentTo = new Set((requests?.outgoing || []).map(item => item.toUid));
      const requestedBy = new Set((requests?.incoming || []).map(item => item.fromUid));
      els.results.innerHTML = (results || []).map(player => {
        const action = known.has(player.uid) ? '<small>Já são amigos</small>' : sentTo.has(player.uid) ? '<small>Pedido enviado</small>' : requestedBy.has(player.uid) ? '<small>Confira os pedidos recebidos</small>' : `<button class="btn pri" data-system-action="send-request" data-uid="${escapeHtml(player.uid)}" data-username="${escapeHtml(player.username || '')}" data-name="${escapeHtml(player.name || '')}">Adicionar</button>`;
        return `<li>${profileAvatarMarkup(player, player.name || player.username || 'Jogador', player.uid)}<div><b>@${escapeHtml(player.username || 'jogador')}</b><small>${escapeHtml(player.name || 'Jogador')}${Number(player.level) > 0 ? ` · nível ${Number(player.level)}` : ''}</small></div>${action}</li>`;
      }).join('') || '<li><small>Nenhum jogador encontrado com esse nome ou usuário.</small></li>';
    } catch (error) {
      if (token !== socialSearchToken) return;
      const message = window.chromaCloud?.describeError?.(error) || error?.message || 'Verifique a configuração e as regras de acesso do Firestore.';
      els.results.innerHTML = `<li><small>Não foi possível buscar jogadores: ${escapeHtml(message)}</small></li>`;
    }
  }

  function openFriendModalFromButton(button) {
    const localName = cleanUser(button.dataset.localName || ''), uid = button.dataset.friendUid || '';
    const key = uid || localName || cleanUser(button.dataset.friendHandle || '');
    const nicknames = readFriendNicknames();
    activeFriend = {
      friendshipId: button.dataset.friendshipId || '', uid, username: cleanUser(button.dataset.friendHandle || localName),
      officialName: String(button.dataset.friendName || '').trim(), localName, key, nickname: nicknames[key] || '',
    };
    const modal = $('#friendModal'); if (modal) modal.hidden = false;
    renderFriendModal('menu');
  }

  function renderFriendModal(view) {
    if (!activeFriend) return;
    const title = $('#friendModalTitle'), handle = $('#friendModalHandle'), body = $('#friendModalBody');
    const officialHandle = activeFriend.username ? `@${activeFriend.username}` : 'Perfil do amigo';
    const shownName = activeFriend.nickname || activeFriend.officialName || officialHandle;
    if (title) title.textContent = shownName;
    if (handle) handle.textContent = officialHandle;
    if (!body) return;
    const back = '<button type="button" class="btn sec friend-modal-back" data-friend-choice="menu">VOLTAR ÀS AÇÕES</button>';
    if (view === 'menu') {
      body.innerHTML = `<div class="friend-action-list"><button type="button" class="btn sec" data-friend-choice="gift">Enviar presente</button><button type="button" class="btn sec" data-friend-choice="profile">Ver Perfil</button><button type="button" class="btn friend-action-danger sol" data-friend-choice="remove">Remover amizade</button><button type="button" class="btn sec" data-friend-choice="nickname">Dar apelido</button></div>`;
      return;
    }
    if (view === 'gift') {
      if (!activeFriend.uid || !authReady()) {
        body.innerHTML = `<p class="friend-modal-copy">Presentes entre contas exigem uma amizade do Firebase e uma sessão conectada.</p>${back}`;
        return;
      }
      const shop = window.chromaShop, owned = shop?.getState?.().owned || [], items = shop?.items || {};
      const labels = { cards: 'Verso de carta', avatar: 'Avatar', table: 'Mesa', profile: 'Moldura de perfil', 'name-effect': 'Efeito de nome' };
      const itemRows = owned.map(id => items[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).map(item => {
        const icon = item.kind === 'avatar' || item.kind === 'frame' ? (item.symbol || 'A') : item.kind === 'name' ? 'Aa' : item.kind === 'table' ? '▰' : 'C';
        return `<li class="friend-gift-item"><span class="friend-gift-art${item.kind === 'avatar' ? ' avatar' : ''}">${escapeHtml(icon)}</span><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(labels[item.type] || 'Cosmético')} · ${escapeHtml(item.rarity)}</small></div><button type="button" class="btn pri" data-friend-choice="gift-send" data-item-id="${escapeHtml(item.id)}">Presentear</button></li>`;
      }).join('');
      body.innerHTML = `<p class="friend-modal-copy">Escolha um cosmético que já está no seu inventário. Ao enviar, ele será transferido imediatamente — sem etapa de aceite.</p>${itemRows ? `<ul class="friend-gift-list">${itemRows}</ul>` : '<p class="friend-modal-copy">Seu inventário não tem cosméticos disponíveis para presentear.</p>'}${back}`;
      return;
    }
    if (view === 'nickname') {
      body.innerHTML = `<p class="friend-modal-copy">Este apelido é privado e só aparece para você. O @usuário oficial continua logo abaixo.</p><label class="lb" for="friendNicknameInput">Apelido</label><input class="fld friend-nickname-field" id="friendNicknameInput" maxlength="28" autocomplete="off" placeholder="Digite qualquer nome" value="${escapeHtml(activeFriend.nickname)}"><div class="friend-modal-buttons"><button type="button" class="btn sec" data-friend-choice="menu">Cancelar</button><button type="button" class="btn pri" data-friend-choice="nickname-save">Salvar</button></div>`;
      $('#friendNicknameInput')?.focus();
      return;
    }
    if (view === 'remove') {
      body.innerHTML = `<p class="friend-modal-copy">Remover ${escapeHtml(activeFriend.nickname || activeFriend.officialName || officialHandle)} da sua lista de amigos?</p><div class="friend-modal-buttons"><button type="button" class="btn sec" data-friend-choice="menu">Cancelar</button><button type="button" class="btn sol" data-friend-choice="remove-confirm">Remover amizade</button></div>`;
      return;
    }
    if (view === 'profile' && (!activeFriend.uid || !authReady())) {
      body.innerHTML = `<p class="friend-modal-copy">Este contato local não tem um perfil público do Firebase para abrir.</p>${back}`;
      return;
    }
    body.innerHTML = `<p class="friend-modal-copy">Carregando perfil público…</p>${back}`;
  }

  async function openFriendPublicProfile() {
    if (!activeFriend?.uid || !authReady()) { renderFriendModal('profile'); return; }
    const body = $('#friendModalBody');
    if (body) body.innerHTML = '<p class="friend-modal-copy">Carregando perfil público…</p>';
    try {
      const profile = await window.chromaSocial.publicProfile(activeFriend.uid);
      if (!activeFriend || !body) return;
      const displayName = profile.name || activeFriend.officialName || 'Jogador';
      const level = Number(profile.level);
      const levelText = Number.isFinite(level) && level > 0 ? `Nível ${level}` : 'Nível indisponível';
      body.innerHTML = `<article class="friend-profile-card">${profileAvatarMarkup(profile, displayName, activeFriend.uid, 'friend-profile-avatar')}<div><b>${escapeHtml(displayName)}</b><small>@${escapeHtml(profile.username || activeFriend.username || 'jogador')}</small><small>${levelText}</small></div></article><button type="button" class="btn sec friend-modal-back" data-friend-choice="menu">VOLTAR ÀS AÇÕES</button>`;
    } catch (error) {
      if (body) body.innerHTML = `<p class="friend-modal-copy">${escapeHtml(window.chromaCloud?.describeError?.(error) || error?.message || 'Não foi possível carregar o perfil.')}</p><button type="button" class="btn sec friend-modal-back" data-friend-choice="menu">VOLTAR ÀS AÇÕES</button>`;
    }
  }

  async function handleFriendModalClick(event) {
    if (event.target.closest('[data-friend-modal-close]') || event.target === $('#friendModal')) { $('#friendModal').hidden = true; activeFriend = null; return; }
    const button = event.target.closest('[data-friend-choice]');
    if (!button || !activeFriend) return;
    const choice = button.dataset.friendChoice;
    if (choice === 'menu') { renderFriendModal('menu'); return; }
    if (choice === 'gift') { renderFriendModal('gift'); return; }
    if (choice === 'profile') { renderFriendModal('profile'); await openFriendPublicProfile(); return; }
    if (choice === 'nickname') { renderFriendModal('nickname'); return; }
    if (choice === 'nickname-save') {
      if (!writeFriendNickname(activeFriend.key, $('#friendNicknameInput')?.value || '')) { window.chromaToast?.('Não foi possível salvar o apelido neste dispositivo.', 'important'); return; }
      activeFriend.nickname = readFriendNicknames()[activeFriend.key] || '';
      if (authReady()) renderRemoteSocial(); else renderLocalSocial();
      window.chromaToast?.(activeFriend.nickname ? 'Apelido salvo. Só você consegue vê-lo.' : 'Apelido removido.', 'success');
      renderFriendModal('menu'); return;
    }
    if (choice === 'remove') { renderFriendModal('remove'); return; }
    if (choice === 'remove-confirm') {
      button.disabled = true;
      try {
        if (activeFriend.uid && activeFriend.friendshipId) await window.chromaSocial.removeFriend(activeFriend.friendshipId);
        else if (activeFriend.localName) { const state = getFriends(); state.friends = state.friends.filter(item => item !== activeFriend.localName); save(KEYS.friends, state); }
        $('#friendModal').hidden = true; activeFriend = null;
        if (authReady()) renderRemoteSocial(); else renderLocalSocial();
        window.chromaToast?.('Amizade removida.', 'success');
      } catch (error) { button.disabled = false; window.chromaToast?.(error?.message || 'Não foi possível remover a amizade.', 'important'); }
      return;
    }
    if (choice === 'gift-send') {
      if (!authReady() || !activeFriend.uid) { window.chromaToast?.('Conecte sua conta para enviar presentes.', 'important'); return; }
      const item = window.chromaShop?.items?.[button.dataset.itemId];
      if (!item) { window.chromaToast?.('Este cosmético não está disponível no catálogo.', 'important'); return; }
      button.disabled = true; button.textContent = 'Enviando…';
      try {
        await window.chromaSocial.sendGift({ uid: activeFriend.uid, username: activeFriend.username, name: activeFriend.officialName }, item);
        $('#friendModal').hidden = true; activeFriend = null;
        window.chromaToast?.(`${item.name} foi enviado como presente. O amigo o recebe imediatamente.`, 'success');
        renderRemoteSocial(); renderInventory();
      } catch (error) { button.disabled = false; button.textContent = 'Presentear'; window.chromaToast?.(window.chromaCloud?.describeError?.(error, 'enviar o presente') || error?.message || 'Não foi possível enviar o presente.', 'important'); }
    }
  }

  async function handleSocialAction(action, button) {
    const name = cleanUser(button.dataset.name);
    if (action === 'open-friend-menu') { openFriendModalFromButton(button); return; }
    if (action === 'remove-local-friend') {
      const state = getFriends();
      state.friends = state.friends.filter(item => item !== name);
      save(KEYS.friends, state);
      renderLocalSocial();
      return;
    }
    if (action === 'connect-account') { document.querySelector('[data-go="set"]')?.click(); return; }
    if (action === 'retry-account') {
      button.disabled = true;
      try { await window.chromaCloud?.retryProfileLoad?.(); }
      catch (error) { window.chromaToast?.(window.chromaCloud?.describeError?.(error) || error?.message || 'Não foi possível reconectar.', 'important'); }
      finally { button.disabled = false; }
      return;
    }
    if (action === 'refresh-social') { renderRemoteSocial(); await searchSocial(); return; }
    if (!authReady()) return;
    button.disabled = true;
    try {
      if (action === 'send-request') await window.chromaSocial.sendRequest({ uid: button.dataset.uid, username: button.dataset.username, name: button.dataset.name });
      else if (action === 'accept-request') await window.chromaSocial.respondRequest(button.dataset.id, true);
      else if (action === 'decline-request') await window.chromaSocial.respondRequest(button.dataset.id, false);
      else if (action === 'cancel-request') await window.chromaSocial.cancelRequest(button.dataset.id);
      else if (action === 'remove-remote-friend') await window.chromaSocial.removeFriend(button.dataset.id);
      window.chromaToast?.('Amizades atualizadas no Firebase.', 'success');
      renderRemoteSocial();
    } catch (error) {
      button.disabled = false;
      window.chromaToast?.(error?.message || 'Não foi possível atualizar as amizades no Firebase.', 'important');
    }
  }

  const inventoryTypeLabels = { cards: 'Cartas', avatar: 'Avatar', table: 'Mesa', profile: 'Moldura', 'name-effect': 'Efeito de nome' };
  const inventoryFilters = [
    { id: 'all', label: 'Todos' }, { id: 'cards', label: 'Cartas' }, { id: 'table', label: 'Mesas' },
    { id: 'profile', label: 'Molduras' }, { id: 'name-effect', label: 'Efeitos de nome' }, { id: 'avatar', label: 'Avatares' },
  ];
  let inventoryFilter = 'all', inventorySort = 'name', inventorySelectedId = '';

  function renderInventory() {
    const grid = $('#inventoryGrid'), api = window.chromaShop;
    if (!grid) return;
    const detail = $('#inventoryPreview'), count = $('#inventoryCount'), filterHost = $('#inventoryFilters');
    if (!api?.getState || !api.items) {
      if (count) count.textContent = 'Aguardando catálogo e confirmação da conta…';
      if (detail) detail.innerHTML = '<p class="inventory-loading">A loja ainda está inicializando; nenhum item foi presumido.</p>';
      grid.innerHTML = '<p class="inventory-loading">A coleção aparecerá após a inicialização da loja.</p>';
      return;
    }
    let state;
    try { state = api.getState() || {}; }
    catch { state = {}; }
    const ownedIds = [...new Set((Array.isArray(state.owned) ? state.owned : []).map(String))];
    const owned = ownedIds.map(id => api.items[id]).filter(Boolean);
    const counts = Object.fromEntries(inventoryFilters.map(filter => [filter.id, filter.id === 'all' ? owned.length : owned.filter(item => item.type === filter.id).length]));
    if (!counts[inventoryFilter]) inventoryFilter = 'all';
    if (filterHost) filterHost.innerHTML = inventoryFilters.map(filter => `<button type="button" role="tab" data-inventory-filter="${escapeHtml(filter.id)}" aria-selected="${filter.id === inventoryFilter}" aria-controls="inventoryGrid"${filter.id !== 'all' && !counts[filter.id] ? ' disabled' : ''}>${escapeHtml(filter.label)}<span>${counts[filter.id]}</span></button>`).join('');
    const sort = $('#inventorySort');
    if (sort) { sort.value = inventorySort; }
    const sourceState = socialAuthState();
    const source = authReady() ? 'conta Firebase' : sourceState === 'UNAUTHENTICATED' ? 'este dispositivo' : 'cache local · conta em verificação';
    if (count) count.textContent = `${owned.length} ${owned.length === 1 ? 'item' : 'itens'} · fonte: ${source}`;
    const equipped = Object.entries(state.equipped || {}).map(([type, id]) => api.items[id]?.type === type && ownedIds.includes(id) ? api.items[id] : null).filter(Boolean);
    const equippedItem = $('#equippedItem');
    if (equippedItem) equippedItem.textContent = equipped.length ? equipped.map(item => `${item.name} · ${inventoryTypeLabels[item.type] || 'Cosmético'}`).join(' · ') : 'Nenhum cosmético equipado';
    const filtered = owned.filter(item => inventoryFilter === 'all' || item.type === inventoryFilter);
    const typeOrder = Object.fromEntries(inventoryFilters.slice(1).map((filter, index) => [filter.id, index]));
    filtered.sort((a, b) => inventorySort === 'type'
      ? (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99) || a.name.localeCompare(b.name, 'pt-BR')
      : a.name.localeCompare(b.name, 'pt-BR'));
    if (!filtered.some(item => item.id === inventorySelectedId)) inventorySelectedId = filtered[0]?.id || '';
    if (!owned.length) {
      if (detail) detail.innerHTML = '<div class="inventory-empty-panel"><b>Sua coleção está vazia</b><p>O inventário só lista cosméticos presentes no estado da loja. Compras locais ficam neste dispositivo; compras de conta dependem da sessão Firebase.</p><button type="button" class="btn sec" data-go="shop">EXPLORAR LOJA</button></div>';
      grid.innerHTML = '';
      return;
    }
    if (!filtered.length) {
      if (detail) detail.innerHTML = `<div class="inventory-empty-panel"><b>Nenhum item em ${escapeHtml(inventoryFilters.find(item => item.id === inventoryFilter)?.label || 'esta categoria')}</b><p>Escolha outra categoria para ver os cosméticos que você possui.</p></div>`;
      grid.innerHTML = '';
      return;
    }
    const selected = filtered.find(item => item.id === inventorySelectedId) || filtered[0];
    const selectedEquipped = state.equipped?.[selected.type] === selected.id;
    const preview = api.previewItem?.(selected.id) || `<span class="inventory-preview-fallback">${escapeHtml(selected.name.slice(0, 1))}</span>`;
    if (detail) detail.innerHTML = `<div class="inventory-detail-art">${preview}</div><div class="inventory-detail-copy"><span class="availability-kicker">${escapeHtml(selected.rarity || 'Cosmético')} · ${escapeHtml(inventoryTypeLabels[selected.type] || 'Cosmético')}</span><h3>${escapeHtml(selected.name)}</h3><span class="inventory-owned-state">PROPRIEDADE · NA COLEÇÃO · ${selectedEquipped ? 'EQUIPADO' : 'NÃO EQUIPADO'}</span><p>${escapeHtml(selected.desc || 'Cosmético registrado na sua coleção.')}</p><button type="button" class="btn sec" data-inventory-equip="${escapeHtml(selected.id)}" aria-pressed="${selectedEquipped}">${selectedEquipped ? 'DESEQUIPAR' : 'EQUIPAR'}</button></div>`;
    grid.innerHTML = filtered.map(item => {
      const selectedNow = item.id === selected.id;
      const equippedNow = state.equipped?.[item.type] === item.id;
      const art = api.previewItem?.(item.id, true) || `<span class="inventory-preview-fallback">${escapeHtml(item.name.slice(0, 1))}</span>`;
      return `<article class="owned-cosmetic-card${selectedNow ? ' is-selected' : ''}" data-item-type="${escapeHtml(item.type)}"><button type="button" class="owned-cosmetic-select" data-inventory-select="${escapeHtml(item.id)}" aria-pressed="${selectedNow}"><span class="owned-cosmetic-art">${art}</span><span class="owned-cosmetic-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(inventoryTypeLabels[item.type] || 'Cosmético')} · ${escapeHtml(item.rarity || '—')}</small><small class="owned-cosmetic-status">${equippedNow ? 'Equipado' : 'Na coleção'}</small></span></button><button type="button" class="owned-cosmetic-equip" data-inventory-equip="${escapeHtml(item.id)}" aria-pressed="${equippedNow}">${equippedNow ? 'Desequipar' : 'Equipar'}</button></article>`;
    }).join('');
  }

  const collectionCategories = [
    { id: 'all', label: 'Todos' }, { id: 'avatar', label: 'Avatares' },
    { id: 'profile', label: 'Molduras' }, { id: 'cards', label: 'Cartas' },
    { id: 'table', label: 'Mesas' }, { id: 'name-effect', label: 'Efeitos de nome' },
  ];
  let profileCategory = 'avatar', profileSelectedId = '', collectionCategory = 'all', collectionSelectedId = '', lastProfileTrigger = null;

  function currentDisplayName() {
    return String(localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || 'Jogador').trim() || 'Jogador';
  }

  function shopState(api = window.chromaShop) {
    try { return api?.getState?.() || {}; } catch { return {}; }
  }

  function collectionSourceLabel() {
    const state = socialAuthState();
    return authReady() ? 'conta Firebase' : state === 'UNAUTHENTICATED' || !window.chromaCloud ? 'este dispositivo' : 'cache local · conta em verificação';
  }

  function shopCategoryFor(api, itemId) {
    return Object.entries(api?.catalog || {}).find(([, items]) => items.some(item => item.id === itemId))?.[0] || '';
  }

  function renderProfileCustomize() {
    const identity = $('#profileCustomizeIdentity');
    const grid = $('#profileCustomizeGrid');
    const previewHost = $('#profileCustomizePreview');
    const note = $('#profileCustomizeNote');
    const api = window.chromaShop;
    const state = shopState(api);
    const owned = new Set(Array.isArray(state.owned) ? state.owned.map(String) : []);
    const uid = String(window.chromaCloud?.getUser?.()?.uid || '');
    const profileForm = $('#profileNameForm');
    const input = $('#profileNameInput');
    if (identity) {
      identity.replaceChildren();
      const avatar = $('#prof .who .av')?.cloneNode(true);
      if (avatar) identity.append(avatar);
      const copy = document.createElement('div');
      copy.className = 'profile-customize-identity-copy';
      const name = document.createElement('b'); name.textContent = currentDisplayName();
      const id = document.createElement('small'); id.textContent = uid ? `ID ${uid}` : 'ID estável disponível ao conectar uma conta';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'profile-name-edit'; edit.dataset.profileEditToggle = '1'; edit.textContent = 'Editar apelido';
      copy.append(name, id, edit); identity.append(copy);
    }
    if (input && profileForm?.hidden) input.value = currentDisplayName();
    const type = profileCategory === 'profile' ? 'profile' : 'avatar';
    const equippedId = owned.has(String(state.equipped?.[type] || '')) ? String(state.equipped[type]) : '';
    const baseline = type === 'avatar'
      ? { id: 'default-avatar', type, name: 'Avatar padrão', rarity: 'Padrão', desc: 'Retrato original do CHROMA; não exige item no inventário.', kind: 'default' }
      : { id: 'no-frame', type, name: 'Sem moldura', rarity: 'Padrão', desc: 'Perfil sem moldura cosmética equipada.', kind: 'default' };
    const items = Object.values(api?.items || {}).filter(item => item.type === type).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const options = [baseline, ...items];
    if (!options.some(item => item.id === profileSelectedId)) profileSelectedId = equippedId || baseline.id;
    const selected = options.find(item => item.id === profileSelectedId) || baseline;
    const active = selected.id === baseline.id ? !equippedId : owned.has(selected.id) && equippedId === selected.id;
    const makeAction = item => {
      const isBase = item.id === baseline.id;
      const isOwned = isBase || owned.has(item.id);
      const isEquipped = isBase ? !equippedId : isOwned && equippedId === item.id;
      const storeCategory = shopCategoryFor(api, item.id);
      if (isEquipped) return '<button class="btn sec" type="button" disabled>EM USO</button>';
      if (isOwned) return `<button class="btn pri" type="button" data-profile-equip="${escapeHtml(item.id)}">EQUIPAR</button>`;
      if (storeCategory) return `<button class="btn sec" type="button" data-profile-shop="${escapeHtml(item.id)}">VER NA LOJA · ${Math.max(0, Number(item.price) || 0).toLocaleString('pt-BR')} MOEDAS</button>`;
      return '<button class="btn sec" type="button" disabled>NÃO ADQUIRIDO</button>';
    };
    const selectedIsOwned = selected.id === baseline.id || owned.has(selected.id);
    const selectedCategory = shopCategoryFor(api, selected.id);
    const selectedStatus = active ? 'EM USO' : selectedIsOwned ? 'NA SUA COLEÇÃO' : selectedCategory ? 'NÃO ADQUIRIDO · DISPONÍVEL NA LOJA' : 'NÃO ADQUIRIDO · AQUISIÇÃO NÃO DISPONÍVEL NA LOJA ATUAL';
    const art = selected.kind === 'default'
      ? ($('#prof .who .av')?.outerHTML || `<span class="profile-default-avatar">${escapeHtml(avatarInitial(currentDisplayName()))}</span>`)
      : (api?.previewItem?.(selected.id) || `<span class="profile-default-avatar">${escapeHtml(selected.name.slice(0, 1))}</span>`);
    if (previewHost) previewHost.innerHTML = `<div class="profile-customize-art">${art}</div><div class="profile-customize-copy"><span class="availability-kicker">${escapeHtml(selected.rarity || 'Cosmético')} · ${escapeHtml(type === 'avatar' ? 'Avatar' : 'Moldura')}</span><h4>${escapeHtml(selected.name)}</h4><span class="profile-cosmetic-state">${selectedStatus}</span><p>${escapeHtml(selected.desc || 'Cosmético do catálogo CHROMA.')}</p>${makeAction(selected)}</div>`;
    if (grid) {
      if (!api?.items) grid.innerHTML = '<p class="inventory-loading">Aguarde a inicialização do catálogo e da conta.</p>';
      else grid.innerHTML = options.map(item => {
        const isBase = item.id === baseline.id;
        const isOwned = isBase || owned.has(item.id);
        const isEquipped = isBase ? !equippedId : isOwned && equippedId === item.id;
        const isLocked = !isOwned;
        const thumb = item.kind === 'default' ? ($('#prof .who .av')?.outerHTML || `<span class="profile-default-avatar">${escapeHtml(avatarInitial(currentDisplayName()))}</span>`) : (api.previewItem?.(item.id, true) || `<span>${escapeHtml(item.name.slice(0, 1))}</span>`);
        const label = isEquipped ? 'Em uso' : isOwned ? 'Na coleção' : shopCategoryFor(api, item.id) ? 'Bloqueado · na Loja' : 'Não adquirido';
        return `<article class="profile-option${item.id === selected.id ? ' is-selected' : ''}${isLocked ? ' is-locked' : ''}"><button class="profile-option-select" type="button" data-profile-select="${escapeHtml(item.id)}" aria-pressed="${item.id === selected.id}"><span class="profile-option-art">${thumb}</span><span class="profile-option-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(label)}</small></span></button></article>`;
      }).join('');
    }
    if (note) {
      const usingPhoto = Boolean(safePhotoURL(localStorage.getItem('chroma-profile-photo')));
      note.textContent = type === 'avatar' && usingPhoto ? 'A foto da sua conta aparece no lugar do cosmético de avatar nas telas que mostram essa foto.' : `${owned.size} cosmético(s) pertencem a este inventário · fonte: ${collectionSourceLabel()}. Itens bloqueados não podem ser equipados.`;
    }
    $$('#profileCustomizeTabs [data-profile-category]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.profileCategory === profileCategory)));
  }

  function renderCharacterCollection() {
    const api = window.chromaShop;
    const summary = $('#collectionSummary');
    const progress = $('#collectionProgress');
    const tabs = $('#collectionTabs');
    const previewHost = $('#collectionPreview');
    const grid = $('#collectionGrid');
    const xp = number(KEYS.xp);
    const level = levelFromXP(xp);
    const base = levelStart(level);
    const next = levelStart(level + 1);
    const progressXp = Math.max(0, xp - base);
    const needed = Math.max(1, next - base);
    if (progress) progress.innerHTML = `<div class="collection-progress-head"><span>Progressão do perfil</span><b>Nível ${level}</b></div><div class="collection-xp-copy"><span>${progressXp} / ${needed} XP</span><small>fonte: ${escapeHtml(collectionSourceLabel())}</small></div><i><b style="width:${Math.min(100, progressXp / needed * 100)}%"></b></i>`;
    if (!api?.items || !api.getState) {
      if (summary) summary.textContent = 'Catálogo ainda não disponível';
      if (previewHost) previewHost.innerHTML = '<p class="inventory-loading">Não foi possível consultar o catálogo local.</p>';
      if (grid) grid.replaceChildren();
      return;
    }
    const state = shopState(api);
    const owned = new Set(Array.isArray(state.owned) ? state.owned.map(String) : []);
    const items = Object.values(api.items).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (summary) summary.textContent = `${owned.size} de ${items.length} cosméticos · fonte: ${collectionSourceLabel()}`;
    const counts = Object.fromEntries(collectionCategories.map(category => [category.id, category.id === 'all' ? items.length : items.filter(item => item.type === category.id).length]));
    if (!counts[collectionCategory]) collectionCategory = 'all';
    if (tabs) tabs.innerHTML = collectionCategories.map(category => `<button type="button" role="tab" data-collection-category="${category.id}" aria-selected="${category.id === collectionCategory}">${escapeHtml(category.label)}<span>${counts[category.id]}</span></button>`).join('');
    const visible = items.filter(item => collectionCategory === 'all' || item.type === collectionCategory);
    if (!visible.some(item => item.id === collectionSelectedId)) collectionSelectedId = visible[0]?.id || '';
    const selected = visible.find(item => item.id === collectionSelectedId);
    if (!selected) {
      if (previewHost) previewHost.innerHTML = `<div class="collection-empty"><b>Nenhum cosmético nesta categoria</b><p>O catálogo não contém itens deste tipo nesta versão.</p></div>`;
      if (grid) grid.innerHTML = '';
      return;
    }
    const isOwned = owned.has(selected.id);
    const isEquipped = isOwned && state.equipped?.[selected.type] === selected.id;
    const category = shopCategoryFor(api, selected.id);
    const typeLabel = inventoryTypeLabels[selected.type] || 'Cosmético';
    const status = isEquipped ? 'EQUIPADO' : isOwned ? 'PERTENCE À SUA COLEÇÃO' : category ? 'NÃO ADQUIRIDO · DISPONÍVEL NA LOJA' : 'NÃO ADQUIRIDO · AQUISIÇÃO INDISPONÍVEL NESTA LOJA';
    const art = api.previewItem?.(selected.id) || `<span class="collection-art-fallback">${escapeHtml(selected.name.slice(0, 1))}</span>`;
    let action = isEquipped ? '<button class="btn sec" type="button" disabled>EM USO</button>'
      : isOwned ? `<button class="btn pri" type="button" data-collection-equip="${escapeHtml(selected.id)}">EQUIPAR</button>`
      : category ? `<button class="btn sec" type="button" data-collection-shop="${escapeHtml(selected.id)}">VER NA LOJA</button>`
      : '<button class="btn sec" type="button" disabled>AQUISIÇÃO INDISPONÍVEL</button>';
    if (previewHost) previewHost.innerHTML = `<div class="collection-detail-art">${art}</div><div class="collection-detail-copy"><span class="availability-kicker">${escapeHtml(selected.rarity || 'Cosmético')} · ${escapeHtml(typeLabel)}</span><h3>${escapeHtml(selected.name)}</h3><span class="collection-item-state">${status}</span><p>${escapeHtml(selected.desc || 'Cosmético do catálogo CHROMA.')}</p>${action}</div>`;
    if (grid) grid.innerHTML = visible.map(item => {
      const ownedNow = owned.has(item.id);
      const equippedNow = ownedNow && state.equipped?.[item.type] === item.id;
      const itemCategory = shopCategoryFor(api, item.id);
      const stateLabel = equippedNow ? 'Equipado' : ownedNow ? 'Na coleção' : itemCategory ? 'Bloqueado · na Loja' : 'Não adquirido';
      const thumb = api.previewItem?.(item.id, true) || `<span>${escapeHtml(item.name.slice(0, 1))}</span>`;
      return `<article class="collection-card${item.id === selected.id ? ' is-selected' : ''}${ownedNow ? '' : ' is-locked'}"><button class="collection-card-select" type="button" data-collection-select="${escapeHtml(item.id)}" aria-pressed="${item.id === selected.id}"><span class="collection-card-art">${thumb}</span><span class="collection-card-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(inventoryTypeLabels[item.type] || 'Cosmético')} · ${escapeHtml(item.rarity || '—')}</small><small class="collection-card-state">${stateLabel}</small></span></button></article>`;
    }).join('');
  }

  function openCollectionShopItem(itemId) {
    const api = window.chromaShop;
    if (!api?.openItem?.(itemId)) return false;
    window.go?.('shop');
    return true;
  }

  function openProfileCustomize(trigger) {
    const modal = $('#profileCustomizeModal');
    if (!modal) return;
    lastProfileTrigger = trigger || null;
    profileCategory = 'avatar';
    profileSelectedId = '';
    const form = $('#profileNameForm'); if (form) form.hidden = true;
    const input = $('#profileNameInput'); if (input) input.value = currentDisplayName();
    const status = $('#profileNameStatus'); if (status) status.textContent = 'A alteração afeta somente seu próprio perfil.';
    modal.hidden = false;
    renderProfileCustomize();
    $('#profileCustomizeClose')?.focus();
  }

  function closeProfileCustomize() {
    const modal = $('#profileCustomizeModal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastProfileTrigger?.isConnected) lastProfileTrigger.focus();
    lastProfileTrigger = null;
  }

  async function saveOwnProfileName(event) {
    event.preventDefault();
    const input = $('#profileNameInput');
    const status = $('#profileNameStatus');
    const button = $('#profileNameForm button[type="submit"]');
    const name = String(input?.value || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40) { if (status) status.textContent = 'Use um apelido entre 2 e 40 caracteres.'; input?.focus(); return; }
    const user = window.chromaCloud?.getUser?.();
    const authState = window.chromaAuth?.getState?.() || window.firebaseAuthState || '';
    const canPublish = authReady() && typeof window.chromaSocial?.publishSocialProfile === 'function';
    if ((user && !canPublish) || (!user && (window.CHROMA_FIREBASE_BOOTING || authState === 'AUTH_LOADING'))) {
      if (status) status.textContent = 'A conta ainda está verificando permissões; aguarde antes de alterar o apelido.';
      return;
    }
    const previous = localStorage.getItem('chroma-name');
    if (button) button.disabled = true;
    if (status) status.textContent = canPublish ? 'Salvando no seu perfil…' : 'Salvando neste dispositivo…';
    try {
      localStorage.setItem('chroma-name', name);
      window.dispatchEvent(new Event('chroma-state-changed'));
      if (canPublish) await window.chromaSocial.publishSocialProfile();
      document.dispatchEvent(new Event('chroma-social-updated'));
      if (status) status.textContent = canPublish ? 'Apelido atualizado no seu perfil Firebase.' : 'Apelido salvo somente neste dispositivo; não sincroniza entre contas.';
    } catch (error) {
      if (previous === null) localStorage.removeItem('chroma-name'); else localStorage.setItem('chroma-name', previous);
      window.dispatchEvent(new Event('chroma-state-changed'));
      if (status) status.textContent = `Não foi possível atualizar o perfil. ${window.chromaCloud?.describeError?.(error) || error?.message || 'Tente novamente.'}`;
    } finally {
      if (button) button.disabled = false;
      renderProfileCustomize();
      updateHomeAndProfile();
    }
  }

  function giftToastQueueKey() { return `chroma-gift-toast-queue:${window.chromaCloud?.getUser?.()?.uid || 'local'}`; }
  function readGiftToastQueue() { try { const queue = JSON.parse(localStorage.getItem(giftToastQueueKey()) || '[]'); return Array.isArray(queue) ? queue : []; } catch { return []; } }
  function saveGiftToastQueue(queue) { try { localStorage.setItem(giftToastQueueKey(), JSON.stringify(queue)); } catch { /* O aviso atual continua visível mesmo sem persistência local. */ } }
  function renderGiftToast() {
    const queue = readGiftToastQueue();
    let toast = $('#friendGiftToast');
    if (!toast && document.body) { toast = document.createElement('button'); toast.id = 'friendGiftToast'; toast.type = 'button'; toast.className = 'friend-toast'; toast.setAttribute('aria-live', 'polite'); document.body.append(toast); }
    if (!toast) return;
    if (!queue.length) { toast.hidden = true; return; }
    const gift = queue[0], small = document.createElement('small'), message = document.createElement('b'), hint = document.createElement('span');
    small.textContent = 'PRESENTE RECEBIDO';
    message.textContent = `Parabéns! ${gift.senderName || 'Um amigo'} te presenteou com um ${gift.itemName || 'cosmético'}, vá resgatar agora!`;
    hint.textContent = queue.length > 1 ? `Toque para abrir o inventário · ${queue.length} presentes` : 'Toque para abrir o inventário e equipar';
    toast.replaceChildren(small, message, hint); toast.hidden = false;
    toast.onclick = async () => {
      const next = readGiftToastQueue().slice(1); saveGiftToastQueue(next); toast.hidden = true;
      try { await window.chromaCloud?.restoreFromServer?.(); } catch { /* O item já foi entregue na conta; a UI tentará carregar o cache atual. */ }
      renderInventory();
      if (typeof window.go === 'function') window.go('inventory');
      else { $$('.scr').forEach(screen => screen.classList.toggle('on', screen.id === 'inventory')); }
      setTimeout(renderGiftToast, 1200);
    };
  }
  function queueGiftToast(gift) {
    if (!gift || !gift.itemName) return;
    const queue = readGiftToastQueue();
    if (!queue.some(item => item.id && item.id === gift.id)) queue.push({ id: gift.id || `gift-${Date.now()}`, senderName: String(gift.senderName || 'Um amigo').slice(0, 40), itemName: String(gift.itemName || 'cosmético').slice(0, 80) });
    saveGiftToastQueue(queue); renderGiftToast();
  }

  function setupAccountUi() {
    const status = $('#accountStatus');
    const button = $('#accountGoogle');
    const emailLink = $('#emailSignInOpen');
    const logout = $('#accountLogout');
    const msg = $('#accountMsg');
    if (!status || !button) return;
    const update = info => {
      const state = info?.state || window.firebaseAuthState || 'AUTH_LOADING';
      cloudState = state;
      const connected = Boolean(window.chromaCloud?.getUser?.());
      const ready = authReady();
      if (window.chromaAuth?.signInGoogle && button.dataset.systemGoogleBound !== '1' && button.dataset.firebaseGoogleBound !== '1') {
        button.dataset.systemGoogleBound = '1';
        button.addEventListener('click', () => window.chromaAuth?.signInGoogle?.());
      }
      button.disabled = !window.chromaCloud || connected;
      button.hidden = connected;
      if (emailLink) { emailLink.hidden = connected; emailLink.setAttribute('aria-disabled', String(!window.chromaCloud)); }
      if (logout) logout.hidden = !connected;
      if (connected) closeEmailAuthModal();
      if (status) {
        if (ready) status.textContent = `Conta conectada · progresso sincronizado com Firebase (${window.chromaCloud.getUser()?.email || 'Google'})`;
        else if (connected) status.textContent = 'Identidade conectada; perfil Firebase indisponível. Progresso e amizades continuam locais até corrigir o acesso.';
        else if (!window.chromaCloud) status.textContent = 'Módulo Firebase não carregou; progresso segue local neste dispositivo.';
        else if (state === 'AUTH_LOADING') status.textContent = 'Conectando ao Firebase…';
        else status.textContent = 'Progresso local neste dispositivo · sem sincronização em nuvem';
      }
      if (!window.chromaCloud) button.textContent = 'Google indisponível';
      else if (connected) button.textContent = 'Google conectado';
      else button.textContent = 'Conectar com Google';
      if (msg && state === 'AUTHENTICATED_PROFILE_ERROR') msg.textContent = info?.error?.message || window.firebaseAuthError || 'Falha ao carregar o perfil no Firebase.';
      updateHomeAndProfile();
      window.chromaShop?.render?.();
      renderInventory();
      renderCharacterCollection();
      if (ready) { renderRemoteSocial(); renderGiftToast(); } else renderLocalSocial();
    };
    const wait = setInterval(() => {
      if (window.chromaAuth?.subscribe) {
        clearInterval(wait);
        update({ state: window.chromaAuth.getState?.() });
        window.chromaAuth.subscribe(update);
      } else if (Date.now() - startedAt > 12000) {
        clearInterval(wait);
        update({ state: 'UNAUTHENTICATED' });
      }
    }, 120);
    button.disabled = true;
    button.textContent = 'Carregando Firebase…';
    $('#accountLogout')?.addEventListener('click', () => { status.textContent = 'Saindo da conta Firebase…'; });
  }
  const startedAt = Date.now();

  function addVolumeControls() {
    const setBody = $('#setBody');
    const musicRow = setBody && [...setBody.querySelectorAll('.sr')].find(row => row.textContent.includes('Música'));
    if (musicRow && !$('#systemAudioControls')) {
      musicRow.insertAdjacentHTML('afterend', `<div class="audio-preferences" id="systemAudioControls"><label for="musicVolume">Volume da música <output id="musicVolumeValue">19%</output></label><input id="musicVolume" type="range" min="0" max="100" value="19" aria-label="Volume da música em configurações"><label for="sfxVolume">Volume dos efeitos permitidos <output id="sfxVolumeValue">45%</output></label><input id="sfxVolume" type="range" min="0" max="100" value="45" aria-label="Volume dos efeitos sonoros"><small>Preferências locais deste dispositivo.</small></div>`);
    }
    const accountRow = $('#setBody .sr.acc');
    if (accountRow) accountRow.remove();
    const oldOut = $('#out');
    if (oldOut) oldOut.remove();
    let account = $('#systemAccount');
    if (!account && setBody) {
      setBody.insertAdjacentHTML('beforeend', `<h3 class="gh">Login</h3><div class="account-panel" id="systemAccount"><div class="account-status" id="accountStatus">Conectando ao Firebase…</div><small>Sem login, o progresso e os contatos ficam somente neste dispositivo.</small><p id="accountMsg" class="account-msg" role="status" aria-live="polite"></p><button class="btn btn-primary pri google-connect" id="accountGoogle" type="button" disabled>Carregando Firebase…</button><a class="account-email-link" id="emailSignInOpen" href="#accountModal">Prefiro E-mail/Senha</a><button class="btn btn-secondary sec account-logout" id="accountLogout" type="button" hidden>Sair da conta</button></div>`);
    }
    if (!$('#accountModal')) document.body.insertAdjacentHTML('beforeend', `<div class="ov auth-overlay" id="accountModal" hidden><section class="mdl auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle"><button class="auth-close" id="authModalClose" type="button" aria-label="Fechar">×</button><p class="auth-kicker">CHROMA · CONTA</p><h3 id="authModalTitle">Entrar</h3><form id="emailAuthForm" novalidate><label class="auth-field-label" for="authEmail">E-mail</label><input class="fld auth-field" id="authEmail" name="email" type="email" inputmode="email" autocomplete="email" placeholder="voce@exemplo.com" required><label class="auth-field-label" for="authPassword">Senha</label><input class="fld auth-field" id="authPassword" name="password" type="password" autocomplete="current-password" placeholder="Sua senha" minlength="6" required><p id="authModalMsg" class="auth-modal-message" role="alert" aria-live="polite"></p><button class="btn btn-primary pri auth-submit" id="authSubmit" type="submit">Entrar</button><p class="auth-switch"><span id="authSwitchPrompt">Ainda não tem uma conta?</span> <a href="#create-account" id="authModeLink">Criar conta</a></p></form></section></div>`);
    const savedMusicVolume = Number(window.ChromaAudio?.getMusicVolume?.());
    const savedSfxVolume = Number(window.ChromaAudio?.getSfxVolume?.());
    const values = {
      music: Math.round(Number.isFinite(savedMusicVolume) ? savedMusicVolume * 100 : 0.19 * 100),
      sfx: Math.round(Number.isFinite(savedSfxVolume) ? savedSfxVolume * 100 : 0.45 * 100),
      musicOn: window.ChromaAudio?.isMusicEnabled?.() !== false,
      sfxOn: window.ChromaAudio?.isSfxEnabled?.() !== false,
    };
    const setVol = $('#musicVolume'); if (setVol) { setVol.value = String(values.music); setVol.style.setProperty('--range-progress', `${values.music}%`); }
    const sfxVol = $('#sfxVolume'); if (sfxVol) { sfxVol.value = String(values.sfx); sfxVol.style.setProperty('--range-progress', `${values.sfx}%`); }
    const musicValue = $('#musicVolumeValue'); if (musicValue) musicValue.textContent = `${values.music}%`;
    const sfxValue = $('#sfxVolumeValue'); if (sfxValue) sfxValue.textContent = `${values.sfx}%`;
    const fxSwitch = $('#setBody .sw[data-k="fx"]');
    if (fxSwitch) { fxSwitch.setAttribute('aria-checked', String(values.sfxOn)); const label = fxSwitch.querySelector('span'); if (label) label.textContent = values.sfxOn ? 'Sim' : 'Não'; }
    const musicSwitch = $('#setBody .sw[data-k="mu"]');
    if (musicSwitch) { musicSwitch.setAttribute('aria-checked', String(values.musicOn)); const label = musicSwitch.querySelector('span'); if (label) label.textContent = values.musicOn ? 'Sim' : 'Não'; }
  }

  function wireAudioControls() {
    const applyMusic = value => {
      const amount = Math.max(0, Math.min(100, Number(value) || 0));
      window.ChromaAudio?.setMusicVolume?.(amount / 100);
      const input = $('#musicVolume'); if (input) { input.value = String(amount); input.style.setProperty('--range-progress', `${amount}%`); }
      const label = $('#musicVolumeValue'); if (label) label.textContent = `${amount}%`;
    };
    const applySfx = value => {
      const amount = Math.max(0, Math.min(100, Number(value) || 0));
      window.ChromaAudio?.setSfxVolume?.(amount / 100);
      const input = $('#sfxVolume'); if (input) { input.value = String(amount); input.style.setProperty('--range-progress', `${amount}%`); }
      const label = $('#sfxVolumeValue'); if (label) label.textContent = `${amount}%`;
    };
    document.addEventListener('input', event => {
      if (event.target.id === 'musicVolume') applyMusic(event.target.value);
      else if (event.target.id === 'sfxVolume') applySfx(event.target.value);
    });
    $('#setBody')?.addEventListener('click', event => {
      const button = event.target.closest('.sw[data-k="fx"], .sw[data-k="mu"]');
      if (!button) return;
      event.stopImmediatePropagation();
      const enabled = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(enabled));
      const label = button.querySelector('span'); if (label) label.textContent = enabled ? 'Sim' : 'Não';
      if (button.dataset.k === 'fx') window.ChromaAudio?.setSfxEnabled?.(enabled);
      else window.ChromaAudio?.setMusicEnabled?.(enabled);
    }, true);
    $('#claim').onclick = claimPassRewards;
    $('#prem').onclick = () => window.chromaToast?.('O passe premium não está conectado a uma compra nesta versão.', 'important');
    $('#pbtn')?.addEventListener('click', () => setTimeout(() => $('#cur7')?.scrollIntoView({ block: 'center' }), 60));
    $('#setBody')?.addEventListener('click', event => {
      if (event.target.closest('[data-ss]')) setTimeout(updateHomeAndProfile, 0);
    });
  }

  function captureSocialClick(event) {
    const button = event.target.closest('[data-system-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const action = button.dataset.systemAction;
    if (action) handleSocialAction(action, button);
  }

  function renderSettingsAccountText() {
    const passLevelEl = $('#systemPassLevel');
    if (passLevelEl) passLevelEl.textContent = `Nível ${passLevel(getPass().xp || 0)}`;
  }

  addVolumeControls();
  setupEmailAuthUi();
  initializeFreshLocalProfile();
  wireAudioControls();
  setupAccountUi();
  document.addEventListener('error', event => {
    const image = event.target;
    if (image?.classList?.contains('friend-avatar-image')) { image.closest('.friend-avatar')?.classList.remove('has-photo'); image.remove(); }
  }, true);
  document.addEventListener('click', captureSocialClick, true);
  $('#friendModal')?.addEventListener('click', handleFriendModalClick);
  $('#profileCustomizeClose')?.addEventListener('click', closeProfileCustomize);
  $('#profileCustomizeModal')?.addEventListener('click', event => { if (event.target.id === 'profileCustomizeModal') closeProfileCustomize(); });
  $('#profileNameForm')?.addEventListener('submit', saveOwnProfileName);
  $('#profileCustomizeModal')?.addEventListener('click', async event => {
    const edit = event.target.closest('[data-profile-edit-toggle]');
    if (edit) { const form = $('#profileNameForm'); if (form) { form.hidden = !form.hidden; if (!form.hidden) $('#profileNameInput')?.focus(); } return; }
    const selection = event.target.closest('[data-profile-select]');
    if (selection) { profileSelectedId = selection.dataset.profileSelect; renderProfileCustomize(); return; }
    const equip = event.target.closest('[data-profile-equip]');
    if (equip) {
      equip.disabled = true;
      try { await window.chromaShop?.equipItem?.(equip.dataset.profileEquip); }
      catch (error) { window.chromaToast?.(error?.message || 'Não foi possível equipar este cosmético.', 'important'); }
      renderProfileCustomize(); renderInventory(); return;
    }
    const shop = event.target.closest('[data-profile-shop]');
    if (shop) { openCollectionShopItem(shop.dataset.profileShop); closeProfileCustomize(); }
  });
  $('#profileCustomizeTabs')?.addEventListener('click', event => {
    const tab = event.target.closest('[data-profile-category]');
    if (!tab) return;
    profileCategory = tab.dataset.profileCategory === 'profile' ? 'profile' : 'avatar';
    profileSelectedId = '';
    renderProfileCustomize();
  });
  document.addEventListener('click', event => {
    const open = event.target.closest('[data-profile-customize]');
    if (open) { openProfileCustomize(open); return; }
    if (event.target.closest('[data-go="characters"]')) setTimeout(renderCharacterCollection, 0);
  });
  document.addEventListener('keydown', event => {
    const modal = $('#profileCustomizeModal');
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeProfileCustomize(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')].filter(node => node.getClientRects().length > 0);
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#friendModal') && !$('#friendModal').hidden) { $('#friendModal').hidden = true; activeFriend = null; } });
  $('#inventoryFilters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-inventory-filter]');
    if (!button || button.disabled) return;
    inventoryFilter = button.dataset.inventoryFilter || 'all';
    renderInventory();
  });
  $('#inventorySort')?.addEventListener('change', event => {
    inventorySort = event.target.value === 'type' ? 'type' : 'name';
    renderInventory();
  });
  $('#inventoryGrid')?.addEventListener('click', async event => {
    const selection = event.target.closest('[data-inventory-select]');
    if (selection) { inventorySelectedId = selection.dataset.inventorySelect; renderInventory(); return; }
    const button = event.target.closest('[data-inventory-equip]');
    if (!button) return;
    button.disabled = true;
    try { await window.chromaShop?.equipItem?.(button.dataset.inventoryEquip); }
    catch (error) { window.chromaToast?.(error?.message || 'Não foi possível equipar este cosmético.', 'important'); }
    finally { renderInventory(); }
  });
  $('#inventoryPreview')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-inventory-equip]');
    if (!button) return;
    button.disabled = true;
    try { await window.chromaShop?.equipItem?.(button.dataset.inventoryEquip); }
    catch (error) { window.chromaToast?.(error?.message || 'Não foi possível equipar este cosmético.', 'important'); }
    finally { renderInventory(); }
  });
  $('#collectionTabs')?.addEventListener('click', event => {
    const tab = event.target.closest('[data-collection-category]');
    if (!tab) return;
    collectionCategory = collectionCategories.some(item => item.id === tab.dataset.collectionCategory) ? tab.dataset.collectionCategory : 'all';
    collectionSelectedId = '';
    renderCharacterCollection();
  });
  const handleCollectionAction = async event => {
    const selection = event.target.closest('[data-collection-select]');
    if (selection) { collectionSelectedId = selection.dataset.collectionSelect; renderCharacterCollection(); return; }
    const equip = event.target.closest('[data-collection-equip]');
    if (equip) {
      equip.disabled = true;
      try { await window.chromaShop?.equipItem?.(equip.dataset.collectionEquip); }
      catch (error) { window.chromaToast?.(error?.message || 'Não foi possível equipar este cosmético.', 'important'); }
      renderCharacterCollection(); renderInventory(); return;
    }
    const shop = event.target.closest('[data-collection-shop]');
    if (shop) openCollectionShopItem(shop.dataset.collectionShop);
  };
  $('#collectionGrid')?.addEventListener('click', handleCollectionAction);
  $('#collectionPreview')?.addEventListener('click', handleCollectionAction);
  document.addEventListener('chroma-gift-received', event => queueGiftToast(event.detail));
  if ($('#sq')) $('#sq').oninput = searchSocial;
  document.addEventListener('chroma-match-ended', event => recordCompletedRound(event.detail));
  document.addEventListener('chroma-tournament-round-ended', event => recordCompletedRound(event.detail));
  const refreshChromaViews = () => { updateHomeAndProfile(); renderSettingsAccountText(); renderInventory(); renderCharacterCollection(); if (!$('#profileCustomizeModal')?.hidden) renderProfileCustomize(); };
  window.addEventListener?.('chroma-state-changed', refreshChromaViews);
  document.addEventListener('chroma-state-changed', refreshChromaViews);
  window.renderSocial = () => { if (authReady()) renderRemoteSocial(); else renderLocalSocial(); if (!$('#sC')?.hidden) window.chromaClanUI?.render?.(); };
  document.addEventListener('chroma-social-updated', () => window.renderSocial?.());
  document.addEventListener('chroma-visual-settings-change', () => addVolumeControls());

  if ($('#systemPlayed')) updateHomeAndProfile();
  renderLocalSocial();
  renderInventory();
  renderCharacterCollection();

  window.chromaSystems = Object.freeze({
    getStats, getPass, getFriends, levelFromXP, passLevel, render: updateHomeAndProfile, renderInventory, renderCollection: renderCharacterCollection,
    addFriendLocal(value) { const state = getFriends(), name = cleanUser(value); if (name.length < 3 || state.friends.includes(name)) return false; state.friends.push(name); return save(KEYS.friends, state); },
  });
})();
