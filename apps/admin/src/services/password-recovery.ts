import type { Session, SupabaseClient } from "@supabase/supabase-js";

const recoverySessions = new WeakMap<SupabaseClient, Session>();

export function captureRecoveryEvents(client: SupabaseClient, pendingRecovery: boolean): void {
  client.auth.onAuthStateChange((event, session) => {
    if (session && (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && pendingRecovery))) {
      recoverySessions.set(client, session);
      pendingRecovery = false;
    } else if (event === "SIGNED_OUT" || (event === "SIGNED_IN"
      && session?.access_token !== recoverySessions.get(client)?.access_token)) {
      recoverySessions.delete(client);
      pendingRecovery = false;
    }
  });
}

export function clearRecoverySession(client: SupabaseClient): void {
  recoverySessions.delete(client);
}

export async function initializeRecovery(client: SupabaseClient): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const initialization = client.auth.initialize();
  const cleanUrl = () => {
    if (window.location.pathname === "/reset-password") window.history.replaceState(window.history.state, "", "/reset-password");
  };
  void initialization.then(cleanUrl, cleanUrl);
  try {
    return await Promise.race([
      initialization.then(async result => {
        if (result.error) return false;
        const { data, error } = await client.auth.getSession();
        await new Promise(resolve => setTimeout(resolve, 0));
        const session = data.session;
        const proven = recoverySessions.get(client);
        return !error && !!session && !!proven && session.access_token === proven.access_token
          && !!session.expires_at && session.expires_at > Math.floor(Date.now() / 1000);
      }),
      new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 15000); })
    ]);
  } finally { clearTimeout(timer); }
}
