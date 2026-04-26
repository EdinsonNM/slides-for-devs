import { useEffect, useState } from "react";
import { Box, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import type { GeneratedResourceEntry } from "../../types";

interface ResourcesPanelProps {
  variant?: "toolbar" | "inspector";
}

function formatResourceDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function ResourceCard({
  resource,
  onUse,
  onDelete,
  busyDelete,
}: {
  resource: GeneratedResourceEntry;
  onUse: () => void;
  onDelete: () => void;
  busyDelete: boolean;
}) {
  const isImage = resource.kind === "image";
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-2 shadow-sm dark:border-border dark:bg-surface">
      <div className="flex gap-2">
        <div
          className={cn(
            "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-stone-100 bg-stone-50 dark:border-border dark:bg-stone-900/50",
            !isImage && "flex items-center justify-center",
          )}
        >
          {isImage &&
          (resource.payload.startsWith("data:image") ||
            resource.payload.startsWith("http://") ||
            resource.payload.startsWith("https://")) ? (
            <img
              src={resource.payload}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Box
              className="h-7 w-7 text-violet-600 dark:text-violet-400"
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-medium leading-snug text-stone-800 dark:text-stone-100">
            {resource.prompt?.trim() ||
              (isImage ? "Imagen generada" : "Modelo 3D")}
          </p>
          <p className="mt-0.5 text-[10px] text-stone-500 dark:text-stone-400">
            {formatResourceDate(resource.createdAt)}
            {resource.source ? ` · ${resource.source}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={onUse}
              className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:opacity-90"
            >
              Usar en diapositiva
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busyDelete}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 dark:border-border dark:text-stone-300 dark:hover:bg-white/5"
              title="Quitar de la biblioteca"
            >
              {busyDelete ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-3 w-3" aria-hidden />
              )}
              Quitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceSection({
  title,
  icon: Icon,
  items,
  onUse,
  onDelete,
  deletingId,
}: {
  title: string;
  icon: typeof ImageIcon;
  items: GeneratedResourceEntry[];
  onUse: (r: GeneratedResourceEntry) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
        <Icon size={14} className="opacity-80" aria-hidden />
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id}>
            <ResourceCard
              resource={r}
              onUse={() => onUse(r)}
              onDelete={() => onDelete(r.id)}
              busyDelete={deletingId === r.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResourcesPanel({ variant = "inspector" }: ResourcesPanelProps) {
  const {
    generatedResources,
    refreshGeneratedResources,
    deleteGeneratedResourceFromLibrary,
    applyLibraryImageResource,
    applyLibraryModel3dResource,
  } = usePresentation();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void refreshGeneratedResources();
  }, [refreshGeneratedResources]);

  if (variant !== "inspector") return null;

  const images = generatedResources.filter((r) => r.kind === "image");
  const models = generatedResources.filter((r) => r.kind === "model3d");

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteGeneratedResourceFromLibrary(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUse = (r: GeneratedResourceEntry) => {
    if (r.kind === "image") {
      void applyLibraryImageResource(r.payload, r.prompt);
    } else {
      void applyLibraryModel3dResource(r.payload);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        variant === "inspector"
          ? "bg-white dark:bg-surface-elevated"
          : "bg-white dark:bg-surface-elevated",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5",
          variant === "inspector"
            ? "border-stone-100 bg-stone-50/60 dark:border-border dark:bg-surface"
            : "border-stone-100 dark:border-border",
        )}
      >
        <div>
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Recursos
          </h2>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            Imágenes y modelos 3D que generaste; reutilízalos sin volver a la
            IA.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {generatedResources.length === 0 ? (
          <p className="text-center text-xs text-stone-500 dark:text-stone-400">
            Aún no hay recursos guardados. Al generar una imagen con IA o un
            modelo con Meshy, aparecerán aquí automáticamente.
          </p>
        ) : (
          <>
            <ResourceSection
              title="Imágenes"
              icon={ImageIcon}
              items={images}
              onUse={handleUse}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
            <ResourceSection
              title="Modelos 3D"
              icon={Box}
              items={models}
              onUse={handleUse}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          </>
        )}
      </div>
    </div>
  );
}
