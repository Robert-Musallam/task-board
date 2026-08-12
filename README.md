# task-board

Board compartido entre 2 personas donde cada tarea mantiene su propia síntesis
(logrado / pendiente / bloqueos / links) generada automáticamente por un agente que lee
Slack, chats de Claude y repos de GitHub vinculados a esa tarea — sin data entry manual
de estado.

- **Datos:** Supabase, proyecto `shlajatmfmujewgyhrpu`, tabla `public.board_tasks`
  (nueva, sin relación con ninguna otra tabla del proyecto).
- **Síntesis:** vive en [`skills/board-sync/SKILL.md`](skills/board-sync/SKILL.md),
  corre como scheduled task de Cowork (diario) + on-demand (pedido por chat).
- **UI:** Next.js (App Router) en Vercel — solo lee/escribe la tabla, nunca sintetiza.
  **Sin login por ahora** (decisión explícita, ver git history) — RLS de
  `board_tasks` está abierto al rol `anon`, así que la tabla es efectivamente
  pública mientras esto siga así. Revisar antes de compartir la URL más
  ampliamente.

## Development

```bash
npm install
cp .env.example .env.local   # completar con URL + anon key de Supabase
npm run dev
```

Ver `task-board-graph-spec.md` (fuera de este repo) para el plan completo de ejecución
por nodos.
