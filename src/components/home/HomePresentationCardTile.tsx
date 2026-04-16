import { motion, useReducedMotion } from "motion/react";
import {
  ImagePlus,
  Trash2,
  Loader2,
  CloudUpload,
  Share2,
  Download,
  CloudOff,
  Users,
} from "lucide-react";
import { cn } from "../../utils/cn";
import type { HomePresentationCard } from "../../types";
import { PresentationStorageBadge } from "./PresentationStorageBadge";
import { presentationHeroCardBorderClass } from "../../utils/presentationStorageUi";

const CARD_GRADIENTS = [
  "from-rose-500/90 to-red-600/90",
  "from-blue-500/90 to-indigo-600/90",
  "from-emerald-500/90 to-teal-600/90",
  "from-violet-500/90 to-purple-600/90",
  "from-amber-500/90 to-orange-600/90",
];

/** Fondo para tarjetas solo-nube propias (sin portada local). */
const CLOUD_ONLY_GRADIENT =
  "from-sky-900/50 via-slate-800/80 to-slate-900/90";

/** Fondo para tarjetas compartidas solo en la nube. */
const SHARED_ONLY_GRADIENT =
  "from-violet-900/55 via-slate-800/80 to-slate-900/90";

/** Entrada de tarjeta: spring suave; con “reducir movimiento” solo un fundido breve. */
function cardEntranceTransition(index: number, reducedMotion: boolean | null) {
  if (reducedMotion) {
    return { duration: 0.2, ease: "easeOut" as const };
  }
  return {
    type: "spring" as const,
    stiffness: 380,
    damping: 30,
    mass: 0.78,
    delay: Math.min(index * 0.038, 0.32),
  };
}

/** Capa de fondo (portada o gradiente) a pantalla completa, sin animación al hover. */
function HeroCardMediaLayer({
  coverUrl,
  gradientClass,
}: {
  coverUrl?: string;
  gradientClass?: string;
}) {
  if (coverUrl) {
    return (
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 size-full bg-cover bg-center"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      </div>
    );
  }
  if (gradientClass) {
    return (
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className={cn(
            "absolute inset-0 size-full bg-linear-to-br",
            gradientClass,
          )}
        />
      </div>
    );
  }
  return null;
}

export interface HomePresentationCardTileProps {
  card: HomePresentationCard;
  index: number;
  coverImageCache: Record<string, string>;
  generatingCoverId: string | null;
  syncingToCloudId: string | null;
  onOpenSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
  onGenerateCover: (id: string) => void;
  cloudSyncAvailable: boolean;
  onSyncToCloud?: (id: string) => void;
  onSharePresentation?: (id: string) => void;
  onDownloadFromCloud: (cloudId: string, ownerUid: string) => void;
  downloadingCloudKey: string | null;
  listLayout?: "grid" | "carousel";
  frameClassName?: string;
  style?: React.CSSProperties;
}

