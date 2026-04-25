import { useCallback, useMemo, useRef, useEffect } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { usePresentation } from "../../context/PresentationContext";
import { useTheme } from "../../context/ThemeContext";

const PERSIST_DEBOUNCE_MS = 400;

/** Datos que guardamos del diagrama (elements, appState y files para imágenes). */
interface ExcalidrawSnapshot {
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, { mimeType?: string; dataURL?: string; id?: string }>;
}

export function SlideContentDiagram() {
  const {
    currentSlide,
    setCurrentSlideExcalidrawData,
    diagramFlushRef,
  } = usePresentation();
  const { effectiveTheme } = useTheme();
  const pendingDataRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Último valor que ya guardamos en el contexto; evita setState cuando no hay cambios y corta el bucle de re-renders. */
  const lastPersistedRef = useRef<string | null>(null);

  const initialData = useMemo(() => {
    if (!currentSlide?.excalidrawData) return null;
    try {
      const parsed = JSON.parse(currentSlide.excalidrawData) as ExcalidrawSnapshot;
      const appState = parsed.appState ?? {};
      // Excalidraw espera appState.collaborators como Map; al restaurar desde JSON queda {} y falla .forEach
      const normalizedAppState = {
        ...appState,
        collaborators: appState.collaborators instanceof Map ? appState.collaborators : new Map(),
      };
      return {
        elements: parsed.elements ?? [],
        appState: normalizedAppState,
        files: parsed.files ?? {},
      };
    } catch {
      return null;
    }
  }, [currentSlide?.id]); // Solo recalcular al cambiar de slide (nuevo montaje)

  // Sincronizar ref con el valor actual al cambiar de slide
  useEffect(() => {
    lastPersistedRef.current = currentSlide?.excalidrawData ?? null;
  }, [currentSlide?.id, currentSlide?.excalidrawData]);

  const flushPending = useCallback(() => {
    if (pendingDataRef.current === null) return;
    const data = pendingDataRef.current;
    pendingDataRef.current = null;
    if (data === lastPersistedRef.current) return;
    lastPersistedRef.current = data;
    setCurrentSlideExcalidrawData(data);
  }, [setCurrentSlideExcalidrawData]);

  /** Vacía el diagrama pendiente y devuelve los datos (para guardar o vista previa). */
  const flushPendingAndReturn = useCallback((): string | null => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingDataRef.current === null) return lastPersistedRef.current;
    const data = pendingDataRef.current;
    pendingDataRef.current = null;
    if (data === lastPersistedRef.current) return data;
    lastPersistedRef.current = data;
    setCurrentSlideExcalidrawData(data);
    return data;
  }, [setCurrentSlideExcalidrawData]);

  useEffect(() => {
    diagramFlushRef.current = flushPendingAndReturn;
    return () => {
      diagramFlushRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingDataRef.current !== null) flushPending();
    };
  }, [diagramFlushRef, flushPendingAndReturn, flushPending]);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, unknown> | undefined) => {
      const filesForJson: Record<string, unknown> = {};
      if (files && typeof files === "object") {
        for (const [id, f] of Object.entries(files)) {
          if (f && typeof f === "object") {
            const entry = f as Record<string, unknown>;
            if (typeof entry.dataURL === "string") {
              filesForJson[id] = {
                mimeType: entry.mimeType,
                dataURL: entry.dataURL,
                id: entry.id ?? id,
              };
            }
          }
        }
      }
      const next = JSON.stringify({
        elements: [...elements],
        appState: { ...appState },
        files: filesForJson,
      });
      pendingDataRef.current = next;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (pendingDataRef.current === null) return;
        const data = pendingDataRef.current;
        pendingDataRef.current = null;
        if (data === lastPersistedRef.current) return;
        lastPersistedRef.current = data;
        setCurrentSlideExcalidrawData(data);
      }, PERSIST_DEBOUNCE_MS);
    },
    [setCurrentSlideExcalidrawData]
  );

  if (!currentSlide) return null;

  return (
    <div className="absolute inset-0 min-h-0">
      <Excalidraw
          initialData={initialData ?? undefined}
          onChange={handleChange}
          theme={effectiveTheme}
          viewModeEnabled={false}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: { saveFileToDisk: false },
              toggleTheme: false,
            },
          }}
        />
    </div>
  );
}
