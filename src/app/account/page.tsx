import { Container, Section } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <Section>
      <Container className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Display name</dt>
                <dd className="text-ink">{user.profile?.display_name ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Username</dt>
                <dd className="text-ink">{user.profile?.username ? `@${user.profile.username}` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Country</dt>
                <dd className="text-ink">{user.profile?.country_code ?? "—"}</dd>
              </div>
            </dl>
            <SignOutButton />
          </CardContent>
        </Card>
      </Container>
    </Section>
  );
}