export function HomePresentationCardTile({
  card,
  index,
  coverImageCache,
  generatingCoverId,
  syncingToCloudId,
  onOpenSaved,
  onDeleteSaved,
  onGenerateCover,
  cloudSyncAvailable,
  onSyncToCloud,
  onSharePresentation,
  onDownloadFromCloud,
  downloadingCloudKey,
  listLayout = "grid",
  frameClassName,
  style,
}: HomePresentationCardTileProps) {
  const reduceMotion = useReducedMotion();

  const carouselFrameClass =
    listLayout === "carousel"
      ? "aspect-video w-full min-h-0 max-w-full"
      : "";

  const mergedFrameStyle =
    listLayout === "carousel" ? { ...style } : { minHeight: 280, ...style };

  if (card.kind === "cloud_only_mine") {
    const dlKey = `${card.ownerUid}::${card.cloudId}`;
    const isBusy = downloadingCloudKey === dlKey;
    const when =
      card.updatedAt != null && card.updatedAt !== ""
        ? new Date(card.updatedAt)
        : new Date(card.savedAt);

    return (
      <motion.div
        initial={
          reduceMotion
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.965, y: 14 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={cardEntranceTransition(index, reduceMotion)}
        className={cn(
          "group overflow-hidden text-left relative z-0",
          listLayout === "carousel" ? "rounded-3xl" : "rounded-2xl",
          "border border-solid border-sky-400/50 dark:border-sky-500/40",
          "shadow-md shadow-sky-950/12",
          carouselFrameClass,
          frameClassName,
        )}
        style={mergedFrameStyle}
      >
        <HeroCardMediaLayer gradientClass={CLOUD_ONLY_GRADIENT} />
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            onDownloadFromCloud(card.cloudId, card.ownerUid)
          }
          className="absolute inset-0 w-full h-full flex flex-col p-6 pt-14 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:ring-inset z-0 disabled:cursor-wait"
        >
          <div className="flex-1" />
          <div className="text-white text-left">
            <p className="flex items-center gap-2 text-xs font-medium text-sky-100/95 mb-1">
              <CloudOff size={14} className="shrink-0 opacity-90" />
              Solo en la nube
            </p>
            <h3 className="text-lg font-bold leading-snug line-clamp-2">
              {card.topic || "Sin título"}
            </h3>
            <p className="text-sm text-white/85 mt-1">Toca para descargar</p>
            <p className="text-xs text-white/70 mt-0.5">
              {when.toLocaleDateString()}
            </p>
          </div>
        </button>
        <div className="absolute top-5 right-5 z-30 pointer-events-none flex items-center gap-1.5 text-white/90">
          <CloudOff size={18} className="opacity-85" aria-hidden />
          <Download size={20} className="opacity-80" aria-hidden />
        </div>
        {isBusy && (
          <div className="absolute inset-0 bg-black/45 rounded-2xl flex items-center justify-center z-20">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </motion.div>
    );
  }

  if (card.kind === "cloud_only_shared") {
    const dlKey = `${card.ownerUid}::${card.cloudId}`;
    const isBusy = downloadingCloudKey === dlKey;
    const when =
      card.updatedAt != null && card.updatedAt !== ""
        ? new Date(card.updatedAt)
        : new Date(card.savedAt);

    return (
      <motion.div
        initial={
          reduceMotion
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.965, y: 14 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={cardEntranceTransition(index, reduceMotion)}
        className={cn(
          "group overflow-hidden text-left relative z-0",
          listLayout === "carousel" ? "rounded-3xl" : "rounded-2xl",
          "border border-solid border-violet-400/50 dark:border-violet-500/40",
          "shadow-md shadow-violet-950/12",
          carouselFrameClass,
          frameClassName,
        )}
        style={mergedFrameStyle}
      >
        <HeroCardMediaLayer gradientClass={SHARED_ONLY_GRADIENT} />
        <div className="absolute inset-0 bg-linear-to-t from-black/78 via-black/25 to-transparent pointer-events-none" />
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            onDownloadFromCloud(card.cloudId, card.ownerUid)
          }
          className="absolute inset-0 w-full h-full flex flex-col p-6 pt-14 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-inset z-0 disabled:cursor-wait"
        >
          <div className="flex-1" />
          <div className="text-white text-left">
            <p className="flex items-center gap-2 text-xs font-semibold text-violet-100 mb-1">
              <Users size={15} className="shrink-0 opacity-95" aria-hidden />
              Compartida contigo
            </p>
            <h3 className="text-lg font-bold leading-snug line-clamp-2">
              {card.topic || "Sin título"}
            </h3>
            <p className="text-sm text-white/85 mt-1">
              Toca para copiar en este equipo
            </p>
            <p className="text-xs text-white/70 mt-0.5">
              {when.toLocaleDateString()}
            </p>
          </div>
        </button>
        <div className="absolute top-5 right-5 z-30 pointer-events-none flex items-center gap-1.5 text-white/90">
          <Users size={18} className="text-violet-200 opacity-95" aria-hidden />
          <Download size={20} className="opacity-80" aria-hidden />
        </div>
        {isBusy && (
          <div className="absolute inset-0 bg-black/45 rounded-2xl flex items-center justify-center z-20">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
        )}
      </motion.div>
    );
  }

  const p = card.meta;
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const isGeneratingCover = generatingCoverId === p.id;
  const isSyncingCloud = syncingToCloudId === p.id;
  const slaimCoverUrl = coverImageCache[p.id];
  const hasSlaimCover = !!slaimCoverUrl;

  const actionBtnClass = hasSlaimCover
    ? "p-2 rounded-lg bg-black/35 text-white backdrop-blur-md ring-1 ring-white/25 hover:bg-black/45 transition-colors"
    : "p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors";
  const actionDeleteClass = hasSlaimCover
    ? "p-2 rounded-lg bg-black/35 text-white backdrop-blur-md ring-1 ring-white/25 hover:bg-red-600/90 hover:ring-red-300/40 transition-colors"
    : "p-2 rounded-lg bg-white/20 hover:bg-red-500/80 text-white transition-colors";

  return (
    <motion.div
      initial={
        reduceMotion
          ? { opacity: 1, scale: 1, y: 0 }
          : { opacity: 0, scale: 0.965, y: 14 }
      }
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={cardEntranceTransition(index, reduceMotion)}
      className={cn(
        "group overflow-hidden text-left relative z-0",
        "bg-white",
        listLayout === "carousel" ? "rounded-3xl" : "rounded-2xl",
        presentationHeroCardBorderClass(p),
        carouselFrameClass,
        frameClassName,
      )}
      style={mergedFrameStyle}
    >
      {hasSlaimCover ? (
        <HeroCardMediaLayer coverUrl={slaimCoverUrl} />
      ) : (
        <HeroCardMediaLayer coverUrl={undefined} gradientClass={gradient} />
      )}
      {hasSlaimCover ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[52%] bg-linear-to-t from-black/58 via-black/12 to-transparent"
          aria-hidden
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 z-[1] bg-linear-to-t from-black/70 via-transparent to-transparent" />
      )}
      <button
        type="button"
        onClick={() => onOpenSaved(p.id)}
        className={cn(
          "absolute inset-0 z-[2] flex h-full w-full flex-col p-6 pt-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset text-white",
          hasSlaimCover
            ? "focus-visible:ring-white/40"
            : "focus-visible:ring-white/35",
        )}
      >
        <div className="flex-1" />
        <div className="text-left">
          <h3
            className={cn(
              "text-lg font-bold leading-snug line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]",
            )}
          >
            {p.topic}
          </h3>
          <p className="mt-1 text-sm text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
            {p.slideCount} diapositivas
          </p>
          <p className="mt-0.5 text-xs text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
            {new Date(p.savedAt).toLocaleDateString()}
          </p>
        </div>
      </button>
      <PresentationStorageBadge
        cloudId={p.cloudId}
        cloudSyncedAt={p.cloudSyncedAt}
        localBodyCleared={p.localBodyCleared}
        sharedCloudSource={p.sharedCloudSource}
      />
      <div className="absolute top-5 right-5 flex flex-col gap-1 z-30 pointer-events-auto">
        {cloudSyncAvailable && onSyncToCloud && !p.localBodyCleared && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSyncToCloud(p.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isGeneratingCover || isSyncingCloud}
            className={cn(actionBtnClass, "disabled:opacity-60")}
            title={
              p.cloudId
                ? "Actualizar copia en la nube"
                : "Subir a la nube (copia en tu cuenta; no afecta presentaciones ajenas)"
            }
          >
            {isSyncingCloud ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CloudUpload size={18} />
            )}
          </button>
        )}
        {cloudSyncAvailable &&
          p.cloudId &&
          !p.localBodyCleared &&
          onSharePresentation && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onSharePresentation(p.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={actionBtnClass}
              title="Compartir (correo o UID)"
            >
              <Share2 size={18} />
            </button>
          )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onGenerateCover(p.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={isGeneratingCover || !!p.localBodyCleared}
          title={
            p.localBodyCleared
              ? "Recupera la presentación desde la nube primero"
              : "Generar imagen de portada"
          }
          className={cn(actionBtnClass, "disabled:opacity-60")}
        >
          <ImagePlus size={18} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteSaved(p.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={actionDeleteClass}
          title={
            p.localBodyCleared && p.cloudId
              ? "Opciones: quitar de la nube o cancelar"
              : p.cloudId
                ? "Eliminar (elige solo local o también nube)"
                : "Eliminar presentación de este dispositivo"
          }
        >
          <Trash2 size={18} />
        </button>
      </div>
      {(isGeneratingCover || isSyncingCloud) && (
        <div
          className={cn(
            "absolute inset-0 z-20 flex items-center justify-center bg-black/45",
            listLayout === "carousel" ? "rounded-3xl" : "rounded-2xl",
          )}
        >
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}
    </motion.div>
  );
}
