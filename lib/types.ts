export type BoardTaskStatus = "todo" | "in_progress" | "done";

export type BoardTaskLink = {
  label: string;
  url: string;
};

export type BoardTaskSynthesis = {
  summary?: string;
  logrado?: string[];
  pendiente?: string[];
  bloqueos?: string[];
  links?: BoardTaskLink[];
  generated_at?: string;
};

export type BoardTaskContextSources = {
  slack_channels?: string[];
  claude_chats?: string[];
  github_repos?: string[];
};

export type BoardTask = {
  id: string;
  title: string;
  owner: string | null;
  status: BoardTaskStatus;
  synthesis: BoardTaskSynthesis | null;
  links: BoardTaskLink[] | null;
  context_sources: BoardTaskContextSources | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};
