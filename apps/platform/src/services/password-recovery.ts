import type { Session, SupabaseClient } from "@supabase/supabase-js";

const recoverySessions = new WeakMap<SupabaseClient, Session>();

export function captureRecoveryEvents(client: SupabaseClient, pkceRecovery: boolean): void {
  let awaitingExchange = pkceRecovery;
  client.auth.onAuthStateChange((event, session) => {
    if (session && (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && awaitingExchange))) {
      recoverySessions.set(client, session);
      awaitingExchange = false;
    } else if (event === "SIGNED_OUT" || (event === "SIGNED_IN"
      && session?.access_token !== recoverySessions.get(client)?.access_token)) {
      recoverySessions.delete(client);
      awaitingExchange = false;
    }
  });
}

export function isRecoverySession(client: SupabaseClient, session: Session | null): boolean {
  const proven = recoverySessions.get(client);
  return !!session && !!proven && session.access_token === proven.access_token &&
    !!session.expires_at && session.expires_at > Math.floor(Date.now() / 1000);
}

export function clearRecoverySession(client: SupabaseClient): void {
  recoverySessions.delete(client);
}

export async function recoveryRequest<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Recovery request timed out")), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

export async function initializeRecovery(client: SupabaseClient): Promise<boolean> {
  // Do not remove callback secrets until the SDK has finished consuming them.
  const initialization = client.auth.initialize();
  const cleanUrl = () => {
    if (window.location.pathname === "/reset-password") {
      window.history.replaceState(window.history.state, "", "/reset-password");
    }
  };
  void initialization.then(cleanUrl, cleanUrl);
  const initialized = await recoveryRequest(initialization);
  if (initialized.error) return false;
  const { data, error } = await recoveryRequest(client.auth.getSession());
  // Implicit PASSWORD_RECOVERY is dispatched in the SDK's next task.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return !error && isRecoverySession(client, data.session);
}
