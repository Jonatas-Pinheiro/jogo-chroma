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
    const bpLevel = passLevel(Number(pass.xp) || 0), bpBase = (bpLevel - 1) * 100, bpProgress = Math.max(0, Number(pass.xp || 0) - bpBase);
    const values = {
      '#systemHomeName': localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || 'Jogador',
      '#systemHomeLevel': `Nível ${level}`,
      '#systemHomeCoins': String(number('chroma-coins')),
      '#systemProfileName': localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || 'Jogador',
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
    const profileCollection = $$('#prof .lb').find(element => element.textContent.startsWith('Coleção:'));
    if (profileCollection?.textContent.startsWith('Coleção:')) profileCollection.textContent = `Coleção: ${getOwnedCosmetics().length} de 40`;
    const achievements = [
      { value: Math.min(1, wins), target: 1, complete: wins > 0 },
      { value: Math.min(5, Number(stats.bestWinStreak) || 0), target: 5, complete: Number(stats.bestWinStreak) >= 5 },
      { value: Math.min(1, Number(stats.cleanHands) || 0), target: 1, complete: Number(stats.cleanHands) > 0 },
      { value: Math.min(1, Number(stats.tournamentWins) || 0), target: 1, complete: Number(stats.tournamentWins) > 0 },
    ];
    $$('#prof .ach > div').forEach((item, index) => {
      const achievement = achievements[index];
      if (!achievement) return;
      item.classList.toggle('lk', !achievement.complete);
      const label = item.querySelector('small');
      if (label) label.textContent = `${achievement.value} de ${achievement.target}`;
    });
    const homeName = $('#systemHomeName');
    if (homeName?.parentElement?.querySelector('small')) homeName.parentElement.querySelector('small').textContent = `Nível ${level}`;
    const seasonName = season === '2' ? 'Singularidade' : 'Mina de Ouro';
    const passSubtitle = $('#pSub');
    if (passSubtitle) passSubtitle.textContent = `${seasonName} · progresso local${authReady() ? ' e sincronizado' : ' neste dispositivo'}`;
    renderPass();
  }

  function getOwnedCosmetics() {
    const shop = read('chroma-shop', { owned: [] });
    return Array.isArray(shop.owned) ? shop.owned : [];
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
      return `<li><span class="friend-avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</span><div class="friend-identity"><b>${escapeHtml(display)}</b><small>@${escapeHtml(name)} · Salvo somente neste dispositivo</small></div>${friendMenuButton({ username: name, name: display, localName: name })}</li>`;
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
      els.incoming.innerHTML = incoming.map(request => `<li><div><b>@${escapeHtml(request.from?.username || 'jogador')}</b><small>${escapeHtml(request.from?.name || 'Pedido de amizade')}</small></div><span class="acts"><button class="btn sec" data-system-action="decline-request" data-id="${escapeHtml(request.id)}">Recusar</button><button class="btn pri" data-system-action="accept-request" data-id="${escapeHtml(request.id)}">Aceitar</button></span></li>`).join('');
      const nicknames = readFriendNicknames();
      const friendRows = friendships.map(friendship => {
        const otherUid = (friendship.participants || []).find(item => item !== uid);
        const profile = friendship.profiles?.[otherUid] || {};
        const username = profile.username || `jogador_${String(otherUid || '').slice(-6)}`;
        const level = Number(profile.level);
        const nickname = nicknames[otherUid] || profile.name || 'Jogador';
        return `<li><div class="friend-identity"><b>${escapeHtml(nickname)}</b><small>@${escapeHtml(username)}${Number.isFinite(level) && level > 0 ? ` · Nível ${level}` : ''}</small></div>${friendMenuButton({ friendshipId: friendship.id, uid: otherUid, username, name: profile.name || username })}</li>`;
      });
      if (els.friendsTitle) els.friendsTitle.textContent = `Meus amigos (${friendRows.length})`;
      els.friends.innerHTML = friendRows.join('') || '<li><small>Nenhum amigo ainda. Busque um nome de usuário no Firebase.</small></li>';
      if (els.sentTitle) { els.sentTitle.hidden = els.sent.hidden = !outgoing.length; els.sentTitle.textContent = `Pedidos enviados (${outgoing.length})`; }
      els.sent.innerHTML = outgoing.map(request => `<li><div><b>@${escapeHtml(request.to?.username || 'jogador')}</b><small>Pedido pendente</small></div><button class="btn sec" data-system-action="cancel-request" data-id="${escapeHtml(request.id)}">Cancelar</button></li>`).join('');
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
        return `<li><div><b>@${escapeHtml(player.username || 'jogador')}</b><small>${escapeHtml(player.name || 'Jogador')} · nível ${Number(player.level) || 1}</small></div>${action}</li>`;
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
      body.innerHTML = `<article class="friend-profile-card"><b>${escapeHtml(profile.name || activeFriend.officialName || 'Jogador')}</b><small>@${escapeHtml(profile.username || activeFriend.username || 'jogador')}</small><small>${escapeHtml(profile.rank || 'Prata I')} · Nível ${Number(profile.level) || 1}</small></article><button type="button" class="btn sec friend-modal-back" data-friend-choice="menu">VOLTAR ÀS AÇÕES</button>`;
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

  const inventoryTypeLabels = { cards: 'Verso de carta', avatar: 'Avatar', table: 'Mesa', profile: 'Moldura de perfil', 'name-effect': 'Efeito de nome' };
  function renderInventory() {
    const grid = $('#inventoryGrid'), api = window.chromaShop;
    if (!grid || !api?.getState || !api.items) return;
    const state = api.getState(), owned = (state.owned || []).map(id => api.items[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const equipped = Object.values(state.equipped || {}).map(id => api.items[id]).find(Boolean);
    const equippedItem = $('#equippedItem'); if (equippedItem) equippedItem.textContent = equipped ? `${equipped.name} · ${inventoryTypeLabels[equipped.type] || 'Cosmético'}` : 'Nenhum cosmético equipado';
    const count = $('#inventory .sub small'); if (count) count.textContent = `${owned.length} cosmético${owned.length === 1 ? '' : 's'} na coleção · toque em “Equipar” para aplicar`;
    grid.innerHTML = owned.length ? owned.map(item => {
      const symbol = item.kind === 'avatar' || item.kind === 'frame' ? (item.symbol || 'A') : item.kind === 'name' ? 'Aa' : item.kind === 'table' ? '▰' : 'C';
      const equippedNow = state.equipped?.[item.type] === item.id;
      const artClass = item.type === 'avatar' ? ' avatar-art' : item.type === 'table' ? ' table-art' : '';
      return `<article class="inventory-item${equippedNow ? ' selected' : ''}"><div class="inventory-art${artClass}">${escapeHtml(symbol)}</div><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(inventoryTypeLabels[item.type] || 'Cosmético')} · ${escapeHtml(item.rarity)}</small></div><button type="button" data-inventory-equip="${escapeHtml(item.id)}" aria-pressed="${equippedNow}">${equippedNow ? 'Desequipar' : 'Equipar'}</button></article>`;
    }).join('') : '<p class="inventory-empty">Sua coleção está vazia. Os cosméticos recebidos como presente aparecem aqui imediatamente.</p>';
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
  document.addEventListener('click', captureSocialClick, true);
  $('#friendModal')?.addEventListener('click', handleFriendModalClick);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('#friendModal') && !$('#friendModal').hidden) { $('#friendModal').hidden = true; activeFriend = null; } });
  $('#inventoryGrid')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-inventory-equip]');
    if (!button) return;
    button.disabled = true;
    try { await window.chromaShop?.equipItem?.(button.dataset.inventoryEquip); }
    catch (error) { window.chromaToast?.(error?.message || 'Não foi possível equipar este cosmético.', 'important'); }
    finally { button.disabled = false; renderInventory(); }
  });
  document.addEventListener('chroma-gift-received', event => queueGiftToast(event.detail));
  if ($('#sq')) $('#sq').oninput = searchSocial;
  document.addEventListener('chroma-match-ended', event => recordCompletedRound(event.detail));
  document.addEventListener('chroma-tournament-round-ended', event => recordCompletedRound(event.detail));
  document.addEventListener('chroma-state-changed', () => { updateHomeAndProfile(); renderSettingsAccountText(); renderInventory(); });
  window.renderSocial = () => { if (authReady()) renderRemoteSocial(); else renderLocalSocial(); if (!$('#sC')?.hidden) window.chromaClanUI?.render?.(); };
  document.addEventListener('chroma-social-updated', () => window.renderSocial?.());
  document.addEventListener('chroma-visual-settings-change', () => addVolumeControls());

  if ($('#systemPlayed')) updateHomeAndProfile();
  renderLocalSocial();
  renderInventory();

  window.chromaSystems = Object.freeze({
    getStats, getPass, getFriends, levelFromXP, passLevel, render: updateHomeAndProfile, renderInventory,
    addFriendLocal(value) { const state = getFriends(), name = cleanUser(value); if (name.length < 3 || state.friends.includes(name)) return false; state.friends.push(name); return save(KEYS.friends, state); },
  });
})();
