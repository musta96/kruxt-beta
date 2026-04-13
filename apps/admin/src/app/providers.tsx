"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { GymProvider } from "@/contexts/gym-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <GymProvider>{children}</GymProvider>
    </AuthProvider>
  );
}
