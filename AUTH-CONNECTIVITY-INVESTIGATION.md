# Investigação de autenticação e conectividade

## Causas encontradas

A aplicação tinha uma única inicialização Firebase (`initializeApp`, `getAuth` e `getFirestore`) e um único `onAuthStateChanged`, mas a função `canWrite()` combinava três decisões diferentes: existência de `currentUser`, conclusão do carregamento da conta e `navigator.onLine !== false`. O último item é apenas uma heurística do navegador e não comprova que o Firebase está acessível. Por isso, uma leitura incorreta de conectividade podia bloquear recursos mesmo com Wi-Fi, dados móveis ou outra conexão funcionando.

O Social e o Clã também dependiam diretamente de `canWrite()`. Assim, durante a restauração assíncrona da sessão, `accountReady` ainda era `false`; o sistema tratava esse intervalo como se fosse logout. Uma falha de leitura/escrita no Firestore também podia acabar apresentada como problema de conexão ou login, em vez de indicar permissão, indisponibilidade ou erro de configuração.

## Correção aplicada

`firebase-auth.js` continua sendo a única fonte de autenticação. A sessão agora usa persistência local do Firebase com `browserLocalPersistence` e é confirmada exclusivamente por `onAuthStateChanged(auth, user => ...)`.

Foi introduzido um estado explícito:

```text
AUTH_LOADING
AUTHENTICATED
UNAUTHENTICATED
```

Durante `AUTH_LOADING`, a interface mostra “Verificando sessão…” e o Social mostra “Sincronizando sua sessão com o Firebase…”. O jogador não é tratado como deslogado. Depois que o Firebase retorna um usuário, o código usa `user.uid` e carrega o documento privado. Um token de carregamento evita que uma resposta antiga sobrescreva uma sessão mais nova.

`canWrite()` não consulta mais `navigator.onLine` e não exige Wi-Fi. A operação real é enviada ao Firebase. Se o servidor estiver indisponível, a operação falha e o erro é convertido em “Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.”

Os erros agora são diferenciados:

- usuário não autenticado: solicitação de login;
- sessão ainda carregando: mensagem de espera;
- `permission-denied`: usuário autenticado, mas sem permissão nas regras;
- `unavailable`, `deadline-exceeded` ou erro de rede: falha de comunicação;
- `failed-precondition`: problema de configuração do Firebase;
- outros erros: mensagem da operação ou erro interno.

## Social e Clã

O Social e o Clã usam a mesma fonte `currentUser` derivada do callback do Firebase. Eles não criam login próprio, não separam Google de e-mail/senha e não consultam `auth.currentUser` apenas uma vez no carregamento da página.

O UID utilizado em perfis públicos, solicitações, amizades e clãs é `currentUser.uid`, somente depois de o estado Auth estar confirmado e o perfil privado estar sincronizado. Se a sessão ainda estiver carregando, a tela permanece em estado de sincronização. Se o carregamento do perfil falhar por permissão, o erro real é mostrado, sem dizer que o usuário está deslogado.

## Arquivos alterados

- `firebase-auth.js`: persistência Auth, estados `AUTH_LOADING`/`AUTHENTICATED`/`UNAUTHENTICATED`, tratamento de erros, remoção do bloqueio por `navigator.onLine`, sincronização do Social após a sessão e exposição de estado Auth.
- `index.html`: estados de carregamento e erro do Social/Clã, mensagens corretas durante restauração e falhas Firestore.
- `05-correio-moedas.js`, `07-social-rede-p2p.js` e `08-render-ui.js`: mensagens de bloqueio atualizadas para usar a causa real fornecida pela camada Firebase.
- `firestore.rules`: mantido como camada de autorização; não foi aberto acesso público nem usado `allow read, write: if true`.
- `AUTH-CONNECTIVITY-INVESTIGATION.md`: este relatório.

## Testes executados

Foram executados com sucesso: validação HTTP local de `index.html`, `firebase-auth.js`, `firebase-config.js` e `firestore.rules`; sintaxe de todos os arquivos JavaScript; leitura estrutural do HTML; teste de regressão do motor de turnos; ausência de `navigator.onLine`, listeners `online`/`offline` e mensagens específicas de Wi-Fi; presença dos três estados Auth; presença de `onAuthStateChanged` e `browserLocalPersistence`; e checagem da separação entre erros de autenticação, autorização e conectividade.

Não foi possível executar login real com Google, login real com e-mail/senha, teste em dados móveis ou desligamento físico da rede dentro do sandbox, porque ele não possui a sessão/credenciais do usuário nem um rádio de rede móvel. Esses testes devem ser realizados no navegador/dispositivo de uso, com o Firebase configurado. A implementação foi preparada para que ambos os métodos de login passem pelo mesmo `onAuthStateChanged` e para que Wi-Fi e dados móveis sejam tratados igualmente.
