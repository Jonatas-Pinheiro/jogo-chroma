/* Fundo interativo da tela inicial: grade de formas que acende com o cursor/toque
   e com ondas ao clicar. Só roda enquanto a tela #home estiver ativa. */
(function () {
  'use strict';

  const canvas = document.getElementById('homeGrid');
  const home = document.getElementById('home');
  const app = document.getElementById('app');
  if (!canvas || !home || !app) return;

  const ctx = canvas.getContext('2d');
  const reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  // Formas do jogo: 0 círculo (Cobalto), 1 quadrado (Sol), 2 triângulo (Esmeralda), 3 losango (Rubi)
  const FORMA_COR = ['--b', '--y', '--g', '--r'];
  const FALLBACK = ['#2f6fed', '#f4e04d', '#1fa86a', '#e8384f'];
  const ALPHA_BASE = 0.07;
  const ALPHA_PICO = 0.7;

  let largura = 0;
  let altura = 0;
  let tamanho = 45;
  let grupos = [[], [], [], []];
  let cores = FALLBACK.slice();
  let ondas = [];
  let ponteiro = { x: -1000, y: -1000 };
  let rafId = 0;

  function lerCores() {
    const estilo = getComputedStyle(document.documentElement);
    cores = FORMA_COR.map((nome, i) => estilo.getPropertyValue(nome).trim() || FALLBACK[i]);
  }

  function ativa() {
    return home.classList.contains('on') && !document.hidden;
  }

  function reduzido() {
    return app.classList.contains('calm') || Boolean(reducedQuery && reducedQuery.matches);
  }

  function inicializar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const caixa = canvas.getBoundingClientRect();
    largura = Math.round(caixa.width);
    altura = Math.round(caixa.height);
    if (!largura || !altura) return;

    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    tamanho = Math.round(45 * Math.max(1, largura / 1920));
    const colunas = Math.ceil(largura / tamanho);
    const linhas = Math.ceil(altura / tamanho);

    grupos = [[], [], [], []];
    for (let r = 0; r < linhas; r++) {
      for (let c = 0; c < colunas; c++) {
        const forma = Math.floor(Math.random() * 4);
        grupos[forma].push({
          x: c * tamanho + tamanho / 2,
          y: r * tamanho + tamanho / 2,
          intensidade: 0
        });
      }
    }
    lerCores();
    desenhar(false);
  }

  function forma(tipo, x, y, r) {
    ctx.beginPath();
    if (tipo === 0) {
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (tipo === 1) {
      if (ctx.roundRect) ctx.roundRect(x - r, y - r, r * 2, r * 2, 3);
      else ctx.rect(x - r, y - r, r * 2, r * 2);
      ctx.fill();
    } else if (tipo === 2) {
      ctx.moveTo(x, y - r * 1.1);
      ctx.lineTo(x + r * 1.1, y + r * 0.9);
      ctx.lineTo(x - r * 1.1, y + r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.2, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.2, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Desenha um quadro. Se `atualizar` for true, avança ondas e brilho; devolve se ainda há movimento.
  function desenhar(atualizar) {
    ctx.clearRect(0, 0, largura, altura);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;

    if (atualizar) {
      for (let i = ondas.length - 1; i >= 0; i--) {
        ondas[i].raio += ondas[i].velocidade;
        if (ondas[i].raio > ondas[i].raioMaximo) ondas.splice(i, 1);
      }
    }

    const raioForma = tamanho * 0.22;
    const raioHover = tamanho * 0.75;
    let movimento = ondas.length > 0;

    for (let g = 0; g < 4; g++) {
      ctx.fillStyle = cores[g];
      ctx.strokeStyle = cores[g];
      const lista = grupos[g];
      for (let i = 0; i < lista.length; i++) {
        const c = lista[i];
        if (atualizar) {
          if (Math.hypot(c.x - ponteiro.x, c.y - ponteiro.y) < raioHover) {
            c.intensidade = Math.max(c.intensidade, 0.65);
          }
          for (let j = 0; j < ondas.length; j++) {
            const delta = Math.abs(Math.hypot(c.x - ondas[j].x, c.y - ondas[j].y) - ondas[j].raio);
            if (delta < ondas[j].largura) {
              c.intensidade = Math.max(c.intensidade, 1 - delta / ondas[j].largura);
            }
          }
        }
        ctx.globalAlpha = ALPHA_BASE + c.intensidade * (ALPHA_PICO - ALPHA_BASE);
        forma(g, c.x, c.y, raioForma);
        if (atualizar) {
          c.intensidade *= 0.9;
          if (c.intensidade < 0.001) c.intensidade = 0;
          else movimento = true;
        }
      }
    }
    ctx.globalAlpha = 1;
    return movimento;
  }

  function quadro() {
    rafId = 0;
    if (!ativa() || reduzido()) return;
    const movimento = desenhar(true);
    // Sem brilho nem ondas: para o loop até a próxima interação (economiza bateria).
    if (movimento || ponteiroDentro()) rafId = requestAnimationFrame(quadro);
  }

  function ponteiroDentro() {
    return ponteiro.x > -500;
  }

  function acordar() {
    if (!rafId && ativa() && !reduzido()) rafId = requestAnimationFrame(quadro);
  }

  function posicao(e) {
    const caixa = canvas.getBoundingClientRect();
    return { x: e.clientX - caixa.left, y: e.clientY - caixa.top };
  }

  document.addEventListener('pointermove', (e) => {
    if (!ativa() || reduzido()) return;
    ponteiro = posicao(e);
    acordar();
  }, { passive: true });

  document.addEventListener('pointerdown', (e) => {
    if (!ativa() || reduzido()) return;
    const p = posicao(e);
    ponteiro = p;
    ondas.push({
      x: p.x,
      y: p.y,
      raio: 0,
      raioMaximo: Math.hypot(Math.max(p.x, largura - p.x), Math.max(p.y, altura - p.y)) + 100,
      velocidade: 16,
      largura: 60
    });
    acordar();
  }, { passive: true });

  function soltar() {
    ponteiro = { x: -1000, y: -1000 };
  }
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') soltar(); }, { passive: true });
  document.addEventListener('pointercancel', soltar, { passive: true });
  document.documentElement.addEventListener('mouseleave', soltar);

  function sincronizar() {
    if (ativa()) {
      if (!largura || !altura) inicializar();
      lerCores();
      if (reduzido()) {
        ondas = [];
        grupos.forEach((lista) => lista.forEach((c) => { c.intensidade = 0; }));
        desenhar(false);
      } else {
        acordar();
      }
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      ondas = [];
      soltar();
    }
  }

  if (window.ResizeObserver) new ResizeObserver(() => { if (ativa()) inicializar(); }).observe(canvas);
  else window.addEventListener('resize', () => { if (ativa()) inicializar(); });

  new MutationObserver(sincronizar).observe(home, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sincronizar).observe(app, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(lerCores).observe(document.documentElement, { attributes: true, attributeFilter: ['data-season', 'data-theme'] });
  document.addEventListener('visibilitychange', sincronizar);
  if (reducedQuery && reducedQuery.addEventListener) reducedQuery.addEventListener('change', sincronizar);

  inicializar();
  sincronizar();
})();
