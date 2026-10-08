# Investigação de autenticação, sessão e conectividade (CHROMA)

## Bugs reais encontrados

1. **Estado inconsistente**: `onAuthStateChanged` marcava `AUTHENTICATED` antes de `loadAccount()` terminar, mas `canWrite()` exigia `accountReady`. Resultado: conta "conectada" com `canWrite()==false`.
2. **Falha de perfil virava falha de sessão**: se `users/{uid}` falhasse (permission-denied, unavailable), `accountReady` ficava `false` para sempre, sem estado de erro nem retry.
3. **Leitura dependia de transação de escrita**: `ensureProfile` rodava `runTransaction` em todo login. Agora lê com `getDoc`; a transação só existe para *criar* o perfil.
4. **`publishSocialProfile().catch(()=>{})`** engolia erros. Também reenviava `clanId: null` a cada login (a chave `chroma-clan-id` nunca era gravada), apagando o clã do perfil público.
5. **Mensagens genéricas**: `getWriteMessage()||'Não foi possível realizar esta alteração.'` (5 pontos), `err.message||'Não foi possível concluir a operação.'` (Social/Clã) e `e.message` cru do Firebase em inglês. Se `firebase-auth.js`/SDK não carregasse (bloqueio de gstatic), `window.chromaCloud` ficava indefinido e o fallback genérico aparecia para sempre — agora há `onerror` no `<script type="module">` e mensagem própria.
6. **Sincronização insegura**: `syncToCloud` sem fila (duas gravações simultâneas), sem guarda de sessão (resposta de uma conta antiga podia ser aplicada na nova), `restoreFromServer` reiniciava `accountReady=false` (bloqueando escritas durante o restore) e o `catch(()=>{})` escondia a falha. Nada limpava o `localStorage` ao trocar de conta/deslogar.
7. **Vínculo Google + e-mail/senha**: usava `auth.currentUser` depois do login, não validava se o e-mail digitado era o da conta Google e não limpava a credencial pendente em caso de erro.
8. **Salvar nome/username** engolia o erro real; e alterar username/nome/foto/nível **nunca atualizava `publicProfiles`** (busca social mostrava nome antigo).
9. **Regra do Firestore (`firestore.rules`)**: a entrada em clã lia `members[uid].role` de quem ainda não estava no mapa → erro de avaliação → `permission-denied` em todo `joinClan`.

## Arquitetura atual (`firebase-auth.js`)

```
onAuthStateChanged  (único observador; ++sessionToken a cada mudança)
  ├─ sem usuário → UNAUTHENTICATED (limpa cache da conta anterior)
  └─ usuário → AUTHENTICATED_LOADING_PROFILE (UID já vale)
        getDoc(users/{uid}) ── não existe → transação só para criar
        ├─ ok   → AUTHENTICATED  (única condição de canWrite())
        └─ erro → AUTHENTICATED_PROFILE_ERROR (currentUser preservado; erro real + botão "Tentar novamente")
AUTH_LOADING = Firebase ainda restaurando a sessão · AUTH_ERROR = erro do próprio observador
```

- Toda operação assíncrona captura `{token, uid}` e confere `isCurrent()` antes de aplicar resultado; respostas de sessão antiga são descartadas.
- Cache local tem dono (`chroma-cache-owner` = UID). Ao trocar de conta/deslogar ele é limpo *antes* do novo perfil chegar. O marcador **não** é prova de login.
- Sincronização: debounce (400 ms) + fila serial + guarda de sessão + `applyingRemote` (sem loop). Rede/indisponível: mantém o local e reenvia (3 s, 10 s, 30 s). Recusa do servidor: informa a causa e realinha com a nuvem.
- `classifyError()` é a única fonte de mensagens; preserva o erro original (`info.original`) e loga no console.
- Google e e-mail/senha terminam no mesmo `onAuthStateChanged` → mesmo `users/{uid}` → mesmo `publicProfiles/{uid}`.
- Sem `navigator.onLine`: conectividade é o resultado real das operações Firebase.

## Coleções e operações exigidas pelas regras

| Coleção | Leitura | Escrita |
|---|---|---|
| `users/{uid}` | só o dono | dono: criar (valores iniciais) e atualizar campos listados |
| `publicProfiles/{uid}` | qualquer logado | dono: criar/atualizar |
| `friendRequests/{id}` | remetente ou destinatário | logado: criar (`fromUid==uid`); destinatário aceita/recusa; remetente cancela |
| `friendships/{id}` | participantes | participante cria/apaga (criada na aceitação) |
| `clans/{id}` | qualquer logado | líder; membro entra/sai alterando só `members`, `memberCount`, `updatedAt` |

## Verificar no Console do Firebase (não dá para checar pelos arquivos)

- Authentication → Sign-in method: **Google** e **E-mail/senha** ativados.
- Authentication → Settings → **Authorized domains**: o domínio onde o jogo está hospedado (ex.: `usuario.github.io`).
- `authDomain` em `firebase-config.js` (`chroma-79384.firebaseapp.com`) é coerente com `projectId`.
- Publicar `firestore.rules` atualizado e testar no Rules Playground/emulador (a regra de clã foi alterada e **não** foi testada num emulador).
- Consultas com `where` + `orderBy` em campos diferentes podem pedir índice; o erro aparece como `failed-precondition` com link de criação.

## Testes

`node auth-session.test.mjs` roda 15 cenários contra um Firebase **simulado em memória** (`auth-test-hooks.mjs`): estados, refresh, Google/vínculo, Social/Clã, permission-denied, unavailable, username, compra/equipar, troca de conta, logout, sessão antiga, fila de sincronização, classificação de erros. Eles provam a lógica, não as regras reais, o popup do Google nem a rede.
