# Pack de ícones Kenney

O pack completo está em `assets/kenney-board-game-icons/`.

O renderer de cartas em `src/features/chroma-game.js` referencia diretamente os ícones selecionados em `assets/kenney-board-game-icons/icons/` para:

- Bloqueio;
- Inverter;
- Escudo;
- Espelho;
- Troca;
- Olho do Paizin;
- Buraco Negro;
- Confusão.

A mão do jogador usa uma faixa horizontal com `overflow-x: auto`, mantendo todas as cartas organizadas sem sobreposição e permitindo rolagem quando ultrapassar a largura da tela.
