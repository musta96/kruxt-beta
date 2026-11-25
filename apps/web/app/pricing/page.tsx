import type { Metadata } from "next";

import { PricingMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Explore early-access KRUXT pricing for athletes and gyms."
};

export default function PricingPage() {
  return <PricingMarketingPage gymAdminUrl={getGymAdminLoginUrl()} />;
}
