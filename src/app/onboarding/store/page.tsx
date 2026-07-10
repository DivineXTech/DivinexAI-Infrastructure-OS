import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { createOnboardingStore } from "@/modules/onboarding/actions";

export default function OnboardingStorePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your storefront</CardTitle>
        <CardDescription>You can refine branding and links later from your dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createOnboardingStore} className="space-y-4">
          <div>
            <Label htmlFor="storeName">Store name</Label>
            <Input id="storeName" name="storeName" placeholder="Kwame Designs" required />
          </div>
          <div>
            <Label htmlFor="storeSlug">Store URL</Label>
            <div className="flex items-center gap-1 text-sm text-ink-muted">
              <span>flowramarket.africa/@</span>
              <Input id="storeSlug" name="storeSlug" placeholder="kwame-designs" required className="flex-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" name="category" placeholder="Creative Assets" />
          </div>
          <div>
            <Label htmlFor="description">Short bio</Label>
            <Textarea id="description" name="description" rows={3} placeholder="What do you make, and who is it for?" />
          </div>
          <div>
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" name="supportEmail" type="email" required />
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
