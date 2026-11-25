import type { Metadata } from "next";

import { LegalMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description: "KRUXT privacy notice for athletes, gym staff, and platform users."
};

export default function PrivacyNoticePage() {
  return (
    <LegalMarketingPage
      gymAdminUrl={getGymAdminLoginUrl()}
      title="Privacy Notice"
      intro="This notice explains the kinds of information KRUXT uses to provide the athlete app, gym workspaces, coaching tools, integrations, support, and security."
      sections={[
        {
          heading: "Information we collect",
          body:
            "KRUXT may process account details, profile information, gym memberships, workout logs, proof posts, comments, check-ins, class bookings, coaching notes, device integration data, support messages, consents, and security events."
        },
        {
          heading: "How we use information",
          body:
            "We use information to operate the product, personalize training plans, show progress, enable gym and coach workflows, provide support, maintain safety, prevent abuse, satisfy legal obligations, and improve KRUXT."
        },
        {
          heading: "Gym and coach visibility",
          body:
            "When you join a gym or are assigned to a coach, the gym or assigned staff may see the information required to support membership, coaching, scheduling, waivers, billing, and safety workflows."
        },
        {
          heading: "Integrations and health-related data",
          body:
            "Device and wearable integrations are optional. Fitness, health-adjacent, injury, progress photo, and measurement data should be handled with extra care and only used where consent and product settings allow it."
        },
        {
          heading: "Your choices and rights",
          body:
            "You can manage visibility, integrations, consents, and privacy requests in KRUXT. Depending on where you live, you may request access, export, correction, deletion, restriction, or objection."
        },
        {
          heading: "Retention and security",
          body:
            "KRUXT is designed with audit logs, role-based access, consent history, and privacy request workflows. Some records may be retained where required for legal, tax, fraud-prevention, or safety reasons."
        }
      ]}
    />
  );
}
