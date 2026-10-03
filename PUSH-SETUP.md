# PUSH do CHROMA

A camada do cliente já está integrada ao PWA:

- pede permissão apenas pelo botão **Configurações → Notificações PUSH**;
- registra uma assinatura por usuário em `pushSubscriptions/{uid}`;
- o Service Worker recebe mensagens Web Push, exibe título, mensagem, ícone e destino;
- o toque abre/foca o CHROMA na tela de recompensas, ranking, Passe de Batalha ou Correio;
- há deduplicação de 24 horas e a página não mostra PUSH enquanto está visível e em uso.

## Ativação do PUSH remoto

1. No Firebase Console, gere uma chave pública Web Push/VAPID.
2. Coloque essa chave em `firebase-config.js`, no campo `messagingVapidKey` (ou atribua `window.CHROMA_PUSH_VAPID_KEY` antes do módulo).
3. O emissor remoto deve enviar para o endpoint salvo em `pushSubscriptions/{uid}` um payload como:

```json
{
  "type": "gift",
  "title": "CHROMA · Presente recebido",
  "body": "Ana enviou um item para você.",
  "route": "mail",
  "tag": "gift_gift-id"
}
```

Os tipos previstos são `reward`, `ranking`, `season` e `gift`. O emissor deve aplicar as mesmas regras do jogo: criar o PUSH apenas quando o usuário não estiver ativo e evitar reenvio do mesmo evento.

Sem a chave VAPID e um emissor (Cloud Functions, servidor ou outro backend), nenhum navegador consegue entregar um PUSH real depois que a página foi encerrada; o CHROMA permanece funcional e informa essa condição no painel de configurações.
