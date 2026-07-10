import { Container } from "@/components/ui/container";

export function SupabaseNotConfiguredNotice({ what = "This page" }: { what?: string }) {
  return (
    <Container className="py-16">
      <div className="rounded-lg border border-warning-soft bg-warning-soft px-6 py-8 text-center">
        <p className="font-display text-lg font-medium text-warning">Supabase is not configured</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          {what} needs a connected Supabase project. Set NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY — see
          ENVIRONMENT.md for local setup.
        </p>
      </div>
    </Container>
  );
}
