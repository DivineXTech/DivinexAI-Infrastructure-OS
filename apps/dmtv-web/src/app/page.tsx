import Link from "next/link";
import { getCreatorSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getCreatorSession();

  return (
    <main>
      <h1>Divine Media TV</h1>
      <p className="muted">
        The AI-native creator ownership &amp; commerce network. Create → Own → Publish → Connect →
        Monetize → Settle.
      </p>

      {session ? (
        <div className="card">
          <p>
            Signed in as <strong>{session.displayName}</strong> (
            <span className="badge">{session.organizationName}</span>)
          </p>
          <p>
            <Link href="/studio">Go to Studio →</Link>
          </p>
          <p>
            <Link href="/dashboard">View balance &amp; request payout →</Link>
          </p>
          <p>
            <Link href={`/creator/${session.handle}`}>View your public creator page →</Link>
          </p>
        </div>
      ) : (
        <div className="card">
          <p>New creator?</p>
          <p>
            <Link href="/signup">Sign up →</Link>
          </p>
        </div>
      )}
    </main>
  );
}
