const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Engine = require('../src/features/chroma-game-engine.js')
const Meter = require('../src/features/chroma-chaos-meter.js')

const card = (id, c, v) => ({ id, c, v })
const now = () => 1_000_000
const randomZero = () => 0

function make(mode = 'supercaos', stack = true, playerCount = 4) {
  const state = Engine.createMatch({ mode, stack, playerCount, random: randomZero, now, turnSeconds: 15 })
  state.turn = 0
  state.direction = 1
  state.pending = 0
  state.drawnId = null
  state.vulnerable = null
  state.discard = [card('top', 'r', '5')]
  state.color = 'r'
  state.players.forEach(player => {
    player.hand = [card(`${player.id}-keep`, 'b', '8')]
    player.shield = false
  })
  return state
}

class ClassList {
  constructor() { this.values = new Set() }
  add(...names) { names.forEach(name => this.values.add(name)) }
  remove(...names) { names.forEach(name => this.values.delete(name)) }
  contains(name) { return this.values.has(name) }
  toggle(name, force) {
    if (force === undefined) force = !this.values.has(name)
    if (force) this.values.add(name); else this.values.delete(name)
    return force
  }
}

function fakeNode() {
  const nodes = new Map([
    ['.chaos-meter__value', { textContent: '' }],
    ['.chaos-meter__state', { textContent: '' }],
    ['.chaos-meter__fill', { style: { width: '' } }],
  ])
  const game = { dataset: {}, classList: new ClassList() }
  const row = { hidden: true }
  const element = {
    hidden: true,
    dataset: {},
    attributes: {},
    style: { setProperty(key, value) { this[key] = value } },
    classList: new ClassList(),
    ownerDocument: { body: { classList: new ClassList() } },
    parentElement: row,
    closest(selector) { return selector === '#game' ? game : selector === '.chaos-meter-row' ? row : null },
    querySelector(selector) { return nodes.get(selector) || null },
    setAttribute(key, value) { this.attributes[key] = String(value) },
    getAttribute(key) { return this.attributes[key] ?? null },
    get offsetWidth() { return 100 },
  }
  return { element, row, game, nodes, value: nodes.get('.chaos-meter__value'), state: nodes.get('.chaos-meter__state'), fill: nodes.get('.chaos-meter__fill') }
}

function fakeEnvironment({ quality = '', reducedMotion = false, bodyClasses = [] } = {}) {
  let clock = 0
  let nextId = 0
  const timers = new Map()
  const storage = new Map(quality ? [['chroma-quality', quality]] : [])
  const body = { classList: new ClassList() }
  body.classList.add(...bodyClasses)
  const environment = {
    document: { body },
    localStorage: { getItem(key) { return storage.get(key) || null } },
    matchMedia(query) { return { matches: reducedMotion && query.includes('prefers-reduced-motion') } },
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, due: clock + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  }
  function advance(ms) {
    const until = clock + ms
    while (true) {
      const item = [...timers.entries()].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]
      if (!item || item[1].due > until) break
      clock = item[1].due
      timers.delete(item[0])
      item[1].callback()
    }
    clock = until
  }
  return { environment, advance, timers }
}

function attach({ quality = '', bodyClasses = [] } = {}) {
  const nodes = fakeNode()
  const env = fakeEnvironment({ quality, bodyClasses })
  const meter = Meter.mount(nodes.element, { environment: env.environment })
  return { ...nodes, ...env, meter }
}

function meterSnapshot(state) {
  return { mode: state.mode, phase: state.phase, pending: state.pending, collapse: state.collapse, log: state.log.at(-1) || '' }
}

function play(state, value, pending = state.pending, random = randomZero) {
  state.pending = pending
  const color = value === '+4' || value === '+6' || value === '+99' ? 'w' : 'r'
  state.players[0].hand = [card(`attack-${value}`, color, value), card('host-keep', 'b', '8')]
  const action = { type: 'play', cardId: `attack-${value}` }
  if (color === 'w') action.color = 'g'
  return Engine.act(state, 'you', action, { now, random })
}

