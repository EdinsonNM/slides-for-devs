import { cn } from "../../../utils/cn";
import { MindMapCanvasSvg } from "./MindMapCanvasSvg";
import { MindMapCanvasToolbar } from "./MindMapCanvasToolbar";
import type { MindMapCanvasProps } from "./useMindMapCanvasController";
import { useMindMapCanvasController } from "./useMindMapCanvasController";

export function MindMapDiagramCanvasView(props: MindMapCanvasProps) {
  const ctrl = useMindMapCanvasController(props);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0e]",
        props.className
      )}
      onWheel={ctrl.handleWheel}
      onPointerDown={ctrl.handlePointerDownBg}
    >
      {/* Animated Deep Space Ambient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-500/20 blur-[100px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-500/10 dark:bg-purple-600/20 blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-[80px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* Parallax Grid for scale and 3D depth */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: `${100 * ctrl.zoom}px ${100 * ctrl.zoom}px`,
          backgroundPosition: `${(ctrl.panX % (100 * ctrl.zoom))}px ${(ctrl.panY % (100 * ctrl.zoom))}px`,
          color: 'var(--tw-prose-body, #64748b)'
        }}
      />
      
      {/* Vignette Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-10" 
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.05) 100%)'
        }}
      />
      
      <MindMapCanvasSvg ctrl={ctrl} />
      <MindMapCanvasToolbar {...ctrl} />
    </div>
  );
}
