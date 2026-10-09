(() => {
  'use strict';

  const Engine = window.ChromaGameEngine;
  if (!Engine) throw new Error('O motor de partidas CHROMA não foi carregado.');
  const chaosMeter = window.ChromaChaosMeter?.mount(document.getElementById('chaosMeter'));
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const MODES = Engine.MODES;
  const COLOR_SHAPE = { r: 'd', y: 's', g: 't', b: 'c' };
  const VALUE_MARK = {
    skip: '⊘', skip2: '2×', rev: '↻', shield: '⬡', mirror: '⟲', swap: '↔', eye: '◉',
    confuse: '?', blackhole: '◉', wild: 'COR', '+2': '+2', '+4': '+4', '+6': '+6', '+10': '+10', '+99': '+99',
  };
  const KENNEY_ICON = {
    skip: 'assets/kenney-board-game-icons/icons/skip.png',
    rev: 'assets/kenney-board-game-icons/icons/rev.png',
    shield: 'assets/kenney-board-game-icons/icons/shield.png',
    mirror: 'assets/kenney-board-game-icons/icons/mirror.png',
    swap: 'assets/kenney-board-game-icons/icons/swap.png',
    eye: 'assets/kenney-board-game-icons/icons/eye.png',
    blackhole: 'assets/kenney-board-game-icons/icons/blackhole.png',
    confuse: 'assets/kenney-board-game-icons/icons/confuse.png',
  };
  const BOT_NAMES = ['Dante', 'Kira', 'Mei', 'Léo', 'Sora', 'Bia', 'Teo', 'Lia'];
  let match = null;
  let selectedCardId = null;
  let spectator = false;
  let nextSpectator = false;
  let timerId = 0;
  let botTimer = 0;
  let scheduledEpoch = null;
  let actionSequence = 0;
  let lastHandMarkup = null;
  let lastOppsMarkup = null;
  let pendingWildId = null;
  let pendingEyeId = null;
  let announcedEnd = null;
  let announcedRound = null;
  let lastSeenLogLength = 0;
  let localPlayerId = 'you';
  let lobbyPlayers = [{ id: 'you', name: 'Você', bot: false }];
  let networkPeer = null;
  let networkConnection = null;
  const hostConnections = new Map();
  let roomNetworkReady = false;
  let roomJoinTimeout = 0;
  const ROOM_PEER_PREFIX = 'chroma-v1-';
  const ROOM_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];
  let roomRole = 'none';
  let collapseResolveTimer = 0;
  let collapseCompleteTimer = 0;
  let collapseTimerKey = null;
  let roomCode = '';
  let roomJoinAttempt = 0;
  // Só para o feedback visual: o convidado envia a ação ao anfitrião e espera o novo estado voltar.
  // Enquanto isso o destaque da compra fica desligado, para não pulsar depois de a pessoa já ter agido.
  let guestActionLock = null;

  function selectedModeIndex() {
    const active = $('#tabs [aria-selected="true"]');
    return Math.max(0, Number(active?.dataset.m) || 0);
  }

  function selectedMode() {
    return MODES[selectedModeIndex()] || 'classic';
  }

  function currentHuman() {
    return match?.players.find(player => player.id === localPlayerId) || null;
  }

  function collapseInProgress() {
    return Boolean(match?.collapse && match.collapse.status !== 'complete');
  }

  function audioSnapshot(state) {
    if (!state) return null;
    const top = state.discard?.[state.discard.length - 1];
    const handCounts = Object.fromEntries((state.players || []).map(player => [player.id, player.hand?.length || 0]));
    return {
      phase: state.phase,
      topId: top?.id || '',
      topValue: top?.v || '',
      turnCount: state.turnCount || 0,
      totalCards: Object.values(handCounts).reduce((sum, count) => sum + count, 0),
      handCounts,
      chromaCount: (state.players || []).reduce((sum, player) => sum + (player.stats?.chroma || 0), 0),
      lastLog: state.log?.[state.log.length - 1] || '',
      winner: state.winner,
    };
  }

  function syncGameAudio() {
    window.ChromaAudio?.setGameActive(Boolean(match && match.phase === 'playing' && !match.paused));
  }

  function playActionSound(action, playerId, card, before) {
    const type = action?.type;
    if (type === 'play') window.ChromaAudio?.gameAction('play', { value: card?.v });
    const after = audioSnapshot(match);
    if (after?.phase === 'ended' && before?.phase !== 'ended') {
      window.ChromaAudio?.finish(after.winner === localPlayerId && !spectator);
    } else syncGameAudio();
  }

  function playObservedTransition(before, after) {
    if (!before || !after || !$('#game')?.classList.contains('on')) return;
    if (after.topId && after.topId !== before.topId) {
      window.ChromaAudio?.gameAction('play', { value: after.topValue });
    } else if (after.totalCards > before.totalCards) {
      window.ChromaAudio?.gameAction('draw', { count: after.totalCards - before.totalCards });
    } else if (after.chromaCount > before.chromaCount) {
      window.ChromaAudio?.gameAction('chroma');
    } else if (after.lastLog !== before.lastLog && /denunci|captur/i.test(after.lastLog)) {
      window.ChromaAudio?.gameAction('catch');
    } else if (after.turnCount > before.turnCount) {
      window.ChromaAudio?.gameAction('pass');
    }
    if (after.phase === 'ended' && before.phase !== 'ended') {
      window.ChromaAudio?.finish(after.winner === localPlayerId && !spectator);
    } else syncGameAudio();
  }

  function isHumanTurn() {
    return Boolean(match && !spectator && !collapseInProgress() && match.phase === 'playing' && !match.paused && match.players[match.turn]?.id === localPlayerId);
  }

  // O jogador local precisa comprar quando é a vez dele, ainda não comprou nesta vez
  // e as regras (Engine.legalCards, já considerando acúmulo e cor atual) não permitem nenhuma jogada.
  function drawIsRequired(human) {
    if (!match || !human || !isHumanTurn() || match.drawnId) return false;
    if (guestActionLock && guestActionLock.epoch === match.turnEpoch) return false;
    return Engine.legalCards(match, human).length === 0;
  }

  // Feedback visual da vez. Só alterna classes CSS; nunca muda estado, regras, sons ou temporizadores.
  // classList.toggle com valor fixo não reinicia a animação enquanto o estado continua igual.
  function updateTurnFeedback() {
    const human = match ? currentHuman() : null;
    const mine = Boolean(human) && isHumanTurn();
    $('#turnLabel')?.classList.toggle('is-my-turn', mine);
    const pile = $('#drawPile');
    if (pile) pile.classList.toggle('draw-hint', mine && !pile.disabled && drawIsRequired(human));
  }

  function modeCapacity(mode = selectedMode()) {
    return mode === 'team3x3' ? 9 : mode === 'team2x2' ? 4 : 4;
  }

  function makeRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  }

  function roomMessage(type, payload = {}) {
    const message = { ...payload, type };
    if (roomRole === 'host') {
      hostConnections.forEach(connection => {
        if (!connection?.open) return;
        try { connection.send(message); } catch (error) { console.warn('[CHROMA] Falha ao enviar atualização da sala.', error); }
      });
    } else if (roomRole === 'guest' && networkConnection?.open) {
      try { networkConnection.send(message); } catch (error) { console.warn('[CHROMA] Falha ao enviar ação ao anfitrião.', error); }
    }
  }

  function stateSnapshot() {
    if (!match) return null;
    return JSON.parse(JSON.stringify(match));
  }

  function receiveState(snapshot) {
    if (!snapshot) return;
    const previousAudio = audioSnapshot(match);
    guestActionLock = null;
    match = snapshot;
    match.random = Math.random;
    match.players = Array.isArray(match.players) ? match.players : [];
    setSpectatorMode(false);
    if ($('#game')?.classList.contains('on')) playObservedTransition(previousAudio, audioSnapshot(match));
    render();
    startClock();
    scheduleBot();
  }

  function clearRoomJoinTimeout() {
    if (roomJoinTimeout) clearTimeout(roomJoinTimeout);
    roomJoinTimeout = 0;
  }

  function closeRoomNetwork({ notify = false } = {}) {
    if (notify) {
      if (roomRole === 'host') roomMessage('closed');
      else if (roomRole === 'guest') roomMessage('leave');
    }
    roomJoinAttempt += 1;
    clearRoomJoinTimeout();
    const connections = [...hostConnections.values()];
    hostConnections.clear();
    connections.forEach(connection => { try { connection.close(); } catch (_) {} });
    networkConnection = null;
    roomNetworkReady = false;
    const currentPeer = networkPeer;
    networkPeer = null;
    if (currentPeer && !currentPeer.destroyed) { try { currentPeer.destroy(); } catch (_) {} }
  }

  function currentDisplayName(fallback = 'Você') {
    let name = fallback;
    try { name = localStorage.getItem('chroma-name') || localStorage.getItem('chroma-username') || fallback; } catch (_) {}
    return String(name).replace(/\s+/g, ' ').trim().slice(0, 20) || fallback;
  }

  function resetRoomToLocal(message) {
    closeRoomNetwork();
    roomRole = 'none';
    roomNetworkReady = false;
    roomCode = '';
    localPlayerId = 'you';
    lobbyPlayers = [{ id: 'you', name: 'Você', bot: false }];
    match = null;
    exitToLobby();
    updateLobby();
    if (message) window.chromaToast?.(message, 'important');
  }

  function refuseRoomConnection(connection, message) {
    try { connection.send({ type: 'error', fatal: true, message }); } catch (_) {}
    setTimeout(() => { try { connection.close(); } catch (_) {} }, 350);
  }

  function removeRoomPlayer(playerId, { notify = true, close = true } = {}) {
    const player = lobbyPlayers.find(item => item.id === playerId);
    if (!player || playerId === localPlayerId || roomRole === 'guest') return false;
    if (roomRole !== 'host' && !(roomRole === 'none' && player.bot)) return false;

    const connection = hostConnections.get(playerId);
    hostConnections.delete(playerId);
    lobbyPlayers = lobbyPlayers.filter(item => item.id !== playerId);
    if (notify && connection?.open) {
      try { connection.send({ type: 'kick', message: 'Você foi removido da sala pelo anfitrião.' }); } catch (_) {}
    }
    if (close && connection) setTimeout(() => { try { connection.close(); } catch (_) {} }, 100);

    if (match?.players.some(item => item.id === playerId)) {
      Engine.removePlayer(match, playerId);
      if (match.phase === 'playing') { startClock(); scheduleBot(); }
      else clearTimers();
      if ($('#game')?.classList.contains('on')) render();
    }
    updateLobby();
    if (roomRole === 'host') {
      roomMessage('roster', { players: lobbyPlayers });
      if (match) roomMessage('state', { state: stateSnapshot() });
    }
    return true;
  }

  function handleHostConnection(connection) {
    let playerId = '';
    connection.on('data', message => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'join') {
        if (playerId) return;
        if (roomRole !== 'host' || (match && match.phase === 'playing')) return refuseRoomConnection(connection, 'A partida já começou.');
        if (lobbyPlayers.length >= modeCapacity()) return refuseRoomConnection(connection, 'A sala está cheia.');
        playerId = connection.peer;
        if (!playerId || lobbyPlayers.some(player => player.id === playerId)) return refuseRoomConnection(connection, 'Este jogador já está na sala.');
        const guestName = String(message.name || 'Amigo').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Amigo';
        lobbyPlayers.push({ id: playerId, name: guestName, bot: false });
        hostConnections.set(playerId, connection);
        try { connection.send({ type: 'welcome', playerId, code: roomCode, players: lobbyPlayers }); }
        catch (_) { removeRoomPlayer(playerId, { notify: false }); return; }
        updateLobby();
        roomMessage('roster', { players: lobbyPlayers });
        return;
      }
      if (!playerId || hostConnections.get(playerId) !== connection) return;
      if (message.type === 'leave') { removeRoomPlayer(playerId, { notify: false }); return; }
      if (message.type !== 'action' || !match || message.playerId !== playerId || !message.action) return;
      const before = audioSnapshot(match);
      const player = match.players.find(item => item.id === playerId);
      const card = message.action.type === 'play' ? player?.hand.find(item => item.id === message.action.cardId) : null;
      const error = Engine.act(match, playerId, message.action);
      if (error) {
        try { connection.send({ type: 'error', fatal: false, message: error }); } catch (_) {}
        return;
      }
      playActionSound(message.action, playerId, card, before);
      render();
      scheduleBot();
      roomMessage('state', { state: stateSnapshot() });
    });
    connection.on('close', () => {
      if (playerId && hostConnections.get(playerId) === connection) removeRoomPlayer(playerId, { notify: false, close: false });
    });
    connection.on('error', error => console.warn('[CHROMA] Erro na conexão de jogador.', error));
  }

  function handleGuestMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'welcome' && roomRole === 'guest') {
      clearRoomJoinTimeout();
      roomNetworkReady = true;
      localPlayerId = String(message.playerId || localPlayerId);
      lobbyPlayers = Array.isArray(message.players) ? message.players : lobbyPlayers;
      updateLobby();
      window.chromaToast?.(`Conectado à sala ${roomCode}.`, 'success');
    } else if (message.type === 'roster' && roomRole === 'guest') {
      lobbyPlayers = Array.isArray(message.players) ? message.players : lobbyPlayers;
      if (roomNetworkReady && !lobbyPlayers.some(player => player.id === localPlayerId)) {
        resetRoomToLocal('Você não faz mais parte desta sala.');
        return;
      }
      updateLobby();
    } else if (message.type === 'kick' && roomRole === 'guest') {
      resetRoomToLocal(message.message || 'Você foi removido da sala pelo anfitrião.');
    } else if (message.type === 'error') {
      if (message.fatal) resetRoomToLocal(message.message || 'Não foi possível entrar nesta sala.');
      else { $('#gameMessage').textContent = message.message || 'A jogada não foi aceita.'; window.chromaToast?.(message.message || 'A jogada não foi aceita.', 'important'); }
    } else if (message.type === 'closed' && roomRole === 'guest') {
      resetRoomToLocal('O anfitrião encerrou a sala.');
    } else if (message.type === 'start' && roomRole === 'guest') {
      receiveState(message.state);
      goToGameScreen();
    } else if (message.type === 'state' && roomRole === 'guest') {
      receiveState(message.state);
    }
  }

  function goToGameScreen() {
    window.go?.('game');
  }

  function createRoom() {
    closeRoomNetwork({ notify: true });
    clearTimers();
    clearCollapseTimers();
    match = null;
    roomRole = 'host';
    roomNetworkReady = false;
    localPlayerId = 'you';
    lobbyPlayers = lobbyPlayers.filter(player => player.id === 'you' || player.bot);
    if (!lobbyPlayers.some(player => player.id === 'you')) lobbyPlayers.unshift({ id: 'you', name: 'Você', bot: false });
    lobbyPlayers.find(player => player.id === 'you').name = currentDisplayName('Você');
    roomCode = makeRoomCode();
    updateLobby();
    if (typeof window.Peer !== 'function') {
      resetRoomToLocal('A biblioteca de conexão não carregou. Verifique a internet e recarregue a página.');
      return;
    }

    const openHostPeer = attempt => {
      let currentPeer;
      try { currentPeer = new window.Peer(ROOM_PEER_PREFIX + roomCode, { config: { iceServers: ROOM_ICE_SERVERS } }); }
      catch (_) { resetRoomToLocal('Não consegui iniciar a conexão da sala. Tente novamente.'); return; }
      networkPeer = currentPeer;
      let opened = false;
      roomJoinTimeout = setTimeout(() => {
        if (networkPeer === currentPeer && !roomNetworkReady) resetRoomToLocal('Não consegui falar com o servidor de conexão. Verifique a internet e tente de novo.');
      }, 15000);
      currentPeer.on('open', () => {
        if (networkPeer !== currentPeer) return;
        opened = true;
        clearRoomJoinTimeout();
        roomNetworkReady = true;
        updateLobby();
        window.chromaToast?.(`Sala ${roomCode} criada. Compartilhe o código com seu amigo.`, 'success');
      });
      currentPeer.on('connection', handleHostConnection);
      currentPeer.on('error', error => {
        if (networkPeer !== currentPeer) return;
        if (!opened && error?.type === 'unavailable-id' && attempt < 8) {
          clearRoomJoinTimeout();
          networkPeer = null;
          try { currentPeer.destroy(); } catch (_) {}
          roomCode = makeRoomCode();
          updateLobby();
          openHostPeer(attempt + 1);
        } else if (!opened) resetRoomToLocal('Não consegui criar a sala. Confira a conexão com a internet e tente novamente.');
        else console.warn('[CHROMA] Erro no servidor de conexão.', error);
      });
      currentPeer.on('disconnected', () => {
        if (networkPeer === currentPeer && !currentPeer.destroyed) { try { currentPeer.reconnect(); } catch (_) {} }
      });
    };
    openHostPeer(0);
  }

  function joinRoom() {
    const input = $('#roomCodeInput');
    const code = input?.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(code || '')) {
      window.chromaToast?.('Digite um código de 4 caracteres.', 'important');
      input?.focus();
      return;
    }
    if (typeof window.Peer !== 'function') {
      window.chromaToast?.('A biblioteca de conexão não carregou. Verifique a internet e recarregue a página.', 'important');
      return;
    }
    closeRoomNetwork({ notify: true });
    clearTimers();
    clearCollapseTimers();
    match = null;
    roomRole = 'guest';
    roomNetworkReady = false;
    roomCode = code;
    localPlayerId = `pending-${Math.random().toString(36).slice(2, 8)}`;
    lobbyPlayers = [{ id: localPlayerId, name: currentDisplayName('Amigo'), bot: false }];
    updateLobby();
    const attempt = ++roomJoinAttempt;
    let currentPeer;
    try { currentPeer = new window.Peer({ config: { iceServers: ROOM_ICE_SERVERS } }); }
    catch (_) { resetRoomToLocal('Não consegui iniciar a conexão. Verifique a internet e tente novamente.'); return; }
    networkPeer = currentPeer;
    roomJoinTimeout = setTimeout(() => {
      if (roomJoinAttempt === attempt && networkPeer === currentPeer && !roomNetworkReady) resetRoomToLocal('Sala não encontrada ou anfitrião indisponível. Confira o código e tente novamente.');
    }, 15000);
    currentPeer.on('open', () => {
      if (networkPeer !== currentPeer || roomJoinAttempt !== attempt) return;
      let connection;
      try { connection = currentPeer.connect(ROOM_PEER_PREFIX + code, { reliable: true }); }
      catch (_) { resetRoomToLocal('Não consegui conectar à sala. Confira o código e a internet.'); return; }
      networkConnection = connection;
      connection.on('open', () => {
        if (networkConnection !== connection || roomJoinAttempt !== attempt) return;
        try { connection.send({ type: 'join', name: lobbyPlayers[0]?.name || 'Amigo' }); }
        catch (_) { resetRoomToLocal('A conexão com o anfitrião falhou. Tente novamente.'); }
      });
      connection.on('data', handleGuestMessage);
      connection.on('close', () => {
        if (networkConnection === connection && roomRole === 'guest') resetRoomToLocal('A conexão com a sala foi perdida.');
      });
      connection.on('error', error => {
        if (!roomNetworkReady) resetRoomToLocal(error?.type === 'peer-unavailable' ? 'Sala não encontrada ou o anfitrião está offline.' : 'Erro de conexão. Confira o código e a internet.');
        else console.warn('[CHROMA] Erro ao conectar à sala.', error);
      });
    });
    currentPeer.on('error', error => {
      if (networkPeer !== currentPeer || roomJoinAttempt !== attempt) return;
      if (!roomNetworkReady) resetRoomToLocal(error?.type === 'peer-unavailable' ? 'Sala não encontrada ou o anfitrião está offline.' : 'Erro de conexão. Confira o código e a internet.');
      else console.warn('[CHROMA] Erro no cliente de conexão.', error);
    });
    currentPeer.on('disconnected', () => {
      if (networkPeer === currentPeer && !currentPeer.destroyed) { try { currentPeer.reconnect(); } catch (_) {} }
    });
  }

  function addBot() {
    if (roomRole === 'guest') return;
    const capacity = modeCapacity();
    if (lobbyPlayers.length >= capacity) return;
    const used = new Set(lobbyPlayers.map(player => player.name));
    const name = BOT_NAMES.find(candidate => !used.has(candidate)) || `Bot ${lobbyPlayers.length}`;
    lobbyPlayers.push({ id: `bot-${Date.now()}-${lobbyPlayers.length}`, name, bot: true });
    updateLobby();
    if (roomRole === 'host') roomMessage('roster', { players: lobbyPlayers });
  }

  function removePlayerFromLobby(playerId) {
    const player = lobbyPlayers.find(item => item.id === playerId);
    if (!player || playerId === localPlayerId) return;
    if (roomRole !== 'host' && !(roomRole === 'none' && player.bot)) return;
    removeRoomPlayer(playerId);
  }

  function updateLobby(index = selectedModeIndex()) {
    const mode = MODES[index] || 'classic';
    const capacity = modeCapacity(mode);
    const list = $('#pl');
    if (list) {
      list.innerHTML = lobbyPlayers.map((player, idx) => {
        const canRemove = player.id !== localPlayerId && (roomRole === 'host' || (roomRole === 'none' && player.bot));
        const removeButton = canRemove ? `<button class="lobby-player-remove" type="button" data-room-remove="${escapeValue(player.id)}" aria-label="Remover ${escapeValue(player.name)} da sala" title="Remover jogador">×</button>` : '';
        const avatar = window.chromaAvatar ? window.chromaAvatar(idx, 44) : `<span class="av emp" style="--s:44px">${idx ? idx : 'V'}</span>`;
        return `<div class="lobby-player-card">${avatar}<span class="lobby-player-copy">${escapeHtml(player.name)}${player.id === localPlayerId ? ' (você)' : ''}<small class="player-kind">${player.bot ? 'bot adicionado' : player.id === localPlayerId ? 'jogador local' : 'jogador online'}</small></span>${removeButton}</div>`;
      }).join('');
    }
    const label = $('#mL');
    if (label) label.textContent = `Jogadores ${lobbyPlayers.length} de ${capacity}`;
    const title = $('#lobbyTitle');
    if (title) title.textContent = roomCode ? `Sala ${roomCode}` : 'Sala local';
    const status = $('#lobbyStatus');
    if (status) status.textContent = roomRole === 'host' ? (roomNetworkReady ? 'Você é o anfitrião · sala online' : 'Conectando ao servidor da sala…') : roomRole === 'guest' ? (roomNetworkReady ? 'Conectado à sala do anfitrião' : 'Conectando à sala…') : 'Crie uma sala ou entre com um código';
    const display = $('#roomCodeDisplay');
    if (display) { display.hidden = !roomCode; display.textContent = roomCode ? `CÓDIGO ${roomCode}` : ''; }
    const create = $('#createRoom');
    if (create) { create.disabled = roomRole === 'guest'; create.textContent = roomRole === 'host' ? 'NOVA SALA' : 'CRIAR SALA'; }
    const add = $('#addBot');
    if (add) { add.disabled = roomRole === 'guest' || lobbyPlayers.length >= capacity; add.hidden = roomRole === 'guest'; }
    const start = $('#startMatch');
    if (start) {
      const canStart = lobbyPlayers.length >= 2 && roomRole !== 'guest' && (roomRole !== 'host' || roomNetworkReady);
      const resumable = match && match.mode === mode;
      start.disabled = !canStart;
      start.textContent = !canStart ? (roomRole === 'guest' ? 'AGUARDANDO O ANFITRIÃO' : roomRole === 'host' && !roomNetworkReady ? 'CONECTANDO…' : 'ADICIONE MAIS 1 JOGADOR') : resumable && match.phase === 'playing' ? 'RETOMAR PARTIDA' : resumable && match.phase === 'betweenRounds' ? 'VER PRÓXIMA RODADA' : match?.phase === 'ended' ? 'NOVA PARTIDA' : 'COMEÇAR';
    }
    const subtitle = $('#lobby .sub small');
    if (subtitle) subtitle.textContent = roomRole === 'host' ? 'Convide alguém pelo código ou adicione bots manualmente' : roomRole === 'guest' ? 'Aguardando o anfitrião iniciar' : 'Vagas vazias não são preenchidas automaticamente';
  }

  function updateStartLabel() {
    const start = $('#lobby [data-go="game"]');
    if (!start) return;
    start.textContent = match?.mode === selectedMode() && match.phase === 'playing' ? 'RETOMAR PARTIDA' : match?.mode === selectedMode() && match.phase === 'betweenRounds' ? 'VER PRÓXIMA RODADA' : match?.phase === 'ended' ? 'NOVA PARTIDA' : 'COMEÇAR';
  }

  function clearTimers() {
    if (timerId) clearInterval(timerId);
    if (botTimer) clearTimeout(botTimer);
    timerId = 0;
    botTimer = 0;
    scheduledEpoch = null;
  }

  function clearCollapseTimers() {
    if (collapseResolveTimer) clearTimeout(collapseResolveTimer);
    if (collapseCompleteTimer) clearTimeout(collapseCompleteTimer);
    collapseResolveTimer = 0;
    collapseCompleteTimer = 0;
    collapseTimerKey = null;
  }

  function syncCollapseOrchestration() {
    const collapse = match?.collapse;
    if (!collapse || match?.phase !== 'playing' || collapse.status === 'complete') {
      clearCollapseTimers();
      return;
    }
    if (roomRole === 'guest') {
      clearCollapseTimers();
      return;
    }

    const targetMatch = match;
    const collapseId = collapse.id;
    if (collapse.status === 'awaiting') {
      if (collapseTimerKey === collapseId && collapseResolveTimer) return;
      clearCollapseTimers();
      collapseTimerKey = collapseId;
      collapseResolveTimer = setTimeout(() => {
        collapseResolveTimer = 0;
        if (match !== targetMatch || match?.collapse?.id !== collapseId || match.collapse.status !== 'awaiting') return;
        const before = audioSnapshot(match);
        if (!Engine.resolveSuperChaosCollapse(match, collapseId)) {
          render();
          return;
        }
        playObservedTransition(before, audioSnapshot(match));
        render();
        if (roomRole === 'host') roomMessage('state', { state: stateSnapshot() });
      }, 700);
      return;
    }

    if (collapse.status === 'resolved' && !(collapseTimerKey === collapseId && collapseCompleteTimer)) {
      if (collapseResolveTimer) clearTimeout(collapseResolveTimer);
      collapseResolveTimer = 0;
      collapseTimerKey = collapseId;
      collapseCompleteTimer = setTimeout(() => {
        collapseCompleteTimer = 0;
        if (match !== targetMatch || match?.collapse?.id !== collapseId || match.collapse.status !== 'resolved') return;
        if (!Engine.completeSuperChaosCollapse(match, collapseId)) return;
        render();
        startClock();
        scheduleBot();
        if (roomRole === 'host') roomMessage('state', { state: stateSnapshot() });
      }, 800);
    }
  }

  function setSpectatorMode(value) {
    spectator = Boolean(value);
    const game = $('#game');
    if (game) game.classList.toggle('spectator', spectator);
    const banner = $('#spectatorBanner');
    const logPanel = $('#spectatorLog');
    if (banner) banner.hidden = !spectator;
    if (logPanel) logPanel.hidden = !spectator;
    const quickMenu = $('#quickMenu');
    const quickOpen = $('#quickOpen');
    if (quickMenu) quickMenu.hidden = true;
    if (quickOpen) quickOpen.setAttribute('aria-expanded', 'false');
  }

  function enter() {
    if (roomRole === 'guest' && !match) return false;
    const requestedSpectator = nextSpectator;
    nextSpectator = false;
    const mode = selectedMode();
    const startsNewMatch = !match || match.phase === 'ended' || match.mode !== mode;
    if (startsNewMatch) {
      if (lobbyPlayers.length < 2) {
        window.chromaToast?.('Adicione um amigo ou um bot antes de começar.', 'important');
        updateLobby();
        return false;
      }
      clearCollapseTimers();
      clearTimers();
      guestActionLock = null;
      selectedCardId = null;
      pendingWildId = null;
      pendingEyeId = null;
      announcedEnd = null;
      lastSeenLogLength = 0;
      match = Engine.createMatch({ mode, stack: $('#stackToggle')?.getAttribute('aria-checked') === 'true', players: lobbyPlayers, code: roomCode || 'LOCAL', turnSeconds: 15 });
      match.spectatorSession = requestedSpectator;
      if (roomRole === 'host') roomMessage('start', { state: stateSnapshot() });
    } else if (match.paused) Engine.resume(match);
    if (match.phase === 'betweenRounds') announcedRound = null;
    if (requestedSpectator) {
      match.spectatorSession = true;
      match.players.forEach(player => { player.bot = true; });
    }
    setSpectatorMode(requestedSpectator || Boolean(match.spectatorSession));
    $('#pauseOv').hidden = true;
    $('#endOv').hidden = true;
    $('#colorPick').hidden = true;
    $('#targetPick').hidden = true;
    selectedCardId = null;
    syncGameAudio();
    if (startsNewMatch) window.ChromaAudio?.gameAction('roundStart');
    render();
    startClock();
    scheduleBot();
    return true;
  }

  function pause() {
    if (!match) return false;
    if (match.phase === 'playing' && !match.paused) {
      Engine.pause(match);
      clearTimers();
      syncGameAudio();
    }
    const ended = match.phase === 'ended';
    const betweenRounds = match.phase === 'betweenRounds';
    $('#pauseTitle').textContent = ended || betweenRounds ? 'Rodada concluída' : 'Partida pausada';
    $('#pauseCopy').textContent = betweenRounds
      ? 'Sua pontuação foi salva. Volte ao resumo para iniciar a próxima rodada do torneio.'
      : ended ? 'O resultado já foi registrado nesta prévia. Volte à sala para iniciar outra rodada.'
        : 'Seu turno, sua mão e o acúmulo permanecem preservados enquanto você está fora da mesa.';
    $('#resumeMatch').textContent = betweenRounds ? 'VOLTAR AO RESUMO' : ended ? 'FICAR NA MESA' : 'RETOMAR';
    $('#pauseOv').hidden = false;
    $('#resumeMatch').focus();
    render();
    return true;
  }

  function resume() {
    if (!match) return false;
    $('#pauseOv').hidden = true;
    if (match.phase === 'playing' && match.paused) Engine.resume(match);
    syncGameAudio();
    if (match.phase === 'betweenRounds') announcedRound = null;
    if (match.phase === 'playing') {
      startClock();
      scheduleBot();
    }
    render();
    return true;
  }

  function exitToLobby() {
    clearCollapseTimers();
    clearTimers();
    window.ChromaAudio?.setGameActive(false);
    window.ChromaAudio?.stopMusic();
    match = null;
    guestActionLock = null;
    updateTurnFeedback();
    selectedCardId = null;
    pendingWildId = null;
    pendingEyeId = null;
    announcedEnd = null;
    setSpectatorMode(false);
    $('#pauseOv').hidden = true;
    $('#endOv').hidden = true;
    $('#colorPick').hidden = true;
    $('#targetPick').hidden = true;
    updateLobby();
    window.go?.('lobby');
  }

  function startClock() {
    if (timerId) clearInterval(timerId);
    if (!match || match.phase !== 'playing' || match.paused) return;
    timerId = setInterval(() => {
      if (!match || match.phase !== 'playing' || match.paused) return;
      if (!collapseInProgress() && Date.now() >= match.turnEndsAt) {
        const before = audioSnapshot(match);
        const expired = Engine.resolveExpiredTurn(match, match.turnEpoch);
        if (expired) {
          playObservedTransition(before, audioSnapshot(match));
          if (roomRole === 'host') roomMessage('state', { state: stateSnapshot() });
        }
      }
      render();
      scheduleBot();
    }, 250);
  }

  function scheduleBot() {
    if (roomRole === 'guest' || !match || match.phase !== 'playing' || match.paused) return;
    if (collapseInProgress()) {
      if (botTimer) clearTimeout(botTimer);
      botTimer = 0;
      scheduledEpoch = null;
      return;
    }
    const player = match.players[match.turn];
    if (!player?.bot) {
      if (botTimer) clearTimeout(botTimer);
      botTimer = 0;
      scheduledEpoch = null;
      return;
    }
    if (botTimer || scheduledEpoch === match.turnEpoch) return;
    scheduledEpoch = match.turnEpoch;
    botTimer = setTimeout(() => {
      botTimer = 0;
      scheduledEpoch = null;
      if (!match || match.phase !== 'playing' || match.paused) return;
      const before = audioSnapshot(match);
      Engine.botMove(match);
      playObservedTransition(before, audioSnapshot(match));
      render();
      if (roomRole === 'host') roomMessage('state', { state: stateSnapshot() });
      scheduleBot();
    }, 1700);
  }

  function escapeValue(value) {
    return escapeHtml(value ?? '');
  }

  function cardAccessibleName(card) {
    return Engine.cardName(card);
  }

  function cardInner(card) {
    const mark = VALUE_MARK[card.v] || card.v;
    const value = escapeValue(mark);
    const icon = KENNEY_ICON[card.v];
    const center = icon
      ? `<img class="kenney-card-icon" src="${icon}" alt="" aria-hidden="true"><b class="v sr-only-value">${value}</b>`
      : `<b class="v">${value}</b>`;
    if (card.c === 'w') return center;
    const shape = COLOR_SHAPE[card.c];
    return `<span class="k"><svg viewBox="0 0 24 24"><use href="#s-${shape}"/></svg></span>${center}<span class="k e"><svg viewBox="0 0 24 24"><use href="#s-${shape}"/></svg></span>`;
  }

  function handMarkup(player) {
    if (!player) return '';
    const legal = new Set(Engine.legalCards(match, player).map(card => card.id));
    const size = player.hand.length;
    const cardWidth = size > 7 ? 'clamp(42px,12vw,68px)' : 'clamp(50px,14.5vw,78px)';
    return player.hand.map((card, index) => {
      const canPlay = legal.has(card.id);
      const selected = card.id === selectedCardId;
      const offset = index - (size - 1) / 2;
      const disabled = !isHumanTurn();
      const label = `Carta ${cardAccessibleName(card)}`;
      return `<button type="button" class="cd c-${card.c}${canPlay ? '' : ' off'}${selected ? ' sel' : ''}" style="--cw:${cardWidth};--rt:0deg;--y-offset:0px" data-card-id="${escapeValue(card.id)}" aria-label="${escapeValue(label)}" aria-pressed="${selected}"${canPlay ? '' : ' aria-disabled="true"'} ${disabled ? 'disabled' : ''}>${cardInner(card)}</button>`;
    }).join('');
  }

  function topCardMarkup(card) {
    if (!card) return '';
    return `<div class="cd c-${card.c}" aria-label="Carta da mesa: ${escapeValue(cardAccessibleName(card))}">${cardInner(card)}</div>`;
  }

  function opponentsMarkup() {
    if (!match) return '';
    const human = currentHuman();
    return match.players.filter(player => player.id !== human?.id).map((player, index) => {
      const active = player.id === match.players[match.turn]?.id;
      const low = player.hand.length === 1;
      const avatar = window.chromaAvatar ? window.chromaAvatar(index + 1, 34) : '';
      const team = player.team == null ? '' : ` · Equipe ${player.team + 1}`;
      return `<div class="op${active ? ' active' : ''}" data-player-id="${escapeValue(player.id)}" aria-label="${escapeValue(player.name)}${team}, ${player.hand.length} cartas${active ? ', na vez' : ''}">${avatar}<span>${escapeValue(player.name)}</span><span class="n${low ? ' low' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-card"/></svg>${player.hand.length}</span></div>`;
    }).join('');
  }

  function renderLog() {
    if (!match) return;
    const recent = match.log.slice(-3).reverse();
    $('#matchLog').innerHTML = recent.map(message => `<span>${escapeValue(message)}</span>`).join('');
    const spectatorItems = $('#spectatorLogItems');
    if (spectatorItems) spectatorItems.innerHTML = match.log.slice(-8).map(message => `<li>${escapeValue(message)}</li>`).join('');
    const spectatorCopy = $('#spectatorLogCopy');
    if (spectatorCopy) spectatorCopy.textContent = `${match.players.length} jogadores · ${match.draw.length} cartas no monte · as mãos continuam ocultas.`;
  }

  function roundSummary(isSpectator = spectator) {
    const summary = Engine.summary(match, localPlayerId, isSpectator);
    return { ...summary, roundId: `${match.code || 'LOCAL'}:${match.tournament?.round || 1}:${match.roundStats?.startedAt || 0}` };
  }

  function render() {
    if (!match) return;
    const gameScreen = $('#game');
    if (gameScreen) gameScreen.dataset.mode = match.mode;
    chaosMeter?.update({
      mode: match.mode,
      phase: match.phase,
      pending: match.pending,
      collapse: match.collapse,
      log: match.log?.[match.log.length - 1] || '',
    });
    syncCollapseOrchestration();
    const fxSnap = window.ChromaCardFx?.before();
    const human = currentHuman();
    const current = match.players[match.turn];
    const humanTurn = isHumanTurn();
    const top = match.discard[match.discard.length - 1];
    const oppsMarkup = opponentsMarkup();
    if (oppsMarkup !== lastOppsMarkup) { $('#opps').innerHTML = oppsMarkup; lastOppsMarkup = oppsMarkup; }
    const disc = $('#disc');
    const topKey = top ? `${top.id}|${top.c}|${top.v}` : '';
    if (disc.dataset.topKey !== topKey || Boolean(top) !== Boolean(disc.firstElementChild)) {
      disc.innerHTML = topCardMarkup(top);
      disc.dataset.topKey = topKey;
    }
    $('#cur').innerHTML = `<span style="color:var(--${match.color})"><svg viewBox="0 0 24 24"><use href="#s-${COLOR_SHAPE[match.color]}"/></svg></span>Cor atual: ${Engine.COLOR_NAMES[match.color] || '—'}`;
    $('#drawCount').textContent = String(match.draw.length);
    $('#drawPile').disabled = !humanTurn || Boolean(match.drawnId);
    $('#drawPile').setAttribute('aria-label', match.pending ? `Comprar ${match.pending} cartas acumuladas` : 'Comprar uma carta');
    $('#turnLabel').textContent = match.phase === 'ended' ? 'Torneio encerrado' : match.phase === 'betweenRounds' ? `Rodada ${match.tournament.round}/${match.tournament.maxRounds} concluída` : humanTurn ? 'Sua vez' : `Vez de ${current?.name || '—'}`;
    updateTurnFeedback();
    const resolvingCollapse = collapseInProgress();
    const seconds = match.phase === 'playing' && !match.paused ? Math.max(0, Math.ceil((match.turnEndsAt - Date.now()) / 1000)) : match.phase !== 'playing' ? 0 : Math.ceil((match.remainingTurnMs || 0) / 1000);
    $('#turnTimer').textContent = resolvingCollapse ? '…' : match.phase !== 'playing' ? 'Fim' : `${seconds} s`;
    $('#turnTimer').classList.toggle('warn', !resolvingCollapse && seconds <= 3 && match.phase === 'playing' && !match.paused);
    $('#stackIndicator').hidden = match.pending <= 0;
    $('#stackIndicator').textContent = match.pending > 0 ? `+${match.pending}` : '';
    const notice = match.modeNotice?.epoch === match.turnEpoch ? match.modeNotice.text : match.log[match.log.length - 1] || '';
    $('#gameMessage').textContent = spectator ? `Espectador · ${notice}` : notice;
    const chroma = $('#chromaBtn');
    chroma.disabled = spectator || resolvingCollapse || !human || match.phase !== 'playing' || !(human.hand.length <= 2 || match.vulnerable === human.id) || human.called;
    const catchButton = $('#catchBtn');
    catchButton.hidden = spectator || !match.vulnerable || match.vulnerable === localPlayerId || match.phase !== 'playing';
    catchButton.disabled = spectator || resolvingCollapse || match.phase !== 'playing';
    $('#passBtn').hidden = !humanTurn || !match.drawnId;
    $('#passBtn').disabled = !humanTurn || !match.drawnId;
    $('#play').disabled = !humanTurn || !selectedCardId || !Engine.legalCards(match, human).some(card => card.id === selectedCardId);
    // Só redesenha a mão se algo mudou (assim as animações não reiniciam a cada tick do relógio)
    const handHtml = spectator ? '' : handMarkup(human);
    const handBox = $('#hand');
    if (handHtml !== lastHandMarkup || (handHtml && !handBox.firstElementChild)) { handBox.innerHTML = handHtml; lastHandMarkup = handHtml; }
    window.ChromaCardFx?.after(fxSnap, match, { humanId: human?.id, selectedId: selectedCardId });
    renderLog();
    updateStartLabel();
    if (match.phase === 'betweenRounds' && announcedRound !== match.tournament.round) {
      announcedRound = match.tournament.round;
      clearTimers();
      document.dispatchEvent(new CustomEvent('chroma-tournament-round-ended', { detail: roundSummary(spectator) }));
    }
    if (match.phase === 'ended' && announcedEnd !== match) {
      announcedEnd = match;
      if (!spectator) {
        document.dispatchEvent(new CustomEvent('chroma-match-ended', { detail: roundSummary(false) }));
      } else {
        $('#gameMessage').textContent = `Mesa encerrada · ${Engine.summary(match, localPlayerId, true).winner} venceu.`;
      }
      clearTimers();
    }
  }

  function perform(action) {
    if (!match || spectator || collapseInProgress()) return false;
    action._id = `${localPlayerId}-${Date.now()}-${++actionSequence}`;
    if (roomRole === 'guest') {
      roomMessage('action', { playerId: localPlayerId, action });
      if (action.type === 'draw' || action.type === 'play' || action.type === 'pass') {
        guestActionLock = { epoch: match.turnEpoch };
        updateTurnFeedback();
      }
      return true;
    }
    const before = audioSnapshot(match);
    const player = match.players.find(item => item.id === localPlayerId);
    const card = action.type === 'play' ? player?.hand.find(item => item.id === action.cardId) : null;
    const error = Engine.act(match, localPlayerId, action);
    if (error) {
      window.ChromaAudio?.gameAction('error');
      $('#gameMessage').textContent = error;
      window.chromaHaptic?.('important');
      return false;
    }
    playActionSound(action, localPlayerId, card, before);
    selectedCardId = null;
    render();
    scheduleBot();
    if (roomRole === 'host') roomMessage('state', { state: stateSnapshot() });
    return true;
  }

  function chooseTarget(cardId) {
    pendingEyeId = cardId;
    const targets = match.players.filter(player => player.id !== localPlayerId);
    $('#targetChoices').innerHTML = targets.map(player => `<button class="btn btn-secondary" type="button" data-target-id="${escapeValue(player.id)}">${escapeValue(player.name)} · ${player.hand.length} cartas</button>`).join('');
    $('#targetPick').hidden = false;
    $('[data-target-id]', $('#targetChoices'))?.focus();
  }

  function playSelected() {
    if (!match || !selectedCardId || !isHumanTurn()) return;
    const card = currentHuman().hand.find(item => item.id === selectedCardId);
    if (!card) return;
    if (card.c === 'w' && card.v !== 'eye') {
      pendingWildId = card.id;
      $('#colorPick').hidden = false;
      $('[data-color]', $('#colorPick'))?.focus();
      return;
    }
    if (card.v === 'eye') {
      chooseTarget(card.id);
      return;
    }
    perform({ type: 'play', cardId: card.id });
  }

  function chooseColor(color) {
    if (!pendingWildId || !Engine.COLORS.includes(color)) return;
    const cardId = pendingWildId;
    pendingWildId = null;
    $('#colorPick').hidden = true;
    selectedCardId = null;
    perform({ type: 'play', cardId, color });
  }

  function chooseEyeTarget(targetId) {
    if (!pendingEyeId) return;
    const cardId = pendingEyeId;
    pendingEyeId = null;
    $('#targetPick').hidden = true;
    selectedCardId = null;
    perform({ type: 'play', cardId, targetId });
    const look = match?.lastLook;
    if (look?.playerId === localPlayerId) {
      const target = match.players.find(player => player.id === look.targetId);
      if (target) $('#gameMessage').textContent = `Mão de ${target.name}: ${target.hand.map(Engine.cardName).join(', ') || 'sem cartas'}`;
    }
  }

  function nextTournamentRound() {
    if (!match || !Engine.nextTournamentRound(match)) return false;
    announcedRound = null;
    announcedEnd = null;
    $('#endOv').hidden = true;
    document.dispatchEvent(new CustomEvent('chroma-tournament-next-round'));
    syncGameAudio();
    render();
    startClock();
    scheduleBot();
    return true;
  }

  function cardClick(event) {
    const button = event.target.closest('[data-card-id]');
    if (!button || button.disabled || !isHumanTurn()) return;
    if (button.getAttribute('aria-disabled') === 'true') {
      window.ChromaAudio?.gameAction('error');
      window.ChromaCardFx?.reject(button);
      window.chromaHaptic?.('important');
      return;
    }
    selectedCardId = selectedCardId === button.dataset.cardId ? null : button.dataset.cardId;
    window.ChromaAudio?.gameAction('select');
    render();
    $(`[data-card-id="${selectedCardId}"]`)?.focus();
    window.chromaHaptic?.('tap');
  }

  $('#hand').addEventListener('click', cardClick);
  $('#drawPile').addEventListener('click', () => { if (isHumanTurn() && !match.drawnId) perform({ type: 'draw' }); });
  $('#play').addEventListener('click', playSelected);
  $('#passBtn').addEventListener('click', () => perform({ type: 'pass' }));
  $('#chromaBtn').addEventListener('click', () => { if (match && !spectator) perform({ type: 'chroma' }); });
  $('#catchBtn').addEventListener('click', () => { if (match && !spectator) perform({ type: 'catch' }); });
  $('#pauseGame').addEventListener('click', pause);
  $('#resumeMatch').addEventListener('click', resume);
  $('#leaveMatch').addEventListener('click', exitToLobby);
  $('#nextRound').addEventListener('click', nextTournamentRound);
  $('#pauseOv').addEventListener('click', event => { if (event.target.id === 'pauseOv') resume(); });
  $('#colorPick').addEventListener('click', event => {
    const button = event.target.closest('[data-color]');
    if (button) chooseColor(button.dataset.color);
    else if (event.target.id === 'colorPick') pendingWildId = null;
  });
  $('#targetChoices').addEventListener('click', event => {
    const button = event.target.closest('[data-target-id]');
    if (button) chooseEyeTarget(button.dataset.targetId);
  });
  $('#cancelTarget').addEventListener('click', () => { pendingEyeId = null; $('#targetPick').hidden = true; });
  $('#targetPick').addEventListener('click', event => { if (event.target.id === 'targetPick') { pendingEyeId = null; $('#targetPick').hidden = true; } });
  $('#stackToggle').addEventListener('click', event => {
    const button = event.currentTarget;
    const enabled = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(enabled));
    const label = button.querySelector('span');
    if (label) label.textContent = enabled ? 'Sim' : 'Não';
  });
  $('#opps').addEventListener('click', event => {
    const opponent = event.target.closest('.op');
    if (opponent && match && spectator) $('#gameMessage').textContent = opponent.getAttribute('aria-label');
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!$('#pauseOv').hidden) { resume(); return; }
    if (!$('#colorPick').hidden) pendingWildId = null;
    if (!$('#targetPick').hidden) pendingEyeId = null;
    $('#colorPick').hidden = true;
    $('#targetPick').hidden = true;
  });

  $('#createRoom')?.addEventListener('click', createRoom);
  $('#joinRoom')?.addEventListener('click', joinRoom);
  $('#roomCodeInput')?.addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#roomCodeInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });
  $('#addBot')?.addEventListener('click', addBot);
  $('#pl')?.addEventListener('click', event => {
    const button = event.target.closest('[data-room-remove]');
    if (button) removePlayerFromLobby(button.dataset.roomRemove);
  });
  updateLobby();
  window.chromaGame = {
    enter,
    pause,
    resume,
    exitToLobby,
    updateLobby,
    createRoom,
    joinRoom,
    addBot,
    setNextSpectator(value = true) { nextSpectator = Boolean(value); },
    getMatch() { return match; },
    getSummary() { return match ? roundSummary(spectator) : null; },
    showPartialSummary() { document.dispatchEvent(new CustomEvent('chroma-match-summary', { detail: match ? roundSummary(spectator) : null })); },
    nextTournamentRound,
  };
})();
