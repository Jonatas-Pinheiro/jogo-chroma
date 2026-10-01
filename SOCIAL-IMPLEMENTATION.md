# CHROMA — Social, Amigos e Clã

## Arquivos alterados

- `index.html`
  - Substituiu a tela antiga de amizades por Social com abas **Amigos** e **Clã**.
  - Adicionou busca pública, cards de jogadores, pedidos recebidos/enviados, perfil público, remoção de amizade, criação/procura/entrada/saída de clã.
  - Mantém a correção anterior de idempotência de ações, timer e empilhamento de punições.
- `style.css`
  - Adicionou os componentes visuais responsivos de Social, cards de perfil, clã, progresso e modal de criação.
- `firebase-auth.js`
  - Adicionou operações Firestore para perfis públicos, solicitações, amizades e clãs.
  - Todas as alterações esperam confirmação do Firebase; falhas não são simuladas como sucesso.
  - O perfil público é sincronizado após o login e não inclui e-mail ou UID na interface.
- `firestore.rules`
  - Adicionou regras separadas para `publicProfiles`, `friendRequests`, `friendships` e `clans`.
  - Mantém documentos de conta privados e impede `allow write: if true`.
- `tests/turn-resolution.test.js`
  - Testes de regressão da correção anterior.

## Estrutura Firestore

```text
users/{uid}
publicProfiles/{uid}
friendRequests/{requestId}
friendships/{uidA__uidB}
clans/{clanId}
```

### Perfil público

`publicProfiles/{uid}` contém apenas `uid`, username, nome público, avatar, rank, nível e referência pública de clã. A leitura exige autenticação; e-mail e dados privados continuam em `users/{uid}`.

### Amizades

- O jogador pesquisa por `usernameLower`.
- A solicitação é criada em `friendRequests` com status `pending`.
- O destinatário pode aceitar ou recusar.
- Aceitar usa uma transação que cria `friendships/{uidA__uidB}` e atualiza a solicitação.
- A lista de amigos consulta somente amizades em que o usuário autenticado está em `participants`.
- IDs de amizade e solicitação são usados para evitar duplicação e permitir remoção segura.

### Clãs

`clans/{clanId}` guarda nome, ícone, líder, nível, XP, XP necessário para o próximo nível, contagem, integrantes, missões, recompensas e eventos. O criador entra como líder; entrada e saída atualizam também `users/{uid}.clanId` e o perfil público.

A estrutura de cargos começa com `leader` e `member` e deixa os campos preparados para vice-líder, oficial e recruta.

## Segurança

- O Social não usa `localStorage` como banco principal.
- Operações de amizade e clã só atualizam a UI depois da confirmação do Firestore.
- Usuários só leem os próprios documentos privados.
- Perfis públicos não expõem e-mail.
- Solicitações só podem ser criadas pelo remetente e respondidas pelo destinatário.
- Amizades só podem ser lidas/removidas pelos participantes.
- A criação de clã exige usuário autenticado e líder correspondente.
- O XP/nível do clã está separado dos dados locais e os campos estão preparados para um backend confiável de progressão.

## Configuração necessária no Firebase Console

1. Confirmar que **Authentication** está habilitado para os provedores usados pelo projeto: e-mail/senha e, se desejado, Google.
2. Confirmar que o domínio de hospedagem está em **Authentication → Settings → Authorized domains**.
3. Publicar `firestore.rules` no projeto `chroma-79384`.
4. Criar o banco Firestore em produção ou modo de teste antes de usar o Social.
5. Para progressão automática de XP, missões e recompensas por partidas, adicionar Firebase Cloud Functions/Admin SDK. A interface já reserva `missions`, `rewards` e `events`, mas essas recompensas não devem ser liberadas por escrita direta do navegador.

## Validação

Executado com sucesso:

- sintaxe dos módulos JavaScript;
- sintaxe dos scripts inline do HTML;
- presença da UI Social e dos endpoints Firestore;
- checagem estrutural das regras;
- testes de regressão dos cenários de spam CHROMA e punição acumulada.
