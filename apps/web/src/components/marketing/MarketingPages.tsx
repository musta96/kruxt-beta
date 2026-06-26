import Image from "next/image";

import { ArrowIcon, MarketingChrome } from "./MarketingChrome";
import { AthleteJourneyPreview, AthletePhonePreview, GymDashboardPreview } from "./ProductPreviews";

type MarketingPageProps = {
  gymAdminUrl: string;
};

const athleteFeatures = [
  ["Adaptive weekly plan", "Mix strength, conditioning, classes, running, hybrid preparation, and recovery around real life."],
  ["Guided workout execution", "Follow blocks, coach notes, targets, rest, equipment, and substitutions without losing the plan."],
  ["Proof and accountability", "Turn completed sessions into proof posts, streaks, milestones, groups, and coach visibility."],
  ["Progress identity", "Keep PRs, attendance, adherence, rank, badges, and recent work together in one meaningful profile."],
  ["Gym and coach connection", "Request gym access, book classes, receive coaching, and keep the plan connected to where you train."],
  ["Your data, your controls", "Manage integrations, consent, privacy requests, support, and personal visibility from your account."]
];

const gymFeatures = [
  ["Members", "Profiles, self-serve join, approval queues, invite links, status, plans, waivers, check-ins, and consent history."],
  ["Staff", "Owner, manager, and coach roles; custom permissions; shifts; coverage; class ownership; and audit trails."],
  ["Coaching", "Athlete rosters, progress, live programs, versioning, exercise swaps, scheduling, notes, and secure messaging."],
  ["Classes", "Recurring schedules, coach assignment, capacity, waitlists, bookings, cancellations, and attendance."],
  ["Money", "Member plans, manual invoices, automated payments when enabled, refunds, dunning, and revenue reporting."],
  ["Brand and growth", "Public page, custom colors and logo, gym discovery, invitations, reports, automations, and integrations."]
];

export function ProductMarketingPage({ gymAdminUrl }: MarketingPageProps) {
  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <section className="marketing-page-hero">
        <h1>The connected system behind better training.</h1>
        <p>
          KRUXT connects the athlete experience, coaching relationship, and daily gym operation so progress never
          disappears between tools.
        </p>
        <div className="marketing-cta-row">
          <a className="marketing-button marketing-button-primary" href="/#member-login">
            Start training
            <ArrowIcon />
          </a>
          <a className="marketing-button marketing-button-secondary" href="/contact#gyms">
            Book a gym walkthrough
          </a>
        </div>
      </section>

      <section className="marketing-page-band">
        <div className="marketing-section-heading">
          <h2>From intention to evidence.</h2>
          <p>Every part of KRUXT contributes to one continuous training record instead of another isolated feature.</p>
        </div>
        <AthleteJourneyPreview />
      </section>

      <section className="marketing-page-two-column">
        <div>
          <span className="marketing-page-index">01</span>
          <h2>Built around the athlete.</h2>
          <p>
            The plan is the operating system: today&apos;s work, the full week, workout execution, proof, community,
            progress, gym access, and coach feedback all meet in one mobile-first experience.
          </p>
          <a className="marketing-inline-link" href="/for-athletes">
            See the athlete experience
            <ArrowIcon />
          </a>
        </div>
        <AthletePhonePreview />
      </section>

      <section className="marketing-page-two-column marketing-page-two-column-reverse">
        <GymDashboardPreview />
        <div>
          <span className="marketing-page-index">02</span>
          <h2>Useful to the people running the gym.</h2>
          <p>
            Member operations, staff, classes, coaching, check-ins, waivers, payments, reports, support, and branding
            work from the same source of truth.
          </p>
          <a className="marketing-inline-link" href="/for-gyms">
            Explore the gym platform
            <ArrowIcon />
          </a>
        </div>
      </section>

      <MarketingClosingCta />
    </MarketingChrome>
  );
}

