const test = require('node:test')
const assert = require('node:assert/strict')
const Game = require('../src/features/chroma-game-engine.js')

const card = (id, c, v) => ({ id, c, v })
const now = () => 1_000_000
const random = () => 0

function make(mode = 'classic', stack = false, playerCount = 4) {
  const state = Game.createMatch({ mode, stack, playerCount, random, now, turnSeconds: 15 })
  state.turn = 0
  state.direction = 1
  state.pending = 0
  state.drawnId = null
  state.vulnerable = null
  state.turnCount = 0
  state.discard = [card('top', 'r', '5')]
  state.color = 'r'
  state.players.forEach((player) => {
    player.hand = [card(`${player.id}-keep`, 'b', '8')]
    player.called = false
    player.shield = false
  })
  return state
}

test('os modos mantêm as cartas especiais por configuração e Espelho depende do acúmulo', () => {
  const maldita = Game.makeDeck('maldita', false, true)
  assert.equal(maldita.filter((item) => item.v === 'shield').length, 4)
  assert.equal(maldita.filter((item) => item.v === 'mirror').length, 4)
  assert.equal(Game.makeDeck('maldita', false, false).filter((item) => item.v === 'mirror').length, 0)
  assert.equal(Game.makeDeck('classic', false, true).filter((item) => item.v === 'shield').length, 0)
  assert.equal(Game.makeDeck('caos', false, false).filter((item) => item.v === '+10').length, 4)
  assert.equal(Game.makeDeck('supercaos', false, false).filter((item) => item.v === '+99').length, 2)
})

test('Super Caos sorteia qualquer jogador para +150 ao ultrapassar o limite e encerra a cadeia', () => {
  const state = make('supercaos', true, 4)
  state.pending = 149
  state.players[0].hand = [card('threshold-plus-two', 'r', '+2'), card('host-keep', 'b', '8')]
  state.players[1].hand = [card('next-normal', 'r', '7'), card('next-keep', 'b', '8')]

  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'threshold-plus-two' }, { now, random: () => 0.75 }), null)
  assert.equal(state.pending, 151)
  assert.equal(state.collapse.status, 'awaiting')
  assert.equal(state.collapse.accumulated, 151)
  assert.equal(state.players[3].stats.drawn, 0)
  assert.match(Game.act(state, 'bot-1', { type: 'draw' }), /Colapso/)
  assert.equal(Game.resolveExpiredTurn(state, state.turnEpoch, { now }), false)
  const collapseId = state.collapse.id
  assert.equal(Game.resolveSuperChaosCollapse(state, collapseId, { random: () => 0.75 }), true)
  assert.equal(state.pending, 0)
  assert.equal(state.players[3].stats.drawn, 150)
  assert.equal(state.players[3].hand.length, 151)
  assert.equal(state.turn, 1)
  assert.equal(Game.legalCards(state, state.players[1]).some((item) => item.id === 'next-normal'), true)
  assert.equal(state.log.some((message) => message.includes('COLAPSO!') && message.includes('Mei') && message.includes('+150')), true)
  assert.equal(Game.resolveSuperChaosCollapse(state, collapseId, { random: () => 0 }), false)
  assert.match(Game.act(state, 'bot-1', { type: 'draw' }), /Colapso/)
  assert.equal(Game.completeSuperChaosCollapse(state, collapseId, now), true)
  assert.equal(Game.completeSuperChaosCollapse(state, collapseId, now), false)
  assert.equal(state.collapse.status, 'complete')
})

test('Super Caos também colapsa quando +99 atinge exatamente 150', () => {
  const state = make('supercaos', true, 4)
  state.pending = 51
  state.players[0].hand = [card('threshold-plus-99', 'w', '+99'), card('host-keep', 'b', '8')]

  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'threshold-plus-99', color: 'g' }, { now, random: () => 0 }), null)
  assert.equal(state.pending, 150)
  assert.equal(state.collapse.status, 'awaiting')
  assert.equal(state.players[0].stats.drawn, 0)
  assert.equal(Game.resolveSuperChaosCollapse(state, state.collapse.id, { random: () => 0 }), true)
  assert.equal(state.pending, 0)
  assert.equal(state.players[0].stats.drawn, 150)
  assert.equal(state.players[0].hand.length, 151)
  assert.equal(state.turn, 1)
  assert.equal(state.log.some((message) => message.includes('COLAPSO!') && message.includes('Você') && message.includes('150')), true)
})

