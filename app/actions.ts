"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase";
import type { BoardTaskStatus } from "@/lib/types";

const VALID_STATUSES: BoardTaskStatus[] = ["todo", "in_progress", "done"];

// Slack channel every new task gets by default — the create form no longer
// asks for it (per user request). Change here if the default should move.
const DEFAULT_SLACK_CHANNEL = "#automation-improvements";

function parseList(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createTask(formData: FormData) {
  const supabase = createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  // owner and github_repos are intentionally not collected here — owner was
  // dropped, and github_repos is inferred by board-sync from claude_chats
  // instead (see skills/board-sync/SKILL.md).
  const { error } = await supabase.from("board_tasks").insert({
    title,
    context_sources: {
      slack_channels: [DEFAULT_SLACK_CHANNEL],
      claude_chats: parseList(formData.get("claude_chats")),
      github_repos: [],
    },
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function requestSyncAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("board_tasks")
    .update({ sync_requested_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function updateStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !VALID_STATUSES.includes(status as BoardTaskStatus)) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("board_tasks")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
}
