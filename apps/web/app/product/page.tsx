import type { Metadata } from "next";

import { ProductMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "Product",
  description: "See how KRUXT connects training plans, proof, coaching, community, and gym operations."
};

export default function ProductPage() {
  return <ProductMarketingPage gymAdminUrl={getGymAdminLoginUrl()} />;
}
