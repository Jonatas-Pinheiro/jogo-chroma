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


## Presentes para amigos

- O botão **Presente** aparece nos cards de **Meus amigos**.
- O remetente escolhe um cosmético próprio; o item é transferido atomicamente do inventário do remetente para um documento `gifts/{giftId}`.
- O destinatário vê o presente no **Correio** com o título `Você ganhou um presente!`, a descrição parametrizada e o botão **Resgatar item**.
- O resgate usa transação Firestore: adiciona o item ao inventário do destinatário e marca o presente como `redeemed`, sem permitir resgate duplicado.
- As regras validam amizade, posse do item no momento do envio e que somente o destinatário pode resgatar.


## Clã: missões, moeda e loja

- Um clã com apenas um integrante exibe a confirmação **“Deseja excluir este clã?”** e é removido atomicamente quando o líder confirma.
- Clãs possuem a moeda separada **Fragmentos do Clã**, com saldo individual por membro.
- As missões exibem progresso, objetivo e a indicação explícita de que a recompensa será entregue a **todos os membros**.
- A loja do clã é acessível somente a integrantes do clã e oferece cosméticos exclusivos até a raridade **Épico**, além de poções de XP de 15 e 30 minutos.
- Compras descontam Fragmentos do Clã e gravam o item no inventário sincronizado do membro.
- O catálogo e a estrutura de missões são preparados para progressão automática via backend confiável/Cloud Functions; a interface não libera recompensas por escrita livre do navegador.
