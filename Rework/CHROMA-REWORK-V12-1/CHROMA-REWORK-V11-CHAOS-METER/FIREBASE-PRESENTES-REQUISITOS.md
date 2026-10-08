# Requisito de segurança do Firebase para presentes

A ZIP de origem não contém `firestore.rules`, `firebase.json` nem uma cópia das regras implantadas. Portanto, não foi possível confirmar nem alterar as permissões do projeto Firebase conectado.

A implementação grava o presente como **entregue** em uma única transação: remove o cosmético de `users/{remetente}`, acrescenta-o a `users/{destinatário}` e cria `gifts/{id}`. O destinatário escuta a coleção `gifts` filtrada por `recipientUid`, marca `notificationRead` como verdadeiro e, ao tocar no toast, recarrega seu perfil antes de abrir o inventário. Não há aceite nem etapa de resgate.

As regras atuais precisam permitir que essa transferência atômica seja concluída e que o destinatário leia seus avisos e altere somente os campos de leitura do presente. Uma regra comum que permita atualizar `users/{uid}` apenas ao próprio dono **bloqueará** a gravação do inventário do destinatário feita pelo remetente.

Para produção, a alternativa mais segura é mover a transferência para uma Cloud Function autenticada. A função deve validar no servidor que quem chama é o remetente, que ambos ainda são amigos, que o item pertence ao remetente segundo o catálogo canônico, que o destinatário ainda não possui o item e que as duas alterações de inventário e o documento do presente são confirmados atomicamente. Não se deve simplesmente conceder aos clientes permissão ampla para editar o inventário de outras contas.

Também é necessário permitir a consulta dos documentos de `gifts` cujo `recipientUid` corresponda ao usuário autenticado e a confirmação de leitura pelo próprio destinatário. Essas permissões e a implantação de eventual Cloud Function dependem do projeto Firebase externo e continuam pendentes de verificação.