test('o Escudo ainda absorve o +150 depois do sorteio e a resolução não se duplica', () => {
  const state = make('supercaos', true, 4)
  state.pending = 149
  state.players[2].shield = true
  state.players[0].hand = [card('threshold-plus-two-shield', 'r', '+2'), card('host-keep', 'b', '8')]
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'threshold-plus-two-shield' }, { now }), null)
  const collapseId = state.collapse.id
  assert.equal(Game.resolveSuperChaosCollapse(state, collapseId, { random: () => 0.5 }), true)
  assert.equal(state.players[2].shield, false)
  assert.equal(state.players[2].stats.drawn, 0)
  assert.equal(state.players[2].hand.length, 1)
  assert.match(state.log.at(-1), /foi sorteado e teve a punição absorvida pelo Escudo/)
  assert.equal(Game.resolveSuperChaosCollapse(state, collapseId, { random: () => 0.5 }), false)
})

test('pausar durante o colapso preserva a partida e devolve um turno completo ao retomar', () => {
  const state = make('supercaos', true, 4)
  state.pending = 149
  state.players[0].hand = [card('pause-collapse-plus-two', 'r', '+2'), card('host-keep', 'b', '8')]
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'pause-collapse-plus-two' }, { now, random: () => 0 }), null)
  const collapseId = state.collapse.id
  assert.equal(Game.pause(state, () => 1_004_000), true)
  assert.equal(state.remainingTurnMs, 11000)
  assert.equal(Game.resolveSuperChaosCollapse(state, collapseId, { random: () => 0.5 }), true)
  assert.equal(Game.completeSuperChaosCollapse(state, collapseId, () => 1_007_000), true)
  assert.equal(state.remainingTurnMs, 15000)
  assert.equal(Game.resume(state, () => 1_020_000), true)
  assert.equal(state.turnEndsAt, 1_035_000)
  assert.equal(state.paused, false)
})

test('Bloqueio e Inverter avançam corretamente; Inverter em dois jogadores devolve a vez', () => {
  const four = make('classic', false, 4)
  four.players[0].hand = [card('skip', 'r', 'skip'), card('spare', 'b', '8')]
  assert.equal(Game.act(four, 'you', { type: 'play', cardId: 'skip' }), null)
  assert.equal(four.turn, 2)
  assert.equal(four.turnCount, 1)

  const two = make('classic', false, 2)
  two.players[0].hand = [card('reverse', 'r', 'rev'), card('spare2', 'b', '8')]
  assert.equal(Game.act(two, 'you', { type: 'play', cardId: 'reverse' }), null)
  assert.equal(two.direction, -1)
  assert.equal(two.turn, 0)
})

test('a compra normal libera somente a carta comprada; passar consome o turno', () => {
  const state = make()
  state.players[0].hand = [card('old-legal', 'r', '6'), card('spare', 'b', '8')]
  const drawn = card('drawn-legal', 'r', '9')
  state.draw = [drawn]
  assert.equal(Game.act(state, 'you', { type: 'draw' }), null)
  assert.equal(state.drawnId, drawn.id)
  assert.deepEqual(Game.legalCards(state, state.players[0]).map((item) => item.id), [drawn.id])
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'old-legal' }), 'Jogue a carta comprada ou passe a vez')
  assert.equal(Game.act(state, 'you', { type: 'pass' }), null)
  assert.equal(state.drawnId, null)
  assert.equal(state.turn, 1)
})

test('um Coringa +4 não pode ser usado com a cor atual na mão; Coringa exige escolha de cor', () => {
  const state = make()
  const plus4 = card('plus-four', 'w', '+4')
  state.players[0].hand = [plus4, card('red-keep', 'r', '2')]
  assert.equal(Game.isLegal(state, state.players[0], plus4), false)
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: plus4.id, color: 'g' }), 'Essa carta não pode ser jogada agora')

  state.players[0].hand = [card('wild', 'w', 'wild'), card('keep', 'b', '2')]
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'wild' }), 'Escolha uma cor')
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'wild', color: 'g' }), null)
  assert.equal(state.color, 'g')
})

test('acúmulo +2 é absorvido pelo Escudo e a vez é encerrada sem cartas', () => {
  const state = make('maldita', true)
  state.players[0].hand = [card('plus-two', 'r', '+2'), card('spare', 'b', '8')]
  state.players[1].hand = [card('p1-card', 'g', '3'), card('p1-card2', 'b', '4')]
  state.players[1].shield = true
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'plus-two' }), null)
  assert.equal(state.pending, 2)
  assert.equal(state.turn, 1)
  assert.equal(Game.act(state, 'bot-1', { type: 'draw' }), null)
  assert.equal(state.pending, 0)
  assert.equal(state.players[1].shield, false)
  assert.equal(state.players[1].hand.length, 2)
  assert.equal(state.turn, 2)
})

