import { useMemo } from "react";
import type { MindMapCanvasController } from "./useMindMapCanvasController";
import type { MindMapNode, MindMapLink } from "../../../domain/entities/MindMapDiagram";
import { Plus, Minus } from "lucide-react";

export function MindMapCanvasSvg({ ctrl }: { ctrl: MindMapCanvasController }) {
  const { 
    data, zoom, panX, panY, handlePointerDownNode, activeDragNodeId, dragPos, 
    selectedNodeId, toggleNodeCollapse, updateNodeLabel 
  } = ctrl;

  const width = 2000;
  const height = 2000;

  // Compute visibility
  const { visibleNodes, visibleLinks } = useMemo(() => {
    const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
    const childMap = new Map<string, string[]>();
    const hasChildren = new Set<string>();
    
    for (const l of data.links) {
      if (!childMap.has(l.from)) childMap.set(l.from, []);
      childMap.get(l.from)!.push(l.to);
      hasChildren.add(l.from);
    }

    const incoming = new Set(data.links.map(l => l.to));
    const roots = data.nodes.filter(n => !incoming.has(n.id));

    const visibleNodeIds = new Set<string>();
    const visibleLinksArr: MindMapLink[] = [];

    const traverse = (nodeId: string, isVisible: boolean) => {
      if (isVisible) {
        visibleNodeIds.add(nodeId);
      }
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const children = childMap.get(nodeId) || [];
      const childrenVisible = isVisible && !node.collapsed;

      for (const childId of children) {
        if (childrenVisible) {
          const link = data.links.find(l => l.from === nodeId && l.to === childId);
          if (link) visibleLinksArr.push(link);
        }
        traverse(childId, childrenVisible);
      }
    };

    for (const root of roots) {
      traverse(root.id, true);
    }
    
    // Fallback for cycles or disconnected components
    for (const node of data.nodes) {
        if (!visibleNodeIds.has(node.id) && !incoming.has(node.id)) {
            traverse(node.id, true);
        }
    }

    return { 
      visibleNodes: data.nodes.filter(n => visibleNodeIds.has(n.id)).map(n => ({...n, hasChildren: hasChildren.has(n.id)})), 
      visibleLinks: visibleLinksArr 
    };
  }, [data]);

  const linksRender = useMemo(() => {
    return visibleLinks.map(link => {
      const source = visibleNodes.find(n => n.id === link.from);
      const target = visibleNodes.find(n => n.id === link.to);
      if (!source || !target) return null;
      
      const sx = source.id === activeDragNodeId && dragPos ? dragPos.x : source.x;
      const sy = source.id === activeDragNodeId && dragPos ? dragPos.y : source.y;
      
      const tx = target.id === activeDragNodeId && dragPos ? dragPos.x : target.x;
      const ty = target.id === activeDragNodeId && dragPos ? dragPos.y : target.y;

      const cx1 = sx + (tx - sx) * 0.5;
      const cy1 = sy;
      const cx2 = tx - (tx - sx) * 0.5;
      const cy2 = ty;

      const path = `M ${width/2 + sx} ${height/2 + sy} C ${width/2 + cx1} ${height/2 + cy1}, ${width/2 + cx2} ${height/2 + cy2}, ${width/2 + tx} ${height/2 + ty}`;
      
      return (
        <path 
            key={link.id} 
            d={path} 
            fill="none" 
            strokeWidth={1.5} 
            stroke={source.color} 
            className="opacity-50 pointer-events-none" 
        />
      );
    });
  }, [visibleLinks, visibleNodes, activeDragNodeId, dragPos]);

  return (
    <div className="absolute inset-0 overflow-hidden select-none touch-none">
      <div 
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
        }}
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="absolute inset-[50%] -translate-x-1/2 -translate-y-1/2 overflow-visible pointer-events-none"
          style={{ width, height }}
        >
          {linksRender}
        </svg>
        <div className="absolute inset-[50%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ width, height }}>
          {visibleNodes.map(node => {
            const rx = node.id === activeDragNodeId && dragPos ? dragPos.x : node.x;
            const ry = node.id === activeDragNodeId && dragPos ? dragPos.y : node.y;
            
            const px = width/2 + rx;
            const py = height/2 + ry;
            
            const isRoot = node.kind === "root";
            const size = isRoot ? 48 : node.kind === "branch" ? 20 : 16;
            const isLeft = rx < 0 && !isRoot;
            const isSelected = selectedNodeId === node.id;
            
            return (
              <div 
                key={node.id}
                className="absolute pointer-events-auto flex items-center justify-center rounded-full transition-shadow cursor-pointer"
                style={{
                  left: px,
                  top: py,
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: node.color,
                  width: size,
                  height: size,
                  opacity: node.id === activeDragNodeId ? 0.8 : 1,
                  boxShadow: isRoot ? `0 0 20px ${node.color}` : isSelected ? `0 0 0 2px white, 0 0 0 4px ${node.color}` : `0 0 8px ${node.color}50`,
                }}
                onPointerDown={(e) => handlePointerDownNode(node.id, e)}
                onDoubleClick={(e) => { e.stopPropagation(); toggleNodeCollapse(node.id); }}
                title="Doble clic para ocultar/mostrar ramas"
              >
                {/* Visual indicator for collapsed nodes */}
                {node.hasChildren && node.collapsed && !isRoot && (
                  <div className="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
                    <Plus size={12} strokeWidth={3} />
                  </div>
                )}
                
                {/* Visual indicator for expandable inner dot */}
                {node.hasChildren && !node.collapsed && !isRoot && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-black/20 rounded-full" />
                  </div>
                )}
                
                {/* Editable Text Label */}
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-1 text-xs md:text-sm drop-shadow-sm select-text text-stone-800 dark:text-gray-100 ${isLeft ? 'right-full mr-2 text-right' : 'left-full ml-2 text-left'}`}
                  style={{ fontWeight: isRoot ? 600 : 500 }}
                  onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking text
                >
                  <span 
                    contentEditable={!ctrl.readOnly}
                    suppressContentEditableWarning
                    className="bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500/50 rounded px-1 cursor-text inline-block min-w-[20px]"
                    onBlur={(e) => updateNodeLabel(node.id, e.currentTarget.textContent || "")}
                    onFocus={() => { if(selectedNodeId !== node.id) ctrl.setSelectedNodeId(node.id); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                  >
                    {node.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
