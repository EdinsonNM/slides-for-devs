import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePresentation } from "../../context/PresentationContext";
import {
  parseIsometricFlowDiagram,
  serializeIsometricFlowDiagram,
  type IsometricFlowDiagram,
} from "../../domain/entities/IsometricFlowDiagram";
import { IsometricFlowDiagramCanvas } from "../shared/IsometricFlowDiagramCanvas";

const PERSIST_DEBOUNCE_MS = 200;

export function SlideContentIsometricFlow() {
  const {
    currentSlide,
    setCurrentSlideIsometricFlowData,
    isometricFlowFlushRef,
  } = usePresentation();
  const pendingRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedRef = useRef<string | null>(null);

  /** Fuente de verdad persistida (reactiva a `isometricFlowData`, no solo al `id`). */
  const parsedFromSlide = useMemo(() => {
    return parseIsometricFlowDiagram(currentSlide?.isometricFlowData);
  }, [currentSlide?.id, currentSlide?.isometricFlowData]);

  /**
   * Copia en memoria actualizada en cada gesto (arrastre, enlaces, etc.).
   * Sin esto, el debounce al padre hace que `data` no cambie durante el drag y los bloques vuelven a la posición inicial.
   */
  const [liveDiagram, setLiveDiagram] = useState<IsometricFlowDiagram>(parsedFromSlide);

  useEffect(() => {
    setLiveDiagram(parsedFromSlide);
  }, [parsedFromSlide]);

  useEffect(() => {
    lastPersistedRef.current = currentSlide?.isometricFlowData ?? null;
  }, [currentSlide?.id, currentSlide?.isometricFlowData]);

  const flushPending = useCallback(() => {
    if (pendingRef.current === null) return;
    const data = pendingRef.current;
    pendingRef.current = null;
    if (data === lastPersistedRef.current) return;
    lastPersistedRef.current = data;
    setCurrentSlideIsometricFlowData(data);
  }, [setCurrentSlideIsometricFlowData]);

  const flushPendingAndReturn = useCallback((): string | null => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingRef.current === null) return lastPersistedRef.current;
    const data = pendingRef.current;
    pendingRef.current = null;
    if (data === lastPersistedRef.current) return data;
    lastPersistedRef.current = data;
    setCurrentSlideIsometricFlowData(data);
    return data;
  }, [setCurrentSlideIsometricFlowData]);

  useEffect(() => {
    isometricFlowFlushRef.current = flushPendingAndReturn;
    return () => {
      isometricFlowFlushRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingRef.current !== null) flushPending();
    };
  }, [isometricFlowFlushRef, flushPendingAndReturn, flushPending]);

  const handleChange = useCallback(
    (next: IsometricFlowDiagram) => {
      setLiveDiagram(next);
      const json = serializeIsometricFlowDiagram(next);
      pendingRef.current = json;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        if (pendingRef.current === null) return;
        const data = pendingRef.current;
        pendingRef.current = null;
        if (data === lastPersistedRef.current) return;
        lastPersistedRef.current = data;
        setCurrentSlideIsometricFlowData(data);
      }, PERSIST_DEBOUNCE_MS);
    },
    [setCurrentSlideIsometricFlowData],
  );

  if (!currentSlide) return null;

  return (
    <div className="absolute inset-0 min-h-0">
      <IsometricFlowDiagramCanvas
        key={currentSlide.id}
        data={liveDiagram}
        onChange={handleChange}
        className="rounded-md"
      />
    </div>
  );
}
