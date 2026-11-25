"use client";

import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "loading" | "challenge" | "verified" | "consumed" | "expired" | "error";
const SITE_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TOKEN_AGE_MS = 110_000;

// Web-only subpath: never imported by the shared React Native entry point.
export function useAuthCaptcha(siteKey: string | undefined) {
  const key = siteKey?.trim() ?? "";
  const enabled = key.length > 0;
  const validKey = SITE_KEY.test(key);
  const [generation, setGeneration] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const version = useRef(0);
  const mounted = useRef(true);
  const loaded = useRef(false);
  const consumed = useRef(false);
  const token = useRef<{ value: string; issuedAt: number } | null>(null);

  const reset = useCallback(() => {
    version.current++;
    token.current = null;
    loaded.current = false;
    consumed.current = false;
    if (!mounted.current) return;
    setPhase("loading");
    setGeneration(version.current);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      version.current++;
      token.current = null;
    };
  }, []);

  useEffect(() => { reset(); }, [key, reset]);

  useEffect(() => {
    if (!enabled || !validKey) return;
    const expected = generation;
    const timer = setTimeout(() => {
      if (mounted.current && version.current === expected && !loaded.current) setPhase("error");
    }, 20_000);
    return () => clearTimeout(timer);
  }, [enabled, validKey, generation]);

  useEffect(() => {
    if (phase !== "verified") return;
    const expected = generation;
    const timer = setTimeout(() => {
      if (mounted.current && version.current === expected) {
        token.current = null;
        setPhase("expired");
      }
    }, MAX_TOKEN_AGE_MS);
    return () => clearTimeout(timer);
  }, [generation, phase]);

  function takeToken(): string | undefined {
    if (!enabled) return undefined;
    const current = token.current;
    if (!validKey || consumed.current || !current || Date.now() - current.issuedAt >= MAX_TOKEN_AGE_MS) {
      token.current = null;
      throw { code: "captcha_required" };
    }
    token.current = null;
    consumed.current = true;
    setPhase("consumed");
    return current.value;
  }

  const current = () => mounted.current && version.current === generation;
  const unavailable = !validKey || phase === "error";
  const widget = !enabled ? null : (
    <div aria-label="Security verification" style={{ minWidth: 0, marginBlock: 12 }}>
      {validKey && <div style={{ minHeight: 144 }}>
        <HCaptcha key={`${key}:${generation}`} sitekey={key} size="compact" theme="dark"
          sentry={false} userJourneys={false} reCaptchaCompat={false}
          onLoad={() => { if (current()) { loaded.current = true; setPhase(value => value === "loading" ? "challenge" : value); } }}
          onVerify={(value) => {
            if (!current() || consumed.current || !value) return;
            token.current = { value, issuedAt: Date.now() };
            setPhase("verified");
          }}
          onExpire={() => { if (current()) { token.current = null; setPhase("expired"); } }}
          onChalExpired={() => { if (current()) { token.current = null; setPhase("expired"); } }}
          onError={() => { if (current()) { token.current = null; setPhase("error"); } }}
        />
      </div>}
      <p role="status" style={{ fontSize: 14, lineHeight: 1.5, overflowWrap: "anywhere" }}>
        {unavailable ? "Security verification is unavailable. Try refreshing verification or contact support."
          : phase === "expired" ? "Security verification expired. Complete a new verification."
          : phase === "verified" ? "Security verification complete."
          : phase === "loading" ? "Loading security verification..." : ""}
      </p>
      {(unavailable || phase === "expired") && <button type="button" onClick={reset}
        style={{ font: "inherit", color: "inherit", background: "transparent", border: "1px solid currentColor", borderRadius: 4, padding: "8px 12px" }}>
        Refresh verification
      </button>}
    </div>
  );

  return { widget, takeToken, reset, verified: phase === "verified" };
}
