import { useCallback, useRef, useState, useMemo } from "react";
import type { IsometricSlideTextOverlayToolbar } from "../isometricFlowDiagramCanvas/isometricFlowDiagramCanvasTypes";
import type { MindMapDiagram, MindMapNode, MindMapLink } from "../../../domain/entities/MindMapDiagram";
import { parseMindMapDiagram, serializeMindMapDiagram } from "../../../domain/entities/MindMapDiagram";

/** Nodo + todos los descendientes por aristas salientes `from → to`. */
function collectSubtreeNodeIds(links: MindMapLink[], rootId: string): Set<string> {
  const byFrom = new Map<string, string[]>();
  for (const l of links) {
    if (!byFrom.has(l.from)) byFrom.set(l.from, []);
    byFrom.get(l.from)!.push(l.to);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of byFrom.get(id) || []) stack.push(c);
  }
  return out;
}

export type MindMapCanvasProps = {
  data: MindMapDiagram;
  onChange?: (v: MindMapDiagram) => void;
  readOnly?: boolean;
  className?: string;
  slideTextOverlayToolbar?: IsometricSlideTextOverlayToolbar;
  onEditorSurfacePointerDown?: () => void;
};

export type MindMapCanvasController = {
  data: MindMapDiagram;
  readOnly: boolean;
  className?: string;
  panX: number;
  panY: number;
  zoom: number;
  handleWheel: (e: React.WheelEvent) => void;
  handlePointerDownBg: (e: React.PointerEvent) => void;
  handlePointerDownNode: (id: string, e: React.PointerEvent) => void;
  slideTextOverlayToolbar?: IsometricSlideTextOverlayToolbar;
  onEditorSurfacePointerDown?: () => void;
  activeDragNodeId: string | null;
  dragPos: { x: number; y: number } | null;
  resetView: () => void;
  addNode: () => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  toggleNodeCollapse: (id: string) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeDescription: (id: string, description: string) => void;
  updateNodeDescriptionSize: (id: string, width: number, height: number) => void;
  setZoom: (action: React.SetStateAction<number>) => void;
  /** Elimina el nodo seleccionado y toda su subárbol (no aplica a la raíz). */
  removeSelectedNode: () => void;
};

