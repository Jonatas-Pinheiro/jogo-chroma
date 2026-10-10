# CHROMA V12 — Implementação baseada nas referências visuais

**Data:** 10/10/2026  
**Cópia de trabalho:** `CHROMA-V12-IMPLEMENTATION-JARVIS/CHROMA-REWORK-V12-1/CHROMA-REWORK-V11-CHAOS-METER`  
**Base aprovada:** `CHROMA-V12-UX-REWORKED-FINAL.zip`. A ZIP e os originais enviados foram preservados.

## Leitura das imagens

A ordem visual segue a confirmação do usuário, não a ordem inicial do briefing:

| Imagem | Referência reconhecida | Adaptação CHROMA |
|---|---|---|
| `45876.jpg` | Modal de perfil e personalização: identidade, avatar, abas de avatar/moldura, prévia e galeria | Modal acessível com avatar atual, apelido, ID estável quando há sessão, abas, item selecionado, estado de propriedade/equipamento, descrição e bloqueio de item não adquirido. A edição só altera a própria conta. |
| `45877.jpg` | Seleção/coleção e progressão de personagem | Galeria filtrável dos cosméticos do catálogo real, detalhe do item, propriedade e estado de bloqueio; nível/XP derivados do perfil existente. O CHROMA não tem personagens com atributos/habilidades nesta versão: HP, ataque, defesa, habilidades e condições/preços inventados não são exibidos. |
| `45878.jpg` | Clã e lista de membros | Aprimoramento da tela de clãs que já existia. Identidade dos membros ligada por UID; avatar/apelido/cargo apresentados com os dados disponíveis. Campos ausentes, como descrição, são sinalizados; presença ou capacidade não são presumidas. |

As imagens serviram como referência de hierarquia e organização; suas cores, personagens, textos, moedas e tema não foram copiados. A identidade CHROMA, navegação de cinco destinos, tokens e componentes existentes foram preservados. Não havia `DESIGN.md` na cópia aprovada; nenhum documento de design existente foi substituído.

## Integração e origem dos dados

- **Perfil, loja e inventário:** autenticado e pronto, os fluxos existentes usam o estado da conta Firebase; sem autenticação, o estado local é explicitamente “somente neste dispositivo”. A UI não converte uma ação local em confirmação de gravação remota.
- **Coleção:** organiza os 16 cosméticos catalogados em avatares, molduras, cartas, mesas e efeitos de nome. Propriedade e equipamento vêm do inventário existente. Cosméticos não adquiridos não podem ser equipados; quando não há aquisição disponível na Loja atual, a ação fica desabilitada e não cria preço/desbloqueio fictício. O avatar padrão é identificado como integrado, não como compra.
- **Progressão:** nível e barra XP usam o perfil real e identificam sua origem. A coleção não simula níveis independentes de personagens.
- **Identidade social:** perfil público carrega IDs de avatar/moldura apenas se os IDs corresponderem ao catálogo conhecido e os itens estiverem possuídos pelo UID atual. A exibição nas amizades e nos membros de clã reutiliza a mesma miniatura/moldura. Se a publicação social falhar, o equipamento confirmado na conta permanece equipado, mas uma mensagem informa que sua exibição nas amizades não foi confirmada.
- **Clãs:** não se inventa nível/XP, descrição, quantidade máxima, presença online/em partida ou estatística competitiva quando os documentos Firebase não os fornecem. A lista usa membros reais do clã e identifica a liderança conforme o campo disponível.
- **Placar global:** continua indisponível sem validação autoritativa no servidor. Nenhum jogador/posição demonstrativa é usado para aparentar uma classificação online.

## Limites e dependências

1. A ZIP não trouxe arquivo de regras Firestore. O código atual publica o próprio perfil público por UID; a permissão em produção para os novos campos opcionais `avatarId` e `profileFrameId` não foi verificada. Se regras publicadas recusarem esses campos, o erro é tratado como falha de sincronização — não como sucesso. Não foram alteradas regras remotas.
2. As operações Firebase foram verificadas com mock em memória, não em uma conta ou banco de produção. Nenhuma escrita Firebase, compra ou login foi realizado nesta implementação.
3. Um placar seguro e recursos baseados em partidas verificadas continuam dependentes de backend autoritativo. A coleção não cria sistemas de personagens inexistentes.
4. A cópia não contém `DESIGN.md`; os estilos existentes e tokens do CHROMA foram mantidos.
5. A inspeção visual foi feita no navegador a 1280 × 624 px. A responsividade mobile tem regras e testes, mas não foi validada em aparelho físico/emulação mobile nesta sessão.

## Testes

- `node --test tests/*.test.cjs`: **76 testes passaram**, incluindo modal, filtros, bloqueio de cosméticos, perfis/clãs e navegação.
- `node --test src/current/*.test.mjs`: **22 cenários passaram** com Firebase simulado em memória, incluindo teste novo de publicação de avatar/moldura possuídos no perfil público do UID atual.
- `node --check` nos módulos alterados e nos scripts inline HTML: **sem erros**.
- Browser: modal e coleção abertos pela navegação do app; filtros com altura renderizada de 46 px; console sem erros na revisão visual. Sem login nem mutações remotas.

**Execução:** somente Jarvis; PAIZIN e KACIQUE não foram envolvidos.
