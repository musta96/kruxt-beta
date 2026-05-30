import { Suspense } from "react";
import { ActivateProfileInviteClient } from "@/components/invite/ActivateProfileInviteClient";

export default function ActivateInvitePage() {
  return (
    <Suspense
      fallback={
        <main className="container">
          <section className="panel">
            <h1 className="heading">KRUXT</h1>
            <p className="subheading">Opening activation link...</p>
          </section>
        </main>
      }
    >
      <ActivateProfileInviteClient />
    </Suspense>
  );
}
