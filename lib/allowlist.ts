// Los mismos 2 emails que la policy RLS de board_tasks
// (supabase/migrations, migración board_tasks_allowlist_rls). RLS es la
// barrera de seguridad real; esta lista solo mejora el mensaje de error en
// la UI cuando alguien fuera del allowlist completa el login por magic
// link. Si cambian los emails, actualizar en los dos lugares.
export const ALLOWED_EMAILS = ["robert@investgcv.com", "josebrest25@gmail.com"];
