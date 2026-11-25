"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = { client: SupabaseClient; viewerId: string; onVerified?: () => void };
type Factor = { id: string; verified: boolean };
type Setup = { id: string; qr: string; secret: string };
const control = "min-h-10 max-w-full rounded-md border border-border bg-kruxt-panel px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";
const button = control + " hover:bg-muted";
const failure = "Authenticator check unavailable. Retry, or sign in again if your account changed.";

// Only in-memory state; changing viewer destroys all enrollment material immediately.
export function OperatorMfa(props: Props) {
  return <MfaPanel key={props.viewerId} {...props} />;
}

function MfaPanel({ client, viewerId, onVerified }: Props) {
  const id = useId();
  const latest = useRef({ client, viewerId, onVerified });
  latest.current = { client, viewerId, onVerified };
  const generation = useRef(0);
  const active = useRef(false);
  const operation = useRef<"load" | "enroll" | "verify" | null>(null);
  const [revision, setRevision] = useState(0);
  const [owner, setOwner] = useState(client);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [verified, setVerified] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [selected, setSelected] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
  const hasVerified = factors.some((factor) => factor.verified);
  const visible = owner === client;

  function clearPrivate() { setSetup(null); setCode(""); }
  function valid(ticket: number) {
    return active.current && generation.current === ticket && latest.current.client === client && latest.current.viewerId === viewerId;
  }
  async function checkUser(ticket: number) {
    const result = await client.auth.getUser();
    if (!valid(ticket)) throw new Error("unavailable");
    if (result.error || result.data.user?.id !== viewerId) {
      clearPrivate(); setReady(false); setVerified(false);
      throw new Error("unavailable");
    }
  }

  useEffect(() => {
    active.current = true;
    const ticket = ++generation.current;
    operation.current = "load";
    setOwner(client);
    setReady(false); setVerified(false); setBusy(true);
    setFactors([]); setSelected(""); setResuming(false); clearPrivate(); setError("");
    // Never await an Auth call inside the subscription: the SDK holds its session lock.
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active.current) return;
      if (event === "INITIAL_SESSION") {
        if (session?.user.id === viewerId) return;
        ++generation.current; operation.current = null;
        clearPrivate(); setReady(false); setVerified(false); setBusy(false); setError(failure);
        return;
      }
      if (event === "MFA_CHALLENGE_VERIFIED" && session?.user.id === viewerId && operation.current === "verify") {
        clearPrivate();
        return; // The initiating operation still checks getUser and current AAL below.
      }
      ++generation.current;
      operation.current = null;
      clearPrivate(); setReady(false); setVerified(false); setBusy(true);
      setRevision((value) => value + 1);
    });
    void (async () => {
      try {
        await checkUser(ticket);
        const list = await client.auth.mfa.listFactors();
        if (!valid(ticket) || list.error || !list.data) throw new Error("unavailable");
        const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!valid(ticket) || assurance.error || !assurance.data?.currentLevel) throw new Error("unavailable");
        await checkUser(ticket);
        const next = list.data.all.filter((factor) => factor.factor_type === "totp")
          .map((factor) => ({ id: factor.id, verified: factor.status === "verified" }));
        setFactors(next);
        setSelected(next.find((factor) => factor.verified)?.id ?? next[0]?.id ?? "");
        setVerified(assurance.data.currentLevel === "aal2");
        setReady(true);
      } catch {
        if (valid(ticket)) { clearPrivate(); setError(failure); }
      } finally {
        if (valid(ticket)) { operation.current = null; setBusy(false); }
      }
    })();
    return () => {
      active.current = false; ++generation.current; operation.current = null;
      subscription.unsubscribe();
      // Release references; no secret is retained in a cache or persistent storage.
      clearPrivate();
    };
  }, [client, viewerId, revision]);

  async function enroll() {
    if (operation.current || !ready || verified || hasVerified || !visible) return;
    operation.current = "enroll"; setBusy(true); setError(""); setNotice("");
    const ticket = generation.current;
    try {
      await checkUser(ticket);
      const result = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "KRUXT operator" });
      if (!valid(ticket) || result.error || !result.data) throw new Error("unavailable");
      await checkUser(ticket);
      const { id: factorId, totp } = result.data;
      // SDK versions return either raw SVG or an SVG data URL. Never load a remote QR URL.
      const raw = totp.qr_code;
      const qr = raw.trimStart().startsWith("<svg") ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`
        : raw.startsWith("data:image/svg+xml;") || raw.startsWith("data:image/svg+xml,") ? raw : "";
      setSetup({ id: factorId, qr, secret: totp.secret });
      setFactors((current) => [...current, { id: factorId, verified: false }]);
      setSelected(factorId); setResuming(true); setCode("");
    } catch {
      if (valid(ticket)) { clearPrivate(); setError("Setup unavailable. Retry the account check before trying again; an unfinished factor may remain."); setReady(false); }
    } finally {
      if (valid(ticket)) { operation.current = null; setBusy(false); }
    }
  }

  async function verify() {
    if (operation.current || !ready || !visible) return;
    if (!/^[0-9]{6}$/.test(code)) { setError("Enter a six-digit authenticator code."); codeInput.current?.focus(); return; }
    const factorId = setup?.id ?? selected;
    if (!factors.some((factor) => factor.id === factorId)) return;
    operation.current = "verify"; setBusy(true); setError(""); setNotice("");
    const ticket = generation.current;
    let submittedCode = code;
    setCode("");
    try {
      await checkUser(ticket);
      const result = await client.auth.mfa.challengeAndVerify({ factorId, code: submittedCode });
      submittedCode = "";
      if (!valid(ticket) || result.error) throw new Error("unavailable");
      await checkUser(ticket);
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!valid(ticket) || assurance.error || assurance.data?.currentLevel !== "aal2") throw new Error("unavailable");
      await checkUser(ticket);
      clearPrivate(); setVerified(true); setResuming(false);
    } catch {
      if (valid(ticket)) { setCode(""); setError("Verification not confirmed. Enter a fresh six-digit code and retry, or retry the account check."); codeInput.current?.focus(); }
      return;
    } finally {
      submittedCode = "";
      if (valid(ticket)) { operation.current = null; setBusy(false); }
    }
    if (valid(ticket)) latest.current.onVerified?.();
  }

  function cancel() {
    ++generation.current; operation.current = null;
    clearPrivate(); setResuming(false); setBusy(false); setError("");
    setNotice("Cancelled. No factor was deleted. An unfinished setup may remain; retry the account check to resume with a code if you saved it in your authenticator. If not, contact your account administrator for authenticator management.");
    setReady(false);
  }

  const choices = hasVerified ? factors.filter((factor) => factor.verified) : factors;
  const showCode = ready && !verified && (hasVerified || resuming);
  return <section aria-labelledby={`${id}-title`} aria-busy={busy} className="min-w-0 space-y-4 border-b border-border py-5">
    <div className="space-y-1">
      <h2 id={`${id}-title`} className="text-base font-semibold">Operator verification</h2>
      <p className="text-sm text-muted-foreground">Privileged changes require authenticator verification (AAL2).</p>
    </div>
    {visible && verified ? <p role="status" className="text-sm text-foreground">Authenticator verified for this session (AAL2).</p> : <>
      {busy && <p role="status" className="text-sm text-muted-foreground">{operation.current === "enroll" ? "Preparing authenticator..." : operation.current === "verify" ? "Verifying authenticator..." : "Checking authenticator..."}</p>}
      {visible && error && <p role="alert" className="text-sm text-kruxt-danger">{error}</p>}
      {visible && notice && <p role="status" className="max-w-prose text-sm text-muted-foreground">{notice}</p>}
      {visible && !ready && !busy && <button type="button" className={button} onClick={() => setRevision((value) => value + 1)}>Retry account check</button>}
      {visible && ready && !hasVerified && !resuming && <div className="flex flex-wrap gap-3">
        <button type="button" className={button} disabled={busy} onClick={() => void enroll()}>Set up authenticator</button>
        {choices.length > 0 && <button type="button" className={button} disabled={busy} onClick={() => { setResuming(true); setError(""); }}>Resume unfinished setup</button>}
      </div>}
      {visible && showCode && <form className="max-w-md space-y-4" onSubmit={(event) => { event.preventDefault(); void verify(); }}>
        {!setup && <div className="space-y-2">
          <label htmlFor={`${id}-factor`} className="block text-sm font-medium">Authenticator</label>
          <select id={`${id}-factor`} className={`${control} w-full`} value={selected} disabled={busy} onChange={(event) => { setSelected(event.target.value); setCode(""); setError(""); }}>
            {choices.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.verified ? "Authenticator" : "Unfinished authenticator"} {index + 1}</option>)}
          </select>
          {!hasVerified && <p className="text-sm text-muted-foreground">The original QR and secret cannot be retrieved here. Resume only if you saved this setup in your authenticator. Otherwise contact your account administrator for authenticator management.</p>}
        </div>}
        {setup && <div className="space-y-3">
          <p className="text-sm">Scan with your authenticator app, then enter its current code.</p>
          {setup.qr && <img src={setup.qr} alt="Authenticator setup QR code" width={192} height={192} className="h-48 w-48 max-w-full bg-white" />}
          <details><summary className="cursor-pointer text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Show manual setup secret</summary>
            <p className="mt-2 break-all font-mono text-sm">{setup.secret}</p>
          </details>
        </div>}
        <div className="space-y-2">
          <label htmlFor={`${id}-code`} className="block text-sm font-medium">Six-digit authenticator code</label>
          <input ref={codeInput} id={`${id}-code`} className={`${control} w-full tabular-nums`} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy} onChange={(event) => setCode(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy || !/^[0-9]{6}$/.test(code)} className={`${button} border-kruxt-platform bg-kruxt-platform text-white hover:bg-kruxt-platform/80`}>Verify authenticator</button>
          <button type="button" className={button} onClick={cancel}>Cancel</button>
        </div>
        {error && <button type="button" className={button} disabled={busy} onClick={() => { clearPrivate(); setRevision((value) => value + 1); }}>Retry account check</button>}
      </form>}
      {visible && busy && operation.current === "enroll" && <button type="button" className={button} onClick={cancel}>Cancel</button>}
    </>}
  </section>;
}
