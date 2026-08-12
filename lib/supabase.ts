import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// No login for now (removed on purpose — see git history). RLS on board_tasks
// grants the anon role open access, so this plain anon-key client is enough
// everywhere: server actions, server components, and if ever needed, the
// browser. There is no user session to manage, so no cookies/@supabase/ssr.
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
