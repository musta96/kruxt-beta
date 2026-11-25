"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { startPendingCleanup } from "@/services/class-series-pending";

export function ClassSeriesPendingCleanup() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => startPendingCleanup({ window, document }), [pathname, user?.id]);

  return null;
}
