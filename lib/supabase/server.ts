import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente para Server Components / Server Actions / Route Handlers. Usa el
// anon key + la sesión del usuario (cookies) — nunca el service_role key.
// El acceso real a board_tasks lo hace cumplir RLS (ver migración
// board_tasks_allowlist_rls), no este código.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se llamó desde un Server Component (no puede escribir
            // cookies). El middleware se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
