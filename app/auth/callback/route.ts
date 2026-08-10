import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recibe el redirect del magic link de Supabase Auth y canjea el code por
// una sesión (cookies). Ver app/login/page.tsx para el envío del link.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
