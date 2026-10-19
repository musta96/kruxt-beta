export function AthletePhonePreview() {
  return (
    <div className="product-phone" aria-label="KRUXT training plan preview">
      <div className="product-phone-status">
        <span>9:41</span>
        <span>LTE</span>
      </div>
      <div className="product-phone-header">
        <span className="product-mini-logo">K</span>
        <span>Today</span>
      </div>
      <div className="product-phone-week">
        <span>Week 4 of 8</span>
        <strong>3 sessions left</strong>
      </div>
      <div className="product-session-card">
        <div>
          <span>Strength + conditioning</span>
          <strong>Lower body power</strong>
        </div>
        <p>62 min - Gym - Coach notes included</p>
        <a href="/#member-login">
          Start workout
          <span>Open</span>
        </a>
      </div>
      <div className="product-proof-row">
        <span className="product-proof-icon">P</span>
        <div>
          <strong>Proof ready after session</strong>
          <span>Share the work. Keep the progress.</span>
        </div>
      </div>
      <div className="product-progress-copy">
        <strong>This week</strong>
        <span>4 of 6 complete</span>
      </div>
      <div className="product-progress-track">
        <span />
      </div>
      <div className="product-next-session">
        <span>Next</span>
        <strong>Conditioning - Tomorrow</strong>
      </div>
      <div className="product-phone-nav">
        <strong>Plan</strong>
        <span>Log</span>
        <span>Community</span>
        <span>Profile</span>
      </div>
    </div>
  );
}

export function AthleteJourneyPreview() {
  return (
    <div className="athlete-journey-preview" aria-label="KRUXT athlete workflow preview">
      <div className="journey-screen journey-screen-plan">
        <div className="journey-screen-head">
          <span>Plan</span>
          <strong>Week 4</strong>
        </div>
        {[
          ["Mon", "Lower strength", "Done"],
          ["Tue", "HYROX intervals", "Today"],
          ["Wed", "Upper strength", "Next"],
          ["Thu", "Zone 2 run", "40 min"],
          ["Fri", "Hybrid engine", "60 min"]
        ].map(([day, title, state]) => (
          <div className="journey-plan-row" key={day}>
            <span>{day}</span>
            <strong>{title}</strong>
            <em>{state}</em>
          </div>
        ))}
      </div>

      <div className="journey-screen journey-screen-workout">
        <div className="journey-screen-head">
          <span>Today</span>
          <strong>62 min</strong>
        </div>
        <h3>Strength + conditioning</h3>
        <p>Keep the reps crisp. Add load where the last set felt strong.</p>
        {["Warm-up", "Strength", "Accessories", "Finisher"].map((block, index) => (
          <div className="journey-block-row" key={block}>
            <span>{index + 1}</span>
            <strong>{block}</strong>
            <em>{index === 0 ? "Complete" : "Open"}</em>
          </div>
        ))}
        <button type="button">Start workout</button>
      </div>

      <div className="journey-screen journey-screen-proof">
        <div className="journey-screen-head">
          <span>Proof</span>
          <strong>Following</strong>
        </div>
        <div className="journey-proof-media">
          <span>Session complete</span>
          <strong>Lower strength</strong>
          <div className="journey-play" aria-label="Play proof preview" />
        </div>
        <p>Strong session. New volume best and the fourth week completed.</p>
        <div className="journey-proof-actions">
          <span>24 likes</span>
          <span>12 comments</span>
        </div>
      </div>
    </div>
  );
}

export function GymDashboardPreview() {
  const members = [
    ["Alex R.", "Active", "Maya", "Today, 18:00"],
    ["Priya S.", "Trial", "Unassigned", "Tomorrow"],
    ["Jordan K.", "At risk", "Leo", "No session"],
    ["Elena M.", "Active", "Maya", "Fri, 09:00"]
  ];

  return (
    <div className="gym-dashboard-preview" aria-label="KRUXT gym operations preview">
      <aside>
        <span className="product-mini-logo">K</span>
        <strong>KRUXT Admin</strong>
        {["Overview", "Members", "Staff", "Coaching", "Classes", "Check-ins", "Waivers", "Reports"].map((item) => (
          <span className={item === "Members" ? "is-active" : ""} key={item}>
            {item}
          </span>
        ))}
      </aside>
      <section>
        <div className="gym-dashboard-head">
          <div>
            <span>Members</span>
            <h3>Know who needs attention.</h3>
          </div>
          <button type="button">Invite member</button>
        </div>
        <div className="gym-dashboard-tabs">
          <strong>All members</strong>
          <span>Pending access</span>
          <span>Needs attention</span>
        </div>
        <div className="gym-member-table">
          <div className="gym-member-row gym-member-header">
            <span>Member</span>
            <span>Status</span>
            <span>Coach</span>
            <span>Next session</span>
          </div>
          {members.map(([member, status, coach, next]) => (
            <div className="gym-member-row" key={member}>
              <strong>{member}</strong>
              <span className={`gym-status gym-status-${status.toLowerCase().replace(" ", "-")}`}>{status}</span>
              <span>{coach}</span>
              <span>{next}</span>
            </div>
          ))}
        </div>
        <div className="gym-dashboard-note">
          <strong>Connected coaching</strong>
          <span>Plans, messages, check-ins, and progress stay attached to each member.</span>
        </div>
      </section>
    </div>
  );
}