test('Espelho devolve todo o acúmulo ao jogador anterior sem inverter o sentido', () => {
  const state = make('maldita', true)
  state.cursedColor = 'g'
  state.players[0].hand = [card('plus-two', 'r', '+2'), card('host-keep', 'b', '8')]
  state.players[1].hand = [card('mirror', 'w', 'mirror'), card('bot-keep', 'g', '8')]
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'plus-two' }), null)
  assert.equal(Game.act(state, 'bot-1', { type: 'play', cardId: 'mirror', color: 'g' }), null)
  assert.equal(state.turn, 0)
  assert.equal(state.pending, 2)
  assert.equal(state.direction, 1)
  state.players[0].shield = true
  assert.equal(Game.act(state, 'you', { type: 'draw' }), null)
  assert.equal(state.pending, 0)
  assert.equal(state.players[0].shield, false)
  assert.equal(state.players[0].hand.length, 1)
})

test('Cor Maldita cobra uma carta após o efeito, mas não cobra a última carta vencedora', () => {
  const state = make('maldita')
  state.cursedColor = 'r'
  state.players[0].hand = [card('cursed', 'r', '7'), card('keep', 'b', '8')]
  state.draw = [card('penalty', 'g', '3')]
  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'cursed' }), null)
  assert.equal(state.players[0].hand.length, 2)
  assert.equal(state.players[0].stats.drawn, 1)

  const last = make('maldita')
  last.cursedColor = 'r'
  last.players[0].hand = [card('last-cursed', 'r', '9')]
  last.draw = [card('not-drawn', 'g', '3')]
  assert.equal(Game.act(last, 'you', { type: 'play', cardId: 'last-cursed' }), null)
  assert.equal(last.phase, 'ended')
  assert.equal(last.winner, 'you')
  assert.equal(last.players[0].stats.drawn, 0)
})

test('timeout consome uma única época e exatamente o acúmulo existente', () => {
  const state = make()
  state.pending = 4
  state.draw = Array.from({ length: 10 }, (_, index) => card(`penalty-${index}`, 'g', '2'))
  const epoch = state.turnEpoch
  assert.equal(Game.resolveExpiredTurn(state, epoch, { now }), true)
  assert.equal(state.players[0].hand.length, 5)
  assert.equal(state.pending, 0)
  assert.equal(Game.resolveExpiredTurn(state, epoch, { now }), false)
  assert.equal(state.players[0].hand.length, 5)
})

test('saída de quem está no turno avança época/contagem, aplica eventos e limpa carta comprada obsoleta', () => {
  const state = make('eventos', false, 4)
  state.turn = 1
  state.turnCount = 5
  state.nextEventAt = 6
  state.pending = 0
  state.drawnId = state.players[1].hand[0].id
  state.turnEpoch = 10
  const oldHand = state.players[1].hand.slice()
  assert.equal(Game.removePlayer(state, 'bot-1', { now, random }), true)
  assert.equal(state.players[state.turn].id, 'bot-2')
  assert.equal(state.turnCount, 6)
  assert.equal(state.turnEpoch, 11)
  assert.equal(state.drawnId, null)
  assert.equal(state.lastEvent, 'rain')
  assert.equal(state.players.some((player) => player.hand === oldHand), false)
})

test('sair no sentido anti-horário escolhe a pessoa anterior como novo turno', () => {
  const state = make('classic', false, 4)
  state.direction = -1
  state.turn = 2
  assert.equal(Game.removePlayer(state, 'bot-2', { now, random }), true)
  assert.equal(state.players[state.turn].id, 'bot-1')
  assert.equal(state.turnEpoch, 2)
})

test('quando sobra uma pessoa, a partida encerra e limpa compra, carta comprada e relógio', () => {
  const state = make('classic', false, 2)
  state.pending = 4
  state.drawnId = null
  state.vulnerable = 'bot-1'
  state.turnEndsAt = 1_234_567
  assert.equal(Game.removePlayer(state, 'bot-1', { now }), true)
  assert.equal(state.phase, 'ended')
  assert.equal(state.winner, 'you')
  assert.equal(state.pending, 0)
  assert.equal(state.drawnId, null)
  assert.equal(state.vulnerable, null)
  assert.equal(state.turnEndsAt, 0)
})

