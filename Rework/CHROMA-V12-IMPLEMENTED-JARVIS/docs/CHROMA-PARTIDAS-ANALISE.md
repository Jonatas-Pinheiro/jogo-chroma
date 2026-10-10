# Auditoria prévia de partidas — CHROMA-ATUAL

Esta análise foi escrita antes de qualquer alteração em `CHROMA-REWORK`. A origem é o ZIP solicitado, extraído sem modificar seus arquivos em `/workspace/chroma-work/CHROMA-ATUAL`.

## Bugs reproduzíveis encontrados

### 1. Saída do jogador ativo não avança o ciclo normal do turno

Em `CHROMA-ATUAL/index.html`, `removePlayer(id)` (linhas 1776–1797) reposiciona o índice para o próximo jogador quando quem sai está no turno (linhas 1795–1796), mas não incrementa `turnCount`/`turnEpoch`, não reinicializa a resolução idempotente e não chama `beginTurn()`. A saída e o fechamento da conexão realmente passam por essa função em `index.html:2045–2047` e `2054`.

**Reprodução com o motor real extraído da página:** em modo `maldita`, com três pessoas, defina `turn=1` (pessoa `p1`), `turnCount=7`, `cursedColor='r'`, `pending=2` e `turnEpoch=4`; chame `removePlayer('p1')`. Resultado observado: `p2` passa a ser o jogador atual, mas `turnCount` continua em `7`, `turnEpoch` em `4` e a cor continua `r`. O início normal do turno não roda, então a troca prevista na oitava jogada/turno fica atrasada. A mesma ausência de avanço afeta o calendário dos Eventos Aleatórios. A pendência de compra é mantida pela origem; a semântica para quem sai com acúmulo deve ser preservada deliberadamente no novo motor, em vez de apagada por acidente.

### 2. Encerramento após a saída da última pessoa adversária mantém estado ativo obsoleto

Na ramificação em que restam menos de duas pessoas (`index.html:1788–1794`), a partida passa a `ended` e define o vencedor, mas não limpa `pending`, `drawnId`, `turnEndsAt`/estado de vulnerabilidade, não finaliza os contadores da rodada e não cancela o `clockTimer`.

**Reprodução com o motor real extraído da página:** inicie uma sala de duas pessoas e remova a pessoa adversária quando a pessoa restante estiver no turno com uma compra acumulada (`pending=4`, `drawnId=null`) **ou**, em outra partida, logo depois de a pessoa restante comprar uma carta jogável (`pending=0`, `drawnId` definido). Resultado em cada caso: `phase='ended'` e vencedor correto, mas o estado de turno correspondente (`pending` ou `drawnId`) e a referência do intervalo continuam presentes. `viewFor()` ainda inclui esses dados no estado (linhas 1866–1872), de modo que a UI pode mostrar uma compra/carta antiga no resultado; o intervalo permanece acordado embora a rodada tenha terminado.

## Cobertura original e invariantes que devem permanecer

Os testes originais de turnos e modos passaram antes da reescrita: `node --test turn-resolution.test.js new-modes.test.js` — **9/9**. Eles já verificam resolução única de timeout, compra acumulada, Escudo, Espelho, Cor Maldita, Eventos e espectadores, mas não cobrem a remoção do jogador ativo nem a limpeza quando resta uma pessoa.

Devem ser mantidos: trava e deduplicação de ações; timeout que resolve uma única época e consome exatamente o acúmulo existente; compra normal de uma carta, com opção de jogá-la se legal ou passar; empilhamento de +N; Espelho devolvendo todo o acúmulo sem inverter o sentido; Escudo absorvendo compra forçada elegível, mas ainda perdendo a vez; validação de cor e de Coringa +4; vitória com a última carta antes de aplicar a penalidade de Cor Maldita; eventos somente em turno livre, sem repetir imediatamente e sem distribuir mãos vazias; mãos ocultas para espectadores. Os cenários após saída precisam agora avançar o turno e encerrar/limpar a sala de modo coerente.

**Registro pré-reescrita:** naquele momento, somente a origem havia sido executada e auditada; `CHROMA-REWORK` ainda não havia sido alterado.

