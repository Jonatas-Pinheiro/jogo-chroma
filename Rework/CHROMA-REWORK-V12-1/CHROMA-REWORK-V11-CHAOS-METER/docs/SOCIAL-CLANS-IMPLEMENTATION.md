# Social e Clãs — integração funcional

## O que foi ligado

A aba **Clã** deixou de usar nomes, membros e contagens fixos no HTML. O novo controlador `src/features/chroma-social-clans.js` usa a API `window.chromaSocial` do Firebase para apresentar estados de carregamento e erro, orientar quem ainda não entrou na conta, pesquisar comunidades, ver detalhes, criar um clã, entrar, consultar o painel e os membros, sair ou dissolver o clã quando só resta a liderança. Uma liderança com outros membros precisa ser transferida antes de sair; a transferência é confirmada na interface e registrada em transação.

A camada Firebase agora expõe `getMyClan` e `transferLeadership`. As transações de entrada e saída verificam o vínculo entre o documento do usuário e o mapa de membros do clã antes de mudar a contagem. A criação revalida a associação dentro da transação. A remoção de amizade também confirma que a conta atual participa da relação antes de apagá-la.

Pedidos recebidos, enviados e mudanças em amizades são observados por `onSnapshot`; os listeners são encerrados ao sair da conta ou trocar de usuário. Assim, uma solicitação feita por outra pessoa pode aparecer sem exigir que o usuário recarregue a página. A busca e a aceitação/recusa/cancelamento continuam usando a camada Firebase existente; apelidos seguem privados no dispositivo e presentes continuam dependentes das regras específicas descritas em `FIREBASE-PRESENTES-REQUISITOS.md`.

## O que ainda depende do projeto Firebase

Este ZIP não inclui `firestore.rules` nem `firebase.json`, e a configuração da sessão Cue não tem um conector Firebase. Portanto, as mudanças foram verificadas contra o Firebase simulado em memória, não contra as regras implantadas no projeto de produção. Antes de publicar, valide no Firebase Emulator Suite que cada operação só pode ser feita pelo participante correto e que pedidos, amizades, perfis públicos e transações de clã não aceitam gravações arbitrárias.

Os documentos de missão do clã já são exibidos com o progresso gravado, mas este pacote não tem um mecanismo autoritativo no servidor para validar resultados de partidas e distribuir XP, fragmentos ou recompensas. A loja de clã e eventos aparecem apenas como métodos/dados existentes no backend, sem fluxo completo na interface. Não foram simuladas recompensas nem adicionada progressão client-side, para não permitir autoatribuição de moedas ou itens por meio do navegador.

## Verificação local

Execute `node --test tests/*.test.cjs src/current/*.test.mjs`. A suíte cobre a integração de tela por verificações do código e as transações de criação, entrada, saída, transferência, dissolução e remoção de amizade contra o Firebase simulado. Esses testes não substituem uma verificação no emulador ou no projeto Firebase real.
