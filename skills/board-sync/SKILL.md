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

1. **Modo cron (todas las tareas activas + pedidos de sync)** — sin argumentos. Trae
   todas las filas con `status != 'done'`, **más** cualquier fila `done` que tenga un
   pedido de sync pendiente desde la UI (botón "Request sync" → columna
   `sync_requested_at`). Corre la síntesis de cada una.
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
where status != 'done'
   or (sync_requested_at is not null
       and (last_synced_at is null or sync_requested_at > last_synced_at));

-- modo on-demand
select id, title, context_sources
from public.board_tasks
where id = '<uuid>'; -- o where title = '<title exacto>'
```

Si el modo on-demand no encuentra ninguna fila, avisá y parás — no hay nada que crear
acá (crear tareas es responsabilidad de la UI, Node 5).

Nota sobre `sync_requested_at`: es la única forma que tiene la UI de "pedir una
actualización" sin sintetizar nada ella misma — solo escribe ese timestamp. El cron
diario es quien realmente lo procesa (no hay un mecanismo de baja latencia; se decidió
así a propósito para no multiplicar corridas de agente sin necesidad).

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

**Si `github_repos` está vacío pero hay `claude_chats`**: el formulario de creación de
la UI ya no pide el repo a mano (decisión explícita — ver `app/actions.ts`). Inferí el
repo desde el contenido de los chats de Claude: buscá menciones de nombre de
repo/organización, rutas de proyecto, URLs de GitHub, o el nombre del working directory
del chat. Si encontrás uno o más repos con confianza razonable, usalos como si hubieran
estado en `github_repos` (y sumalos a `links` si corresponde citarlos). Si no podés
inferir ninguno, no inventes — dejá esa fuente sin cubrir y no la marques como bloqueo
(no es una fuente configurada, así que no hay nada "caído").

No compiles información de fuentes que no estén listadas en `context_sources` de esa
tarea específica — cada tarea se sintetiza solo con lo que ella misma declara (salvo la
inferencia de repo desde `claude_chats` descrita arriba).

## Paso 3 — Sintetizar

Con lo recolectado, generá un objeto JSON con esta forma exacta (usalo tal cual como
valor de `synthesis`):

```json
{
  "summary": "one line, overall state of the task",
  "logrado": ["concrete point already resolved", "..."],
  "pendiente": ["what's missing, in progress now", "..."],
  "bloqueos": ["what's stuck and why", "unreachable source: <which>", "..."],
  "links": [{"label": "PR #12", "url": "https://github.com/org/repo/pull/12"}],
  "generated_at": "<ISO 8601 UTC timestamp of this run>"
}
```

Los nombres de las claves (`logrado`/`pendiente`/`bloqueos`) se quedan tal cual, en
español, porque son parte del contrato de datos con la UI (`lib/types.ts`) — no los
traduzcas. Lo que sí va **en inglés siempre** es el contenido: `summary`, cada bullet
de `logrado`/`pendiente`/`bloqueos`, y `label` de cada link. La UI está en inglés; la
síntesis tiene que estarlo también.

Reglas de contenido:

- `logrado`/`pendiente`/`bloqueos` son arrays de bullets cortos, **en inglés**, sin
  relleno — si una fuente no aporta nada nuevo desde el último sync, no inventes texto.
  Preferí "no updates since last sync" antes que forzar un bullet vacío de contenido.
- `links` son hallazgos automáticos de las fuentes (PRs, hilos de Slack, mensajes
  puntuales) — **no** es lo mismo que la columna `links` de la tabla, que administra la
  persona a mano desde la UI. No toques esa columna.
- Si las tres listas (`logrado`, `pendiente`, `bloqueos`) quedan vacías porque ninguna
  fuente resolvió, igual escribí el objeto con arrays vacíos y `summary: "no data from
  configured sources"` — no dejes `synthesis` en null salvo que la tarea no tenga
  ninguna `context_source` configurada.
- Si `context_sources` está vacío (`{}` o sin claves con contenido), escribí
  `summary: "no sources configured"` y arrays vacíos — no marques error.

## Paso 4 — Escribir el resultado

```sql
update public.board_tasks
set synthesis = '<jsonb del paso 3>'::jsonb,
    last_synced_at = now(),
    sync_requested_at = null
where id = '<uuid de la tarea>';
```

Poner `sync_requested_at = null` siempre, haya habido pedido o no (no rompe nada si ya
era null) — así el próximo pedido desde la UI se detecta limpio.

Una corrida por tarea, siempre pisa el `synthesis` anterior completo (no hace merge
incremental). Es idempotente: correr el mismo modo de nuevo sobrescribe sin problema.

## Paso 5 — Reportar

Al terminar (cron u on-demand), devolvé un resumen corto: cuántas tareas se
sincronizaron, cuántas tuvieron al menos un bloqueo de fuente inaccesible, y el `id`/
`title` de cada una. No hace falta más que eso — el detalle vive en `synthesis` dentro
de Supabase.
