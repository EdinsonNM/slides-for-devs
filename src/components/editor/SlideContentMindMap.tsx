import { useEffect, useState, useRef } from "react";
import { usePresentation } from "../../context/PresentationContext";
import { MindMapDiagramCanvas } from "../shared/MindMapDiagramCanvas";
import type { MindMapDiagram } from "../../domain/entities/MindMapDiagram";
import { parseMindMapDiagram, serializeMindMapDiagram } from "../../domain/entities/MindMapDiagram";

export function SlideContentMindMap() {
  const { currentSlide, patchCurrentSlideCanvasScene, addCanvasElementToCurrentSlide, setCurrentSlideMindMapData } =
    usePresentation();

  const [data, setData] = useState<MindMapDiagram>(() =>
    parseMindMapDiagram(currentSlide?.mindMapData),
  );

  const debounceTimerRef = useRef<number>(null);

  // Sync back from slide if changed externally
  useEffect(() => {
    setData(parseMindMapDiagram(currentSlide?.mindMapData));
  }, [currentSlide?.mindMapData]);

  const handleChange = (newData: MindMapDiagram) => {
    setData(newData);
    
    // Debounce the save to prevent stuttering
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = window.setTimeout(() => {
      if (currentSlide) {
        setCurrentSlideMindMapData(serializeMindMapDiagram(newData));
      }
    }, 500);
  };
  
  const hasTitleOverlay = currentSlide?.canvasScene?.elements?.some(
    (e) => e.kind === "title" || e.kind === "chapterTitle",
  );
  
  const hasMarkdownOverlay = currentSlide?.canvasScene?.elements?.some(
    (e) => e.kind === "markdown",
  );

  return (
    <div className="absolute inset-0 z-0">
      <MindMapDiagramCanvas
        data={data}
        onChange={handleChange}
        slideTextOverlayToolbar={{
          onAddTitle: () => addCanvasElementToCurrentSlide("title"),
          onAddDescription: () => addCanvasElementToCurrentSlide("markdown"),
          disableTitle: hasTitleOverlay,
          disableDescription: hasMarkdownOverlay,
        }}
        onEditorSurfacePointerDown={() => {
          // Deselect canvas elements when clicking the mind map background
          // This allows users to drop focus from floating text editors
          patchCurrentSlideCanvasScene?.((scene) => ({
            ...scene,
            selectedElementId: undefined,
          }));
        }}
      />
    </div>
  );
}
