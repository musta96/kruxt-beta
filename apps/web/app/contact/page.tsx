import type { Metadata } from "next";

import { ContactMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact KRUXT for gym onboarding, beta access, partnerships, and support."
};

export default function ContactPage() {
  return <ContactMarketingPage gymAdminUrl={getGymAdminLoginUrl()} />;
}