test('classificação do medidor cobre exatamente as cinco faixas e os limites adjacentes', () => {
  const cases = [
    [0, 'stable'], [19, 'stable'], [20, 'unstable'], [39, 'unstable'],
    [40, 'critical'], [79, 'critical'], [80, 'overload'], [149, 'overload'],
    [150, 'collapse'], [151, 'collapse'], [999, 'collapse'],
  ]
  for (const [pending, expected] of cases) assert.equal(Meter.bandFor(pending).key, expected, `pending=${pending}`)
  assert.deepEqual(Meter.BANDS.map(({ label, min, max }) => [label, min, max]), [
    ['ESTÁVEL', 0, 19], ['INSTÁVEL', 20, 39], ['CRÍTICO', 40, 79],
    ['SOBRECARGA', 80, 149], ['COLAPSO!', 150, Infinity],
  ])
})

test('a intensidade cresce gradualmente a partir de 60, sem alterar a faixa definida', () => {
  const view = attach()
  for (const [pending, intensity, level] of [[59, 'base', 'critical'], [60, 'rising', 'critical'], [100, 'high', 'overload'], [130, 'near-max', 'overload']]) {
    view.meter.update({ mode: 'supercaos', phase: 'playing', pending, log: `acúmulo ${pending}` })
    assert.equal(view.element.dataset.intensity, intensity, `intensidade em ${pending}`)
    assert.equal(view.element.dataset.level, level, `faixa em ${pending}`)
  }
})

test('integração real de +2, +4, +6, +10 e +99 atualiza pending, faixa, valor e impacto visual', () => {
  const cases = [
    { value: '+2', start: 0, expected: 2, level: 'stable' },
    { value: '+4', start: 18, expected: 22, level: 'unstable' },
    { value: '+6', start: 35, expected: 41, level: 'critical' },
    { value: '+10', start: 75, expected: 85, level: 'overload' },
    { value: '+99', start: 20, expected: 119, level: 'overload' },
  ]
  for (const item of cases) {
    const state = make()
    state.pending = item.start
    const view = attach()
    view.meter.update(meterSnapshot(state))
    assert.equal(play(state, item.value, item.start), null, `${item.value}: ação válida`)
    view.meter.update(meterSnapshot(state))
    assert.equal(state.pending, item.expected, `${item.value}: acúmulo real`)
    assert.equal(view.element.hidden, false)
    assert.equal(view.element.dataset.level, item.level, `${item.value}: faixa visual`)
    assert.equal(view.value.textContent, String(item.expected), `${item.value}: valor legível`)
    assert.equal(view.element.attributes['aria-valuenow'], String(item.expected))
    assert.equal(view.element.classList.contains('is-hit'), true, `${item.value}: microimpacto`)
    assert.equal(view.element.dataset.impact, item.value === '+99' ? 'heavy' : item.value === '+10' ? 'medium' : 'light')
  }
})

test('Espelho preserva o acúmulo real e dispara a onda visual do medidor', () => {
  const state = make()
  const view = attach()
  view.meter.update(meterSnapshot(state))
  assert.equal(play(state, '+99', 0), null)
  view.meter.update(meterSnapshot(state))
  assert.equal(state.pending, 99)

  state.players[1].hand = [card('mirror', 'w', 'mirror'), card('bot-keep', 'b', '8')]
  assert.equal(Engine.act(state, 'bot-1', { type: 'play', cardId: 'mirror', color: 'r' }, { now, random: randomZero }), null)
  view.meter.update(meterSnapshot(state))
  assert.equal(state.pending, 99)
  assert.equal(state.turn, 0)
  assert.equal(view.value.textContent, '99')
  assert.equal(view.element.classList.contains('is-wave'), true)
  assert.equal(view.element.dataset.impact, 'medium')
})

