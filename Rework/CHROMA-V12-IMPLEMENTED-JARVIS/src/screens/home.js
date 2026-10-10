export function renderHome() {
  return `<section class="screen home-screen">
    <header class="screen-header"><div class="player"><chroma-avatar name="Nina" size="48"></chroma-avatar><span><strong>Nina</strong><small>Nível 7</small></span></div><div class="header-actions"><span class="wallet">✦ 2.480</span><button class="icon-button" data-screen="settings" aria-label="Configurações">⚙</button></div></header>
    <div class="home-layout">
      <div class="home-copy"><p class="eyebrow">TEMPORADA 01 <span>/</span> PELE ATIVA</p><h1>MINA DE<br><em>OURO</em></h1><p class="hero-copy">Seu próximo movimento<br>começa aqui.</p><chroma-button label="JOGAR" variant="primary" data-action="notice" data-message="Sala rápida pronta — esta é uma prévia de UI."></chroma-button></div>
      <section class="season-card" aria-label="Card da temporada Mina de Ouro"><div class="season-top"><span>PELE ATIVA</span><strong>01</strong></div><div class="mine-art"><div class="mine-arch"></div><div class="gold-rock"></div><chroma-card tone="red" value="◇" label="07"></chroma-card><chroma-card tone="yellow" value="□" label="02"></chroma-card><chroma-card tone="blue" value="●" label="05"></chroma-card></div><div class="season-bottom"><span>Uma temporada para<br>jogar fora do eixo.</span><small>01 — 02</small></div></section>
      <aside class="continue-panel"><div class="panel-line"><span>CONTINUE</span><b>→</b></div><div class="progress-label"><strong>RITMO DO DIA</strong><span>84%</span></div><div class="progress"><i></i></div><p>Mais uma partida para fechar a sequência.</p></aside>
    </div>
    <div class="availability"><i></i> MATCHMAKING <strong>DISPONÍVEL</strong></div>
    <chroma-dock active="home"></chroma-dock>
  </section>`
}
