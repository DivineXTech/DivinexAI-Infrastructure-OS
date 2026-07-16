"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createDesignProjectAction } from "@/app/app/design-studio/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewDesignProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    const result = await createDesignProjectAction(name || undefined);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/app/design-studio/${result.data.projectId}`);
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-name">Design name</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled design"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={busy} onClick={handleCreate} className="self-start">
        {busy ? "Creating…" : "Create design"}
      </Button>
    </div>
  );
}
