import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setOnboardingPurpose } from "@/modules/onboarding/actions";

const OPTIONS = [
  { value: "buy", title: "Buy products", description: "I want to discover and purchase from African creators." },
  { value: "sell", title: "Sell products", description: "I want to publish my own products and storefront." },
  { value: "both", title: "Both", description: "I want to buy and sell on FlowraMarket Africa." },
];

export default function OnboardingPurposePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What brings you to FlowraMarket Africa?</CardTitle>
        <CardDescription>You can always add selling later from your account settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={setOnboardingPurpose} className="space-y-3">
          {OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 hover:bg-paper-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="radio" name="purpose" value={option.value} defaultChecked={option.value === "buy"} className="mt-1" required />
              <span>
                <span className="block text-sm font-medium text-ink">{option.title}</span>
                <span className="block text-xs text-ink-muted">{option.description}</span>
              </span>
            </label>
          ))}
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
