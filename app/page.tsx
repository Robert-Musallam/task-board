import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_EMAILS } from "@/lib/allowlist";
import { createTask, signOutAction, updateStatusAction } from "./actions";
import type { BoardTask, BoardTaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: BoardTaskStatus[] = ["todo", "in_progress", "done"];

const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  todo: "To do",
  in_progress: "En curso",
  done: "Hecho",
};

const COLUMN_STYLES: Record<
  BoardTaskStatus,
  { header: string; body: string; accent: string }
> = {
  todo: {
    header: "bg-slate-600",
    body: "bg-slate-50",
    accent: "border-l-slate-500",
  },
  in_progress: {
    header: "bg-amber-500",
    body: "bg-amber-50",
    accent: "border-l-amber-500",
  },
  done: {
    header: "bg-emerald-600",
    body: "bg-emerald-50",
    accent: "border-l-emerald-500",
  },
};

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!user.email || !ALLOWED_EMAILS.includes(user.email)) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  const { data: tasks, error } = await supabase
    .from("board_tasks")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<BoardTask[]>();

  const byStatus: Record<BoardTaskStatus, BoardTask[]> = {
    todo: [],
    in_progress: [],
    done: [],
  };
  for (const task of tasks ?? []) {
    (byStatus[task.status] ?? byStatus.todo).push(task);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Task Board</h1>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-neutral-500 hover:underline"
          >
            {user.email} · salir
          </button>
        </form>
      </header>

      <details className="rounded-lg border border-neutral-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-neutral-600">
          + Nueva tarea
        </summary>
        <form
          action={createTask}
          className="grid gap-2 border-t border-neutral-200 p-4 sm:grid-cols-2"
        >
          <input
            name="title"
            placeholder="Título"
            required
            className="rounded border border-neutral-300 px-3 py-2 sm:col-span-2"
          />
          <input
            name="owner"
            placeholder="Owner"
            className="rounded border border-neutral-300 px-3 py-2 sm:col-span-2"
          />
          <input
            name="slack_channels"
            placeholder="Canales de Slack (#canal, #otro)"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="claude_chats"
            placeholder="Chats de Claude (urls o ids)"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="github_repos"
            placeholder="Repos de GitHub (org/repo)"
            className="rounded border border-neutral-300 px-3 py-2 sm:col-span-2"
          />
          <button
            type="submit"
            className="justify-self-start rounded bg-neutral-900 px-4 py-2 text-white sm:col-span-2"
          >
            Crear
          </button>
        </form>
      </details>

      {error && (
        <p className="text-sm text-red-600">
          Error cargando tareas: {error.message}
        </p>
      )}

      <div className="grid flex-1 gap-4 sm:grid-cols-3">
        {STATUSES.map((status) => (
          <Column key={status} status={status} tasks={byStatus[status]} />
        ))}
      </div>
    </main>
  );
}

function Column({
  status,
  tasks,
}: {
  status: BoardTaskStatus;
  tasks: BoardTask[];
}) {
  const styles = COLUMN_STYLES[status];
  return (
    <section className={`flex flex-col rounded-lg ${styles.body} overflow-hidden`}>
      <div
        className={`flex items-center justify-between px-4 py-2 text-sm font-semibold text-white ${styles.header}`}
      >
        <span>{STATUS_LABELS[status]}</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
          {tasks.length}
        </span>
      </div>
      <div className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto p-3">
        {tasks.length === 0 && (
          <p className="px-1 text-sm text-neutral-400">Sin tareas.</p>
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} accent={styles.accent} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({ task, accent }: { task: BoardTask; accent: string }) {
  const allLinks = [...(task.links ?? []), ...(task.synthesis?.links ?? [])];

  return (
    <article
      className={`space-y-2 rounded-md border-l-4 bg-white p-3 shadow-sm ${accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium leading-tight">{task.title}</h3>
          {task.owner && (
            <p className="text-xs text-neutral-500">{task.owner}</p>
          )}
        </div>
      </div>

      <form action={updateStatusAction} className="flex items-center gap-1">
        <input type="hidden" name="id" value={task.id} />
        <select
          name="status"
          defaultValue={task.status}
          className="rounded border border-neutral-300 px-1.5 py-1 text-xs"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-neutral-300 px-1.5 py-1 text-xs hover:bg-neutral-50"
        >
          Mover
        </button>
      </form>

      {task.synthesis ? (
        <div className="space-y-1.5 text-xs">
          {task.synthesis.summary && (
            <p className="text-neutral-700">{task.synthesis.summary}</p>
          )}
          <SynthesisList
            title="Logrado"
            items={task.synthesis.logrado}
            color="text-emerald-700"
          />
          <SynthesisList
            title="Pendiente"
            items={task.synthesis.pendiente}
            color="text-amber-700"
          />
          <SynthesisList
            title="Bloqueos"
            items={task.synthesis.bloqueos}
            color="text-red-700"
          />
        </div>
      ) : (
        <p className="text-xs text-neutral-400">Sin síntesis todavía.</p>
      )}

      {allLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {allLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      {task.last_synced_at && (
        <p className="text-[10px] text-neutral-400">
          Sync: {new Date(task.last_synced_at).toLocaleString()}
        </p>
      )}
    </article>
  );
}

function SynthesisList({
  title,
  items,
  color,
}: {
  title: string;
  items?: string[];
  color: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase ${color}`}>{title}</p>
      <ul className="list-disc pl-3.5 text-neutral-600">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
