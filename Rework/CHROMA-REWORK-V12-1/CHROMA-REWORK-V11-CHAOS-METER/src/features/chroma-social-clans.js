(() => {
  'use strict';

  const root = document.querySelector('#sCl');
  const panel = document.querySelector('#sC');
  const tabs = document.querySelector('#stabs');
  if (!root || !panel || !tabs) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const icons = { shield: '⬡', sparkles: '✧', flame: '▲', crown: '♛', star: '★' };
  const iconLabel = { shield: 'Escudo', sparkles: 'Faísca', flame: 'Chama', crown: 'Coroa', star: 'Estrela' };
  const authReady = () => Boolean(window.chromaCloud?.canWrite?.() && window.chromaSocial?.isReady?.());
  const signedIn = () => Boolean(window.chromaCloud?.getUser?.());
  const describe = error => window.chromaCloud?.describeError?.(error) || error?.message || 'Não foi possível concluir a operação.';
  const toast = (message, kind = 'success') => window.chromaToast?.(message, kind) || window.toast?.(message);
  let viewToken = 0;
  let memberToken = 0;
  let searchToken = 0;
  let searchTimer = 0;
  let searchText = '';
  let openedClanId = '';

  function setStatus(message, error = false) {
    root.innerHTML = `<div class="clan-status${error ? ' is-error' : ''}" role="${error ? 'alert' : 'status'}">${esc(message)}</div>`;
  }

  function clanSymbol(icon) {
    const safe = icons[icon] ? icon : 'shield';
    return `<span class="clan-symbol clan-symbol-${safe}" aria-label="${iconLabel[safe]}">${icons[safe]}</span>`;
  }

  function makeSignInGate() {
    const state = window.chromaAuth?.getState?.() || window.firebaseAuthState || 'AUTH_LOADING';
    if (state === 'AUTH_LOADING' || state === 'AUTHENTICATED_LOADING_PROFILE') {
      setStatus('Conectando sua conta ao Firebase… Seus clãs aparecerão assim que o perfil estiver pronto.');
      return;
    }
    if (signedIn()) {
      setStatus(window.chromaCloud?.getWriteMessage?.() || 'Sua conta está conectada, mas o perfil ainda não está disponível. Tente novamente em Configurações.');
      root.insertAdjacentHTML('beforeend', '<button type="button" class="btn sec" data-clan-retry> Tentar novamente </button>');
      return;
    }
    root.innerHTML = '<div class="clan-gate"><span class="clan-gate-mark" aria-hidden="true">⬡</span><h3>Entre para encontrar seu clã</h3><p>Crie um clã, descubra comunidades e mantenha sua participação sincronizada entre dispositivos.</p><button type="button" class="btn pri" data-system-action="connect-account">Conectar conta</button><small>Sem login, não há entrada ou criação de clãs online.</small></div>';
  }

  function clanCard(clan) {
    const id = String(clan.id || '');
    const members = Math.max(0, Number(clan.memberCount) || Object.keys(clan.members || {}).length);
    const level = Math.max(1, Number(clan.level) || 1);
    const isOpen = openedClanId === id;
    const own = clan.leaderId === window.chromaCloud?.getUser?.()?.uid;
    const missions = Array.isArray(clan.missions) ? clan.missions : [];
    const mission = missions.find(item => !item.completed && Number(item.target) > 0);
    return `<article class="clan-card${isOpen ? ' is-open' : ''}"><div class="clan-card-head">${clanSymbol(clan.icon)}<div><h3>${esc(clan.name || 'Clã sem nome')}</h3><small>Nível ${level} · ${members} ${members === 1 ? 'membro' : 'membros'}</small></div></div><div class="clan-card-meta"><span>${esc(clan.currencyName || 'Fragmentos do Clã')}</span><span>${own ? 'Seu clã' : (clan.leaderId ? 'Comunidade ativa' : 'Clã')}</span></div>${mission ? `<p class="clan-card-quest">Próximo objetivo: ${esc(mission.title || mission.description || 'Missão do clã')}</p>` : ''}<div class="clan-card-actions"><button type="button" class="btn sec" data-clan-details="${esc(id)}" aria-expanded="${isOpen}">${isOpen ? 'Ocultar' : 'Detalhes'}</button>${own ? '<small class="clan-own-label">Você já lidera este clã</small>' : `<button type="button" class="btn pri" data-clan-join="${esc(id)}">Entrar</button>`}</div></article>`;
  }

  function renderDirectoryShell() {
    root.innerHTML = `<div class="clan-directory"><section class="clan-create-panel"><div class="clan-section-kicker">COMECE UMA COMUNIDADE</div><h3>Crie seu clã</h3><p>Escolha um nome e um símbolo. Você será a liderança inicial e poderá transferi-la depois.</p><form id="clanCreateForm" class="clan-create-form"><label for="clanName">Nome do clã</label><input id="clanName" class="fld" name="name" minlength="3" maxlength="24" pattern="[A-Za-zÀ-ÿ0-9 _-]{3,24}" placeholder="Ex.: Veio Dourado" autocomplete="off" required><label for="clanIcon">Símbolo</label><select id="clanIcon" name="icon"><option value="shield">Escudo</option><option value="sparkles">Faísca</option><option value="flame">Chama</option><option value="crown">Coroa</option><option value="star">Estrela</option></select><button class="btn pri" type="submit">Criar clã</button><small>O nome deve ter de 3 a 24 caracteres.</small></form></section><section class="clan-browse"><div class="clan-section-kicker">ENCONTRE SUA COMUNIDADE</div><div class="clan-browse-title"><h3>Clãs disponíveis</h3><span>Até 20 resultados</span></div><form id="clanSearchForm" class="clan-search-form" role="search"><input id="clanSearch" class="fld" type="search" value="${esc(searchText)}" placeholder="Buscar por nome do clã" aria-label="Buscar clãs" autocomplete="off"><button type="submit" class="btn sec">Buscar</button></form><div id="clanDirectoryResults" class="clan-directory-results" aria-live="polite"><div class="clan-status" role="status">Carregando clãs…</div></div><div id="clanBrowseDetails"></div></section></div>`;
  }

  async function loadDirectory(term = '') {
    if (!authReady()) { makeSignInGate(); return; }
    const target = root.querySelector('#clanDirectoryResults');
    if (!target) return;
    const token = ++searchToken;
    searchText = String(term || '').trim();
    target.innerHTML = '<div class="clan-status" role="status">Buscando clãs…</div>';
    try {
      const clans = await window.chromaSocial.listClans(searchText);
      if (token !== searchToken || !root.querySelector('#clanDirectoryResults')) return;
      target.innerHTML = (clans || []).map(clanCard).join('') || `<div class="clan-empty"><b>${searchText ? 'Nenhum clã encontrado' : 'Ainda não há clãs públicos'}</b><span>${searchText ? 'Tente outra busca ou crie o seu.' : 'Seja o primeiro a iniciar uma comunidade.'}</span></div>`;
      if (openedClanId && (clans || []).some(clan => clan.id === openedClanId)) await loadBrowseDetails(openedClanId);
      else if (!openedClanId) root.querySelector('#clanBrowseDetails')?.replaceChildren();
    } catch (error) {
      if (token !== searchToken) return;
      target.innerHTML = `<div class="clan-status is-error" role="alert">${esc(describe(error))}<button type="button" class="btn sec" data-clan-refresh> Tentar novamente </button></div>`;
    }
  }

  async function renderDirectory() {
    renderDirectoryShell();
    await loadDirectory(searchText);
  }

  function memberFallback(uid) {
    return `Jogador ${String(uid || '').slice(-5) || '—'}`;
  }

  async function renderMemberList(clan, selector, token) {
    const target = root.querySelector(selector);
    if (!target) return;
    const members = clan.members && typeof clan.members === 'object' ? clan.members : {};
    const entries = Object.entries(members).sort(([uidA, a], [uidB, b]) => {
      if (uidA === clan.leaderId) return -1;
      if (uidB === clan.leaderId) return 1;
      return (Number(b.contributionXp) || 0) - (Number(a.contributionXp) || 0);
    });
    const visible = entries.slice(0, 50);
    if (!visible.length) { target.innerHTML = '<li class="clan-member-empty">A lista de membros ainda está vazia.</li>'; return; }
    target.innerHTML = '<li class="clan-member-empty">Carregando perfis…</li>';
    const profiles = await Promise.all(visible.map(async ([uid]) => {
      try { return await window.chromaSocial.publicProfile(uid); } catch { return {}; }
    }));
    if (token !== memberToken || !target.isConnected) return;
    const me = window.chromaCloud?.getUser?.()?.uid;
    target.innerHTML = visible.map(([uid, member], index) => {
      const profile = profiles[index] || {};
      const display = profile.name || profile.username || memberFallback(uid);
      const handle = profile.username ? `@${profile.username}` : memberFallback(uid);
      const isLeader = uid === clan.leaderId || member.role === 'leader';
      const contribution = Math.max(0, Number(member.contributionXp) || 0);
      const transfer = clan.leaderId === me && uid !== me ? `<button type="button" class="btn sec clan-transfer" data-clan-transfer="${esc(uid)}" data-member-name="${esc(display)}">Transferir liderança</button>` : '';
      return `<li class="clan-member"><span class="clan-member-avatar">${esc(String(display).trim().slice(0, 1).toUpperCase() || '?')}</span><div class="clan-member-identity"><b>${esc(display)}${uid === me ? ' <small>(você)</small>' : ''}</b><small>${esc(handle)} · ${contribution} XP contribuído</small></div>${isLeader ? '<span class="clan-role">LIDERANÇA</span>' : '<span class="clan-role is-member">MEMBRO</span>'}${transfer}</li>`;
    }).join('') + (entries.length > visible.length ? `<li class="clan-member-empty">Mostrando 50 de ${entries.length} membros.</li>` : '');
  }

  function renderMissions(clan) {
    const missions = Array.isArray(clan.missions) ? clan.missions : [];
    if (!missions.length) return '<div class="clan-empty"><span>Este clã ainda não tem missões configuradas.</span></div>';
    return missions.map(mission => {
      const target = Math.max(1, Number(mission.target) || 1);
      const progress = Math.max(0, Math.min(target, Number(mission.progress) || 0));
      const percent = Math.round(progress / target * 100);
      return `<article class="clan-mission${mission.completed ? ' is-complete' : ''}"><div><b>${esc(mission.title || 'Missão do clã')}</b><small>${esc(mission.description || '')}</small></div><strong>${progress} / ${target}</strong><i aria-label="${percent}% concluída"><b style="width:${percent}%"></b></i><span>${mission.completed ? 'Concluída' : `Recompensa: ${esc(mission.reward?.label || 'contribuição para o clã')}`}</span></article>`;
    }).join('');
  }

  async function renderDashboard(clan, token) {
    const uid = window.chromaCloud?.getUser?.()?.uid;
    const member = clan.members?.[uid] || clan.myMember || {};
    const count = Math.max(0, Number(clan.memberCount) || Object.keys(clan.members || {}).length);
    const level = Math.max(1, Number(clan.level) || 1);
    const xp = Math.max(0, Number(clan.xp) || 0);
    const xpToNext = Math.max(1, Number(clan.xpToNext) || 100);
    const progress = Math.min(100, Math.round((xp % xpToNext) / xpToNext * 100));
    const isLeader = clan.leaderId === uid;
    const balance = Math.max(0, Number(member.clanCoins) || 0);
    const clanId = String(clan.id || '');
    root.innerHTML = `<div class="clan-dashboard"><header class="clan-hero">${clanSymbol(clan.icon)}<div class="clan-hero-copy"><div class="clan-section-kicker">${isLeader ? 'SUA COMUNIDADE' : 'BEM-VINDO AO CLÃ'}</div><h3>${esc(clan.name || 'Clã')}</h3><p>${count} ${count === 1 ? 'membro' : 'membros'} · ${isLeader ? 'Você é a liderança' : 'Membro'}</p></div><div class="clan-level"><small>NÍVEL</small><b>${level}</b></div></header><section class="clan-progress"><div><span>EXP do clã</span><b>${xp} / ${xpToNext}</b></div><i><b style="width:${progress}%"></b></i></section><div class="clan-stat-grid"><article><small>SEUS FRAGMENTOS</small><b>${balance}</b><span>${esc(clan.currencyName || 'Fragmentos do Clã')}</span></article><article><small>SUA CONTRIBUIÇÃO</small><b>${Math.max(0, Number(member.contributionXp) || 0)} XP</b><span>Contribuição registrada</span></article></div><section class="clan-subsection"><div class="clan-subsection-head"><div><div class="clan-section-kicker">QUEM ESTÁ COM VOCÊ</div><h4>Membros</h4></div><span>${count} ${count === 1 ? 'pessoa' : 'pessoas'}</span></div><ul id="clanMemberList" class="clan-members"></ul></section><section class="clan-subsection"><div class="clan-subsection-head"><div><div class="clan-section-kicker">OBJETIVOS COLETIVOS</div><h4>Missões do clã</h4></div></div><div class="clan-missions">${renderMissions(clan)}</div><p class="clan-mission-note">Progresso conforme os dados salvos. Partidas ainda não são contabilizadas automaticamente por um servidor.</p></section><footer class="clan-dashboard-actions">${isLeader && count > 1 ? '<p>Para sair, transfira a liderança para outro membro.</p>' : ''}<button type="button" class="btn sol" data-clan-leave="${esc(clanId)}">${isLeader && count <= 1 ? 'Dissolver clã' : 'Sair do clã'}</button></footer></div>`;
    const tokenMembers = ++memberToken;
    await renderMemberList(clan, '#clanMemberList', tokenMembers);
  }

  async function loadBrowseDetails(id) {
    const target = root.querySelector('#clanBrowseDetails');
    if (!target || !id || !authReady()) return;
    const token = ++memberToken;
    target.innerHTML = '<div class="clan-status" role="status">Carregando detalhes…</div>';
    try {
      const clan = await window.chromaSocial.getClan(id);
      if (token !== memberToken || !target.isConnected) return;
      const count = Math.max(0, Number(clan.memberCount) || Object.keys(clan.members || {}).length);
      target.innerHTML = `<section class="clan-details"><div class="clan-section-kicker">DETALHES DA COMUNIDADE</div><h4>${esc(clan.name || 'Clã')}</h4><p>Nível ${Math.max(1, Number(clan.level) || 1)} · ${count} ${count === 1 ? 'membro' : 'membros'} · Liderança ${esc(clan.members?.[clan.leaderId]?.uid ? 'ativa' : 'registrada')}.</p><div class="clan-details-missions">${renderMissions(clan)}</div><ul id="clanPreviewMembers" class="clan-members"></ul></section>`;
      await renderMemberList(clan, '#clanPreviewMembers', token);
    } catch (error) {
      if (token === memberToken && target.isConnected) target.innerHTML = `<div class="clan-status is-error" role="alert">${esc(describe(error))}</div>`;
    }
  }

  async function renderClanScreen() {
    if (panel.hidden) return;
    const token = ++viewToken;
    if (!authReady()) { makeSignInGate(); return; }
    setStatus('Carregando seu clã…');
    try {
      const clan = await window.chromaSocial.getMyClan();
      if (token !== viewToken || panel.hidden) return;
      if (clan) await renderDashboard(clan, token);
      else await renderDirectory();
    } catch (error) {
      if (token !== viewToken) return;
      setStatus(describe(error), true);
      root.insertAdjacentHTML('beforeend', '<button type="button" class="btn sec" data-clan-refresh> Tentar novamente </button>');
    }
  }

  async function act(button, task, successMessage) {
    if (!button || button.disabled) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = 'Aguarde…';
    try {
      await task();
      if (successMessage) toast(successMessage);
      await renderClanScreen();
    } catch (error) {
      button.disabled = false;
      button.textContent = original;
      toast(describe(error), 'important');
    }
  }

  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-t]');
    if (!button) return;
    tabs.querySelectorAll('[data-t]').forEach(item => item.setAttribute('aria-selected', String(item === button)));
    const friends = document.querySelector('#sF');
    panel.hidden = button.dataset.t !== 'c';
    if (friends) friends.hidden = button.dataset.t !== 'f';
    if (!panel.hidden) void renderClanScreen();
  });

  root.addEventListener('input', event => {
    if (event.target.id !== 'clanSearch') return;
    searchText = event.target.value.trim();
    openedClanId = '';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { void loadDirectory(searchText); }, 260);
  });

  root.addEventListener('submit', async event => {
    if (event.target.id === 'clanSearchForm') {
      event.preventDefault();
      searchText = root.querySelector('#clanSearch')?.value.trim() || '';
      openedClanId = '';
      await loadDirectory(searchText);
      return;
    }
    if (event.target.id !== 'clanCreateForm') return;
    event.preventDefault();
    if (!authReady()) { makeSignInGate(); return; }
    const form = event.target;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Criando…';
    try {
      const name = form.elements.name.value.trim();
      const clan = await window.chromaSocial.createClan(name, form.elements.icon.value);
      searchText = '';
      toast(`Clã “${clan.name}” criado.`);
      await renderClanScreen();
    } catch (error) {
      submit.disabled = false;
      submit.textContent = 'Criar clã';
      toast(describe(error), 'important');
    }
  });

  root.addEventListener('click', event => {
    const retry = event.target.closest('[data-clan-refresh]');
    if (retry) { void renderClanScreen(); return; }
    const details = event.target.closest('[data-clan-details]');
    if (details) {
      const id = details.dataset.clanDetails;
      openedClanId = openedClanId === id ? '' : id;
      void renderDirectory();
      return;
    }
    const join = event.target.closest('[data-clan-join]');
    if (join) { void act(join, () => window.chromaSocial.joinClan(join.dataset.clanJoin), 'Você entrou no clã.'); return; }
    const leave = event.target.closest('[data-clan-leave]');
    if (leave) {
      const dissolve = leave.textContent.includes('Dissolver');
      const message = dissolve ? 'Dissolver seu clã? Esta ação exclui o clã porque você é seu único membro.' : 'Sair deste clã?';
      if (!window.confirm(message)) return;
      void act(leave, () => window.chromaSocial.leaveClan(leave.dataset.clanLeave), dissolve ? 'Clã dissolvido.' : 'Você saiu do clã.');
      return;
    }
    const transfer = event.target.closest('[data-clan-transfer]');
    if (transfer) {
      const name = transfer.dataset.memberName || 'este membro';
      if (!window.confirm(`Transferir a liderança para ${name}? Você continuará no clã como membro.`)) return;
      void act(transfer, () => window.chromaSocial.transferLeadership(transfer.closest('.clan-dashboard')?.querySelector('[data-clan-leave]')?.dataset.clanLeave, transfer.dataset.clanTransfer), `Liderança transferida para ${name}.`);
    }
  });

  let authSubscribed = false;
  const authWait = setInterval(() => {
    const cloud = window.chromaCloud;
    if (cloud?.subscribe && !authSubscribed) {
      authSubscribed = true;
      clearInterval(authWait);
      cloud.subscribe(() => { if (!panel.hidden) void renderClanScreen(); });
    } else if (Date.now() > startedAt + 15000) clearInterval(authWait);
  }, 120);
  const startedAt = Date.now();
  window.chromaClanUI = Object.freeze({ render: renderClanScreen });
})();
