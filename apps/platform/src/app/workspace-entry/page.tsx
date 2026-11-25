"use client";

import { useEffect, useRef, useState } from "react";
import { receiveWorkspace } from "@kruxt/ui/workspace-session";
import { createPlatformSupabaseClient } from "@/services/supabase-client";

export default function WorkspaceEntryPage() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    let cancel: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      if (started.current) return;
      started.current = true;
      try {
        cancel = receiveWorkspace({ win: window, client: createPlatformSupabaseClient(), workspace: "platform",
          projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          onComplete: path => window.location.replace(path), onError: setError });
      } catch { setError("Workspace sign-in is unavailable. Return to the source tab and try again."); }
    }, 0);
    return () => { window.clearTimeout(timer); cancel?.(); };
  }, []);
  return <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-4 px-6">
    <h1 className="text-xl font-semibold">{error ? "Unable to open platform" : "Opening platform"}</h1>
    <p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error ?? "Verifying your sign-in..."}</p>
    {error && <a href="/login" className="text-sm font-semibold text-kruxt-platform underline underline-offset-4">Sign in to this workspace</a>}
  </main>;
}
