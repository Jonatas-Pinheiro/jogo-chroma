# Novas funcionalidades do CHROMA

Esta versão adiciona cinco recursos sem criar pastas novas.

## 1. Tutorial interativo

Na tela inicial, abra **Como jogar** e clique em **Fazer tutorial rápido**. O jogo inicia uma partida guiada contra bots, com cartas controladas para explicar cor/número, Bloqueio, Inverter, +2, Coringa, CHROMA!, Olho do Paizin, Buraco Negro e Confusão. O botão **Pular tutorial** encerra o guia.

O tutorial usa o modo Treinamento, não cria sala P2P, não dá XP, não altera ranking, missões ou estatísticas.

## 2. Emotes visuais

Durante uma partida, abra **Mensagens rápidas** e escolha uma reação. O texto continua aparecendo no jogador e o emoji flutua sobre ele para todos os participantes. O host valida a mensagem e o emoji permitidos e aplica cooldown de 1,5 segundo. Ultra Leve e `prefers-reduced-motion` exibem o emoji sem animação.

## 3. Fim de rodada aprimorado

A tela de encerramento mostra vencedor, duração, cartas jogadas, cartas compradas, usos de CHROMA e maior sequência de cartas especiais. O vencedor recebe confete leve; quem perde recebe um efeito discreto. Ultra Leve e `prefers-reduced-motion` desligam o confete/animações pesadas.

## 4. Modo espectador

Na tela de entrada da sala, informe o código e clique em **Assistir**. O espectador vê a mesa, o log, o chat e a contagem de cartas, mas nunca recebe as mãos. Ele não entra em `room.players`, não ocupa `maxPlayers` e o host bloqueia jogadas, CHROMA! e denúncias nessa conexão.

## 5. Missão de jogar com amigos

O Passe de Batalha agora possui:

- diária: **Jogue 1 partida com amigo**;
- semanal: **Jogue 3 partidas com amigos**.

A partida precisa ser online, não ser treinamento, terminar normalmente e conter ao menos um humano que seja amigo. A amizade é conferida na coleção `friendships`; o espelho local `chroma-friends` é usado como fallback. Cada `uid + roundId` só conta uma vez.

Como as partidas são P2P, o host não tem uma autoridade de servidor para comprovar a identidade declarada pelos clientes. A validação reduz duplicações e exige amizade real no Firestore, mas não é uma proteção antifraude forte contra um cliente modificado.

## Arquivos alterados

- `index.html`: telas, tutorial, emotes, resumo/confete, espectador, missão e integração dos fluxos.
- `style.css`: balões de tutorial, emotes, confete, estado de espectador e refinamentos da tela final.
- `firestore.rules`: validação restritiva dos contadores `friends` do Passe de Batalha.

## Campos e coleções novos

**Coleções novas:** nenhuma.

**Campos novos:**

- `users/{uid}.missions.__battlePass.daily.progress.friends` — contador inteiro da missão diária;
- `users/{uid}.missions.__battlePass.weekly.progress.friends` — contador inteiro da missão semanal.

Esses campos passam pelo cache local por UID, restauração da conta e `cloudPayload` já existentes.

## Publicação no Firebase

Publique as regras atualizadas:

```bash
firebase deploy --only firestore:rules
```

O arquivo a publicar é `firestore.rules`. Não é necessário criar coleção nova nem índice novo para esta versão.

## Como testar

1. Abra `index.html` por um servidor HTTP, não diretamente como `file://`.
2. Abra **Como jogar → Fazer tutorial rápido**, avance os passos e confirme que o tutorial termina sem aumentar XP ou partidas.
3. Em uma partida de treinamento/online, envie duas mensagens rápidas consecutivas e confirme o cooldown; observe o emoji no jogador.
4. Finalize uma rodada e confira o resumo e o comportamento de vitória/derrota.
5. Em outro navegador, entre com o mesmo código usando **Assistir**; confirme que não há mão, ações ou vaga adicional de jogador.
6. Com dois usuários amigos, finalize uma partida online normal e abra o Passe de Batalha para conferir o contador `friends`.
7. Rode os testes automatizados:

```bash
node --test turn-resolution.test.js auth-session.test.mjs
```