test('pausar e retomar preserva mão, turno, acúmulo e tempo restante', () => {
  const state = make('maldita', true)
  state.pending = 6
  state.drawnId = null
  state.turnEndsAt = 1_009_000
  const hand = state.players[0].hand.slice()
  assert.equal(Game.pause(state, now), true)
  assert.equal(state.paused, true)
  assert.equal(Game.act(state, 'you', { type: 'draw' }), 'A partida não está em andamento')
  assert.equal(Game.resume(state, () => 1_002_000), true)
  assert.equal(state.paused, false)
  assert.equal(state.turnEndsAt, 1_011_000)
  assert.equal(state.pending, 6)
  assert.deepEqual(state.players[0].hand, hand)
})

test('ações repetidas com o mesmo identificador não removem duas cartas', () => {
  const state = make()
  state.players[0].hand = [card('play-once', 'r', '7'), card('keep', 'b', '8')]
  const action = { type: 'play', cardId: 'play-once', _id: 'event-1' }
  assert.equal(Game.act(state, 'you', action), null)
  const remaining = state.players[0].hand.length
  assert.equal(Game.act(state, 'you', action), null)
  assert.equal(state.players[0].hand.length, remaining)
})

test('Torneio soma pontos por colocação e mantém o placar ao iniciar a rodada seguinte', () => {
  const state = Game.createMatch({ mode: 'tournament', playerCount: 4, random, now })
  state.turn = 0
  state.discard = [card('top', 'r', '5')]
  state.color = 'r'
  state.players[0].hand = [card('round-1-win', 'r', '7')]
  state.players[1].hand = [card('d1', 'b', '8'), card('d2', 'g', '8'), card('d3', 'y', '8')]
  state.players[2].hand = [card('k1', 'b', '8'), card('k2', 'g', '8')]
  state.players[3].hand = Array.from({ length: 5 }, (_, i) => card(`m${i}`, 'b', '8'))

  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'round-1-win' }), null)
  assert.equal(state.phase, 'betweenRounds')
  assert.equal(state.tournament.round, 1)
  assert.deepEqual(state.tournament.scores, { you: 100, 'bot-2': 75, 'bot-1': 55, 'bot-3': 40 })
  const result = Game.summary(state)
  assert.equal(result.roundComplete, true)
  assert.equal(result.complete, false)
  assert.equal(result.won, true)
  assert.equal(result.tournament.round, 1)

  assert.equal(Game.nextTournamentRound(state, { now, random }), true)
  assert.equal(state.phase, 'playing')
  assert.equal(state.tournament.round, 2)
  assert.equal(state.players[0].hand.length, 7)
  assert.deepEqual(state.tournament.scores, { you: 100, 'bot-2': 75, 'bot-1': 55, 'bot-3': 40 })
})

test('a quinta rodada encerra o Torneio e escolhe o campeão pelo placar acumulado', () => {
  const state = Game.createMatch({ mode: 'tournament', playerCount: 4, random, now })
  state.tournament.round = 5
  state.tournament.scores = { you: 0, 'bot-1': 500, 'bot-2': 300, 'bot-3': 200 }
  state.turn = 0
  state.discard = [card('top', 'r', '5')]
  state.color = 'r'
  state.players[0].hand = [card('last-round-win', 'r', '7')]
  state.players[1].hand = [card('d1', 'b', '8'), card('d2', 'g', '8'), card('d3', 'y', '8')]
  state.players[2].hand = [card('k1', 'b', '8'), card('k2', 'g', '8')]
  state.players[3].hand = Array.from({ length: 5 }, (_, i) => card(`m${i}`, 'b', '8'))

  assert.equal(Game.act(state, 'you', { type: 'play', cardId: 'last-round-win' }), null)
  assert.equal(state.phase, 'ended')
  assert.equal(state.tournament.finished, true)
  assert.equal(state.tournament.round, 5)
  assert.equal(state.winner, 'bot-1')
  assert.equal(Game.summary(state).winner, 'Dante')
  assert.equal(Game.summary(state).won, false)
  assert.equal(Game.nextTournamentRound(state), false)
})

test('criar uma partida com roster explícito preserva vagas vazias sem adicionar bots', () => {
  const state = Game.createMatch({
    mode: 'classic',
    players: [{ id: 'you', name: 'Você', bot: false }, { id: 'friend-1', name: 'Amigo', bot: false }],
    random,
    now,
  })
  assert.deepEqual(state.players.map(player => ({ id: player.id, bot: player.bot })), [
    { id: 'you', bot: false },
    { id: 'friend-1', bot: false },
  ])
  assert.equal(state.players.length, 2)
})
