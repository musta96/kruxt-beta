import type { Metadata } from "next";

import { AthletesMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "For athletes",
  description: "Plan training, log workouts, prove progress, join gyms, and stay connected to coaches with KRUXT."
};

export default function ForAthletesPage() {
  return <AthletesMarketingPage gymAdminUrl={getGymAdminLoginUrl()} />;
}
