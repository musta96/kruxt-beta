"use client";

import { MemberShell } from "@/components/public/MemberShell";

export function LogScreen() {
  return (
    <MemberShell
      title="Workout Log"
      subtitle="Start the logging flow, capture the session context, and prepare proof before the full workflow is wired."
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">LOG FLOW</p>
          <h2 className="section-title">Record effort before it disappears.</h2>
          <p className="section-copy">
            This shell is ready for the real workout logger. For now it gives structure for the next implementation slice.
          </p>
        </div>
      </section>

      <section className="section-stack">
        <div className="split-card">
          <div className="glass-panel tight-panel">
            <p className="field-label">Session type</p>
            <div className="chip-row">
              <button className="ghost-chip is-selected">Class</button>
              <button className="ghost-chip">Open gym</button>
              <button className="ghost-chip">Run</button>
              <button className="ghost-chip">Recovery</button>
            </div>
          </div>

          <div className="glass-panel tight-panel">
            <p className="field-label">Intensity</p>
            <div className="chip-row">
              <button className="ghost-chip">Low</button>
              <button className="ghost-chip is-selected">Moderate</button>
              <button className="ghost-chip">High</button>
            </div>
          </div>
        </div>

        <div className="glass-panel">
          <p className="field-label">Draft checklist</p>
          <ul className="checklist">
            <li>Choose the class or workout format</li>
            <li>Add duration and session notes</li>
            <li>Attach proof image or video</li>
            <li>Publish to feed and streak engine</li>
          </ul>
          <div className="stack-actions">
            <button className="primary-cta" type="button">
              Start log
            </button>
            <button className="secondary-cta" type="button">
              Review draft model
            </button>
          </div>
        </div>
      </section>
    </MemberShell>
  );
}
