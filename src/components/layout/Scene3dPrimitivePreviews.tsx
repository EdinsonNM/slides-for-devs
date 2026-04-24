import type { Canvas3dPrimitiveKind } from "../../domain/entities/Canvas3dSceneData";
import { cn } from "../../utils/cn";

/** Miniaturas estilo vista alámbrica / sombreada para la rejilla «Añadir forma». */
export function Scene3dPrimitivePreview({
  kind,
  className,
}: {
  kind: Canvas3dPrimitiveKind;
  className?: string;
}) {
  const stroke = "currentColor";
  const common = {
    viewBox: "0 0 48 48",
    className: cn("size-full text-stone-600 dark:text-stone-300", className),
    "aria-hidden": true as const,
  };

  switch (kind) {
    case "box":
      return (
        <svg {...common}>
          <path
            d="M10 18 L24 10 L38 18 L38 32 L24 40 L10 32 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M10 18 L10 32 M24 10 L24 24 M38 18 L38 32"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.45"
          />
          <path
            d="M24 24 L38 32 M24 24 L10 32 M24 24 L24 40"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.35"
          />
        </svg>
      );
    case "sphere":
      return (
        <svg {...common}>
          <ellipse
            cx="24"
            cy="24"
            rx="15"
            ry="15"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="15"
            ry="6"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.5"
          />
          <path
            d="M9 24 Q24 14 39 24"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.45"
          />
          <path
            d="M9 24 Q24 34 39 24"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.35"
          />
        </svg>
      );
    case "cylinder":
      return (
        <svg {...common}>
          <ellipse
            cx="24"
            cy="14"
            rx="12"
            ry="5"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
          <path
            d="M12 14 L12 34 M36 14 L36 34"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.4"
          />
          <ellipse
            cx="24"
            cy="34"
            rx="12"
            ry="5"
            fill="none"
            stroke={stroke}
            strokeWidth="1.4"
          />
          <line
            x1="12"
            y1="14"
            x2="12"
            y2="34"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <line
            x1="36"
            y1="14"
            x2="36"
            y2="34"
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      );
    case "cone":
      return (
        <svg {...common}>
          <path
            d="M24 8 L38 38 L10 38 Z"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <ellipse
            cx="24"
            cy="38"
            rx="14"
            ry="4.5"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.75"
          />
        </svg>
      );
    case "torus":
      return (
        <svg {...common}>
          <ellipse
            cx="24"
            cy="24"
            rx="18"
            ry="8"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="10"
            ry="4"
            fill="none"
            stroke={stroke}
            strokeWidth="1.35"
            opacity="0.85"
          />
          <path
            d="M6 24 Q24 12 42 24"
            fill="none"
            stroke={stroke}
            strokeWidth="1.2"
            opacity="0.4"
          />
        </svg>
      );
    case "capsule":
      return (
        <svg {...common}>
          <rect
            x="14"
            y="12"
            width="20"
            height="24"
            rx="10"
            ry="10"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <line
            x1="14"
            y1="24"
            x2="34"
            y2="24"
            stroke={stroke}
            strokeWidth="1.1"
            opacity="0.35"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect
            x="8"
            y="8"
            width="32"
            height="32"
            rx="3"
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            opacity="0.35"
          />
        </svg>
      );
  }
}
