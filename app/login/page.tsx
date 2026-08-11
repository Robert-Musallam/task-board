"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "not_allowed") setAccessError(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Task Board</h1>

        {accessError && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            That email doesn&apos;t have access to this board.
          </p>
        )}

        {status === "sent" ? (
          <p className="text-sm text-neutral-600">
            We sent a magic link to <strong>{email}</strong>. Open it in this
            browser to sign in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {status === "sending" ? "Sending..." : "Send magic link"}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-600">
                Couldn&apos;t send the link. Try again.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
