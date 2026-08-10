---
name: board-sync
description: Sincroniza board_tasks del Task Board — lee tareas activas de Supabase, recorre sus context_sources (canales de Slack, chats de Claude, repos de GitHub), sintetiza logrado/pendiente/bloqueos/links, y escribe el resultado de vuelta en synthesis + last_synced_at. Usar cuando corre el cron diario (todas las tareas activas) o cuando alguien pide on-demand "corré el sync del board" / "sincronizá la tarea X".
---

# board-sync

Este skill es la única inteligencia del Task Board. La webapp (Next.js) **solo lee y
escribe** la tabla — nunca sintetiza nada. Todo el trabajo de "leer fuentes y resumir
estado" pasa por acá.

## Alcance — no negociable

- Proyecto Supabase: **`shlajatmfmujewgyhrpu`**, tabla **`public.board_tasks`**.
- Esta tabla es nueva e independiente. **Nunca leas ni toques `cos_items` ni ninguna
  otra tabla de ese proyecto** — el board no tiene relación con el blackboard existente
  más allá de compartir el mismo proyecto Supabase.
- Este skill **solo escribe** las columnas `synthesis` y `last_synced_at` de
  `board_tasks`. No toca `title`, `owner`, `status`, `links` ni `context_sources` — esas
  las administra la persona desde la UI.
- Fuentes: **solo lectura**. Nunca postear en Slack, nunca comentar en GitHub, nunca
  escribir en ningún chat de Claude.

## Modos de invocación

1. **Modo cron (todas las tareas activas)** — sin argumentos. Trae todas las filas con
   `status != 'done'` y corre la síntesis de cada una.
2. **Modo on-demand (una tarea puntual)** — recibe un `id` (uuid) o un `title` exacto de
   `board_tasks`. Corre la síntesis solo para esa fila, sin importar su `status`.

Si te piden "corré el sync del board" a secas, es modo cron. Si te piden "sincronizá la
tarea X" / "corré el sync de X", es modo on-demand con esa tarea.

## Paso 1 — Traer las tareas objetivo

Vía el conector de Supabase (o `execute_sql` si corrés con MCP de Supabase disponible),
contra el proyecto `shlajatmfmujewgyhrpu`:

```sql
-- modo cron
select id, title, context_sources
from public.board_tasks
where status != 'done';

-- modo on-demand
select id, title, context_sources
from public.board_tasks
where id = '<uuid>'; -- o where title = '<title exacto>'
```

Si el modo on-demand no encuentra ninguna fila, avisá y parás — no hay nada que crear
acá (crear tareas es responsabilidad de la UI, Node 5).

## Paso 2 — Recorrer context_sources de cada tarea

`context_sources` tiene esta forma (cualquier clave puede faltar o venir vacía):

```json
{
  "slack_channels": ["#canal"],
  "claude_chats": ["url_o_id"],
  "github_repos": ["org/repo"]
}
```

Para cada tarea, por cada fuente:

- **`slack_channels`**: leé los mensajes recientes del canal (últimos ~7 días, o desde
  el `last_synced_at` anterior si existe y es más reciente) con las herramientas de
  Slack disponibles (lectura de canal, hilos). Si el canal no existe o no tenés acceso,
  anotalo como bloqueo — no hagas fallar toda la síntesis por una fuente caída.
- **`github_repos`**: mirá actividad reciente relevante — issues/PRs abiertos, commits
  recientes, estado de checks. Si el repo es privado y no hay acceso, anotalo como
  bloqueo.
- **`claude_chats`**: cada entrada es una URL (chat compartido de claude.ai) o un id de
  sesión de Claude Code. Si es URL, traé el contenido; si es id de sesión y tenés
  herramientas de sesión disponibles, leé la transcripción. Si no podés resolverla,
  anotalo como bloqueo en vez de inventar contenido.

No compiles información de fuentes que no estén listadas en `context_sources` de esa
tarea específica — cada tarea se sintetiza solo con lo que ella misma declara.

## Paso 3 — Sintetizar

Con lo recolectado, generá un objeto JSON con esta forma exacta (usalo tal cual como
valor de `synthesis`):

```json
{
  "summary": "una línea, estado general de la tarea",
  "logrado": ["punto concreto ya resuelto", "..."],
  "pendiente": ["qué falta, en curso ahora", "..."],
  "bloqueos": ["qué está trabado y por qué", "fuente inaccesible: <cual>", "..."],
  "links": [{"label": "PR #12", "url": "https://github.com/org/repo/pull/12"}],
  "generated_at": "<timestamp ISO 8601 UTC del momento de la corrida>"
}
```

Reglas de contenido:

- `logrado`/`pendiente`/`bloqueos` son arrays de bullets cortos, en español, sin relleno
  — si una fuente no aporta nada nuevo desde el último sync, no inventes texto.
  Preferí "sin novedades desde el último sync" antes que forzar un bullet vacío de
  contenido.
- `links` son hallazgos automáticos de las fuentes (PRs, hilos de Slack, mensajes
  puntuales) — **no** es lo mismo que la columna `links` de la tabla, que administra la
  persona a mano desde la UI. No toques esa columna.
- Si las tres listas (`logrado`, `pendiente`, `bloqueos`) quedan vacías porque ninguna
  fuente resolvió, igual escribí el objeto con arrays vacíos y `summary: "sin datos de
  las fuentes configuradas"` — no dejes `synthesis` en null salvo que la tarea no tenga
  ninguna `context_source` configurada.
- Si `context_sources` está vacío (`{}` o sin claves con contenido), escribí
  `summary: "sin fuentes configuradas"` y arrays vacíos — no marques error.

## Paso 4 — Escribir el resultado

```sql
update public.board_tasks
set synthesis = '<jsonb del paso 3>'::jsonb,
    last_synced_at = now()
where id = '<uuid de la tarea>';
```

Una corrida por tarea, siempre pisa el `synthesis` anterior completo (no hace merge
incremental). Es idempotente: correr el mismo modo de nuevo sobrescribe sin problema.

## Paso 5 — Reportar

Al terminar (cron u on-demand), devolvé un resumen corto: cuántas tareas se
sincronizaron, cuántas tuvieron al menos un bloqueo de fuente inaccesible, y el `id`/
`title` de cada una. No hace falta más que eso — el detalle vive en `synthesis` dentro
de Supabase.
