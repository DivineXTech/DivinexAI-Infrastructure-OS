import Link from "next/link";
import { WorkflowGraphDesigner } from "@/components/workflow/graph-designer";
import { atlasVideoFactoryGraph } from "@/src/graph/atlas-video-factory.graph";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Atlas AI <span className="text-primary">Video Factory</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            From idea to published video — fully automated, governed, and
            observable.
          </p>
        </div>
        <Link
          href="/providers"
          className="border-border hover:bg-muted shrink-0 rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Provider status
        </Link>
      </div>
      <div className="rounded-lg border border-border">
        <WorkflowGraphDesigner graph={atlasVideoFactoryGraph} />
      </div>
    </main>
  );
}