## Reescrita e validação no CHROMA-REWORK

A auditoria acima foi criada **antes** de qualquer alteração no REWORK. A origem auditada continua intacta em `/workspace/chroma-work/CHROMA-ATUAL`; a lógica funcional foi portada para uma camada isolada em `src/features/chroma-game-engine.js`, com a interface em `src/features/chroma-game.js`.

### Correções aplicadas à reescrita

1. **Saída no turno ativo:** a remoção agora invalida a época antiga, consome/avança o ciclo normal do turno, aplica o início de turno (inclusive eventos/rotação de cor quando elegíveis) e descarta `drawnId` obsoleto. A compra acumulada continua pendente e é encaminhada conforme a regra do motor, sem desaparecer silenciosamente.
2. **Encerramento com menos de dois jogadores:** o estado terminal limpa compra pendente, carta recém-comprada, vulnerabilidade, relógio/tempo restante e trava de ação; a última pessoa é declarada vencedora e nenhuma resolução de turno antiga pode continuar.
3. **Torneio:** porta as cinco rodadas, pontuação por colocação (100/75/55/40/30/20/10/5), placar acumulado, desempate nominal e decisão de campeão pelo total — sem confundir vitória de uma rodada intermediária com o fim do torneio.
4. **Interface:** resumo entre rodadas expõe classificação e CTA “PRÓXIMA RODADA”; rodada final encerra o Torneio. A legenda da cor atual fica abaixo da carta da mesa, sem sobreposição, e as abas de modos têm altura mínima para ficarem visíveis/acionáveis.
5. **Pausa:** fechar o modal clicando no overlay usa a mesma retomada do botão (não deixa o jogo parado com a janela escondida); os rótulos distinguem pausa, entre-rodadas e fim normal.

### Regras e estados cobertos

A suíte de motor confirma rotação normal/inversa e direção em duas pessoas; compra normal, carta comprada legal e passar; acúmulos/timeout/idempotência; Bloqueio, Inverter, Escudo, Espelho, Cor Maldita e vitória antes da penalidade; legalidade do Coringa +4 e escolha de cor; modos/baralhos, saída nos dois sentidos, remoção que encerra a partida; pausa/retomada com tempo/mão/turno preservados; pontuação, reinício e campeão do Torneio. Ações duplicadas continuam deduplicadas.

**Resultados executados:** antes da reescrita, `node --test turn-resolution.test.js new-modes.test.js` na origem passou **9/9**. Depois da reescrita, `node --check` nos três módulos e `node --test tests/chroma-game-engine.test.cjs` passaram **15/15**.

**Smoke test no navegador:** a URL da prévia respondeu HTTP 200 local e publicamente; a página carregou sem erros de console registrados. A navegação Home → sala → partida funcionou, bots executaram jogadas e a vez passou ao usuário. A compra exibiu “Você comprou uma carta” e liberou “PASSAR”; pausa e retomada conservaram o mesmo turno e o tempo restante observado (11 s). O clique manual em “PASSAR” não foi contabilizado porque o turno expirou durante a validação browser; o comportamento de passar foi coberto e aprovado no teste automatizado. O jogo permanece explicitamente identificado como prévia local contra bots.

Os componentes de toast e haptics do REWORK não foram substituídos: toasts seguem ativos fora da mesa e suprimidos durante gameplay; preferência tátil continua persistida e configurável. O UI Kit é aplicado aos controles relevantes: ação principal, secundárias de sala/turno e ações especiais CHROMA/denúncia, sem reformar as outras telas.

### Arquivos principais

- Motor: `src/features/chroma-game-engine.js`
- Interface de partida: `src/features/chroma-game.js`
- Resumo/classificação e integração com as telas existentes: `src/features/chroma-expansion.js`
- Botões e área de jogo: `index.html` (variantes `.btn-primary`, `.btn-secondary` e `.btn-special` do UI Kit; outras telas não foram reformadas)
- Testes: `tests/chroma-game-engine.test.cjs`
- Este relatório: `docs/CHROMA-PARTIDAS-ANALISE.md`
