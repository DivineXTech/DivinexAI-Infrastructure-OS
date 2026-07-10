import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/container";
import { CreatorCard } from "@/components/marketplace/creator-card";
import { EmptyState } from "@/components/ui/states";
import { SupabaseNotConfiguredNotice } from "@/components/supabase-status-notice";
import { isSupabaseConfigured } from "@/lib/env";
import { listFeaturedStorefronts } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Creators" };

export default async function CreatorsPage() {
  const configured = isSupabaseConfigured();
  const creators = configured ? await listFeaturedStorefronts(48) : [];

  return (
    <Section>
      <Container>
        <h1 className="font-display text-2xl font-medium text-ink sm:text-3xl">Creators</h1>
        <p className="mt-1 text-sm text-ink-muted">Storefronts published across FlowraMarket Africa.</p>
        <div className="mt-8">
          {!configured ? (
            <SupabaseNotConfiguredNotice what="The creators directory" />
          ) : creators.length === 0 ? (
            <EmptyState title="No storefronts published yet" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {creators.map((creator) => (
                <CreatorCard key={creator.username} creator={creator} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
