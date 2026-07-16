import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewDesignProjectForm } from "@/components/design-studio/new-project-form";
import { requireDesignStudioEditAccess } from "@/lib/design-studio/guard";

export default async function NewDesignProjectPage() {
  await requireDesignStudioEditAccess();

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Start a new design</CardTitle>
          <CardDescription>You&rsquo;ll choose a garment template and color in the editor.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewDesignProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
