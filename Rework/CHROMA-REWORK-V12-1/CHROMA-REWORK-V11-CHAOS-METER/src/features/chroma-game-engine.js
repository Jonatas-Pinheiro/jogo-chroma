(function attachChromaGameEngine(root) {
  'use strict';

  const COLORS = ['r', 'y', 'g', 'b'];
  const COLOR_NAMES = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul' };
  const PLUS = { '+2': 2, '+4': 4, '+6': 6, '+10': 10, '+99': 99 };
  const TOURNAMENT_POINTS = [100, 75, 55, 40, 30, 20, 10, 5];
  const MODES = ['classic', 'caos', 'supercaos', 'maldita', 'eventos', 'tournament', 'team2x2', 'team3x3'];
  const SHIELD_MODES = new Set(['caos', 'supercaos', 'maldita', 'eventos']);
  const MIRROR_MODES = SHIELD_MODES;
  const TURN_SECONDS = 15;
  const MALDITA_TURNOS = 8;
  const EVENTOS_TURNOS = 6;
  const EVENT_NAMES = [
    ['rain', 'Chuva de cartas'], ['reverse', 'Maré inversa'], ['paint', 'Pintura surpresa'],
    ['help', 'Ajuda ao azarado'], ['gift', 'Presente de escudo'], ['pass', 'Passa-passa'],
  ];
  const DEFAULT_NAMES = ['Você', 'Dante', 'Kira', 'Mei', 'Léo', 'Sora', 'Bia', 'Teo', 'Lia'];

  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const playerAt = (state, offset) => {
    const n = state.players.length;
    return state.players[((state.turn + state.direction * offset) % n + n) % n];
  };
  const log = (state, message) => {
    state.log.push(String(message));
    if (state.log.length > 30) state.log.shift();
  };
  const randomIndex = (length, random) => Math.floor(random() * length);

  function shuffle(items, random = Math.random) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1, random);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function modePlayerCount(mode, requested) {
    if (mode === 'team3x3') return 9;
    if (mode === 'team2x2') return 4;
    return clamp(Math.floor(Number(requested) || 4), 2, 4);
  }

  function makeDeck(mode = 'classic', dumpColor = false, stack = false) {
    const cards = [];
    let serial = 0;
    const add = (color, value) => cards.push({ id: `c${serial++}`, c: color, v: value });
    for (const color of COLORS) {
      add(color, '0');
      for (let value = 1; value <= 9; value += 1) {
        add(color, String(value));
        add(color, String(value));
      }
      for (const value of ['skip', 'rev', '+2']) {
        add(color, value);
        add(color, value);
      }
      if (mode === 'caos' || mode === 'supercaos') {
        add(color, 'skip2');
        add(color, '+10');
      }
      if (dumpColor) add(color, 'blackhole');
      if (SHIELD_MODES.has(mode)) add(color, 'shield');
    }
    for (let i = 0; i < 4; i += 1) {
      add('w', 'wild');
      add('w', '+4');
    }
    if (mode === 'caos' || mode === 'supercaos') {
      for (let i = 0; i < 2; i += 1) {
        add('w', '+6');
        add('w', 'swap');
        add('w', 'eye');
      }
    }
    if (mode === 'supercaos') {
      for (let i = 0; i < 2; i += 1) add('w', '+99');
      for (let i = 0; i < 2; i += 1) add('w', 'confuse');
    }
    if (stack && MIRROR_MODES.has(mode)) {
      for (let i = 0; i < 4; i += 1) add('w', 'mirror');
    }
    return cards;
  }

  function createMatch(options = {}) {
    const mode = MODES.includes(options.mode) ? options.mode : 'classic';
    const roster = Array.isArray(options.players) && options.players.length ? options.players : null;
    const count = roster ? roster.length : modePlayerCount(mode, options.playerCount);
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const names = Array.isArray(options.names) ? options.names : DEFAULT_NAMES;
    const teamSize = mode === 'team2x2' ? 2 : mode === 'team3x3' ? 3 : 0;
    const state = {
      code: String(options.code || 'LOCAL'), mode, stack: Boolean(options.stack), dumpColor: Boolean(options.dumpColor),
      turnSeconds: clamp(Number(options.turnSeconds) || TURN_SECONDS, 1, 30), random,
      players: Array.from({ length: count }, (_, index) => {
        const descriptor = roster?.[index] || {};
        const id = String(descriptor.id || (index === 0 ? 'you' : `bot-${index}`));
        const bot = descriptor.bot == null ? index !== 0 : Boolean(descriptor.bot);
        return {
        id,
        name: String(descriptor.name || names[index] || (index === 0 ? 'Você' : `Bot ${index}`)),
        hand: [], bot, team: descriptor.team ?? (teamSize ? Math.floor(index / teamSize) : null),
        called: false, shield: false, wins: 0,
        stats: { played: 0, drawn: 0, chroma: 0, specialRun: 0, bestSpecial: 0 },
        };
      }),
      phase: 'playing', draw: [], discard: [], turn: 0, direction: 1, color: 'r', pending: 0,
      collapse: null, collapseSerial: 0,
      drawnId: null, vulnerable: null, winner: null, winnerTeam: null, turnEndsAt: 0,
      turnEpoch: 0, resolvedTurnEpoch: null, actionLock: false, seenActionIds: [],
      turnCount: 0, cursedColor: null, nextEventAt: EVENTOS_TURNOS, lastEvent: null,
      modeNotice: null, roundStats: { startedAt: Date.now(), durationMs: 0 },
      tournament: { round: 0, maxRounds: 5, scores: {}, finished: false, champion: null, roundWinner: null },
      log: [], paused: false, remainingTurnMs: null, lastLook: null, normalEnd: false,
    };
    startRound(state, { now: options.now || Date.now, random });
    return state;
  }

  function startRound(state, options = {}) {
    const now = options.now || Date.now;
    const random = options.random || state.random || Math.random;
    state.roundStats = { startedAt: now(), durationMs: 0 };
    state.normalEnd = false;
    state.deckSerial = (state.deckSerial || 0) + 1;
    state.draw = shuffle(makeDeck(state.mode, state.dumpColor, state.stack)
      .map((card, index) => ({ ...card, id: `r${state.deckSerial}-${index}` })), random);
    state.discard = [];
    for (const player of state.players) {
      player.hand = [];
      player.called = false;
      player.shield = false;
      player.stats = { played: 0, drawn: 0, chroma: 0, specialRun: 0, bestSpecial: 0 };
    }
    for (let n = 0; n < 7; n += 1) {
      for (const player of state.players) player.hand.push(state.draw.pop());
    }
    let first;
    let guard = 0;
    do {
      first = state.draw.pop();
      if (!first) break;
      if (/^\d$/.test(first.v)) break;
      state.draw.unshift(first);
    } while (++guard < 200);
    if (!first) throw new Error('O baralho acabou antes de iniciar a rodada.');
    state.discard.push(first);
    state.color = first.c;
    state.direction = 1;
    state.pending = 0;
    state.collapse = null;
    state.drawnId = null;
    state.vulnerable = null;
    state.winner = null;
    state.winnerTeam = null;
    state.turnCount = 0;
    state.nextEventAt = EVENTOS_TURNOS;
    state.lastEvent = null;
    state.modeNotice = null;
    state.cursedColor = state.mode === 'maldita' ? COLORS[randomIndex(COLORS.length, random)] : null;
    state.turnEpoch = (state.turnEpoch || 0) + 1;
    state.resolvedTurnEpoch = null;
    state.actionLock = false;
    state.seenActionIds = [];
    state.turn = randomIndex(state.players.length, random);
    state.turnEndsAt = now() + state.turnSeconds * 1000;
    state.paused = false;
    state.remainingTurnMs = null;
    state.phase = 'playing';
    if (state.mode === 'tournament') state.tournament.round += 1;
    state.log = [`Rodada iniciada! ${playerAt(state, 0).name} começa.`];
    if (state.cursedColor) {
      log(state, `Cor Maldita inicial: ${COLOR_NAMES[state.cursedColor]}!`);
      state.modeNotice = { text: `Cor Maldita: ${COLOR_NAMES[state.cursedColor]}!`, epoch: state.turnEpoch };
    }
    beginTurn(state, now, random);
    return state;
  }

  function beginTurn(state, now = Date.now, random = state.random || Math.random) {
    if (state.phase !== 'playing') return;
    state.modeNotice = null;
    if (state.mode === 'maldita' && state.turnCount > 0 && state.turnCount % MALDITA_TURNOS === 0) {
      state.cursedColor = COLORS.filter(color => color !== state.cursedColor)[randomIndex(COLORS.length - 1, random)];
      state.modeNotice = { text: `Cor Maldita: ${COLOR_NAMES[state.cursedColor]}!`, epoch: state.turnEpoch };
      log(state, `Cor Maldita mudou para ${COLOR_NAMES[state.cursedColor]}!`);
    }
    if (state.mode !== 'eventos' || state.turnCount < state.nextEventAt || state.pending || state.drawnId) return;
    const eligible = EVENT_NAMES.filter(([id]) => id !== state.lastEvent);
    const [id, name] = eligible[randomIndex(eligible.length, random)];
    state.lastEvent = id;
    state.nextEventAt = state.turnCount + EVENTOS_TURNOS;
    state.modeNotice = { text: `Evento: ${name}!`, epoch: state.turnEpoch };
    log(state, `EVENTO: ${name}!`);
    runEvent(state, id, now, random);
  }

  function refill(state) {
    const top = state.discard.pop();
    if ((state.mode === 'caos' || state.mode === 'supercaos') && state.discard.length === 0) {
      state.deckSerial = (state.deckSerial || 0) + 1;
      state.draw = shuffle(makeDeck(state.mode, state.dumpColor, state.stack)
        .map((card, index) => ({ ...card, id: `r${state.deckSerial}-${index}` })), state.random || Math.random);
      state.discard = top ? [top] : [];
      return;
    }
    state.draw = shuffle(state.discard, state.random || Math.random);
    state.discard = top ? [top] : [];
  }

  function drawCards(state, player, amount) {
    const received = [];
    const count = Math.max(0, Math.floor(Number(amount) || 0));
    for (let index = 0; index < count; index += 1) {
      if (!state.draw.length) refill(state);
      if (!state.draw.length) break;
      const card = state.draw.pop();
      player.hand.push(card);
      received.push(card);
      if (state.phase === 'playing') player.stats.drawn += 1;
    }
    return received;
  }

  function drawForced(state, player, amount, source, losesTurn = true) {
    if (player.shield) {
      player.shield = false;
      log(state, `Escudo de ${player.name} absorveu ${source} (${amount} carta${amount === 1 ? '' : 's'})${losesTurn ? `; ${player.name} perdeu a vez.` : '.'}`);
      return [];
    }
    return drawCards(state, player, amount);
  }

  function queueSuperChaosCollapse(state) {
    if (state.mode !== 'supercaos' || state.pending < 150) return false;
    state.collapseSerial = (Number(state.collapseSerial) || 0) + 1;
    state.collapse = {
      id: `collapse-${state.turnEpoch}-${state.collapseSerial}`,
      status: 'awaiting',
      accumulated: state.pending,
    };
    return true;
  }

  function resolveSuperChaosCollapse(state, collapseId, options = {}) {
    if (!state || state.mode !== 'supercaos' || state.phase !== 'playing' ||
        state.collapse?.status !== 'awaiting' || state.collapse.id !== collapseId || state.pending < 150) return false;
    const random = options.random || state.random || Math.random;
    const accumulated = state.collapse.accumulated;
    const target = state.players[randomIndex(state.players.length, random)];
    if (!target) return false;
    const hadShield = target.shield;
    const penalty = drawForced(state, target, 150, 'o Colapso do Super Caos');
    state.pending = 0;
    state.collapse.status = 'resolved';
    state.collapse.targetId = target.id;
    const outcome = hadShield ? 'teve a punição absorvida pelo Escudo.' : `comprou ${penalty.length} cartas na punição de +150.`;
    log(state, `COLAPSO! Acúmulo de ${accumulated}; ${target.name} foi sorteado e ${outcome}`);
    return true;
  }

  function completeSuperChaosCollapse(state, collapseId, now = Date.now) {
    if (!state || state.mode !== 'supercaos' || state.phase !== 'playing' ||
        state.collapse?.status !== 'resolved' || state.collapse.id !== collapseId) return false;
    state.collapse.status = 'complete';
    if (state.paused) state.remainingTurnMs = state.turnSeconds * 1000;
    else state.turnEndsAt = now() + state.turnSeconds * 1000;
    return true;
  }

  function runEvent(state, eventId, now = Date.now, random = state.random || Math.random) {
    if (eventId === 'rain') {
      state.players.forEach(player => drawForced(state, player, 1, 'a Chuva de cartas', false));
      log(state, 'Chuva de cartas: cada jogador sem Escudo comprou 1 carta.');
    } else if (eventId === 'reverse') {
      state.direction *= -1;
      log(state, 'Maré inversa: o sentido do jogo mudou.');
    } else if (eventId === 'paint') {
      state.color = COLORS.filter(color => color !== state.color)[randomIndex(COLORS.length - 1, random)];
      log(state, `Pintura surpresa: a cor da mesa agora é ${COLOR_NAMES[state.color]}.`);
    } else if (eventId === 'help') {
      const sorted = state.players.slice().sort((a, b) => b.hand.length - a.hand.length);
      const player = sorted[0] && (!sorted[1] || sorted[0].hand.length > sorted[1].hand.length) ? sorted[0] : null;
      if (!player || player.hand.length <= 1) log(state, 'Ajuda ao azarado: empate ou ninguém pode devolver carta.');
      else {
        const card = player.hand.splice(randomIndex(player.hand.length, random), 1)[0];
        state.draw.push(card);
        state.draw = shuffle(state.draw, random);
        log(state, `${player.name} devolveu 1 carta ao monte.`);
      }
    } else if (eventId === 'gift') {
      const sorted = state.players.slice().sort((a, b) => b.hand.length - a.hand.length);
      const player = sorted[0] && (!sorted[1] || sorted[0].hand.length > sorted[1].hand.length) ? sorted[0] : null;
      if (!player) log(state, 'Presente de escudo: empate; ninguém recebeu Escudo.');
      else if (!player.shield) { player.shield = true; log(state, `${player.name} ganhou um Escudo.`); }
      else log(state, `${player.name} já tinha um Escudo.`);
    } else if (eventId === 'pass') {
      if (state.players.some(player => !player.hand.length)) return;
      const cards = state.players.map(player => player.hand.splice(randomIndex(player.hand.length, random), 1)[0]);
      cards.forEach((card, index) => {
        const n = state.players.length;
        state.players[(index + state.direction + n) % n].hand.push(card);
      });
      log(state, 'Passa-passa: todos passaram 1 carta no sentido atual.');
    }
  }

  function isLegal(state, player, card) {
    const top = state.discard[state.discard.length - 1];
    if (!top) return false;
    if (state.pending > 0) return state.stack && (has(PLUS, card.v) || card.v === 'mirror');
    if (card.c === 'w') {
      if (card.v === '+4' || card.v === '+6') return !player.hand.some(other => other.id !== card.id && other.c === state.color);
      return true;
    }
    return card.c === state.color || card.v === top.v;
  }

  function legalCards(state, player) {
    if (!player || state.phase !== 'playing') return [];
    if (state.drawnId) {
      const drawn = player.hand.find(card => card.id === state.drawnId);
      return drawn && isLegal(state, player, drawn) ? [drawn] : [];
    }
    return player.hand.filter(card => isLegal(state, player, card));
  }

  function endRound(state, player, reason = 'cards') {
    if (state.phase !== 'playing') return;
    state.phase = 'ended';
    state.winner = player ? player.id : null;
    state.winnerTeam = player && player.team != null ? player.team : null;
    if (player) player.wins += 1;
    state.pending = 0;
    state.drawnId = null;
    state.vulnerable = null;
    state.turnEndsAt = 0;
    state.actionLock = false;
    state.normalEnd = reason === 'cards';
    state.roundStats.durationMs = Math.max(0, Date.now() - state.roundStats.startedAt);
    if (state.mode === 'tournament') {
      state.tournament.roundWinner = player?.id || null;
      scoreTournamentRound(state, player);
      if (state.tournament.round < state.tournament.maxRounds) {
        state.phase = 'betweenRounds';
        log(state, `Rodada ${state.tournament.round}/${state.tournament.maxRounds} encerrada${player ? `: ${player.name} venceu` : ''}.`);
      } else {
        const champion = tournamentResults(state)[0] || null;
        state.tournament.finished = true;
        state.tournament.champion = champion?.id || null;
        state.winner = champion?.id || null;
        state.winnerTeam = null;
        state.phase = 'ended';
        log(state, champion ? `Torneio encerrado: ${champion.name} é o campeão com ${champion.points} pontos!` : 'Torneio encerrado sem vencedor.');
      }
      return;
    }
    if (player) log(state, state.winnerTeam != null ? `${player.name} terminou; ${teamLabel(state.winnerTeam)} venceu!` : `${player.name} venceu a rodada!`);
    else log(state, 'A rodada terminou sem vencedor.');
  }

  function tournamentResults(state) {
    return state.players.slice().sort((a, b) => (state.tournament.scores[b.id] || 0) - (state.tournament.scores[a.id] || 0) || a.name.localeCompare(b.name))
      .map((player, index) => ({ id: player.id, name: player.name, points: state.tournament.scores[player.id] || 0, place: index + 1 }));
  }

  function scoreTournamentRound(state, winner) {
    if (state.mode !== 'tournament') return;
    const results = state.players.slice().sort((a, b) => a.id === winner?.id ? -1 : b.id === winner?.id ? 1 : a.hand.length - b.hand.length || a.name.localeCompare(b.name));
    results.forEach((player, index) => {
      state.tournament.scores[player.id] = (state.tournament.scores[player.id] || 0) + (TOURNAMENT_POINTS[Math.min(index, TOURNAMENT_POINTS.length - 1)] || 5);
    });
  }

  function nextTournamentRound(state, options = {}) {
    if (!state || state.mode !== 'tournament' || state.phase !== 'betweenRounds' || state.tournament.round >= state.tournament.maxRounds) return false;
    startRound(state, options);
    return true;
  }

  function teamLabel(team) {
    return team === 0 ? 'Equipe Azul' : team === 1 ? 'Equipe Vermelha' : team === 2 ? 'Equipe Verde' : '';
  }

  function advance(state, steps = 1, options = {}) {
    const now = options.now || Date.now;
    const n = state.players.length;
    if (!n) return;
    state.turn = ((state.turn + state.direction * steps) % n + n) % n;
    state.turnEpoch += 1;
    state.resolvedTurnEpoch = null;
    state.actionLock = false;
    state.turnCount += 1;
    state.turnEndsAt = now() + state.turnSeconds * 1000;
    if (!options.deferBegin) beginTurn(state, now, options.random || state.random || Math.random);
  }

  function act(state, playerId, action = {}, options = {}) {
    if (!state || state.phase !== 'playing' || state.paused) return 'A partida não está em andamento';
    if (state.collapse && state.collapse.status !== 'complete') return 'O Colapso do Super Caos está em andamento';
    const player = state.players.find(item => item.id === playerId);
    if (!player) return 'Jogador inválido';
    const eventId = typeof action._id === 'string' && action._id ? action._id : null;
    if (eventId && state.seenActionIds.includes(eventId)) return null;
    if (state.actionLock) return null;
    state.actionLock = true;
    let result;
    try {
      result = actCore(state, player, action, options);
    } finally {
      state.actionLock = false;
    }
    if (!result && eventId) {
      state.seenActionIds.push(eventId);
      if (state.seenActionIds.length > 200) state.seenActionIds.splice(0, state.seenActionIds.length - 200);
    }
    return result;
  }

  function actCore(state, player, action, options) {
    const now = options.now || Date.now;
    const random = options.random || state.random || Math.random;
    const index = state.players.indexOf(player);
    if (action.type === 'chroma') {
      if (state.vulnerable === player.id) {
        state.vulnerable = null;
        player.called = true;
        player.stats.chroma += 1;
        log(state, `${player.name} gritou CHROMA!`);
        return null;
      }
      if (player.hand.length <= 2) {
        if (!player.called) player.stats.chroma += 1;
        player.called = true;
        return null;
      }
      return 'Você ainda tem cartas demais';
    }
    if (action.type === 'catch') {
      const target = state.players.find(item => item.id === state.vulnerable);
      if (!target || target.id === player.id) return 'Ninguém para denunciar agora';
      drawCards(state, target, 2);
      state.vulnerable = null;
      log(state, `${player.name} pegou ${target.name} sem CHROMA! (+2 cartas)`);
      return null;
    }
    if (index !== state.turn) return 'Não é a sua vez';

    if (action.type === 'play') {
      const cardIndex = player.hand.findIndex(card => card.id === action.cardId);
      if (cardIndex < 0) return 'Carta inválida';
      const card = player.hand[cardIndex];
      if (state.drawnId && state.drawnId !== card.id) return 'Jogue a carta comprada ou passe a vez';
      if (!isLegal(state, player, card)) return 'Essa carta não pode ser jogada agora';
      if ((card.v === 'eye' || card.v === 'swap' || card.v === 'confuse' || card.v === 'skip2' || card.v === '+10' || card.v === '+6') && !['caos', 'supercaos'].includes(state.mode)) return 'Essa carta só existe no modo Caos';
      if (card.v === '+99' && state.mode !== 'supercaos') return 'Essa carta só existe no modo Super Caos';
      if (card.v === 'mirror' && !state.stack) return 'O Espelho exige acúmulo ligado';
      if (card.v === 'eye' && (!state.players.some(target => target.id === action.targetId && target.id !== player.id))) return 'Escolha outro jogador para observar';
      if (card.c === 'w' && card.v !== 'eye' && !COLORS.includes(action.color)) return 'Escolha uma cor';

      state.vulnerable = null;
      player.hand.splice(cardIndex, 1);
      state.discard.push(card);
      player.stats.played += 1;
      player.stats.specialRun = /^\d$/.test(card.v) ? 0 : player.stats.specialRun + 1;
      player.stats.bestSpecial = Math.max(player.stats.bestSpecial, player.stats.specialRun);
      if (card.c === 'w' && card.v !== 'eye') state.color = action.color;
      else if (card.c !== 'w') state.color = card.c;
      state.drawnId = null;
      log(state, `${player.name} jogou ${cardName(card)}${card.c === 'w' && card.v !== 'eye' ? ` → ${COLOR_NAMES[action.color]}` : ''}`);

      if (state.dumpColor && card.v === 'blackhole') {
        const returned = player.hand.filter(item => item.c === card.c);
        if (returned.length) {
          player.hand = player.hand.filter(item => item.c !== card.c);
          state.draw = shuffle(state.draw.concat(returned), random);
          log(state, `${player.name} devolveu ${returned.length} carta(s) da mesma cor ao monte.`);
        }
      }

      // A última carta vence antes de Bloqueio, compra acumulada ou Cor Maldita.
      if (player.hand.length === 0) { endRound(state, player); return null; }
      if (player.hand.length === 1) {
        if (player.called) log(state, `${player.name}: CHROMA! (1 carta)`);
        else { state.vulnerable = player.id; log(state, `${player.name} está com 1 carta!`); }
      } else player.called = false;

      const count = state.players.length;
      switch (card.v) {
        case 'skip': {
          const skipped = playerAt(state, 1);
          log(state, `${skipped.name} perdeu a vez`);
          advance(state, 2, { deferBegin: true, now });
          break;
        }
        case 'skip2': {
          const skippedCount = Math.min(2, count - 1);
          const names = [];
          for (let i = 1; i <= skippedCount; i += 1) names.push(playerAt(state, i).name);
          log(state, `${names.join(' e ')} perderam a vez (Bloqueio Duplo)`);
          advance(state, skippedCount + 1, { deferBegin: true, now });
          break;
        }
        case 'rev':
          state.direction *= -1;
          log(state, 'Sentido invertido');
          advance(state, count === 2 ? 2 : 1, { deferBegin: true, now });
          break;
        case '+2': case '+4': case '+6': case '+10': case '+99': {
          const amount = PLUS[card.v];
          if (state.stack) {
            state.pending += amount;
            advance(state, 1, { deferBegin: true, now });
            queueSuperChaosCollapse(state);
          } else {
            const target = playerAt(state, 1);
            const hadShield = target.shield;
            drawForced(state, target, amount, `a carta ${card.v}`);
            if (!hadShield) log(state, `${target.name} comprou ${amount} e perdeu a vez`);
            advance(state, 2, { deferBegin: true, now });
          }
          break;
        }
        case 'shield':
          if (!player.shield) { player.shield = true; log(state, `${player.name} ganhou um Escudo.`); }
          else log(state, `${player.name} já tinha um Escudo (limite de 1).`);
          advance(state, 1, { deferBegin: true, now });
          break;
        case 'mirror':
          if (state.pending > 0) {
            const target = playerAt(state, -1);
            log(state, `${player.name} refletiu +${state.pending} para ${target.name} com Espelho!`);
            advance(state, -1, { deferBegin: true, now });
          } else advance(state, 1, { deferBegin: true, now });
          break;
        case 'swap': {
          const others = state.players.filter(item => item.id !== player.id);
          if (others.length) {
            const target = others[randomIndex(others.length, random)];
            [player.hand, target.hand] = [target.hand, player.hand];
            log(state, `${player.name} trocou de mão com ${target.name}!`);
          }
          advance(state, 1, { deferBegin: true, now });
          break;
        }
        case 'confuse': {
          const pile = shuffle(state.players.flatMap(item => item.hand), random);
          const base = Math.floor(pile.length / count);
          let extra = pile.length - base * count;
          const start = state.players.indexOf(player);
          const order = Array.from({ length: count }, (_, offset) => state.players[(start + offset) % count]);
          for (const target of order) {
            const take = base + (extra > 0 ? 1 : 0);
            if (extra > 0) extra -= 1;
            target.hand = pile.splice(0, take);
          }
          log(state, `CONFUSÃO! As mãos foram redistribuídas (${base}${pile.length ? `–${base + 1}` : ''} cartas por pessoa).`);
          advance(state, 1, { deferBegin: true, now });
          break;
        }
        case 'eye': {
          const target = state.players.find(item => item.id === action.targetId);
          if (target) {
            state.lastLook = { playerId: player.id, targetId: target.id, cards: target.hand.map(item => ({ ...item })) };
            log(state, `${player.name} observou as cartas de ${target.name}.`);
          }
          advance(state, 1, { deferBegin: true, now });
          break;
        }
        default:
          advance(state, 1, { deferBegin: true, now });
      }

      if (state.mode === 'maldita' && card.c === state.cursedColor) {
        drawCards(state, player, 1);
        log(state, `${player.name} jogou a Cor Maldita ${COLOR_NAMES[card.c]} e comprou 1 carta.`);
        if (player.hand.length !== 1) {
          if (state.vulnerable === player.id) state.vulnerable = null;
          player.called = false;
        }
      }
      const empty = state.players.find(item => item.hand.length === 0);
      if (empty) endRound(state, empty);
      else beginTurn(state, now, random);
      return null;
    }

    if (action.type === 'draw') {
      state.vulnerable = null;
      player.called = false;
      if (state.pending > 0) {
        const amount = state.pending;
        const hadShield = player.shield;
        const penalty = drawForced(state, player, amount, 'a compra acumulada');
        if (!hadShield) log(state, `${player.name} comprou ${penalty.length} cartas e perdeu a vez`);
        state.pending = 0;
        state.drawnId = null;
        advance(state, 1, { now, random });
        return null;
      }
      if (state.drawnId) return 'Você já comprou: jogue a carta ou passe a vez';
      const received = drawCards(state, player, 1);
      if (!received.length) {
        log(state, 'Não há mais cartas para comprar');
        advance(state, 1, { now, random });
        return null;
      }
      log(state, `${player.name} comprou uma carta`);
      if (isLegal(state, player, received[0])) state.drawnId = received[0].id;
      else advance(state, 1, { now, random });
      return null;
    }

    if (action.type === 'pass') {
      if (!state.drawnId) return 'Só dá para passar depois de comprar';
      state.vulnerable = null;
      state.drawnId = null;
      log(state, `${player.name} passou a vez`);
      advance(state, 1, { now, random });
      return null;
    }
    return 'Ação desconhecida';
  }

  function resolveExpiredTurn(state, epoch = state.turnEpoch, options = {}) {
    if (!state || state.phase !== 'playing' || state.paused || (state.collapse && state.collapse.status !== 'complete') || epoch !== state.turnEpoch || state.resolvedTurnEpoch === epoch) return false;
    const player = state.players[state.turn];
    if (!player) return false;
    state.resolvedTurnEpoch = epoch;
    state.vulnerable = null;
    state.drawnId = null;
    player.called = false;
    const accumulated = Math.max(0, Number(state.pending) || 0);
    const amount = accumulated > 0 ? accumulated : 1;
    const penalty = accumulated > 0 ? drawForced(state, player, amount, 'a compra acumulada') : drawCards(state, player, amount);
    if (accumulated > 0) {
      state.pending = 0;
      log(state, `${player.name} perdeu o tempo e ${penalty.length ? `comprou ${penalty.length} cartas da punição acumulada.` : 'teve a compra absorvida pelo Escudo.'}`);
    } else log(state, `${player.name} perdeu o tempo e recebeu ${penalty.length ? '1 carta de penalidade.' : 'passou sem comprar: baralho vazio.'}`);
    advance(state, 1, options);
    return true;
  }

  function removePlayer(state, playerId, options = {}) {
    const index = state.players.findIndex(player => player.id === playerId);
    if (index < 0) return false;
    const wasPlaying = state.phase === 'playing';
    const wasTurn = wasPlaying && index === state.turn;
    const [leaving] = state.players.splice(index, 1);
    log(state, `${leaving.name} saiu da sala`);
    if (wasPlaying) {
      state.draw = shuffle(state.draw.concat(leaving.hand), options.random || state.random || Math.random);
      if (state.vulnerable === playerId) state.vulnerable = null;
    }
    if (!wasPlaying) return true;

    if (state.players.length < 2) {
      const remaining = state.players[0] || null;
      state.winner = remaining ? remaining.id : null;
      state.winnerTeam = remaining && remaining.team != null ? remaining.team : null;
      if (remaining) remaining.wins += 1;
      state.phase = 'ended';
      state.pending = 0;
      state.collapse = null;
      state.drawnId = null;
      state.vulnerable = null;
      state.turnEndsAt = 0;
      state.resolvedTurnEpoch = state.turnEpoch;
      state.actionLock = false;
      state.normalEnd = false;
      state.roundStats.durationMs = Math.max(0, (options.now || Date.now)() - state.roundStats.startedAt);
      log(state, remaining ? `${remaining.name} venceu; as outras pessoas saíram.` : 'A sala foi encerrada.');
      return true;
    }

    if (wasTurn) {
      state.drawnId = null;
      leaving.called = false;
      const n = state.players.length;
      state.turn = state.direction === 1 ? index % n : (index - 1 + n) % n;
      state.turnEpoch += 1;
      state.resolvedTurnEpoch = null;
      state.actionLock = false;
      state.seenActionIds = [];
      state.turnCount += 1;
      state.turnEndsAt = (options.now || Date.now)() + state.turnSeconds * 1000;
      // Uma saída do jogador ativo consome a vez e executa as regras do próximo início.
      beginTurn(state, options.now || Date.now, options.random || state.random || Math.random);
    } else if (index < state.turn) state.turn -= 1;
    return true;
  }

  function pause(state, now = Date.now) {
    if (!state || state.phase !== 'playing' || state.paused) return false;
    state.remainingTurnMs = Math.max(0, state.turnEndsAt - now());
    state.paused = true;
    return true;
  }

  function resume(state, now = Date.now) {
    if (!state || state.phase !== 'playing' || !state.paused) return false;
    state.paused = false;
    state.turnEndsAt = now() + Math.max(0, Number(state.remainingTurnMs) || 0);
    state.remainingTurnMs = null;
    return true;
  }

  function cardName(card) {
    const names = { skip: 'Bloqueio', skip2: 'Bloqueio Duplo', rev: 'Inverter', '+2': '+2', '+4': 'Coringa +4', '+6': '+6', '+10': '+10', '+99': '+99', wild: 'Coringa', swap: 'Coringa Troca', eye: 'Olho do Paizin', confuse: 'Confusão', shield: 'Escudo', mirror: 'Espelho', blackhole: 'Buraco negro' };
    return card.c === 'w' ? (names[card.v] || card.v) : `${names[card.v] || card.v} ${COLOR_NAMES[card.c]}`;
  }

  function chooseBotAction(state, player = state.players[state.turn], random = state.random || Math.random) {
    const legal = legalCards(state, player);
    if (!legal.length) return { type: 'draw' };
    if (state.pending > 0) {
      const mirrors = legal.filter(card => card.v === 'mirror');
      const plus = legal.filter(card => has(PLUS, card.v));
      if (mirrors.length && state.pending >= 4 && (!plus.length || random() < 0.85)) legal.splice(0, legal.length, ...mirrors);
      else if (plus.length) legal.splice(0, legal.length, ...plus);
      else return { type: 'draw' };
    } else if (state.mode === 'maldita' && player.hand.length > 1) {
      const safe = legal.filter(card => card.c !== state.cursedColor);
      if (safe.length) legal.splice(0, legal.length, ...safe);
    }
    const shields = legal.filter(card => card.v === 'shield');
    if (!player.shield && shields.length) legal.splice(0, legal.length, ...shields);
    const nonWild = legal.filter(card => card.c !== 'w');
    const pool = nonWild.length ? nonWild : legal;
    const card = pool[randomIndex(pool.length, random)];
    const action = { type: 'play', cardId: card.id };
    if (card.c === 'w' && card.v !== 'eye') {
      const counts = Object.fromEntries(COLORS.map(color => [color, 0]));
      player.hand.forEach(item => { if (item.id !== card.id && item.c !== 'w') counts[item.c] += 1; });
      action.color = COLORS.slice().sort((a, b) => counts[b] - counts[a])[0];
    }
    if (card.v === 'eye') {
      const others = state.players.filter(item => item.id !== player.id);
      action.targetId = others[randomIndex(others.length, random)]?.id;
    }
    if (player.hand.length === 2 && random() < 0.9) player.called = true;
    return action;
  }

  function botMove(state, options = {}) {
    if (!state || state.phase !== 'playing' || state.paused || (state.collapse && state.collapse.status !== 'complete')) return false;
    const player = state.players[state.turn];
    if (!player || !player.bot) return false;
    const action = chooseBotAction(state, player, options.random || state.random || Math.random);
    const result = act(state, player.id, action, options);
    if (result && result !== 'Ação desconhecida') {
      const fallback = act(state, player.id, { type: state.drawnId ? 'pass' : 'draw' }, options);
      return fallback === null;
    }
    return result === null;
  }

  function summary(state, viewerId = 'you', spectator = false) {
    const viewer = state.players.find(player => player.id === viewerId);
    const winner = state.players.find(player => player.id === state.winner);
    const teamWon = viewer && viewer.team != null && state.winnerTeam === viewer.team;
    return {
      mode: state.mode,
      complete: state.phase === 'ended',
      roundComplete: state.phase === 'betweenRounds' || state.phase === 'ended',
      won: !spectator && (viewer?.id === (state.mode === 'tournament' && !state.tournament.finished ? state.tournament.roundWinner : state.winner) || teamWon),
      spectator: Boolean(spectator),
      winner: winner?.name || (state.winnerTeam != null ? teamLabel(state.winnerTeam) : 'Sem vencedor'),
      tournament: state.mode === 'tournament' ? {
        round: state.tournament.round,
        maxRounds: state.tournament.maxRounds,
        finished: state.tournament.finished,
        champion: state.tournament.champion,
        scores: tournamentResults(state),
      } : null,
      turns: state.turnCount,
      played: spectator ? state.players.reduce((sum, player) => sum + player.stats.played, 0) : (viewer?.stats.played || 0),
      drawn: spectator ? state.players.reduce((sum, player) => sum + player.stats.drawn, 0) : (viewer?.stats.drawn || 0),
      chroma: spectator ? state.players.reduce((sum, player) => sum + player.stats.chroma, 0) : (viewer?.stats.chroma || 0),
      bestSpecial: spectator ? Math.max(0, ...state.players.map(player => player.stats.bestSpecial)) : (viewer?.stats.bestSpecial || 0),
      durationMs: state.roundStats.durationMs || Math.max(0, Date.now() - state.roundStats.startedAt),
    };
  }

  const api = {
    COLORS, COLOR_NAMES, PLUS, MODES, TURN_SECONDS, MALDITA_TURNOS, EVENTOS_TURNOS,
    makeDeck, createMatch, startRound, nextTournamentRound, beginTurn, isLegal, legalCards, drawCards, drawForced,
    act, advance, resolveExpiredTurn, resolveSuperChaosCollapse, completeSuperChaosCollapse, removePlayer, pause, resume, cardName,
    chooseBotAction, botMove, summary, playerAt, teamLabel,
  };
  root.ChromaGameEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
