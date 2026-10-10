(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const tutorialSteps = [
    { kicker: 'FUNDAMENTO', title: 'Combine cor, número ou símbolo', text: 'Na sua vez, jogue uma carta que combine com a carta da mesa pela cor, pelo número ou pela ação. Se não tiver jogada válida, compre uma carta.', example: '<span class="cd c-r" style="--cw:54px"><b class="v">7</b></span><span>Vermelho 7 combina com uma carta vermelha ou outro 7.</span>' },
    { kicker: 'CARTAS DE AÇÃO', title: 'Mude o ritmo da rodada', text: 'Bloqueio pula a próxima vez; Inverter troca o sentido; +2 e Coringa +4 fazem o próximo jogador comprar, conforme as regras da mesa.', example: '<span class="cd c-b" style="--cw:54px"><b class="v">↻</b></span><span>Leia o símbolo e o efeito antes de jogar.</span>' },
    { kicker: 'CHROMA!', title: 'Avise quando ficar com uma carta', text: 'Ao ficar com uma carta na mão, use CHROMA! para sinalizar. Esquecer o aviso pode gerar uma penalidade, dependendo das regras da partida.', example: '<span class="tutorial-chip">1 carta</span><span>O aviso comunica um estado importante; não depende só da cor.</span>' },
    { kicker: 'ESPECIAL · ESCUDO', title: 'Absorva uma compra forçada', text: 'O Escudo colorido protege contra uma compra forçada elegível, como +2 ou Chuva de cartas. Depois de absorver, ele desaparece e a vez é encerrada.', example: '<span class="special-card"><svg aria-hidden="true"><use href="#i-shield"/></svg></span><span>Limite de um Escudo ativo por jogador.</span>' },
    { kicker: 'ESPECIAL · ESPELHO', title: 'Devolva o acúmulo', text: 'O Espelho é coringa: escolha uma cor ao jogá-lo. Com acúmulo ativo, ele devolve a compra ao jogador anterior sem inverter o sentido.', example: '<span class="special-card mirror-card"><svg aria-hidden="true"><use href="#i-mirror"/></svg></span><span>Sem acúmulo, funciona como um Coringa comum.</span>' },
    { kicker: 'MODOS DE EVENTO', title: 'Adapte-se às regras da mesa', text: 'Cor Maldita pode penalizar quem joga uma carta da cor marcada; Eventos Aleatórios introduz efeitos periódicos. Ambos são não ranqueados na referência.', example: '<span class="tutorial-chip">COR MALDITA</span><span class="tutorial-chip">EVENTOS ALEATÓRIOS</span>' },
  ];
  function renderMissions() {
    const shortcut = $('#missionShortcut');
    if (shortcut) shortcut.textContent = 'Indisponível';
  }

  let tutorialIndex = 0;
  let spectatorMode = false;
  let nextGameIsSpectator = false;
  let lastReactionAt = 0;
  let reactionTimer = 0;


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
    const seconds = Math.max(0, Math.floor((Number(summary?.durationMs) || 0) / 1000));
    const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('#quickMenu').hidden = true;
    $('#quickOpen').setAttribute('aria-expanded', 'false');
    $('#endTitle').textContent = tournament
      ? tournament.finished ? 'Torneio encerrado!' : `Rodada ${tournament.round} de ${tournament.maxRounds} concluída`
      : complete ? (summary.won ? 'Vitória!' : 'Rodada concluída') : 'Resumo parcial';
    $('#endCopy').textContent = tournament
      ? tournament.finished ? `Campeão: ${summary.winner} · classificação final após ${tournament.maxRounds} rodadas.` : `Vencedor desta rodada: ${summary.winner} · pontos acumulados preservados para a próxima partida.`
      : complete ? `${summary.won ? 'Você venceu' : `Vencedor: ${summary.winner}`} · ${modeName}. O histórico de jogo disponível é local ou sincronizado por conta e não é verificado competitivamente.`
        : `Partida em andamento · ${modeName}. Este resumo parcial não atualiza estatísticas.`;
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

  function addProfileLinks() {
    const profile = $('#prof');
    if (!profile || $('.profile-links', profile)) return;
    profile.insertAdjacentHTML('beforeend', `<div class="profile-links" aria-label="Categorias do perfil"><button type="button" data-go="inventory"><span>Coleção</span><b id="profileCollectionLinkCount">0 itens</b></button><button type="button" data-go="achievements"><span>Conquistas</span><b>Ver marcos</b></button><button type="button" data-go="rewards"><span>Recompensas</span><b>Diárias e correio indisponíveis</b></button></div>`);
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-go]');
    if (nav) {
      if (nav.dataset.go === 'game') {
        spectatorMode = nextGameIsSpectator;
        nextGameIsSpectator = false;
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
})();
