# CHROMA — Passe de Batalha

## Estrutura

- Tela acessível pelo botão **Passe de Batalha** na home.
- Exatamente 30 níveis, do 1 ao 30, em lista vertical.
- Cada nível tem uma recompensa exclusiva no catálogo `BATTLE_PASS_REWARDS`.
- Estados de card: **Bloqueado**, **Disponível** e **Coletado**.
- `Coletar todas` coleta somente níveis desbloqueados ainda não registrados em `claimed`.

## Missões

- Missões diárias são reiniciadas por `todayKey()` e concedem menos XP.
- Missões semanais são reiniciadas pela segunda-feira calculada em `battlePassWeekKey()` e concedem mais XP.
- Partidas concluídas alimentam as estatísticas do Passe (`played`, `wins` e `team`).
- Cada missão possui um ID único no bucket diário/semanal e só pode ser coletada uma vez.

## Persistência

O estado fica em `users/{uid}.battlePass` e no espelho local `chroma-battle-pass`:

```text
{
  season: "s1",
  xp: number,
  claimed: number[],
  daily: { period, progress, claimed },
  weekly: { period, progress, claimed }
}
```

O campo foi adicionado ao `cloudPayload`, à restauração da conta, ao cache isolado por UID e às regras Firestore. IDs únicos e deduplicação impedem a coleta repetida no mesmo estado da conta.
