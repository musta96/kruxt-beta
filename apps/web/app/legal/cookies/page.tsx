import type { Metadata } from "next";

import { LegalMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "Cookie Notice",
  description: "KRUXT cookie notice and browser storage information."
};

export default function CookiesPage() {
  return (
    <LegalMarketingPage
      gymAdminUrl={getGymAdminLoginUrl()}
      title="Cookie Notice"
      intro="KRUXT uses limited browser storage and similar technologies to keep the product secure, remember essential preferences, and understand product performance."
      sections={[
        {
          heading: "Strictly necessary storage",
          body:
            "Some cookies or local storage entries are required for authentication, session security, routing, fraud prevention, consent records, and core app functionality."
        },
        {
          heading: "Preference storage",
          body:
            "KRUXT may remember product choices such as unit system, selected views, dismissed notices, and other interface preferences so the app feels consistent when you return."
        },
        {
          heading: "Analytics and performance",
          body:
            "During beta, KRUXT may use privacy-conscious analytics to understand reliability, feature usage, errors, and performance. These tools should not be used to sell personal information."
        },
        {
          heading: "Third parties",
          body:
            "Integrated services such as authentication, payments, email, infrastructure, or wearable providers may use their own cookies or similar technologies when required to provide their service."
        },
        {
          heading: "Your controls",
          body:
            "You can control cookies through your browser settings. Blocking necessary cookies or storage may prevent login, app navigation, or security-sensitive workflows from working correctly."
        }
      ]}
    />
  );
}
