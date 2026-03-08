"use client";

import { MemberShell } from "@/components/public/MemberShell";

const FEED_ITEMS = [
  {
    id: "post_1",
    title: "Spartan conditioning tonight",
    meta: "BZone · 18:00",
    body: "Coach-led conditioning block with sled pushes, carries, and threshold intervals.",
    cta: "Open session"
  },
  {
    id: "post_2",
    title: "Proof streak checkpoint",
    meta: "This week",
    body: "You are 2 logs away from keeping your weekly streak alive. Post proof before Sunday night.",
    cta: "Log now"
  },
  {
    id: "post_3",
    title: "Leaderboard snapshot",
    meta: "Guild update",
    body: "Functional Training moved up three places this week. Next cutoff is after the weekend open gym session.",
    cta: "See ranking"
  }
];

export function FeedScreen() {
  return (
    <MemberShell
      title="Proof Feed"
      subtitle="What is happening now across your gym, your streak, and the next sessions that matter."
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">THIS WEEK</p>
          <h2 className="section-title">Stay visible. Proof counts every time.</h2>
          <p className="section-copy">
            This is the rebuilt member-facing feed shell. The data structure is in place; live social feed wiring comes next.
          </p>
        </div>
        <div className="hero-stats">
          <div className="metric-card">
            <span className="metric-label">Streak</span>
            <strong className="metric-value">5 days</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Upcoming</span>
            <strong className="metric-value">2 classes</strong>
          </div>
        </div>
      </section>

      <section className="section-stack">
        {FEED_ITEMS.map((item) => (
          <article key={item.id} className="feed-card">
            <div className="feed-card-header">
              <div>
                <p className="feed-meta">{item.meta}</p>
                <h3 className="feed-title">{item.title}</h3>
              </div>
              <button className="ghost-chip" type="button">
                {item.cta}
              </button>
            </div>
            <p className="feed-body">{item.body}</p>
          </article>
        ))}
      </section>
    </MemberShell>
  );
}
