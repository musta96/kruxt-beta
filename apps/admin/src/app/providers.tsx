"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/auth-context";
import { GymProvider } from "@/contexts/gym-context";
import { ClassSeriesPendingCleanup } from "@/components/class-series-pending-cleanup";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ClassSeriesPendingCleanup />
      <GymProvider>{children}</GymProvider>
    </AuthProvider>
  );
}
