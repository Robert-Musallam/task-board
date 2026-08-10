# task-board

Board compartido entre 2 personas donde cada tarea mantiene su propia síntesis
(logrado / pendiente / bloqueos / links) generada automáticamente por un agente que lee
Slack, chats de Claude y repos de GitHub vinculados a esa tarea — sin data entry manual
de estado.

- **Datos:** Supabase, proyecto `shlajatmfmujewgyhrpu`, tabla `public.board_tasks`
  (nueva, sin relación con ninguna otra tabla del proyecto). Acceso restringido por RLS
  a 2 emails allowlisted (`auth.jwt() ->> 'email'`).
- **Síntesis:** vive en [`skills/board-sync/SKILL.md`](skills/board-sync/SKILL.md),
  corre como scheduled task de Cowork (diario) + on-demand.
- **UI:** Next.js (App Router) en Vercel — solo lee/escribe la tabla, nunca sintetiza.
  Login con magic link de Supabase Auth, RLS hace cumplir el allowlist.

## Development

```bash
npm install
cp .env.example .env.local   # completar con URL + anon key de Supabase
npm run dev
```

Ver `task-board-graph-spec.md` (fuera de este repo) para el plan completo de ejecución
por nodos.
