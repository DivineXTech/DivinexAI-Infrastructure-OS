import { WorkflowGraphDesigner } from "@/components/workflow/graph-designer";
import { atlasVideoFactoryGraph } from "@/src/graph/atlas-video-factory.graph";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">
          Atlas AI <span className="text-primary">Video Factory</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          From idea to published video — fully automated, governed, and
          observable.
        </p>
      </div>
      <div className="rounded-lg border border-border">
        <WorkflowGraphDesigner graph={atlasVideoFactoryGraph} />
      </div>
    </main>
  );
}
