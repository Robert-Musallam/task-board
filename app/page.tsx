import { createClient } from "@/lib/supabase";
import { createTask } from "./actions";
import { TaskCard } from "@/components/TaskCard";
import type { BoardTask, BoardTaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: BoardTaskStatus[] = ["todo", "in_progress", "done"];

const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
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
  const supabase = createClient();

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
      </header>

      <details className="rounded-lg border border-neutral-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium text-neutral-600">
          + New task
        </summary>
        <form
          action={createTask}
          className="grid gap-2 border-t border-neutral-200 p-4"
        >
          <input
            name="title"
            placeholder="Title"
            required
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <input
            name="claude_chats"
            placeholder="Claude chats (urls or ids), comma separated"
            className="rounded border border-neutral-300 px-3 py-2"
          />
          <p className="text-xs text-neutral-400">
            Slack channel defaults to #automation-improvements. GitHub repo is
            inferred from the Claude chats.
          </p>
          <button
            type="submit"
            className="justify-self-start rounded bg-neutral-900 px-4 py-2 text-white"
          >
            Create
          </button>
        </form>
      </details>

      {error && (
        <p className="text-sm text-red-600">Error loading tasks: {error.message}</p>
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
          <p className="px-1 text-sm text-neutral-400">No tasks.</p>
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} accent={styles.accent} />
        ))}
      </div>
    </section>
  );
}
