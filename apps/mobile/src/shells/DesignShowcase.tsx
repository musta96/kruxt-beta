import React from "react";
import { Badge, StatCard, ListRow, DataTable, Avatar, Divider, StatusDot, IconButton } from "@mobile/design-system";
import { ProgressBar, PrimaryBtn, GhostBtn, InputField, TabStrip, Spinner, SkeletonCard, BackBtn, ErrorBanner } from "@mobile/design-system";
import { Bell, ChevronRight, Flame, Trophy, Zap } from "lucide-react";

const sampleData = [
  { id: "1", name: "Alex Rivera", rank: 3, score: "1,240", status: "active" },
  { id: "2", name: "Jordan Kael", rank: 7, score: "980", status: "active" },
  { id: "3", name: "Sam Torres", rank: 12, score: "745", status: "inactive" },
];

export default function DesignShowcase() {
  const [tab, setTab] = React.useState<"mobile" | "admin">("mobile");
  const [inputVal, setInputVal] = React.useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow-ion">
              <span className="text-xl font-display font-black text-primary-foreground">K</span>
            </div>
            <div>
              <h1 className="text-3xl font-display font-black text-foreground tracking-tight">KRUXT</h1>
              <p className="text-sm text-primary font-display font-semibold">No log, no legend.</p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm max-w-md">
            Design system showcase — guild-premium aesthetic with equipment-panel surfaces and ion-blue accents.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-12">
        {/* Color Palette */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Color Palette</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: "Background", cls: "bg-background border border-border" },
              { name: "Card", cls: "bg-card border border-border" },
              { name: "Ion Blue", cls: "bg-primary" },
              { name: "Steel", cls: "bg-steel" },
              { name: "Success", cls: "bg-success" },
              { name: "Warning", cls: "bg-warning" },
              { name: "Danger", cls: "bg-destructive" },
              { name: "Muted", cls: "bg-muted" },
            ].map((c) => (
              <div key={c.name} className="flex flex-col gap-1.5">
                <div className={`h-12 rounded-lg ${c.cls}`} />
                <span className="text-xs text-muted-foreground font-display">{c.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Typography</h2>
          <div className="panel p-6 space-y-4">
            <h1 className="text-4xl font-display font-black">Headline — Space Grotesk</h1>
            <p className="text-base font-body text-secondary-foreground">Body text — Inter. Clean, readable, professional.</p>
            <p className="font-mono text-xl tabular-nums text-foreground">1,247 reps · 03:42:18 · Rank #3</p>
          </div>
        </section>

        {/* Badges / Sigils */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Badges & Sigils</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="ion">Ion Blue</Badge>
            <Badge variant="steel">Steel</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Suspended</Badge>
          </div>
        </section>

        {/* Status */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Status Dots</h2>
          <div className="flex flex-wrap gap-4">
            <StatusDot status="success" label="Online" />
            <StatusDot status="warning" label="Pending" />
            <StatusDot status="danger" label="Offline" />
            <StatusDot status="info" label="Syncing" />
            <StatusDot status="muted" label="Unknown" />
          </div>
        </section>

        {/* Stat Cards */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Stat Cards</h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Weekly Rank" value="#3" />
            <StatCard label="Total Reps" value="1,247" />
            <StatCard label="Chain Streak" value={14} unit="days" />
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Buttons</h2>
          <div className="space-y-3 max-w-sm">
            <PrimaryBtn>Log Workout</PrimaryBtn>
            <GhostBtn>View History</GhostBtn>
            <PrimaryBtn disabled>Disabled State</PrimaryBtn>
            <PrimaryBtn loading loadingLabel="Submitting...">Submit</PrimaryBtn>
            <div className="flex gap-2">
              <button className="btn-compact">Compact</button>
              <IconButton label="Notifications"><Bell size={18} /></IconButton>
            </div>
          </div>
        </section>

        {/* Tab Strip */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Tab Strip</h2>
          <TabStrip
            options={[
              { value: "mobile" as const, label: "Mobile" },
              { value: "admin" as const, label: "Admin" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as "mobile" | "admin")}
            ariaLabel="Shell mode"
          />
        </section>

        {/* Form Controls */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Form Controls</h2>
          <div className="space-y-3 max-w-sm">
            <InputField id="demo-name" label="Display Name" value={inputVal} onChange={setInputVal} placeholder="Enter your guild name" />
            <InputField id="demo-err" label="Email" value="" onChange={() => {}} error="Required field" placeholder="kruxt@guild.io" />
          </div>
        </section>

        {/* Progress */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Progress Bar</h2>
          <div className="max-w-sm space-y-2">
            <ProgressBar value={60} />
            <ProgressBar value={100} />
          </div>
        </section>

        {/* List Rows */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">List Rows</h2>
          <div className="panel overflow-hidden">
            <ListRow leading={<Avatar alt="Alex" size="sm" />} trailing={<ChevronRight size={16} />} onClick={() => {}}>
              <div className="text-sm font-semibold text-foreground">Alex Rivera</div>
              <div className="text-xs text-muted-foreground">Rank #3 · 14-day chain</div>
            </ListRow>
            <ListRow leading={<Avatar alt="Jordan" src={null} size="sm" />} trailing={<Badge variant="success">Active</Badge>}>
              <div className="text-sm font-semibold text-foreground">Jordan Kael</div>
              <div className="text-xs text-muted-foreground">Rank #7 · 8-day chain</div>
            </ListRow>
            <ListRow leading={<Avatar alt="Sam" size="sm" />} trailing={<Badge variant="danger">Inactive</Badge>}>
              <div className="text-sm font-semibold text-foreground">Sam Torres</div>
              <div className="text-xs text-muted-foreground">Rank #12 · Chain broken</div>
            </ListRow>
          </div>
        </section>

        {/* Data Table */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Data Table</h2>
          <div className="panel overflow-hidden">
            <DataTable
              columns={[
                { key: "rank", label: "Rank", mono: true },
                { key: "name", label: "Member" },
                { key: "score", label: "Score", align: "right", mono: true },
                {
                  key: "status",
                  label: "Status",
                  render: (row) => (
                    <Badge variant={row.status === "active" ? "success" : "danger"}>
                      {String(row.status)}
                    </Badge>
                  ),
                },
              ]}
              data={sampleData}
            />
          </div>
        </section>

        {/* Skeletons */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Loading States</h2>
          <div className="space-y-3 max-w-sm">
            <SkeletonCard />
            <div className="flex items-center gap-2">
              <Spinner size={20} />
              <span className="text-sm text-muted-foreground">Loading proof feed...</span>
            </div>
          </div>
        </section>

        {/* Error */}
        <section>
          <h2 className="text-xl font-display font-bold mb-4 text-foreground">Error Banner</h2>
          <div className="max-w-sm">
            <ErrorBanner message="Failed to sync workout data." onRetry={() => {}} />
          </div>
        </section>

        <Divider label="End of Showcase" />

        {/* Brand copy */}
        <section className="text-center space-y-2 pb-8">
          <p className="text-sm text-muted-foreground font-display">Proof counts. · Rank is earned weekly. · Log to claim.</p>
          <p className="text-primary font-display font-bold">No log, no legend.</p>
        </section>
      </div>
    </div>
  );
}
