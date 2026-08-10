import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_EMAILS } from "@/lib/allowlist";
import { createTask, signOutAction, updateStatusAction } from "./actions";
import type { BoardTask, BoardTaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  todo: "To do",
  in_progress: "En curso",
  done: "Hecho",
};

const STATUS_PILL: Record<BoardTaskStatus, string> = {
  todo: "bg-neutral-200 text-neutral-700",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 p-6">
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

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Nueva tarea</h2>
        <form
          action={createTask}
          className="grid gap-2 rounded border border-neutral-200 p-4"
        >
          <input
            name="title"
            placeholder="Título"
            required
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="owner"
            placeholder="Owner"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="slack_channels"
            placeholder="Canales de Slack, separados por coma (#canal, #otro)"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="claude_chats"
            placeholder="Chats de Claude (urls o ids), separados por coma"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="github_repos"
            placeholder="Repos de GitHub (org/repo), separados por coma"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <button
            type="submit"
            className="justify-self-start rounded bg-neutral-900 px-4 py-2 text-white"
          >
            Crear
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {error && (
          <p className="text-sm text-red-600">
            Error cargando tareas: {error.message}
          </p>
        )}
        {tasks?.length === 0 && (
          <p className="text-sm text-neutral-500">No hay tareas todavía.</p>
        )}
        {tasks?.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </section>
    </main>
  );
}

function TaskCard({ task }: { task: BoardTask }) {
  const allLinks = [...(task.links ?? []), ...(task.synthesis?.links ?? [])];

  return (
    <article className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{task.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[task.status]}`}
            >
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          {task.owner && (
            <p className="text-sm text-neutral-500">{task.owner}</p>
          )}
        </div>

        <form action={updateStatusAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={task.id} />
          <select
            name="status"
            defaultValue={task.status}
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded border border-neutral-300 px-2 py-1 text-xs"
          >
            Guardar
          </button>
        </form>
      </div>

      {task.synthesis ? (
        <div className="space-y-2 text-sm">
          {task.synthesis.summary && (
            <p className="text-neutral-700">{task.synthesis.summary}</p>
          )}
          <SynthesisList title="Logrado" items={task.synthesis.logrado} />
          <SynthesisList title="Pendiente" items={task.synthesis.pendiente} />
          <SynthesisList title="Bloqueos" items={task.synthesis.bloqueos} />
        </div>
      ) : (
        <p className="text-sm text-neutral-400">Sin síntesis todavía.</p>
      )}

      {allLinks.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
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
        <p className="text-xs text-neutral-400">
          Último sync: {new Date(task.last_synced_at).toLocaleString()}
        </p>
      )}
    </article>
  );
}

function SynthesisList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase text-neutral-400">{title}</p>
      <ul className="list-disc pl-4">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
