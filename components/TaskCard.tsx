"use client";

import { useState } from "react";
import { requestSyncAction, updateStatusAction } from "@/app/actions";
import type { BoardTask, BoardTaskStatus } from "@/lib/types";

const STATUSES: BoardTaskStatus[] = ["todo", "in_progress", "done"];

const STATUS_LABELS: Record<BoardTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export function TaskCard({ task, accent }: { task: BoardTask; accent: string }) {
  const [expanded, setExpanded] = useState(false);
  const allLinks = [...(task.links ?? []), ...(task.synthesis?.links ?? [])];
  const syncPending =
    !!task.sync_requested_at &&
    (!task.last_synced_at || task.sync_requested_at > task.last_synced_at);

  return (
    <article
      className={`space-y-2 rounded-md border-l-4 bg-white p-3 shadow-sm ${accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 text-left"
        >
          <h3 className="font-medium leading-tight">{task.title}</h3>
          {task.owner && (
            <p className="text-xs text-neutral-500">{task.owner}</p>
          )}
          {!expanded && task.synthesis?.summary && (
            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
              {task.synthesis.summary}
            </p>
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50"
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
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
            Move
          </button>
        </form>

        <form action={requestSyncAction}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
            disabled={syncPending}
            className="rounded border border-neutral-300 px-1.5 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
            title="Flags this task for the next daily sync run"
          >
            {syncPending ? "Sync requested" : "Request sync"}
          </button>
        </form>
      </div>

      {expanded && (
        <>
          {task.synthesis ? (
            <div className="space-y-1.5 text-xs">
              {task.synthesis.summary && (
                <p className="text-neutral-700">{task.synthesis.summary}</p>
              )}
              <SynthesisList
                title="Achieved"
                items={task.synthesis.logrado}
                color="text-emerald-700"
              />
              <SynthesisList
                title="Pending"
                items={task.synthesis.pendiente}
                color="text-amber-700"
              />
              <SynthesisList
                title="Blockers"
                items={task.synthesis.bloqueos}
                color="text-red-700"
              />
            </div>
          ) : (
            <p className="text-xs text-neutral-400">No synthesis yet.</p>
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
              Synced: {new Date(task.last_synced_at).toLocaleString()}
            </p>
          )}
        </>
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
