"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BoardTaskStatus } from "@/lib/types";

const VALID_STATUSES: BoardTaskStatus[] = ["todo", "in_progress", "done"];

function parseList(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createTask(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const owner = String(formData.get("owner") ?? "").trim();

  const { error } = await supabase.from("board_tasks").insert({
    title,
    owner: owner || null,
    context_sources: {
      slack_channels: parseList(formData.get("slack_channels")),
      claude_chats: parseList(formData.get("claude_chats")),
      github_repos: parseList(formData.get("github_repos")),
    },
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function updateStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !VALID_STATUSES.includes(status as BoardTaskStatus)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("board_tasks")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
