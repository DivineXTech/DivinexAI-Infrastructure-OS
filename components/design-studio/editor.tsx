"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createDesignVersionAction,
  getGarmentTemplateForEditorAction,
  listGarmentTemplatesForEditorAction,
  saveDesignStateAction,
  submitDesignForReviewAction,
} from "@/app/app/design-studio/actions";
import { uploadArtworkAction } from "@/app/app/design-studio/artwork-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DesignCanvas } from "@/components/design-studio/design-canvas";
import { ElementInspector } from "@/components/design-studio/element-inspector";
import { LayerList } from "@/components/design-studio/layer-list";
import type { GarmentTemplateDetail, GarmentTemplateSummary } from "@/lib/catalog/data-access";
import {
  canRedo,
  canUndo,
  dispatchDesignAction,
  initHistory,
  redo,
  undo,
  type HistoryState,
} from "@/lib/design-studio/history-reducer";
import type { GarmentViewAsset } from "@/components/garment-preview/adapter";
import type { DesignElement, DesignProjectState, GarmentView } from "@/lib/design-studio/project-schema";

const AUTOSAVE_DEBOUNCE_MS = 2500;

export function DesignStudioEditor({
  projectId,
  initialState,
  initialTemplate,
}: {
  projectId: string;
  initialState: DesignProjectState;
  initialTemplate: GarmentTemplateDetail | null;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryState>(() => initHistory(initialState));
  const [templates, setTemplates] = useState<GarmentTemplateSummary[]>([]);
  const [template, setTemplate] = useState<GarmentTemplateDetail | null>(initialTemplate);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const state = history.present;

  useEffect(() => {
    listGarmentTemplatesForEditorAction().then(setTemplates);
  }, []);

  // Debounced autosave — never on every pointer movement, only after the
  // present state settles for AUTOSAVE_DEBOUNCE_MS (section 22).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      const result = await saveDesignStateAction(projectId, state);
      setSaveStatus(result.ok ? "saved" : "error");
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [state, projectId]);

  const currentViewZones = useMemo(
    () => (template ? template.printZones.filter((z) => z.viewKey === state.activeView) : []),
    [template, state.activeView],
  );
  const currentViewElements = useMemo(
    () => state.elements.filter((el) => el.placement.garmentView === state.activeView),
    [state.elements, state.activeView],
  );
  const selectedElement = state.elements.find((el) => el.id === selectedElementId) ?? null;
  const activeZone = currentViewZones.find((z) => z.id === selectedZoneId) ?? currentViewZones[0] ?? null;

  async function handleSelectTemplate(templateId: string) {
    const detail = await getGarmentTemplateForEditorAction(templateId);
    setTemplate(detail);
    setHistory((h) =>
      dispatchDesignAction(h, {
        type: "set_garment",
        garmentTemplateId: templateId,
        garmentColorId: detail?.colors[0]?.id ?? null,
      }),
    );
  }

  function handleSelectColor(colorId: string) {
    setHistory((h) => dispatchDesignAction(h, { type: "set_garment", garmentTemplateId: state.garmentTemplateId, garmentColorId: colorId }));
  }

  function handleSetView(view: GarmentView) {
    setHistory((h) => dispatchDesignAction(h, { type: "set_view", view }));
  }

  function addTextElement() {
    const maxZ = Math.max(0, ...state.elements.map((e) => e.zIndex));
    const zone = activeZone;
    const newElement: DesignElement = {
      id: crypto.randomUUID(),
      elementType: "text",
      zIndex: maxZ + 1,
      locked: false,
      hidden: false,
      textContent: "Your text",
      fontKey: "sans",
      fontSize: 24,
      textColor: "#111111",
      textAlign: "center",
      designAssetId: null,
      placement: {
        printZoneId: zone?.id ?? null,
        garmentView: state.activeView,
        x: zone?.x ?? 30,
        y: zone?.y ?? 30,
        width: zone?.width ?? 40,
        height: zone?.height ?? 20,
        rotation: 0,
      },
    };
    setHistory((h) => dispatchDesignAction(h, { type: "add_element", element: newElement }));
    setSelectedElementId(newElement.id);
  }

  async function handleArtworkUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("artwork", file);
    const result = await uploadArtworkAction(formData, projectId);
    event.target.value = "";
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    const maxZ = Math.max(0, ...state.elements.map((e) => e.zIndex));
    const zone = activeZone;
    const newElement: DesignElement = {
      id: crypto.randomUUID(),
      elementType: "image",
      zIndex: maxZ + 1,
      locked: false,
      hidden: false,
      textContent: null,
      fontKey: null,
      fontSize: null,
      textColor: null,
      textAlign: null,
      designAssetId: result.assetId,
      placement: {
        printZoneId: zone?.id ?? null,
        garmentView: state.activeView,
        x: zone?.x ?? 30,
        y: zone?.y ?? 30,
        width: zone?.width ?? 40,
        height: zone?.height ?? 40,
        rotation: 0,
      },
    };
    setHistory((h) => dispatchDesignAction(h, { type: "add_element", element: newElement }));
    setSelectedElementId(newElement.id);
  }

  function handleMoveElement(id: string, x: number, y: number) {
    setHistory((h) => dispatchDesignAction(h, { type: "update_placement", id, patch: { x, y } }));
  }

  async function handleSaveDraft() {
    setSaveStatus("saving");
    const result = await saveDesignStateAction(projectId, state);
    setSaveStatus(result.ok ? "saved" : "error");
  }

  async function handleCreateVersion() {
    await handleSaveDraft();
    const label = window.prompt("Label this version (optional)") ?? undefined;
    await createDesignVersionAction(projectId, label || undefined);
  }

  async function handleSubmit() {
    await handleSaveDraft();
    const result = await submitDesignForReviewAction(projectId);
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex flex-col gap-3 lg:w-80 lg:shrink-0">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="template-select">Garment template</Label>
          <select
            id="template-select"
            value={state.garmentTemplateId ?? ""}
            onChange={(e) => handleSelectTemplate(e.target.value)}
            className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
          >
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {template && template.colors.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="color-select">Color</Label>
            <select
              id="color-select"
              value={state.garmentColorId ?? ""}
              onChange={(e) => handleSelectColor(e.target.value)}
              className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
            >
              {template.colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {currentViewZones.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zone-select">Print zone</Label>
            <select
              id="zone-select"
              value={selectedZoneId ?? currentViewZones[0]?.id ?? ""}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              className="h-10 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
            >
              {currentViewZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zoneKey.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(["front", "back", "left", "right"] as const).map((view) => (
            <Button
              key={view}
              type="button"
              size="sm"
              variant={view === state.activeView ? "default" : "outline"}
              onClick={() => handleSetView(view)}
            >
              {view}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={addTextElement}>
            Add text
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <label className="cursor-pointer">
              Upload artwork
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={handleArtworkUpload}
              />
            </label>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Layers</CardTitle>
          </CardHeader>
          <CardContent>
            <LayerList
              elements={currentViewElements}
              selectedElementId={selectedElementId}
              onSelect={setSelectedElementId}
              onReorder={(id, zIndex) => setHistory((h) => dispatchDesignAction(h, { type: "reorder_element", id, zIndex }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canUndo(history)}
              onClick={() => setHistory(undo)}
            >
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canRedo(history)}
              onClick={() => setHistory(redo)}
            >
              Redo
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-subtle" aria-live="polite">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : ""}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleSaveDraft}>
              Save draft
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleCreateVersion}>
              Save version
            </Button>
            <Button type="button" size="sm" onClick={handleSubmit}>
              Submit for review
            </Button>
          </div>
        </div>

        <DesignCanvas
          view={(template?.views.find((v) => v.viewKey === state.activeView) as GarmentViewAsset | undefined) ?? null}
          colorHex={template?.colors.find((c) => c.id === state.garmentColorId)?.hexValue ?? null}
          printZones={currentViewZones}
          elements={currentViewElements}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
          onMoveElement={handleMoveElement}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Element properties</CardTitle>
          </CardHeader>
          <CardContent>
            <ElementInspector
              element={selectedElement}
              activeZone={activeZone}
              onUpdate={(patch) =>
                selectedElement &&
                setHistory((h) => dispatchDesignAction(h, { type: "update_element", id: selectedElement.id, patch }))
              }
              onUpdatePlacement={(patch) =>
                selectedElement &&
                setHistory((h) => dispatchDesignAction(h, { type: "update_placement", id: selectedElement.id, patch }))
              }
              onDuplicate={() =>
                selectedElement &&
                setHistory((h) =>
                  dispatchDesignAction(h, { type: "duplicate_element", id: selectedElement.id, newId: crypto.randomUUID() }),
                )
              }
              onDelete={() => {
                if (!selectedElement) return;
                setHistory((h) => dispatchDesignAction(h, { type: "remove_element", id: selectedElement.id }));
                setSelectedElementId(null);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
