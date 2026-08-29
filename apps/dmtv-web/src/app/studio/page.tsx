import Link from "next/link";
import { redirect } from "next/navigation";
import { getAssetById } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getCreatorSession } from "@/lib/session";
import { createProductAction, declareRightsAndPublishAction, generateAction } from "./actions";

interface StudioPageProps {
  searchParams: Promise<{ assetId?: string; step?: string }>;
}

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const session = await getCreatorSession();
  if (!session) redirect("/signup");

  const { assetId, step } = await searchParams;
  const { pool } = getDmtvContext();
  const asset = assetId ? await getAssetById(pool, session.userId, assetId) : null;

  if (step === "done" && asset) {
    return (
      <main>
        <h1>Published 🎉</h1>
        <div className="card">
          <p>
            <strong>{asset.title}</strong> is live.
          </p>
          <p>
            <Link href={`/creator/${session.handle}`}>View your public creator page →</Link>
          </p>
          <p>
            <Link href="/studio">Create another track →</Link>
          </p>
        </div>
      </main>
    );
  }

  if (step === "product" && asset) {
    return (
      <main>
        <h1>Sell &ldquo;{asset.title}&rdquo;</h1>
        <p className="muted">Step 5: create a product for fans to purchase.</p>
        <form action={createProductAction} className="card">
          <input type="hidden" name="assetId" value={asset.id} />
          <label htmlFor="name">Product name</label>
          <input id="name" name="name" required defaultValue={`${asset.title} (Digital Download)`} />
          <label htmlFor="priceDollars">Price (USD)</label>
          <input id="priceDollars" name="priceDollars" type="number" min="1" step="0.01" required defaultValue="4.99" />
          <button type="submit">List for sale</button>
        </form>
      </main>
    );
  }

  if (step === "rights" && asset) {
    return (
      <main>
        <h1>Declare rights for &ldquo;{asset.title}&rdquo;</h1>
        <p className="muted">
          Step 4: confirm ownership and revenue splits before publishing. This vertical slice defaults to you
          owning 100% as the sole contributor.
        </p>
        <form action={declareRightsAndPublishAction} className="card">
          <input type="hidden" name="assetId" value={asset.id} />
          <p>
            Master rights: <strong>{session.displayName}</strong> — 100%
          </p>
          <p>
            Publishing rights: <strong>{session.displayName}</strong> — 100%
          </p>
          <p>
            Contributor split: <strong>{session.displayName}</strong> (Primary Artist) — 100%
          </p>
          <button type="submit">Confirm rights &amp; publish</button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <h1>Studio</h1>
      <p className="muted">Step 3: generate music and artwork with AI, then create your asset.</p>
      <form action={generateAction} className="card">
        <label htmlFor="title">Track title</label>
        <input id="title" name="title" required placeholder="New Beginnings" />

        <label htmlFor="musicPrompt">Music prompt (Text-to-Music)</label>
        <textarea id="musicPrompt" name="musicPrompt" required rows={3} placeholder="an upbeat synthwave anthem about new beginnings" />

        <label htmlFor="artworkPrompt">Artwork prompt (Text-to-Image, optional)</label>
        <textarea id="artworkPrompt" name="artworkPrompt" rows={2} placeholder="album cover, neon skyline" />

        <button type="submit">Generate &amp; create asset</button>
      </form>
    </main>
  );
}