export function AthletesMarketingPage({ gymAdminUrl }: MarketingPageProps) {
  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <section className="marketing-page-hero marketing-athlete-page-hero">
        <div>
          <h1>Train with direction. Keep what you earn.</h1>
          <p>
            KRUXT gives people who train a living weekly plan, a complete workout record, proof-backed progress, and a
            community that understands the work.
          </p>
          <div className="marketing-cta-row">
            <a className="marketing-button marketing-button-primary" href="/#member-login">
              Create your account
              <ArrowIcon />
            </a>
            <a className="marketing-button marketing-button-secondary" href="#athlete-features">
              Explore features
            </a>
          </div>
        </div>
        <div className="marketing-athlete-hero-visual">
          <Image
            src="/marketing/kruxt-athlete-hero.jpg"
            alt="Athlete preparing for a strength session"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
          />
          <AthletePhonePreview />
        </div>
      </section>

      <section className="marketing-feature-list" id="athlete-features">
        <div className="marketing-section-heading">
          <h2>Not another folder of workouts.</h2>
          <p>KRUXT keeps the full training loop connected before, during, and after every session.</p>
        </div>
        <div className="marketing-feature-rows">
          {athleteFeatures.map(([title, copy], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-page-band">
        <div className="marketing-section-heading">
          <h2>Plan. Train. Prove. Progress.</h2>
          <p>The same session updates your plan, history, progress, coach view, and community contribution.</p>
        </div>
        <AthleteJourneyPreview />
      </section>

      <MarketingClosingCta />
    </MarketingChrome>
  );
}

export function GymsMarketingPage({ gymAdminUrl }: MarketingPageProps) {
  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <section className="marketing-page-hero marketing-gym-page-hero">
        <h1>Your gym should not need six tools to feel organized.</h1>
        <p>
          KRUXT brings members, staff, classes, coaching, waivers, check-ins, payments, reporting, support, and your
          public brand into one connected workspace.
        </p>
        <div className="marketing-cta-row">
          <a className="marketing-button marketing-button-primary" href="/contact#gyms">
            Book a walkthrough
            <ArrowIcon />
          </a>
          <a className="marketing-button marketing-button-secondary" href={gymAdminUrl}>
            Gym admin sign in
          </a>
        </div>
      </section>

      <section className="marketing-gym-showcase">
        <GymDashboardPreview />
      </section>

      <section className="marketing-feature-list">
        <div className="marketing-section-heading">
          <h2>One operating system for the whole gym.</h2>
          <p>Give every role the right view while the business keeps one source of truth.</p>
        </div>
        <div className="marketing-feature-rows">
          {gymFeatures.map(([title, copy], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-gym-value-band">
        <div>
          <h2>Keep the member experience connected.</h2>
          <p>
            Staff changes reach the athlete app immediately: class bookings enter the plan, published programs reach
            the member, completed work reaches the coach, and permissions stay enforced throughout.
          </p>
        </div>
        <div>
          <strong>White-label ready</strong>
          <span>Colors, logo, public page, plan visibility, and publishing controls.</span>
          <strong>Built for accountable teams</strong>
          <span>Role-based access, sensitive-data controls, MFA gates, and activity history.</span>
        </div>
      </section>

      <MarketingClosingCta gym />
    </MarketingChrome>
  );
}

export function PricingMarketingPage({ gymAdminUrl }: MarketingPageProps) {
  const gymPlans = [
    ["Launch", "€0", "For a small gym proving the workflow.", ["Up to 50 active members", "Core member management", "Classes and check-ins", "Manual payments", "Public page and invites"]],
    ["Starter", "€39 / month", "For an independent gym replacing basic tools.", ["Up to 200 active members", "Staff scheduling and PT assignment", "Versioned waivers and e-sign", "Automated member payments", "Basic reports and branding"]],
    ["Pro", "€129 / month", "For a coaching-led gym ready to grow.", ["Unlimited members and staff", "Private coaching workspace", "Advanced analytics and automations", "Wearable integrations", "AI coaching credits"]],
    ["Enterprise", "Custom", "For multi-location and franchise operations.", ["Multi-location reporting", "SSO and API access", "Custom data residency and DPA", "Franchise entitlement controls", "Dedicated support"]]
  ] as const;

  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <section className="marketing-page-hero marketing-pricing-hero">
        <h1>Start where you are. Grow when you need more.</h1>
        <p>
          Athletes can use KRUXT free during beta. Gym plans scale from essential operations to complete coaching and
          multi-location control.
        </p>
      </section>

      <section className="marketing-athlete-price">
        <div>
          <span>KRUXT for athletes</span>
          <h2>Free during beta</h2>
          <p>Plan, workout logging, proof, community, gym discovery, progress, integrations, privacy, and support.</p>
        </div>
        <a className="marketing-button marketing-button-primary" href="/#member-login">
          Create your account
          <ArrowIcon />
        </a>
      </section>

      <section className="marketing-plan-list">
        <div className="marketing-section-heading">
          <h2>KRUXT for gyms</h2>
          <p>Early-access price anchors shown in EUR. Final commercial packaging may evolve during beta.</p>
        </div>
        {gymPlans.map(([name, price, description, features]) => (
          <article key={name}>
            <div>
              <span>{name}</span>
              <h3>{price}</h3>
              <p>{description}</p>
            </div>
            <ul>
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <a className="marketing-inline-link" href="/contact#gyms">
              {name === "Enterprise" ? "Talk to KRUXT" : "Choose this plan"}
              <ArrowIcon />
            </a>
          </article>
        ))}
      </section>

      <section className="marketing-pricing-note">
        <h2>Clear foundations, contextual upgrades.</h2>
        <p>
          There is no standalone "Premium" destination. Advanced programs, analytics, coaching tools, API access, and
          AI features appear where they create value.
        </p>
      </section>
    </MarketingChrome>
  );
}

export function ContactMarketingPage({ gymAdminUrl }: MarketingPageProps) {
  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <section className="marketing-page-hero marketing-contact-hero">
        <h1>Let&apos;s find the right next step.</h1>
        <p>Talk to KRUXT about gym onboarding, beta access, partnerships, support, or product questions.</p>
      </section>
      <section className="marketing-contact-grid">
        <article id="gyms">
          <span>For gyms</span>
          <h2>Book a product walkthrough.</h2>
          <p>Tell us how your gym works today and which tools you want to replace.</p>
          <a className="marketing-button marketing-button-primary" href="mailto:support@kruxt.app?subject=KRUXT%20gym%20walkthrough">
            Email the gym team
            <ArrowIcon />
          </a>
        </article>
        <article id="support">
          <span>Support</span>
          <h2>Get help with KRUXT.</h2>
          <p>Include your account email, gym name when relevant, and a short description of what happened.</p>
          <a className="marketing-button marketing-button-secondary" href="mailto:support@kruxt.app?subject=KRUXT%20support">
            Contact support
            <ArrowIcon />
          </a>
        </article>
      </section>
    </MarketingChrome>
  );
}

type LegalMarketingPageProps = MarketingPageProps & {
  title: string;
  intro: string;
  sections: Array<{ heading: string; body: string }>;
};

export function LegalMarketingPage({ gymAdminUrl, title, intro, sections }: LegalMarketingPageProps) {
  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <article className="marketing-legal-page">
        <header>
          <span>Last updated June 25, 2026</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <aside>
          KRUXT is currently in beta. These public notices describe the product&apos;s intended handling and should
          receive legal review before broad commercial launch.
        </aside>
        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <p className="marketing-legal-contact">
          Questions can be sent to <a href="mailto:support@kruxt.app">support@kruxt.app</a>.
        </p>
      </article>
    </MarketingChrome>
  );
}

function MarketingClosingCta({ gym = false }: { gym?: boolean }) {
  return (
    <section className="marketing-final-cta marketing-page-closing-cta">
      <Image
        src="/marketing/kruxt-community.jpg"
        alt="Training partners sharing a moment after a workout"
        fill
        sizes="100vw"
      />
      <div>
        <h2>{gym ? "Run the gym with clarity." : "Make every session count."}</h2>
        <p>
          {gym
            ? "Keep members, coaches, staff, and the business connected."
            : "Train with direction. Keep progress connected. Build something real."}
        </p>
        <a className="marketing-button marketing-button-primary" href={gym ? "/contact#gyms" : "/#member-login"}>
          {gym ? "Book a walkthrough" : "Start training"}
          <ArrowIcon />
        </a>
      </div>
    </section>
  );
}
