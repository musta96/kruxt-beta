import Image from "next/image";
import type { ReactNode } from "react";

import { ArrowIcon, MarketingChrome } from "./MarketingChrome";
import { AthleteJourneyPreview, AthletePhonePreview, GymDashboardPreview } from "./ProductPreviews";

type MarketingHomeProps = {
  authPanel: ReactNode;
  gymAdminUrl: string;
};

const athleteSteps = [
  {
    number: "01",
    title: "Plan the week",
    copy: "Build around your goals, schedule, equipment, classes, and coach. Move sessions when life moves."
  },
  {
    number: "02",
    title: "Do the work",
    copy: "Follow clear workout blocks, log sets and effort, check in at your gym, and bring wearable data into context."
  },
  {
    number: "03",
    title: "Own the proof",
    copy: "Turn completed sessions into proof, progress, streaks, milestones, rank, and accountability with your people."
  }
];

const gymOutcomes = [
  ["Know every member", "Profiles, access requests, membership status, waivers, check-ins, consent history, and activity."],
  ["Run the floor", "Classes, capacity, coach assignment, staff shifts, coverage, and daily operations."],
  ["Coach beyond the session", "PT assignments, live training plans, exercise swaps, progress, notes, and secure messaging."],
  ["Grow with control", "Plans, invoices, payments, reports, branding, permissions, and a complete activity trail."]
];

export function MarketingHome({ authPanel, gymAdminUrl }: MarketingHomeProps) {
  return (
    <MarketingChrome gymAdminUrl={gymAdminUrl}>
      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <h1>Your training has a place now.</h1>
          <p>
            Plan every session, prove the work, train with your people, and stay connected to the gym or coach behind
            your progress.
          </p>
          <div className="marketing-cta-row">
            <a className="marketing-button marketing-button-primary" href="#member-login">
              Start training
              <ArrowIcon />
            </a>
            <a className="marketing-button marketing-button-secondary" href="#product">
              See how it works
              <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="marketing-hero-media">
          <Image
            src="/marketing/kruxt-athlete-hero.jpg"
            alt="Athlete training with dumbbells in a strength gym"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 58vw"
          />
          <div className="marketing-hero-phone">
            <AthletePhonePreview />
          </div>
        </div>

        <a className="marketing-scroll-cue" href="#product">
          Discover the connected training loop
          <span>Scroll</span>
        </a>
      </section>

      <section className="marketing-section marketing-product-intro" id="product">
        <div className="marketing-section-heading">
          <h2>One place for the work behind your progress.</h2>
          <p>
            Your plan, workout log, proof, community, gym access, coach feedback, rank, and personal progress stay
            connected instead of living across six different apps.
          </p>
        </div>

        <AthleteJourneyPreview />

        <div className="marketing-step-rail">
          {athleteSteps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>

        <a className="marketing-inline-link" href="/for-athletes">
          Explore KRUXT for athletes
          <ArrowIcon />
        </a>
      </section>

      <section className="marketing-section marketing-gym-section">
        <div className="marketing-gym-copy">
          <h2>Run the gym. Keep the human connection.</h2>
          <p>
            Replace scattered spreadsheets, booking tools, payment notes, chat threads, and coaching apps with one
            connected operating system for your gym.
          </p>
          <div className="marketing-outcome-list">
            {gymOutcomes.map(([title, copy], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="marketing-cta-row">
            <a className="marketing-button marketing-button-primary" href="/contact#gyms">
              Book a gym walkthrough
              <ArrowIcon />
            </a>
            <a className="marketing-button marketing-button-secondary" href="/for-gyms">
              See gym features
            </a>
          </div>
        </div>
        <GymDashboardPreview />
      </section>

      <section className="marketing-section marketing-connection-section">
        <div>
          <h2>One action. Every side stays in sync.</h2>
          <p>
            A coach updates a plan. The athlete sees it immediately. A class is booked. It appears in the training
            week. A session is completed. Progress reaches the coach, community, and gym without duplicate entry.
          </p>
        </div>
        <div className="marketing-connection-line" aria-hidden="true">
          <span>ATHLETE</span>
          <i />
          <span>COACH</span>
          <i />
          <span>GYM</span>
        </div>
      </section>

      <section className="marketing-section marketing-pricing-preview">
        <div className="marketing-section-heading">
          <h2>Start where you are. Grow when you need more.</h2>
          <p>KRUXT is free for athletes during beta. Gyms can start lean and add deeper coaching and operations.</p>
        </div>
        <div className="marketing-pricing-split">
          <article>
            <div>
              <span>For athletes</span>
              <h3>Free during beta</h3>
              <p>Plan, log, prove, connect, discover gyms, and build a progress identity.</p>
            </div>
            <a className="marketing-button marketing-button-primary" href="#member-login">
              Create your account
              <ArrowIcon />
            </a>
          </article>
          <article>
            <div>
              <span>For gyms</span>
              <h3>From €39 / month</h3>
              <p>Member operations, classes, staff, coaching, payments, reporting, branding, and more.</p>
            </div>
            <a className="marketing-button marketing-button-secondary" href="/pricing">
              Compare gym plans
              <ArrowIcon />
            </a>
          </article>
        </div>
      </section>

      <section className="marketing-auth-section" id="member-login">
        <div className="marketing-auth-copy">
          <span>Member access</span>
          <h2>Bring your training into focus.</h2>
          <p>Create your KRUXT account or continue where you left off. Gym owners and staff use the gym admin login.</p>
          <a className="marketing-inline-link" href={gymAdminUrl}>
            Gym owner or staff?
            <ArrowIcon />
          </a>
        </div>
        {authPanel}
      </section>

      <section className="marketing-final-cta">
        <Image
          src="/marketing/kruxt-community.jpg"
          alt="Athletes sharing a moment together after training"
          fill
          sizes="100vw"
        />
        <div>
          <h2>Make every session count.</h2>
          <p>Train with direction. Run your gym with clarity. Keep progress connected.</p>
          <div className="marketing-cta-row">
            <a className="marketing-button marketing-button-primary" href="#member-login">
              Start training
              <ArrowIcon />
            </a>
            <a className="marketing-button marketing-button-light" href="/contact">
              Talk to KRUXT
            </a>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
