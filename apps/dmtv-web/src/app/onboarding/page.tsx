import { redirect } from "next/navigation";
import { getCreatorSession } from "@/lib/session";
import { completeOnboardingAction } from "./actions";

export default async function OnboardingPage() {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  return (
    <main>
      <h1>Creator onboarding</h1>
      <p className="muted">Step 2: link your FlowraPay payout account so you can get paid.</p>
      <form action={completeOnboardingAction} className="card">
        <label htmlFor="email">Payout contact email</label>
        <input id="email" name="email" type="email" required placeholder="you@example.com" />
        <button type="submit">Link FlowraPay account</button>
      </form>
    </main>
  );
}
