/** Explicit workspace switching only. Never use this transport for OAuth/PKCE. */
export type Workspace = "admin" | "platform";
const ORIGINS: Record<Workspace, readonly string[]> = {
  admin: ["https://kruxt-admin.vercel.app", "https://kruxt-admin-owvhy089d-edoardos-projects-61f55e37.vercel.app"],
  platform: ["https://kruxt-platform.vercel.app", "https://kruxt-platform-p3t51m7ip-edoardos-projects-61f55e37.vercel.app"],
};
const LOCAL: Record<Workspace, readonly string[]> = {
  admin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  platform: ["http://localhost:3100", "http://127.0.0.1:3100"],
};
const RETURN_KEY = "kruxt-workspace-return-origin";
const PROTOCOL = "kruxt-workspace-v1";
const TIMEOUT = 30_000;
type Identity = { id: string };
type Credentials = { access_token: string; refresh_token: string };
type Session = Credentials & { user: Identity };
export interface WorkspaceClient {
  auth: {
    getUser(): Promise<{ data: { user: Identity | null }; error: unknown }>;
    getSession(): Promise<{ data: { session: Session | null }; error: unknown }>;
    setSession(tokens: Credentials): Promise<{ error: unknown; data?: { session: Session | null } }>;
    signOut(options: { scope: "local" }): Promise<unknown>;
    onAuthStateChange(callback: (event: string, session: Session | null) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
  };
}

function originOnly(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

export function trustedWorkspaceOrigin(value: string, workspace: Workspace, currentOrigin: string): string | null {
  const origin = originOnly(value);
  if (!origin) return null;
  if (ORIGINS[workspace].includes(origin)) return origin;
  // Local destinations are allowed only when the source is itself an approved local workspace.
  if (Object.values(LOCAL).flat().includes(currentOrigin) && LOCAL[workspace].includes(origin)) return origin;
  return null;
}

export function resolveWorkspaceOrigin(workspace: Workspace, currentOrigin: string, candidates: Array<string | undefined> = []): string {
  for (const candidate of candidates) {
    const origin = candidate && trustedWorkspaceOrigin(candidate, workspace, currentOrigin);
    if (origin) return origin;
  }
  return Object.values(LOCAL).flat().includes(currentOrigin) ? LOCAL[workspace][0] : ORIGINS[workspace][0];
}

export function workspaceReturnOrigin(win: Window, workspace: Workspace): string | null {
  try {
    return trustedWorkspaceOrigin(win.sessionStorage.getItem(RETURN_KEY) ?? "", workspace, win.location.origin);
  } catch { return null; }
}

function project(projectUrl: string): string {
  const url = new URL(projectUrl);
  if (url.username || url.password || url.search || url.hash) throw new Error("Invalid authentication project.");
  return url.origin;
}

function destinationPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) {
    throw new Error("Invalid workspace destination.");
  }
  const url = new URL(path, "https://workspace.invalid");
  if (!["/", "/preview", "/members", "/tenants"].includes(url.pathname) || url.hash) {
    throw new Error("Invalid workspace destination.");
  }
  const permitted = new Set(["gymId", "supportSessionId", "source", "invite"]);
  for (const key of url.searchParams.keys()) {
    if (!permitted.has(key)) throw new Error("Invalid workspace destination.");
  }
  return url.pathname + url.search;
}

