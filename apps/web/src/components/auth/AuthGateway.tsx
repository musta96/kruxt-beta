"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { ensureProfileForUser, resolveAdminAccess } from "@/lib/auth/access";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export function AuthGateway() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  async function resolvePostAuthPath(): Promise<string> {
    const access = await resolveAdminAccess(supabase);
    if (access.platformRole === "founder") return "/admin";
    if (access.staffGymIds.length > 0) return "/org";
    return "/org";
  }

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (data.user) {
        const nextPath = await resolvePostAuthPath();
        router.replace(nextPath);
        return;
      }

      setCheckingSession(false);
    };

    const listener = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        void resolvePostAuthPath().then((nextPath) => {
          if (!active) return;
          router.replace(nextPath);
        });
      }
    });

    void checkSession();

    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password
        });
        if (signInError) throw signInError;

        const nextPath = await resolvePostAuthPath();
        router.replace(nextPath);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password
      });
      if (signUpError) throw signUpError;

      if (signUpData.user) {
        await ensureProfileForUser(supabase, {
          userId: signUpData.user.id,
          email: normalizedEmail,
          username,
          displayName
        });
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (signInError) {
        setError(
          signInError.message.includes("Email not confirmed")
            ? "Account created. Check your email to confirm before signing in."
            : signInError.message
        );
        return;
      }

      const nextPath = await resolvePostAuthPath();
      router.replace(nextPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="container">
        <div className="panel">
          <h1 className="heading">KRUXT</h1>
          <p className="subheading">Checking your session...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1 className="heading">KRUXT</h1>
        <p className="subheading">Operations and coaching platform for gyms and staff.</p>

        <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn ${mode === "signin" ? "btn-primary" : ""}`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn ${mode === "signup" ? "btn-primary" : ""}`}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid">
          {mode === "signup" && (
            <>
              <div>
                <label className="label" htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Edoardo Mustarelli"
                />
              </div>
              <div>
                <label className="label" htmlFor="username">Username</label>
                <input
                  id="username"
                  className="input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="musta96"
                />
              </div>
            </>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="mustarelli.edoardo@gmail.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signup" ? "Minimum 8 characters" : "Your password"}
            />
          </div>

          {error && (
            <div className="badge badge-danger" role="alert" style={{ justifyContent: "center" }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
