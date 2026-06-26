import type { Metadata } from "next";

import { GymsMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "For gyms",
  description: "Run members, staff, coaching, classes, check-ins, waivers, payments, reporting, and branding with KRUXT."
};

export default function ForGymsPage() {
  return <GymsMarketingPage gymAdminUrl={getGymAdminLoginUrl()} />;
}