test('colapso exato encerra visualmente em COLAPSO!, libera a barra e volta para ESTÁVEL', () => {
  const state = make()
  const view = attach()
  state.log.push('pendência inicial')
  state.pending = 148
  view.meter.update(meterSnapshot(state))
  assert.equal(play(state, '+2', 148, () => 0.5), null)
  assert.equal(state.pending, 150)
  assert.equal(state.collapse.status, 'awaiting')
  assert.equal(state.players[2].stats.drawn, 0)
  view.meter.update(meterSnapshot(state))

  assert.equal(view.element.dataset.level, 'collapse')
  assert.equal(view.element.dataset.stage, 'charge')
  assert.equal(view.value.textContent, '150+')
  assert.equal(view.state.textContent, 'SOBRECARGA')
  assert.equal(view.fill.style.width, '100%')
  view.advance(150)
  assert.equal(view.element.dataset.stage, 'tension')
  view.advance(150)
  assert.equal(view.element.dataset.stage, 'rupture')
  view.advance(150)
  assert.equal(view.element.dataset.stage, 'collapse-label')
  assert.equal(view.state.textContent, 'COLAPSO!')
  assert.equal(state.players[2].stats.drawn, 0, 'a consequência não pode anteceder o texto de colapso')
  view.advance(250)
  assert.equal(Engine.resolveSuperChaosCollapse(state, state.collapse.id, { random: () => 0.5 }), true)
  assert.equal(state.pending, 0)
  assert.equal(state.players[2].stats.drawn, 150)
  view.meter.update(meterSnapshot(state))
  assert.equal(view.element.dataset.stage, 'consequence')
  assert.equal(view.value.textContent, '150+')
  assert.match(Engine.act(state, 'bot-1', { type: 'draw' }), /Colapso/)
  view.advance(400)
  assert.equal(view.element.dataset.stage, 'release')
  assert.equal(view.value.textContent, '0')
  assert.equal(view.fill.style.width, '0%')
  view.advance(399)
  assert.equal(view.element.dataset.stage, 'release')
  assert.equal(Engine.completeSuperChaosCollapse(state, state.collapse.id, now), true)
  view.meter.update(meterSnapshot(state))
  assert.equal(view.element.dataset.level, 'stable')
  assert.equal(view.state.textContent, 'ESTÁVEL')
  assert.equal(view.value.textContent, '0')
})

test('acúmulos acima de 150 aguardam a sequência visual e depois sorteiam um alvo para exatamente +150', () => {
  for (const [value, expectedAccumulation] of [['+2', 151], ['+10', 159], ['+99', 248]]) {
    const state = make()
    assert.equal(play(state, value, 149, () => 0.6), null)
    assert.equal(state.pending, expectedAccumulation, `${value}: valor pré-resolução ${expectedAccumulation}`)
    assert.equal(state.collapse.status, 'awaiting')
    assert.equal(state.collapse.accumulated, expectedAccumulation)
    assert.equal(state.players[2].stats.drawn, 0, `${value}: ainda sem consequência`)
    assert.equal(state.log.some(message => /COLAPSO!/i.test(message)), false, `${value}: texto ainda não resolvido`)
    assert.equal(Engine.resolveSuperChaosCollapse(state, state.collapse.id, { random: () => 0.6 }), true)
    assert.equal(state.pending, 0, `${value}: reset do acúmulo ${expectedAccumulation}`)
    assert.equal(state.players[2].stats.drawn, 150, `${value}: sorteio aleatório do jogador`)
    assert.match(state.log.at(-1), new RegExp(`Acúmulo de ${expectedAccumulation}.*COLAPSO!|COLAPSO!.*Acúmulo de ${expectedAccumulation}`))
    assert.ok(state.log.at(-1).includes('foi sorteado'))
    assert.equal(Engine.completeSuperChaosCollapse(state, state.collapse.id, now), true)
  }
})

test('o medidor só aparece em partidas Super Caos ativas, e ULTRA LEVE zera os efeitos extras', () => {
  const view = attach({ quality: 'ultra-leve' })
  view.meter.update({ mode: 'classic', phase: 'playing', pending: 40, log: 'Clássico' })
  assert.equal(view.element.hidden, true)
  assert.equal(view.row.hidden, true)
  view.meter.update({ mode: 'supercaos', phase: 'playing', pending: 80, log: 'Caos' })
  assert.equal(view.element.hidden, false)
  assert.equal(view.element.dataset.quality, 'ultra-leve')
  assert.equal(view.game.dataset.graphicsQuality, 'ultra-leve')
  assert.equal(view.game.classList.contains('chaos-overload'), true)
  view.meter.update({ mode: 'supercaos', phase: 'ended', pending: 0, log: 'Fim' })
  assert.equal(view.element.hidden, true)
  assert.equal(view.row.hidden, true)
  assert.equal(view.game.classList.contains('chaos-overload'), false)
})

