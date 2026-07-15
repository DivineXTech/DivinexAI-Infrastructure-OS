import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline">{phase}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted">
          This module hasn&apos;t been built yet — it&apos;s scaffolded here
          so navigation and access control are already in place. See{" "}
          <code>docs/IMPLEMENTATION_PLAN.md</code> for the build sequence.
        </p>
      </CardContent>
    </Card>
  );
}
