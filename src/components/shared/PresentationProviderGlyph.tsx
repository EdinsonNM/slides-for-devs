import { Bot, Cpu, Network, X, Zap } from "lucide-react";
import type { PresentationProvider } from "../../constants/presentationModels";
import { cn } from "../../utils/cn";

const imgBase = "shrink-0 object-contain opacity-95 dark:opacity-100";

export function PresentationProviderGlyph({
  provider,
  className,
}: {
  provider: PresentationProvider;
  className?: string;
}) {
  const box = cn("size-[18px]", className);

  switch (provider) {
    case "gemini":
      return (
        <img
          src="/simple-icons/googlegemini.svg"
          alt=""
          className={cn(imgBase, box)}
          draggable={false}
        />
      );
    case "openrouter":
      return (
        <img
          src="/simple-icons/openrouter.svg"
          alt=""
          className={cn(imgBase, box)}
          draggable={false}
        />
      );
    case "openai":
      return (
        <Bot
          className={cn(box, "text-emerald-600 dark:text-emerald-400")}
          strokeWidth={2}
          aria-hidden
        />
      );
    case "xai":
      return (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900",
            box,
          )}
          aria-hidden
        >
          <X size={11} strokeWidth={2.75} />
        </span>
      );
    case "groq":
      return (
        <Zap
          className={cn(box, "text-orange-500 dark:text-orange-400")}
          strokeWidth={2}
          aria-hidden
        />
      );
    case "cerebras":
      return (
        <Cpu
          className={cn(box, "text-amber-600 dark:text-amber-400")}
          strokeWidth={2}
          aria-hidden
        />
      );
    default:
      return (
        <Network
          className={cn(box, "text-muted-foreground")}
          strokeWidth={2}
          aria-hidden
        />
      );
  }
}
