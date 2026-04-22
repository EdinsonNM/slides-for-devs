import type { PresentationProvider } from "../../constants/presentationModels";
import {
  Sparkles,
  Brain,
  Zap,
  Gauge,
  Cpu,
  Share2,
} from "lucide-react";
import { cn } from "../../utils/cn";

const iconClass = "shrink-0 opacity-90";

export function PresentationProviderIcon({
  provider,
  className,
  size = 14,
}: {
  provider: PresentationProvider;
  className?: string;
  size?: number;
}) {
  const c = cn(iconClass, className);
  switch (provider) {
    case "gemini":
      return <Sparkles size={size} className={cn(c, "text-emerald-600 dark:text-emerald-400")} />;
    case "openai":
      return <Brain size={size} className={cn(c, "text-sky-700 dark:text-sky-400")} />;
    case "xai":
      return <Zap size={size} className={cn(c, "text-stone-700 dark:text-stone-300")} />;
    case "groq":
      return <Gauge size={size} className={cn(c, "text-orange-600 dark:text-orange-400")} />;
    case "cerebras":
      return <Cpu size={size} className={cn(c, "text-amber-700 dark:text-amber-400")} />;
    case "openrouter":
      return <Share2 size={size} className={cn(c, "text-violet-600 dark:text-violet-400")} />;
    default:
      return <Cpu size={size} className={cn(c, "text-stone-500 dark:text-stone-400")} />;
  }
}
