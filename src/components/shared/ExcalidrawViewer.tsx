import { useMemo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

interface ExcalidrawSnapshot {
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, { mimeType?: string; dataURL?: string; id?: string }>;
}

export interface ExcalidrawViewerProps {
  /** JSON string con { elements, appState } guardado de Excalidraw */
  excalidrawData?: string;
  /** Clase CSS para el contenedor */
  className?: string;
  /** Si true, al cargar centra el contenido en la vista manteniendo zoom al 100% (vista previa) */
  fitToViewOnLoad?: boolean;
}

/**
 * Muestra un diagrama Excalidraw en modo solo lectura (vista previa / presentación).
 */
export function ExcalidrawViewer({
  excalidrawData,
  className,
  fitToViewOnLoad = false,
}: ExcalidrawViewerProps) {
  const initialData = useMemo(() => {
    if (!excalidrawData) return null;
    try {
      const parsed = JSON.parse(excalidrawData) as ExcalidrawSnapshot;
      const appState = parsed.appState ?? {};
      // Excalidraw espera appState.collaborators como Map; al restaurar desde JSON queda {} y falla .forEach
      const normalizedAppState = {
        ...appState,
        collaborators: appState.collaborators instanceof Map ? appState.collaborators : new Map(),
        viewModeEnabled: true,
      };
      return {
        elements: parsed.elements ?? [],
        appState: normalizedAppState,
        files: parsed.files ?? {},
      };
    } catch {
      return null;
    }
  }, [excalidrawData]);

  return (
    <div className={className} style={{ height: "100%", minHeight: 280 }}>
      <Excalidraw
        initialData={initialData ?? undefined}
        excalidrawAPI={(api) => {
          if (fitToViewOnLoad && api?.scrollToContent) {
            setTimeout(() => {
              api.scrollToContent(undefined, { animate: true });
            }, 80);
          }
        }}
        viewModeEnabled={true}
        theme="light"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: { saveFileToDisk: false },
            toggleTheme: false,
            changeViewMode: false,
          },
        }}
      />
    </div>
  );
}
