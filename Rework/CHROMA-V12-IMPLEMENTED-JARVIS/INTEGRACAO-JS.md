# Integração JavaScript do CHROMA Atual no Rework

A interface não foi substituída. O `index.html` e todos os estilos em `src/styles/` permanecem os do CHROMA Rework V6.

Somente a camada JavaScript foi adicionada em `src/current/`, incluindo:

- configuração, áudio, animações e estado de sala;
- correio, moedas, loja, XP, missões e Passe;
- rede social, P2P, bots, ranking e times;
- renderizadores e notificações PUSH;
- autenticação Firebase;
- testes e service worker JavaScript originais.

`src/current/chroma-current-bridge.js` é a única ponte carregada automaticamente pelo Rework. Ela expõe estado de moedas, XP, loja e missões sem injetar HTML nem CSS.

## Arquivos visuais preservados

- `index.html` do Rework V6;
- `src/styles/tokens.css`;
- `src/styles/components.css`;
- `src/styles/screens.css`;
- `src/styles/chroma-cards.css`;
- `src/styles/chroma-home-grid.css`;
- `src/styles/chroma-toast.css`.