function nonce(win: Window): string {
  return Array.from(win.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("");
}

function message(data: unknown): Record<string, unknown> | null {
  return data !== null && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
}

async function verifiedSession(client: WorkspaceClient, expectedUser: string): Promise<Session> {
  const verified = await client.auth.getUser();
  if (verified.error || verified.data.user?.id !== expectedUser) throw new Error("Your sign-in changed. Switch again from the current account.");
  const local = await client.auth.getSession();
  if (local.error || !local.data.session || local.data.session.user.id !== expectedUser) throw new Error("Sign in again before switching workspaces.");
  return local.data.session;
}

export interface OpenWorkspaceOptions {
  win: Window;
  client: WorkspaceClient;
  projectUrl: string;
  workspace: Workspace;
  origin: string;
  expectedUser: string;
  prepare: () => Promise<string>;
  timeoutMs?: number;
}

/** Must be called directly from a click handler, before any await. */
export function openWorkspace(options: OpenWorkspaceOptions): Promise<void> {
  const { win, client, workspace, expectedUser } = options;
  const origin = trustedWorkspaceOrigin(options.origin, workspace, win.location.origin);
  const sourceWorkspace = workspace === "admin" ? "platform" : "admin";
  if (!origin || !trustedWorkspaceOrigin(win.location.origin, sourceWorkspace, win.location.origin)) {
    return Promise.reject(new Error("This workspace address is not approved for authenticated switching."));
  }
  const binding = nonce(win);
  const projectId = project(options.projectUrl);
  const opened = win.open("about:blank", "_blank");
  if (!opened) return Promise.reject(new Error("The new tab was blocked. Allow pop-ups for this site and try again."));
  const child = opened;

  return new Promise<void>((resolve, reject) => {
    let done = false;
    let sent = false;
    let verifying = false;
    const cleanup = () => {
      win.removeEventListener("message", receive);
      win.removeEventListener("pagehide", abandoned);
      win.clearTimeout(timer);
      subscription.unsubscribe();
    };
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      cleanup();
      if (error) { child.close(); reject(error); } else resolve();
    };
    const abandoned = () => finish(new Error("Workspace switch cancelled."));
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== expectedUser)) abandoned();
    });
    const timer = win.setTimeout(() => finish(new Error("Workspace switch timed out. Check the approved address and try again.")), options.timeoutMs ?? TIMEOUT);
    async function receive(event: MessageEvent) {
      const data = message(event.data);
      if (done || event.origin !== origin || event.source !== child || !data ||
          data.protocol !== PROTOCOL || data.nonce !== binding || data.project !== projectId || data.user !== expectedUser) return;
      if (data.type === "complete" && sent) { finish(); return; }
      if (data.type === "failed") {
        done = true;
        cleanup();
        reject(new Error("The destination could not verify this sign-in. Check its tab or sign in there separately."));
        return;
      }
      if (data.type !== "ready" || sent || verifying) return;
      verifying = true;
      try {
        const session = await verifiedSession(client, expectedUser);
        if (done) return;
        sent = true;
        child.postMessage({ protocol: PROTOCOL, type: "credentials", nonce: binding, project: projectId, user: expectedUser,
          access_token: session.access_token, refresh_token: session.refresh_token }, origin);
      } catch { finish(new Error("Unable to verify your current sign-in. Switch again after signing in.")); }
    }
    win.addEventListener("message", receive);
    win.addEventListener("pagehide", abandoned);
    void (async () => {
      try {
        await verifiedSession(client, expectedUser);
        if (done) return;
        const path = destinationPath(await options.prepare());
        if (done) return;
        const entry = new URL("/workspace-entry", origin);
        entry.hash = new URLSearchParams({ nonce: binding, source: win.location.origin, project: projectId, user: expectedUser, next: path }).toString();
        child.location.href = entry.href;
      } catch { finish(new Error("Unable to open this workspace. Confirm your sign-in and gym support access, then try again.")); }
    })();
  });
}

