# PWA e Lucide local no CHROMA

## Lucide fixado

O projeto usa o pacote web **Lucide 1.48.0**, com o arquivo UMD salvo localmente como `lucide.min.js`.

O `index.html` tenta carregar o arquivo local primeiro. Se ele não estiver disponível, usa a mesma versão fixa por CDN. Os ícones são atualizados por `refreshIcons()`, que verifica se `window.lucide` existe; assim, o jogo continua funcionando sem ícones caso os dois carregamentos falhem.

Para trocar a versão no futuro:

1. Baixe o UMD da nova versão para a raiz como `lucide.min.js`.
2. Atualize a versão fixa do fallback CDN no `index.html`.
3. Valide os nomes `data-lucide` e os ícones gerados pelos templates JavaScript.
4. Incremente `CACHE_VERSION` em `sw.js`.
5. Rode os testes antes de publicar.

A versão local atual tem SHA-256:

```text
344d31835187df329541d22325fa9b97f94bb012b520a41b9b4a74a1d4d9c637
```

## Cache e atualização do PWA

O Service Worker está em `sw.js` e usa:

```js
const CACHE_VERSION = 2;
```

Para forçar uma atualização, altere apenas esse número, publique os arquivos novamente e abra o jogo. O Service Worker remove caches antigos no `activate`. A atualização só recarrega a página quando o usuário clica em **Atualizar**; durante uma partida, ela espera o usuário sair dela.

O pré-cache contém somente os arquivos essenciais. Imagens, áudios, fontes e scripts CDN são guardados dinamicamente. Firebase Auth, Firestore, PeerJS/signaling e requisições que não sejam GET nunca entram no cache.

## Como instalar

### Chrome, Edge e Android

1. Abra o CHROMA em HTTPS ou localhost.
2. Vá em **Configurações → Instalar o jogo**.
3. Clique em **Instalar** e confirme o prompt do navegador.

### iPhone e iPad

O Safari não oferece prompt automático. Abra o jogo no Safari, toque em **Compartilhar** e depois em **Adicionar à Tela de Início**.

O botão muda para **Jogo já instalado** quando o navegador informa que o app está em modo standalone.

## Arquivos novos

- `lucide.min.js`
- `manifest.webmanifest`
- `sw.js`
- `icon-192.png`
- `icon-512.png`
- `icon-maskable-512.png`
- `apple-touch-icon.png`
- `PWA-E-LUCIDE.md`

## Arquivos alterados

- `index.html`: Lucide local/fallback seguro, manifest, metas PWA, Service Worker, atualização e controle de instalação.
- `style.css`: estilo da linha de instalação e estados do botão.

`firebase-auth.js`, `firestore.rules` e `01-config.js` até `09-admin.js` não foram alterados.

## Testes manuais importantes

- Testar instalação e abertura como app em Chrome/Edge/Android.
- Testar **Compartilhar → Adicionar à Tela de Início** no Safari iOS/iPadOS.
- Testar login por e-mail dentro do app instalado.
- Testar login com Google dentro do app instalado: o fluxo pode abrir uma janela/aba do provedor e depende da configuração OAuth e dos domínios autorizados no Firebase. Confirme que o retorno volta ao app e que a sessão permanece após fechar e abrir o app.
- Confirmar uma partida online, Firestore e PeerJS com rede real. O Service Worker deliberadamente não intercepta essas requisições.
- Simular uma nova versão alterando `CACHE_VERSION`, publicar e confirmar o aviso **Nova versão disponível**.
