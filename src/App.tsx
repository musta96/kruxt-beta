import React, { useState } from "react";
// ─── All business logic imported from apps/mobile – never from root src/ ──
import { OnboardingFlow } from "@mobile/onboarding";

function GuildHallPlaceholder({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-6">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
        <span className="text-4xl font-display font-black text-primary-foreground">K</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-display font-black text-foreground">Guild Hall</h1>
        <p className="text-primary font-semibold">Proof counts.</p>
        <p className="text-sm text-muted-foreground">You're in. Start logging to protect your chain.</p>
      </div>
      <button onClick={onSignOut} className="text-xs text-muted-foreground underline underline-offset-2 mt-4">
        Sign out
      </button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<"onboarding" | "guild_hall">("onboarding");

  if (view === "guild_hall") {
    return <GuildHallPlaceholder onSignOut={() => setView("onboarding")} />;
  }

  return <OnboardingFlow onComplete={() => setView("guild_hall")} />;
}
