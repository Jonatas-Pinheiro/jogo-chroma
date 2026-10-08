(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEY = 'chroma-rework-preview-v1';
  const TODAY = localDateKey(new Date());
  const WEEK = localWeekKey(new Date());

  function localDateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function localWeekKey(date) {
    const monday = new Date(date);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return localDateKey(monday);
  }

  function emptyState() {
    return {
      day: TODAY,
      week: WEEK,
      daily: { played: 0, wins: 0, friends: 0, claimed: [] },
      weekly: { friends: 0, events: 0, claimed: [] },
      dailyRewardClaimed: false,
      equipped: 'Veio dourado',
    };
  }

  function loadState() {
    let state;
    try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { state = null; }
    if (!state || typeof state !== 'object') state = emptyState();
    if (state.day !== TODAY) {
      state.day = TODAY;
      state.daily = { played: 0, wins: 0, friends: 0, claimed: [] };
      state.dailyRewardClaimed = false;
    }
    if (state.week !== WEEK) {
      state.week = WEEK;
      state.weekly = { friends: 0, events: 0, claimed: [] };
    }
    state.daily ||= { played: 0, wins: 0, friends: 0, claimed: [] };
    state.weekly ||= { friends: 0, events: 0, claimed: [] };
    state.daily.claimed ||= [];
    state.weekly.claimed ||= [];
    state.equipped ||= 'Veio dourado';
    saveState(state);
    return state;
  }

  function saveState(next = state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* A prévia continua utilizável sem armazenamento. */ }
  }

  let state = loadState();
  let tutorialIndex = 0;
  let spectatorMode = false;
  let nextGameIsSpectator = false;
  let roundRecorded = false;
  let lastReactionAt = 0;
  let reactionTimer = 0;

  const dailyMissions = [
    { id: 'daily-play', title: 'Jogue 1 partida', detail: 'Qualquer modo de jogo', stat: 'played', goal: 1, reward: 20, symbol: '1' },
    { id: 'daily-win', title: 'Vença 1 partida', detail: 'Uma vitória nesta prévia', stat: 'wins', goal: 1, reward: 40, symbol: 'V' },
    { id: 'daily-friend', title: 'Jogue 1 partida com amigo', detail: 'Partida com um amigo de demonstração', stat: 'friends', goal: 1, reward: 30, symbol: '2' },
  ];
  const weeklyMissions = [
    { id: 'weekly-friends', title: 'Jogue 3 partidas com amigos', detail: 'Acumule partidas sociais na semana', stat: 'friends', goal: 3, reward: 100, symbol: '3' },
    { id: 'weekly-events', title: 'Jogue 2 partidas de evento', detail: 'Experimente o modo Eventos Aleatórios', stat: 'events', goal: 2, reward: 80, symbol: 'E' },
  ];

  const tutorialSteps = [
    { kicker: 'FUNDAMENTO', title: 'Combine cor, número ou símbolo', text: 'Na sua vez, jogue uma carta que combine com a carta da mesa pela cor, pelo número ou pela ação. Se não tiver jogada válida, compre uma carta.', example: '<span class="cd c-r" style="--cw:54px"><b class="v">7</b></span><span>Vermelho 7 combina com uma carta vermelha ou outro 7.</span>' },
    { kicker: 'CARTAS DE AÇÃO', title: 'Mude o ritmo da rodada', text: 'Bloqueio pula a próxima vez; Inverter troca o sentido; +2 e Coringa +4 fazem o próximo jogador comprar, conforme as regras da mesa.', example: '<span class="cd c-b" style="--cw:54px"><b class="v">↻</b></span><span>Leia o símbolo e o efeito antes de jogar.</span>' },
    { kicker: 'CHROMA!', title: 'Avise quando ficar com uma carta', text: 'Ao ficar com uma carta na mão, use CHROMA! para sinalizar. Esquecer o aviso pode gerar uma penalidade, dependendo das regras da partida.', example: '<span class="tutorial-chip">1 carta</span><span>O aviso comunica um estado importante; não depende só da cor.</span>' },
    { kicker: 'ESPECIAL · ESCUDO', title: 'Absorva uma compra forçada', text: 'O Escudo colorido protege contra uma compra forçada elegível, como +2 ou Chuva de cartas. Depois de absorver, ele desaparece e a vez é encerrada.', example: '<span class="special-card"><svg aria-hidden="true"><use href="#i-shield"/></svg></span><span>Limite de um Escudo ativo por jogador.</span>' },
    { kicker: 'ESPECIAL · ESPELHO', title: 'Devolva o acúmulo', text: 'O Espelho é coringa: escolha uma cor ao jogá-lo. Com acúmulo ativo, ele devolve a compra ao jogador anterior sem inverter o sentido.', example: '<span class="special-card mirror-card"><svg aria-hidden="true"><use href="#i-mirror"/></svg></span><span>Sem acúmulo, funciona como um Coringa comum.</span>' },
    { kicker: 'MODOS DE EVENTO', title: 'Adapte-se às regras da mesa', text: 'Cor Maldita pode penalizar quem joga uma carta da cor marcada; Eventos Aleatórios introduz efeitos periódicos. Ambos são não ranqueados na referência.', example: '<span class="tutorial-chip">COR MALDITA</span><span class="tutorial-chip">EVENTOS ALEATÓRIOS</span>' },
  ];

  function toast(message, type) {
    window.chromaToast?.(message, type);
  }

  function progress(mission, bucket) {
    return Math.min(mission.goal, Number(state[bucket][mission.stat]) || 0);
  }

  function missionMarkup(mission, bucket) {
    const value = progress(mission, bucket);
    const claimed = state[bucket].claimed.includes(mission.id);
    const complete = value >= mission.goal;
    const percentage = Math.round((value / mission.goal) * 100);
    const buttonLabel = claimed ? 'Coletada' : complete ? 'Coletar' : 'Em andamento';
    return `<article class="mission-item"><span class="mission-symbol" aria-hidden="true">${mission.symbol}</span><div class="mission-copy"><b>${mission.title}</b><small>${mission.detail}</small><i class="mission-track" role="progressbar" aria-label="Progresso: ${mission.title}" aria-valuemin="0" aria-valuemax="${mission.goal}" aria-valuenow="${value}"><i style="width:${percentage}%"></i></i><div class="mission-meta"><span>${value}/${mission.goal}</span><strong>+${mission.reward} moedas</strong></div></div><button class="btn sec" data-claim-mission="${mission.id}" data-bucket="${bucket}" ${(!complete || claimed) ? 'disabled' : ''}>${buttonLabel}</button></article>`;
  }

  function renderMissions() {
    const daily = $('#dailyMissionList');
    const weekly = $('#weeklyMissionList');
    if (daily) daily.innerHTML = dailyMissions.map(m => missionMarkup(m, 'daily')).join('');
    if (weekly) weekly.innerHTML = weeklyMissions.map(m => missionMarkup(m, 'weekly')).join('');
    const all = [...dailyMissions.map(m => [m, 'daily']), ...weeklyMissions.map(m => [m, 'weekly'])];
    const done = all.filter(([m, bucket]) => progress(m, bucket) >= m.goal).length;
    const shortcut = $('#missionShortcut');
    if (shortcut) shortcut.textContent = `${done}/${all.length}`;
  }

  function renderTutorial() {
    const step = tutorialSteps[tutorialIndex];
    if (!step) return;
    $('#tutorialKicker').textContent = step.kicker;
    $('#tutorialTitle').textContent = step.title;
    $('#tutorialText').textContent = step.text;
    $('#tutorialExample').innerHTML = step.example;
    $('#tutorialCount').textContent = `${tutorialIndex + 1} / ${tutorialSteps.length}`;
    $('#tutorialFill').style.width = `${((tutorialIndex + 1) / tutorialSteps.length) * 100}%`;
    $('#tutorialPrev').disabled = tutorialIndex === 0;
    $('#tutorialNext').textContent = tutorialIndex === tutorialSteps.length - 1 ? 'CONCLUIR' : 'PRÓXIMO';
  }

  function syncSpectator() {
    const game = $('#game');
    if (!game) return;
    game.classList.toggle('spectator', spectatorMode);
    $('#spectatorBanner').hidden = !spectatorMode;
    $('#spectatorLog').hidden = !spectatorMode;
    $('#quickMenu').hidden = true;
    $('#quickOpen').setAttribute('aria-expanded', 'false');
    if (spectatorMode) $('#spectatorBanner').focus?.();
  }

  function renderRoundSummary(summary = window.chromaGame?.getSummary?.()) {
    if (spectatorMode || summary?.spectator) {
      $('#gameMessage').textContent = 'Espectadores acompanham a mesa; não há estatísticas pessoais para registrar.';
      return;
    }
    window.chromaHaptic?.('tap');
    const modeName = $('#tabs [aria-selected="true"]')?.textContent.trim() || 'Clássico';
    const complete = Boolean(summary?.complete);
    const roundComplete = Boolean(summary?.roundComplete);
    const tournament = summary?.tournament;
    if (roundComplete && !roundRecorded) {
      state.daily.played += 1;
      if (summary.won) state.daily.wins += 1;
      if (modeName === 'Eventos Aleatórios') state.weekly.events += 1;
      saveState();
      roundRecorded = true;
      renderMissions();
    }
    const seconds = Math.max(0, Math.floor((Number(summary?.durationMs) || 0) / 1000));
    const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('#quickMenu').hidden = true;
    $('#quickOpen').setAttribute('aria-expanded', 'false');
    $('#endTitle').textContent = tournament
      ? tournament.finished ? 'Torneio encerrado!' : `Rodada ${tournament.round} de ${tournament.maxRounds} concluída`
      : complete ? (summary.won ? 'Vitória!' : 'Rodada concluída') : 'Resumo parcial';
    $('#endCopy').textContent = tournament
      ? tournament.finished ? `Campeão: ${summary.winner} · classificação final após ${tournament.maxRounds} rodadas.` : `Vencedor desta rodada: ${summary.winner} · pontos acumulados preservados para a próxima partida.`
      : complete ? `${summary.won ? 'Você venceu' : `Vencedor: ${summary.winner}`} · ${modeName}. Resultado e missões ficam salvos somente nesta prévia local.`
        : `Partida em andamento · ${modeName}. Este resumo parcial não altera missões.`;
    $('#tourneyMeta').hidden = !tournament;
    $('#tourneyStandings').hidden = !tournament;
    if (tournament) {
      $('#tourneyMeta').textContent = tournament.finished ? 'CLASSIFICAÇÃO FINAL' : `PONTUAÇÃO ACUMULADA · PARTIDA ${tournament.round}/${tournament.maxRounds}`;
      $('#tourneyStandings').innerHTML = tournament.scores.map(player => `<li>${player.place}. ${player.name} · ${player.points} pts</li>`).join('');
    }
    const nextRound = Boolean(tournament && roundComplete && !tournament.finished);
    $('#nextRound').hidden = !nextRound;
    $('#endClose').hidden = nextRound;
    $('#endMissions').classList.toggle('btn-primary', !nextRound);
    $('#endMissions').classList.toggle('btn-secondary', nextRound);
    $('#endStats').innerHTML = [
      ['Duração', duration], ['Turnos', String(summary?.turns ?? 0)], ['Cartas jogadas', String(summary?.played ?? 0)],
      ['Cartas compradas', String(summary?.drawn ?? 0)], ['Avisos CHROMA!', String(summary?.chroma ?? 0)],
      ['Sequência especial', String(summary?.bestSpecial ?? 0)], ['Modo', modeName],
    ].map(([label, value]) => `<div><small>${label}</small><b>${value}</b></div>`).join('');
    $('#endOv').hidden = false;
    $('#endClose').focus();
  }

  function claimMission(id, bucket) {
    const catalog = bucket === 'weekly' ? weeklyMissions : dailyMissions;
    const mission = catalog.find(item => item.id === id);
    if (!mission || progress(mission, bucket) < mission.goal || state[bucket].claimed.includes(id)) return;
    window.chromaHaptic?.('tap');
    state[bucket].claimed.push(id);
    saveState();
    window.chromaPreview?.addCoins(mission.reward);
    renderMissions();
    toast(`+${mission.reward} moedas de demonstração · ${mission.title}`, 'success');
  }

  function addProfileLinks() {
    const profile = $('#prof');
    if (!profile || $('.profile-links', profile)) return;
    profile.insertAdjacentHTML('beforeend', `<div class="profile-links" aria-label="Categorias do perfil"><button data-go="inventory"><span>Coleção</span><b>12 / 40</b></button><button data-go="achievements"><span>Conquistas</span><b>Ver marcos</b></button><button data-go="rewards"><span>Recompensas e correio</span><b>Ver mensagens</b></button></div>`);
  }

  function restoreInventory() {
    const equipped = state.equipped;
    $$('#inventoryGrid [data-equip]').forEach(button => {
      const selected = button.dataset.equip === equipped;
      button.setAttribute('aria-pressed', String(selected));
      button.textContent = selected ? 'Equipado' : 'Equipar';
      button.closest('.inventory-item')?.classList.toggle('selected', selected);
    });
    const label = $('#equippedItem');
    if (label) {
      const type = equipped === 'Mineiro' ? 'avatar' : equipped === 'Galeria' ? 'mesa' : 'verso de carta';
      label.textContent = `${equipped} · ${type}`;
    }
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-go]');
    if (nav) {
      if (nav.dataset.go === 'game') {
        spectatorMode = nextGameIsSpectator;
        nextGameIsSpectator = false;
        roundRecorded = false;
        syncSpectator();
      }
      if (nav.dataset.go === 'missions') renderMissions();
      if (nav.dataset.go === 'tutorial') {
        tutorialIndex = 0;
        renderTutorial();
      }
      if (nav.dataset.go === 'prof') addProfileLinks();
    }
  });

  $('#tutorialPrev').addEventListener('click', () => {
    tutorialIndex = Math.max(0, tutorialIndex - 1);
    renderTutorial();
  });
  $('#tutorialNext').addEventListener('click', () => {
    if (tutorialIndex < tutorialSteps.length - 1) {
      tutorialIndex += 1;
      renderTutorial();
    } else {
      document.querySelector('#tutorial [data-go="home"]')?.click();
      toast('Tutorial concluído! O passo a passo não inicia uma sala online.', 'success');
    }
  });
  $('#tutorialSkip').addEventListener('click', () => document.querySelector('#tutorial [data-go="home"]')?.click());

  $('#watchStart').addEventListener('click', () => {
    nextGameIsSpectator = true;
    window.chromaGame?.setNextSpectator?.(true);
    $('#lobby [data-go="game"]')?.click();
  });

  $('#quickOpen').addEventListener('click', () => {
    const menu = $('#quickMenu');
    const open = menu.hidden;
    menu.hidden = !open;
    $('#quickOpen').setAttribute('aria-expanded', String(open));
    if (open) $('[data-reaction]', menu)?.focus();
  });
  $('#quickMenu').addEventListener('click', event => {
    const reaction = event.target.closest('[data-reaction]');
    if (reaction) {
      if (spectatorMode) { $('#gameMessage').textContent = 'Espectadores não enviam reações nesta prévia.'; return; }
      const now = Date.now();
      if (now - lastReactionAt < 1500) { $('#gameMessage').textContent = 'Aguarde um instante antes da próxima reação.'; return; }
      window.chromaHaptic?.('tap');
      lastReactionAt = now;
      const feedback = $('#emoteFeedback');
      feedback.replaceChildren();
      const source = reaction.dataset.emoteSrc || '';
      const allowedEmote = /^assets\/chroma-ui\/emotes\/style-1\/emote_[a-zA-Z0-9_]+\.png$/.test(source);
      if (allowedEmote) {
        const image = document.createElement('img');
        image.src = source;
        image.alt = '';
        image.setAttribute('aria-hidden', 'true');
        feedback.append(image);
      }
      const label = document.createElement('span');
      label.textContent = reaction.dataset.reaction;
      feedback.append(label);
      feedback.hidden = false;
      clearTimeout(reactionTimer);
      reactionTimer = setTimeout(() => { feedback.hidden = true; }, 4000);
      $('#quickMenu').hidden = true;
      $('#quickOpen').setAttribute('aria-expanded', 'false');
      $('#gameMessage').textContent = 'Reação enviada na mesa local.';
    }
    if (event.target.closest('#finishPreview')) {
      if (window.chromaGame?.showPartialSummary) window.chromaGame.showPartialSummary();
      else renderRoundSummary();
    }
  });

  $('#dailyMissionList').addEventListener('click', event => {
    const button = event.target.closest('[data-claim-mission]');
    if (button) claimMission(button.dataset.claimMission, 'daily');
  });
  $('#weeklyMissionList').addEventListener('click', event => {
    const button = event.target.closest('[data-claim-mission]');
    if (button) claimMission(button.dataset.claimMission, 'weekly');
  });

  $('#endClose').addEventListener('click', () => { window.chromaHaptic?.('tap'); $('#endOv').hidden = true; });
  $('#endMissions').addEventListener('click', () => {
    $('#endOv').hidden = true;
    document.querySelector('#home [data-go="missions"]')?.click();
  });
  $('#endOv').addEventListener('click', event => { if (event.target.id === 'endOv') $('#endOv').hidden = true; });
  $('#colorPick').addEventListener('click', event => { if (event.target.id === 'colorPick') $('#colorPick').hidden = true; });

  document.addEventListener('chroma-match-ended', event => renderRoundSummary(event.detail));
  document.addEventListener('chroma-match-summary', event => renderRoundSummary(event.detail));
  document.addEventListener('chroma-tournament-round-ended', event => renderRoundSummary(event.detail));
  document.addEventListener('chroma-tournament-next-round', () => { roundRecorded = false; });

  $('#missions').addEventListener('click', event => {
    const button = event.target.closest('[data-claim-mission]');
    if (button) claimMission(button.dataset.claimMission, button.dataset.bucket);
  });
  $('#inventoryGrid').addEventListener('click', event => {
    const button = event.target.closest('[data-equip]');
    if (!button) return;
    if (state.equipped !== button.dataset.equip) window.chromaHaptic?.('tap');
    state.equipped = button.dataset.equip;
    saveState();
    restoreInventory();
    toast(`${state.equipped} equipado nesta prévia.`, 'success');
  });

  $('#claimDaily').addEventListener('click', event => {
    if (state.dailyRewardClaimed) return;
    window.chromaHaptic?.('tap');
    state.dailyRewardClaimed = true;
    saveState();
    window.chromaPreview?.addCoins(75);
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'COLETADO';
    toast('+75 moedas de demonstração.', 'success');
  });
  $('#openEventMode').addEventListener('click', () => {
    $('[data-m="4"]', $('#tabs'))?.click();
    document.querySelector('#events [data-go="home"]')?.click();
    document.querySelector('#home [data-go="lobby"]')?.click();
  });

  document.addEventListener('chroma-demo-notice', event => {
    const detail = event.detail;
    if (detail && typeof detail === 'object') toast(detail.message, detail.type);
    else toast(detail);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      $('#endOv').hidden = true;
      $('#colorPick').hidden = true;
      $('#quickMenu').hidden = true;
      $('#quickOpen').setAttribute('aria-expanded', 'false');
    }
  });

  const tactileSwitch = $('#setBody .sw[data-k="vb"]');
  const tactilePreference = window.chromaHaptic?.getPreference?.();
  if (tactileSwitch && typeof tactilePreference === 'boolean') {
    tactileSwitch.setAttribute('aria-checked', String(tactilePreference));
    const status = $('span', tactileSwitch);
    if (status) status.textContent = tactilePreference ? 'Sim' : 'Não';
  }

  renderTutorial();
  renderMissions();
  addProfileLinks();
  restoreInventory();
  if (state.dailyRewardClaimed) {
    $('#claimDaily').disabled = true;
    $('#claimDaily').textContent = 'COLETADO';
  }
})();
