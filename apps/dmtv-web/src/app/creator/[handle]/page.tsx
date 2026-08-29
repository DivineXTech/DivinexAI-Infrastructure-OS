import { notFound } from "next/navigation";
import { getCreatorStorefront } from "@divinexai/dmtv-core";
import { getDmtvContext } from "@/lib/server-context";
import { getFanSession } from "@/lib/session";
import { purchaseAction, registerFanAction } from "./actions";

interface CreatorPageProps {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ purchased?: string }>;
}

function formatPrice(amountMinorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinorUnits / 100);
}

export default async function CreatorPublicPage({ params, searchParams }: CreatorPageProps) {
  const { handle } = await params;
  const { purchased } = await searchParams;
  const { pool } = getDmtvContext();
  const storefront = await getCreatorStorefront(pool, handle);
  if (!storefront) notFound();

  const fanSession = await getFanSession();

  return (
    <main>
      <h1>{storefront.creator.displayName}</h1>
      <p className="muted">@{storefront.creator.handle}</p>

      {purchased && (
        <div className="card">
          <p>✅ Purchase complete. Thank you for supporting {storefront.creator.displayName}!</p>
        </div>
      )}

      {!fanSession ? (
        <div className="card">
          <h3>Become a fan</h3>
          <form action={registerFanAction}>
            <input type="hidden" name="handle" value={handle} />
            <label htmlFor="displayName">Your name</label>
            <input id="displayName" name="displayName" required placeholder="Fan Ninety-One" />
            <button type="submit">Register</button>
          </form>
        </div>
      ) : (
        <p className="muted">Signed in as fan: {fanSession.displayName}</p>
      )}

      <h2>Releases</h2>
      {storefront.publishedAssets.length === 0 && <p className="muted">No published releases yet.</p>}
      {storefront.publishedAssets.map((asset) => (
        <div className="card" key={asset.id}>
          <h3>{asset.title}</h3>
          <p className="muted">
            {asset.type} · published {asset.publishedAt ? new Date(asset.publishedAt).toLocaleDateString() : ""}
          </p>
        </div>
      ))}

      <h2>Support {storefront.creator.displayName}</h2>
      {storefront.products.length === 0 && <p className="muted">No products for sale yet.</p>}
      {storefront.products.map((product) => (
        <div className="card" key={product.id}>
          <h3>{product.name}</h3>
          <p>{formatPrice(product.price.amountMinorUnits, product.price.currency)}</p>
          {fanSession ? (
            <form action={purchaseAction}>
              <input type="hidden" name="handle" value={handle} />
              <input type="hidden" name="organizationId" value={storefront.creator.organizationId} />
              <input type="hidden" name="workspaceId" value={storefront.creator.workspaceId} />
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit">Buy</button>
            </form>
          ) : (
            <p className="muted">Register as a fan above to purchase.</p>
          )}
        </div>
      ))}
    </main>
  );
}
