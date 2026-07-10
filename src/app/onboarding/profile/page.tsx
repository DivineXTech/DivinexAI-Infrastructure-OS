import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { saveOnboardingProfile } from "@/modules/onboarding/actions";

export default async function OnboardingProfilePage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const [{ data: countries }, { data: currencies }] = await Promise.all([
    supabase.from("countries").select("code, name").eq("is_active", true).order("sort_order"),
    supabase.from("currencies").select("code, name").eq("is_active", true),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tell us about you</CardTitle>
        <CardDescription>This appears on your profile and helps us tailor payments and language.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveOnboardingProfile} className="space-y-4">
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" name="displayName" defaultValue={user.profile?.display_name ?? ""} required />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" placeholder="kwame-designs" defaultValue={user.profile?.username ?? ""} required />
          </div>
          <div>
            <Label htmlFor="countryCode">Country</Label>
            <Select id="countryCode" name="countryCode" defaultValue={user.profile?.country_code ?? "NG"} required>
              {(countries ?? []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="preferredCurrency">Preferred currency</Label>
            <Select id="preferredCurrency" name="preferredCurrency" defaultValue={user.profile?.preferred_currency_code ?? "USD"} required>
              {(currencies ?? []).map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} — {currency.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
