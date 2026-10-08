# Modos e cartas novas do CHROMA

## Cartas novas

### Escudo

- Existem quatro Escudos coloridos, um de cada cor.
- Pode ser jogado pela cor normal ou sobre outro Escudo.
- Dá um escudo ao jogador, com no máximo um escudo ativo.
- Absorve uma compra forçada por `+2`, `+4`, `+6`, `+10`, `+99` e a **Chuva de cartas**.
- Depois de absorver, o escudo desaparece e o jogador perde a vez sem comprar.
- Não absorve Cor Maldita, tempo esgotado, falta de CHROMA!, Bloqueio, Confusão ou Troca.
- O estado do escudo aparece para todos, inclusive espectadores.

### Espelho

- É uma carta coringa: o jogador escolhe a cor quando a joga.
- Entra em partidas com acúmulo ativado, em quantidade configurável de quatro cartas.
- Sem acúmulo, funciona como um Coringa comum.
- Com `pending > 0`, devolve todo o acúmulo ao jogador anterior sem inverter o sentido.
- O jogador anterior pode responder com outra compra, outro Espelho ou comprar.

Os ícones das duas cartas usam Lucide: `shield` para Escudo e `flip-horizontal` para Espelho.

## Modos novos

### Cor Maldita

A cada oito turnos, uma cor diferente é sorteada como maldita. Jogar uma carta colorida dessa cor faz o jogador comprar uma carta, exceto quando ela é a última carta da mão e encerra a rodada. Coringas não contam. Bots evitam essa cor quando têm outra jogada legal.

### Eventos Aleatórios

A cada seis turnos, no começo de um turno livre sem compra pendente, um evento é sorteado. O mesmo evento não aparece duas vezes seguidas:

1. Chuva de cartas;
2. Maré inversa;
3. Pintura surpresa;
4. Ajuda ao azarado;
5. Presente de escudo;
6. Passa-passa.

Os eventos não encerram a rodada nem deixam alguém com zero cartas.

Os dois modos funcionam no Treinamento, em partidas online e para espectadores. Eles não são ranqueados.

## Onde ajustar o balanceamento

As constantes ficam no topo do script inline do `index.html`, no bloco comentado **MODOS NOVOS — BALANCEAMENTO**. Ali estão, entre outros valores:

- quantidade de Escudos e Espelhos;
- intervalo da troca da Cor Maldita;
- intervalo dos Eventos Aleatórios;
- chance de o bot usar o Espelho;
- quantidade da Chuva de cartas.

A tabela de disponibilidade informa em quais modos as cartas aparecem. Para ajustar o jogo, altere primeiro essas constantes, sem mexer nas funções do motor.

## LOCKED_MODES

Hoje `LOCKED_MODES` continua contendo apenas Caos e Super Caos, que exigem nível 5. Cor Maldita e Eventos Aleatórios não foram adicionados a essa lista: ficam disponíveis normalmente, mas são sempre não ranqueados.

## Testes executados

- `node --test turn-resolution.test.js auth-session.test.mjs`: aprovado, incluindo os 17 cenários de autenticação.
- `node --test new-modes.test.js`: aprovado com 8 cenários de Escudo, Espelho, Cor Maldita, Eventos, timeout, dois jogadores e privacidade do espectador.
- Sintaxe dos scripts inline: aprovada.
- Service Worker atualizado para `CACHE_VERSION = 3`.

## Testes manuais recomendados

1. No Treinamento, jogue partidas completas de Cor Maldita e Eventos Aleatórios.
2. Teste Espelho sobre `+2` e `+99`, com e sem Escudo, incluindo uma sala de dois jogadores.
3. Deixe um turno com acúmulo expirar e confirme que o pending não duplica.
4. Jogue a última carta de uma Cor Maldita e confirme que não compra.
5. Entre como espectador e confira a faixa da cor/evento e os escudos, sem receber mãos.
6. Com amigos, teste as duas modalidades online e confirme os banners, logs e mudanças de sentido.
7. No celular, confira lobby, destaque da cor maldita, indicador do próximo evento e tamanho dos ícones das cartas.