/** The route owns the lifetime; cleanup cancels pending work, including late SDK responses. */
export function receiveWorkspace(options: {
  win: Window; client: WorkspaceClient; workspace: Workspace; projectUrl: string;
  onComplete(path: string): void; onError(message: string): void; timeoutMs?: number;
}): () => void {
  const { win, client, workspace } = options;
  const params = new URLSearchParams(win.location.hash.slice(1));
  win.history.replaceState(null, "", win.location.pathname);
  const sourceWorkspace = workspace === "admin" ? "platform" : "admin";
  const source = trustedWorkspaceOrigin(params.get("source") ?? "", sourceWorkspace, win.location.origin);
  const binding = params.get("nonce") ?? "";
  const expectedUser = params.get("user") ?? "";
  const projectId = project(options.projectUrl);
  const opener = win.opener as Window | null;
  let path: string;
  try { path = destinationPath(params.get("next") ?? ""); } catch { options.onError("Invalid workspace destination. Return to the source tab and try again."); return () => {}; }
  if (!source || !opener || opener === win || !/^[a-f0-9]{64}$/.test(binding) || !expectedUser ||
      params.get("project") !== projectId || !trustedWorkspaceOrigin(win.location.origin, workspace, win.location.origin)) {
    options.onError("This workspace switch is missing its trusted source. Return to the source tab and try again.");
    return () => {};
  }
  let done = false;
  let consumed = false;
  let installed = false;
  let installedToken: string | null = null;
  const envelope = { protocol: PROTOCOL, nonce: binding, project: projectId, user: expectedUser };
  const notify = (type: string) => opener.postMessage({ ...envelope, type }, source);
  const cleanup = () => {
    win.clearTimeout(timer);
    win.removeEventListener("message", receive);
    win.removeEventListener("pagehide", cancel);
    subscription.unsubscribe();
  };
  const fail = (reason: string) => {
    if (done) return;
    done = true;
    cleanup();
    notify("failed");
    options.onError(reason);
  };
  const cancel = () => fail("Workspace switch cancelled. Return to the source tab and try again.");
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || (session && session.user.id !== expectedUser)) cancel();
  });
  const timer = win.setTimeout(() => fail("Workspace switch timed out. Return to the source tab and try again."), options.timeoutMs ?? TIMEOUT);
  async function clearInstalled() {
    if (!installed) return;
    const current = await client.auth.getSession();
    if (current.data.session?.user.id === expectedUser && current.data.session.access_token === installedToken) {
      await client.auth.signOut({ scope: "local" });
    }
  }
  async function receive(event: MessageEvent) {
    const data = message(event.data);
    if (done || consumed || event.origin !== source || event.source !== opener || !data ||
        data.protocol !== PROTOCOL || data.type !== "credentials" || data.nonce !== binding ||
        data.project !== projectId || data.user !== expectedUser ||
        typeof data.access_token !== "string" || !data.access_token ||
        typeof data.refresh_token !== "string" || !data.refresh_token) return;
    consumed = true;
    try {
      const existing = await client.auth.getSession();
      if (done) return;
      if (existing.error) throw new Error("Unable to check the current destination account.");
      if (existing.data.session) {
        if (existing.data.session.user.id !== expectedUser) throw new Error("A different account is already signed in here. Sign out in this tab before switching.");
        const verified = await client.auth.getUser();
        if (done) return;
        if (verified.error || verified.data.user?.id !== expectedUser) throw new Error("Unable to verify the destination account. Sign out here before switching.");
      } else {
        if (done) return;
        installed = true;
        installedToken = data.access_token;
        const result = await client.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
        installedToken = result.data?.session?.access_token ?? installedToken;
        if (result.error) throw new Error("The destination could not establish your sign-in.");
        if (done) { await clearInstalled(); return; }
      }
      const verified = await client.auth.getUser();
      if (done) { await clearInstalled(); return; }
      if (verified.error || verified.data.user?.id !== expectedUser) throw new Error("The destination could not verify your identity.");
      // This is non-secret navigation metadata, never a credential or PKCE verifier.
      try { win.sessionStorage.setItem(RETURN_KEY, source); } catch { /* Returning falls back to the approved alias. */ }
      done = true;
      cleanup();
      notify("complete");
      options.onComplete(path);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Workspace sign-in failed.");
      await clearInstalled();
    }
  }
  win.addEventListener("message", receive);
  win.addEventListener("pagehide", cancel);
  notify("ready");
  return () => { if (!done) { done = true; cleanup(); } };
}
