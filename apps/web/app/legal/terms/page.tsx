import type { Metadata } from "next";

import { LegalMarketingPage } from "@/components/marketing/MarketingPages";
import { getGymAdminLoginUrl } from "@/lib/marketing-url";

export const metadata: Metadata = {
  title: "Terms",
  description: "KRUXT beta terms for using the athlete app and gym workspaces."
};

export default function TermsPage() {
  return (
    <LegalMarketingPage
      gymAdminUrl={getGymAdminLoginUrl()}
      title="Terms"
      intro="These terms describe the baseline rules for using KRUXT during beta, including accounts, training content, gym workspaces, and acceptable use."
      sections={[
        {
          heading: "Accounts and eligibility",
          body:
            "You are responsible for keeping your account secure and for providing accurate information. Gym owners and staff must only access member data for legitimate gym, coaching, support, or compliance purposes."
        },
        {
          heading: "Training and health disclaimer",
          body:
            "KRUXT helps organize training information but does not replace medical advice. You are responsible for training within your ability and seeking qualified professional guidance where needed."
        },
        {
          heading: "User content and proof",
          body:
            "Workout proof, comments, messages, profile information, and uploaded media remain your responsibility. Do not upload illegal, harmful, abusive, misleading, or rights-infringing content."
        },
        {
          heading: "Gyms, coaches, and services",
          body:
            "Gyms and coaches are responsible for their own services, pricing, schedules, staffing, safety standards, member approvals, and compliance obligations. KRUXT provides the software layer."
        },
        {
          heading: "Payments and subscriptions",
          body:
            "Payment features may vary by gym, plan, country, and beta stage. Fees, refunds, credits, and cancellations are governed by the applicable gym or KRUXT subscription terms shown at purchase."
        },
        {
          heading: "Acceptable use",
          body:
            "Do not attempt to bypass permissions, scrape private data, abuse support workflows, interfere with service availability, impersonate others, or use KRUXT for unsafe or unlawful purposes."
        }
      ]}
    />
  );
}
