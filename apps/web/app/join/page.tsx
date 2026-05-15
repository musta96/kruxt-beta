import { Suspense } from "react";

import { JoinGymClient } from "@/components/join/JoinGymClient";

function JoinFallback() {
  return (
    <main className="container">
      <div className="panel">
        <h1 className="heading">Join gym</h1>
        <p className="subheading">Loading invite details...</p>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinFallback />}>
      <JoinGymClient />
    </Suspense>
  );
}
