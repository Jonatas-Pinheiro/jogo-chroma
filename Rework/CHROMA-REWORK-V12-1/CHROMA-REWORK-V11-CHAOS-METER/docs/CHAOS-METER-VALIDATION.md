# Validação do Chaos Meter — Super Caos

O motor mantém o acúmulo até a sequência visual avançar; só então zera `pending`, sorteia um jogador ativo e aplica exatamente +150, respeitando o Escudo. As ações do jogador, o temporizador de turno e a próxima jogada de bot permanecem bloqueados até a barra terminar o retorno visual. A mudança só afeta o ciclo de Super Caos.

## Sequência verificada

Aos **0 ms**, a barra chega a 150+; aos **150 ms**, começa a tensão; aos **300 ms**, ocorre a ruptura; e aos **450 ms**, o medidor mostra **COLAPSO!**. Só aos **700 ms** o motor sorteia entre os jogadores ativos, aplica +150 (ou deixa o Escudo absorver) e zera `pending`.

Aos **1.100 ms**, o valor e a barra começam o retorno animado a zero. Aos **1.500 ms**, a animação termina, o estado volta a **ESTÁVEL** e o turno/jogo é liberado. O motor identifica cada colapso e rejeita tentativas repetidas de resolução.

## Responsividade e acessibilidade

Em mobile, o medidor usa `14vw` (cerca de 15% da área útil após as margens), até 68 px, com mínimo de 46 px; tablets recebem dimensões intermediárias e desktop preserva a largura original de 166 px. O modo **ULTRA LEVE** desativa tremor, partículas, onda, distorção e pulsos adicionais; preserva leitura, preenchimento, microanimação essencial do valor e o movimento reduzido para a barra. `prefers-reduced-motion` desativa animações e transições.

A mesa real foi aberta e inspecionada visualmente no navegador em desktop (viewport 1280 × 624). A ferramenta de navegador desta execução não aceitou ajustar a viewport CSS; por isso, a aparência mobile/tablet não foi verificada por captura visual. Os breakpoints e limites correspondentes foram verificados em teste automatizado.

## Alterações verificadas

O motor `src/features/chroma-game-engine.js` agora separa iniciar, resolver e concluir o colapso; mantém o sorteio, a punição +150, o Escudo e a idempotência, inclusive com pausa. O controlador `src/features/chroma-game.js` agenda essas etapas, bloqueia entradas e bots, suspende o timeout e sincroniza o estado em sala.

O componente `src/features/chroma-chaos-meter.js` exibe COLAPSO na etapa visual correta e temporiza o retorno. O CSS `src/styles/chroma-chaos-meter.css` reduz o medidor mobile, dimensiona tablet/desktop e sobrescreve efeitos reativos em ULTRA LEVE. `tests/chroma-game-engine.test.cjs` e `tests/chroma-chaos-meter.test.cjs` cobrem limites, sorteio, Escudo, idempotência, pausa, sequência visual, acessibilidade e responsividade; `docs/CHAOS-METER-NODE-TESTS.txt` contém o log TAP integral.

## Resultado

`node --check` passou para os três arquivos JavaScript modificados. A suíte integral, executada com `node --test tests/*.test.cjs src/current/*.test.mjs`, passou em **64/64 testes**, sem falhas. O ZIP-base permaneceu intacto; esta versão foi montada a partir de uma cópia de trabalho separada.