export function useMindMapCanvasController(props: MindMapCanvasProps): MindMapCanvasController {
  const {
    data,
    onChange,
    readOnly = false,
    className,
    slideTextOverlayToolbar,
    onEditorSurfacePointerDown,
  } = props;
  
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  
  const [activeDragNodeId, setActiveDragNodeId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{x: number, y: number} | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  
  const isDraggingBgRef = useRef(false);
  const bgStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  /** Último desplazamiento del puntero en un arrastre de fondo (mismo eje que `onMove` del plano). */
  const bgLastPtrDeltaRef = useRef({ dx: 0, dy: 0 });
  const hasDraggedNodeRef = useRef(false);

  const resetView = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setZoom(1);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.target instanceof Element && e.target.closest("[data-mind-map-ui]")) return;
    e.preventDefault();
    if (e.shiftKey) {
      /* Shift + rueda: desplazar el plano. La rueda suelta hace zoom (p. ej. trackpad o mouse). */
      setPanX((x) => x - e.deltaX);
      setPanY((y) => y - e.deltaY);
      return;
    }
    /* Rueda sin modificadores: zoom; deltaX + deltaY para trackpads. */
    const d = (e.deltaY + e.deltaX) * 0.0025;
    setZoom((z) => Math.max(0.1, Math.min(5, z - d)));
  }, []);

  const handlePointerDownBg = useCallback((e: React.PointerEvent) => {
    if (e.target instanceof Element && e.target.closest("[data-mind-map-ui]")) return;
    onEditorSurfacePointerDown?.();
    if (e.button !== 0) return;
    isDraggingBgRef.current = true;
    bgStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
    bgLastPtrDeltaRef.current = { dx: 0, dy: 0 };

    const onMove = (ev: PointerEvent) => {
      if (!isDraggingBgRef.current) return;
      const dx = ev.clientX - bgStartRef.current.x;
      const dy = ev.clientY - bgStartRef.current.y;
      bgLastPtrDeltaRef.current = { dx, dy };
      setPanX(bgStartRef.current.panX + dx);
      setPanY(bgStartRef.current.panY + dy);
    };

    const onUp = () => {
      isDraggingBgRef.current = false;
      const { dx, dy } = bgLastPtrDeltaRef.current;
      if (Math.abs(dx) + Math.abs(dy) < 6) {
        setSelectedNodeId(null);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [panX, panY, onEditorSurfacePointerDown, setSelectedNodeId]);

  const handlePointerDownNode = useCallback((id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    
    // In readOnly mode, we can select but not drag
    if (readOnly) {
      setSelectedNodeId(id);
      return;
    }
    
    setActiveDragNodeId(id);
    const node = data.nodes.find(n => n.id === id);
    if (!node) return;
    
    setDragPos({ x: node.x, y: node.y });
    
    const startX = e.clientX;
    const startY = e.clientY;
    const nodeStartX = node.x;
    const nodeStartY = node.y;
    hasDraggedNodeRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDraggedNodeRef.current = true;
      }
      
      const nx = nodeStartX + dx;
      const ny = nodeStartY + dy;
      setDragPos({ x: nx, y: ny });
      
      // Update data immediately for live sync (can be throttled)
      if (onChange) {
        const nextNodes = data.nodes.map(n => n.id === id ? { ...n, x: Math.round(nx), y: Math.round(ny) } : n);
        onChange({ ...data, nodes: nextNodes });
      }
    };

    const onUp = () => {
      if (!hasDraggedNodeRef.current) {
        setSelectedNodeId(id);
      }
      setActiveDragNodeId(null);
      setDragPos(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [data, zoom, readOnly, onChange]);

  const addNode = useCallback(() => {
    if (!onChange || readOnly) return;
    const parentId = selectedNodeId || (data.nodes.find(n => n.kind === "root")?.id) || data.nodes[0]?.id;
    const parent = data.nodes.find(n => n.id === parentId);
    if (!parent) return;

    const id = `n_${crypto.randomUUID().slice(0, 8)}`;
    // Distribute children based on parent position (left or right)
    const isRight = parent.x >= 0;
    const dirX = isRight ? 1 : -1;
    const nextNodes = [...data.nodes, {
      id,
      x: parent.x + (150 * dirX),
      y: parent.y + ((Math.random() - 0.5) * 80),
      label: "Nuevo Nodo",
      color: parent.color !== "#3b82f6" ? parent.color : "#10b981", 
      kind: "leaf"
    } as MindMapNode];
    const nextLinks = [...data.links, { id: `l_${id}`, from: parent.id, to: id }];
    
    // Auto-expand parent if collapsed
    const finalNodes = nextNodes.map(n => n.id === parent.id ? { ...n, collapsed: false } : n);
    
    onChange({ ...data, nodes: finalNodes, links: nextLinks });
    setSelectedNodeId(id);
  }, [data, onChange, readOnly, selectedNodeId]);

  const removeSelectedNode = useCallback(() => {
    if (!onChange || readOnly || !selectedNodeId) return;
    const target = data.nodes.find((n) => n.id === selectedNodeId);
    if (!target || target.kind === "root") return;

    const removeIds = collectSubtreeNodeIds(data.links, selectedNodeId);
    const nextNodes = data.nodes.filter((n) => !removeIds.has(n.id));
    const nextLinks = data.links.filter((l) => !removeIds.has(l.from) && !removeIds.has(l.to));

    const parentLink = data.links.find((l) => l.to === selectedNodeId);
    const parentId = parentLink?.from;
    onChange({ ...data, nodes: nextNodes, links: nextLinks });
    setSelectedNodeId(
      parentId && nextNodes.some((n) => n.id === parentId) ? parentId : null,
    );
  }, [data, onChange, readOnly, selectedNodeId]);

  const toggleNodeCollapse = useCallback((id: string) => {
    if (!onChange || readOnly) {
      setCollapsedOverrides(prev => {
        const isCollapsed = prev[id] !== undefined ? prev[id] : data.nodes.find(n => n.id === id)?.collapsed;
        return { ...prev, [id]: !isCollapsed };
      });
      return;
    }
    const nextNodes = data.nodes.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n);
    onChange({ ...data, nodes: nextNodes });
  }, [data, onChange, readOnly]);

  const updateNodeLabel = useCallback((id: string, label: string) => {
    if (!onChange || readOnly) return;
    const nextNodes = data.nodes.map(n => n.id === id ? { ...n, label } : n);
    onChange({ ...data, nodes: nextNodes });
  }, [data, onChange, readOnly]);

  const updateNodeDescription = useCallback((id: string, description: string) => {
    if (!onChange || readOnly) return;
    const nextNodes = data.nodes.map(n => (n.id === id ? { ...n, description } : n));
    onChange({ ...data, nodes: nextNodes });
  }, [data, onChange, readOnly]);

  const updateNodeDescriptionSize = useCallback(
    (id: string, width: number, height: number) => {
      if (!onChange || readOnly) return;
      const w = Math.round(Math.max(1, width));
      const h = Math.round(Math.max(1, height));
      const nextNodes = data.nodes.map(n =>
        n.id === id ? { ...n, descriptionWidth: w, descriptionHeight: h } : n,
      );
      onChange({ ...data, nodes: nextNodes });
    },
    [data, onChange, readOnly],
  );

  const displayData = useMemo(() => {
    if (Object.keys(collapsedOverrides).length === 0) return data;
    return {
      ...data,
      nodes: data.nodes.map(n => collapsedOverrides[n.id] !== undefined ? { ...n, collapsed: collapsedOverrides[n.id] } : n)
    };
  }, [data, collapsedOverrides]);

  return {
    data: displayData,
    readOnly,
    className,
    panX,
    panY,
    zoom,
    handleWheel,
    handlePointerDownBg,
    handlePointerDownNode,
    slideTextOverlayToolbar,
    onEditorSurfacePointerDown,
    activeDragNodeId,
    dragPos,
    resetView,
    addNode,
    selectedNodeId,
    setSelectedNodeId,
    toggleNodeCollapse,
    updateNodeLabel,
    updateNodeDescription,
    updateNodeDescriptionSize,
    setZoom,
    removeSelectedNode,
  };
}
