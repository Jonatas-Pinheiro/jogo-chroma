# Mapa de assets e controles — CHROMA REWORK

Todos os novos arquivos visuais usados pela interface estão em `assets/chroma-ui/`; o HTML, CSS e JavaScript continuam estáticos e editáveis pelo SPCK Editor. Nenhum pacote ou framework foi adicionado.

## Ícones substituídos

Os símbolos SVG de interface existentes foram remapeados para PNGs locais do pacote fornecido: início → casa; ranking → troféu; loja → sacola; jogador/grupo → avatar/grupo; voltar → seta esquerda; pausa → pausa; bloqueio → proibido; inversão → atualizar; moedas → star-coin; carta → carta; escudo → escudo; espelho → espelho; configurações → engrenagem; cadeado → bloqueio; confirmação → tick. Os quatro símbolos de forma das cartas foram igualmente trocados por losango, círculo, triângulo e estrela. Os ícones são monocromáticos e recebem inversão no tema claro; as formas sobre as cartas mantêm branco para preservar contraste nas faces coloridas.

Arquivos locais principais: `assets/chroma-ui/icons/`.

## Emotes

A grade em “Mensagens rápidas” usa **os 30 PNGs, e somente eles, de `Emotes/PNG/Vector/Style 1`**. As outras pastas/estilos de emotes não são integradas. A escolha mostra o emote e uma legenda textual na confirmação local.

Arquivos locais: `assets/chroma-ui/emotes/style-1/`.

## Indicadores de gameplay

- **PC:** ←/→ selecionam carta; `Enter` joga a carta selecionada; `D` compra; `N` passa quando essa ação estiver disponível; `C` aciona CHROMA!; `P` pausa/retoma; `Esc` mantém o cancelamento/fechamento seguro dos seletores e camadas já suportados pelo jogo. As legendas de teclado ficam ocultas em Tablet/Celular.
- **Controle conectado:** a API Gamepad do navegador detecta conexão/desconexão e só então mostra o indicador em qualquer perfil. O mapeamento é D-pad ←/→ seleciona, `A` joga/confirma, `X` compra, `B` passa/volta e `Y` pausa. A leitura usa o mapeamento padrão de gamepad do navegador.
- Os atalhos ignoram modificadores Ctrl/Alt/Meta e campos editáveis. Setas só cancelam o comportamento normal do navegador quando há uma carta/controle a navegar.

Pictogramas locais: `assets/chroma-ui/keys/`; imagem de controle: `assets/chroma-ui/icons/controller.png`.

## Tema, perfil e cursores

Preferências são persistidas no `localStorage` do navegador. Os perfis PC/Tablet/Celular alteram o envelope responsivo da interface, sem definir resolução física; em uma viewport menor a UI refluí e as telas de jogo/configurações podem rolar. Os cursores `Kenney · contorno` e `Kenney · sombreado` são aplicados somente a mouse/ponteiro preciso (`hover` e `pointer:fine`), sem alterar toque ou caneta.

Cursores: `assets/chroma-ui/cursors/`. A licença CC0 original do Cursor Pack está junto em `assets/chroma-ui/cursors/LICENSE-KENNEY.txt`.
