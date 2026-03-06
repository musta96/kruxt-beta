import { Suspense } from "react";

import { AcceptInviteClient } from "@/components/invite/AcceptInviteClient";

function AcceptInviteFallback() {
  return (
    <main className="container">
      <div className="panel">
        <h1 className="heading">Accept invite</h1>
        <p className="subheading">Loading invite details...</p>
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteFallback />}>
      <AcceptInviteClient />
    </Suspense>
  );
}
