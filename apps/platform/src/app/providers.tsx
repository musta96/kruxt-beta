"use client";

import type { ReactNode } from "react";
import { PlatformAuthProvider } from "@/contexts/platform-auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return <PlatformAuthProvider>{children}</PlatformAuthProvider>;
}