test('partículas só são habilitadas no estado de Sobrecarga ou na ruptura, nunca em Estável', () => {
  const project = path.resolve(__dirname, '..')
  const css = fs.readFileSync(path.join(project, 'src/styles/chroma-chaos-meter.css'), 'utf8')
  assert.match(css, /data-level="overload"\]\[data-quality="padrao"\] \.chaos-meter__spark/)
  assert.match(css, /is-breaking:not\(\[data-quality="ultra-leve"\]\)/)
  assert.match(css, /#chaosMeter\[data-quality="ultra-leve"\] \.chaos-meter__spark \{ display: none !important; \}/)
  assert.match(css, /#chaosMeter\[data-quality="ultra-leve"\]\.is-hit \{[^}]*transform: none !important;/)
  assert.match(css, /#chaosMeter\[data-quality="ultra-leve"\]\.is-collapsing\[data-stage="tension"\] \{ transform: none !important;/)
  assert.match(css, /#chaosMeter\[data-quality="ultra-leve"\]\.is-wave \.chaos-meter__fill::before \{ display: none !important; animation: none !important;/)
  assert.match(css, /#chaosMeter\.is-hit\[data-impact="medium"\] \.chaos-meter__value,\s*#chaosMeter\.is-hit\[data-impact="heavy"\] \.chaos-meter__value \{\s*animation: chaos-value-hit/)
  assert.ok(css.indexOf('#chaosMeter[data-quality="ultra-leve"] {') > css.indexOf('#chaosMeter.is-hit[data-impact="heavy"] {'))
})

test('layout mobile respeita o limite aproximado de 15% e preserva dimensões distintas em tablet/desktop', () => {
  const project = path.resolve(__dirname, '..')
  const css = fs.readFileSync(path.join(project, 'src/styles/chroma-chaos-meter.css'), 'utf8')
  assert.match(css, /width: min\(14vw, 68px\);\s*min-width: 46px/)
  assert.match(css, /@media \(min-width: 640px\)[\s\S]*?width: min\(142px, 17vw\)/)
  assert.match(css, /@media \(min-width: 960px\)[\s\S]*?width: 166px/)
})

test('preferência legada chroma-light e classe lightweight são reconhecidas sem alterar a lógica', () => {
  const legacyStorage = { getItem(key) { return key === 'chroma-light' ? '1' : null } }
  assert.equal(Meter.graphicsQuality({ localStorage: legacyStorage }), 'ultra-leve')
  const view = attach({ quality: 'ultra', bodyClasses: ['lightweight'] })
  view.meter.update({ mode: 'supercaos', phase: 'playing', pending: 2, log: 'Super Caos' })
  assert.equal(view.element.dataset.quality, 'ultra-leve')
})

test('HTML carrega o componente isolado antes do controlador, e CSS desativa animações sob movimento reduzido', () => {
  const project = path.resolve(__dirname, '..')
  const html = fs.readFileSync(path.join(project, 'index.html'), 'utf8')
  const controller = fs.readFileSync(path.join(project, 'src/features/chroma-game.js'), 'utf8')
  const css = fs.readFileSync(path.join(project, 'src/styles/chroma-chaos-meter.css'), 'utf8')
  assert.match(html, /id="chaosMeter"[^>]*hidden/)
  assert.ok(html.indexOf('src/features/chroma-chaos-meter.js') < html.indexOf('src/features/chroma-game.js'))
  assert.ok(html.includes('src/styles/chroma-chaos-meter.css'))
  assert.match(controller, /pending:\s*match\.pending/)
  assert.match(controller, /ChromaChaosMeter\?\.mount/)
  assert.match(css, /prefers-reduced-motion:\s*reduce/)
  assert.match(css, /data-quality="ultra-leve"/)
  assert.match(css, /\.chaos-meter__spark/)
})
