import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  Eye,
  GraduationCap,
  Layers3,
  LayoutGrid,
  Loader2,
  Palette,
  Search,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { useAuth } from "../../presentation/contexts/AuthContext";
import { AvatarMenu } from "../shared/AvatarMenu";
import { cn } from "../../utils/cn";
import {
  listPublicPresentationsForExplore,
  pullPresentationFromCloud,
  type PublicPresentationExploreItem,
} from "../../services/presentationCloud";
import { DEFAULT_DECK_VISUAL_THEME } from "../../domain/entities";
import { getFirebaseConfig, initFirebase } from "../../services/firebase";
import { formatCloudSharedListError } from "../../utils/cloudSyncErrors";
import { HeroCardMediaLayer } from "./HomePresentationCardTile";
import { HomeDeckSlideReplicaFill } from "./HomeDeckSlideReplicaFill";
import { SlideMarkdown } from "../shared/SlideMarkdown";

export interface PublicPresentationsMockProps {
  onOpenConfig?: () => void;
}

type CategoryId = "todas" | "negocios" | "educacion" | "tecnologia" | "creatividad";

interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: typeof Briefcase;
}

const CATEGORIES: CategoryDef[] = [
  { id: "todas", label: "Todas", icon: LayoutGrid },
  { id: "negocios", label: "Negocios", icon: Briefcase },
  { id: "educacion", label: "Educación", icon: GraduationCap },
  { id: "tecnologia", label: "Tecnología", icon: BookOpen },
  { id: "creatividad", label: "Creatividad", icon: Palette },
];

const HERO_BANNER_AUTOPLAY_MS = 7_500;

const BANNER_MEDIA_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BANNER_MEDIA_SPRING = {
  type: "spring" as const,
  stiffness: 340,
  damping: 36,
  mass: 0.88,
};

/** Misma prioridad que `HomePresentationCardTile` (nube): portada Slaim → réplica slide 0 → gradiente. */
const EXPLORE_CARD_FALLBACK_GRADIENT =
  "from-sky-900/50 via-slate-800/80 to-slate-900/90";

function PublicExploreItemPreviewMedia({
  item,
  className,
  fit = "cover",
  lockReplicaInteraction = false,
  zoomClassName,
}: {
  item: PublicPresentationExploreItem;
  className?: string;
  fit?: "cover" | "fill";
  zoomClassName?: string;
  /**
   * En el hero, si solo hay réplica del slide 0, bloquea clics, foco y scroll dentro del lienzo
   * (el iframe/canvas de la preview no debe capturar eventos).
   */
  lockReplicaInteraction?: boolean;
}) {
  const coverUrl = item.homePreviewImageUrl?.trim();
  const hasCover = !!coverUrl;
  const slide = item.homeFirstSlideReplica;
  const hasReplica = !!slide && !hasCover;
  return (
    <div className={cn("relative overflow-hidden bg-stone-300 dark:bg-stone-800", className)}>
      {hasCover ? (
        <img
          src={coverUrl}
          alt=""
          className={cn(
            "h-full w-full transition-transform duration-500 ease-out",
            fit === "cover" ? "object-cover" : "object-fill",
            zoomClassName,
          )}
          draggable={false}
        />
      ) : hasReplica ? (
        <div
          className={cn(
            "absolute inset-0",
            lockReplicaInteraction && "touch-none select-none overscroll-none",
          )}
          aria-hidden
          inert={lockReplicaInteraction ? true : undefined}
        >
          <HomeDeckSlideReplicaFill
            slide={slide}
            deckVisualTheme={item.homePreviewDeckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME}
          />
        </div>
      ) : (
        <HeroCardMediaLayer coverUrl={undefined} gradientClass={EXPLORE_CARD_FALLBACK_GRADIENT} />
      )}
    </div>
  );
}

function publicItemKey(p: PublicPresentationExploreItem): string {
  return `${p.ownerUid}::${p.cloudId}`;
}

/**
 * Clasifica cada publicación en una de las 4 pestañas de la UI a partir de
 * `publicationCategories` (valores de `PRESENTATION_CATEGORY_OPTIONS`).
 */
function primaryCategoryId(item: PublicPresentationExploreItem): CategoryId {
  const c = new Set(item.publicationCategories);
  if (c.size === 0) return "tecnologia";
  if (["Productividad", "Arquitectura"].some((x) => c.has(x))) return "negocios";
  if (["Data", "AI/ML"].some((x) => c.has(x))) return "educacion";
  if (
    ["Frontend", "Backend", "DevOps", "Cloud", "Testing", "Seguridad"].some((x) =>
      c.has(x),
    )
  ) {
    return "tecnologia";
  }
  return "creatividad";
}

function categoryDefForPrimaryBucket(item: PublicPresentationExploreItem) {
  const pid = primaryCategoryId(item);
  return CATEGORIES.find((c) => c.id === pid);
}

function shortUid(uid: string, len = 8): string {
  if (uid.length <= len) return uid;
  return `${uid.slice(0, len)}…`;
}

function formatPublicDate(value: string | null | undefined): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(date);
}

function pseudoSocialCountFromUid(uid: string): number {
  const checksum = [...uid].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return 120 + (checksum % 870);
}

export function PublicPresentationsMock({ onOpenConfig }: PublicPresentationsMockProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setIsPreviewMode } = usePresentation();
  const reduceMotion = useReducedMotion();
  const greetingTitle = useMemo(() => {
    const d = user?.displayName?.trim();
    if (!d) return "Hola de nuevo";
    return `Hola, ${d.split(/\s+/)[0] ?? d}`;
  }, [user?.displayName]);

  const [categoryId, setCategoryId] = useState<CategoryId>("todas");
  const [allItems, setAllItems] = useState<PublicPresentationExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [pauseAutoplayOnHero, setPauseAutoplayOnHero] = useState(false);
  const [pauseAutoplayOnTendencias, setPauseAutoplayOnTendencias] = useState(false);
  const [openingCardKey, setOpeningCardKey] = useState<string | null>(null);
  const [detailOpenKey, setDetailOpenKey] = useState<string | null>(null);
  const [detailReadme, setDetailReadme] = useState<string>("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [followedOwners, setFollowedOwners] = useState<Record<string, boolean>>({});
  const filteredRef = useRef<PublicPresentationExploreItem[]>([]);

  const load = useCallback(async () => {
    const fb = await initFirebase();
    if (!fb?.firestore || !user) {
      setAllItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listPublicPresentationsForExplore();
      setAllItems(rows);
    } catch (e) {
      console.error(e);
      const cfg = await getFirebaseConfig();
      setLoadError(formatCloudSharedListError(e, cfg?.projectId));
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () =>
      categoryId === "todas"
        ? allItems
        : allItems.filter((it) => primaryCategoryId(it) === categoryId),
    [allItems, categoryId],
  );

  filteredRef.current = filtered;

  const autoplayHeroPaused = pauseAutoplayOnHero || pauseAutoplayOnTendencias;

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedKey("");
      return;
    }
    setSelectedKey((prev) => {
      if (prev && filtered.some((x) => publicItemKey(x) === prev)) return prev;
      return publicItemKey(filtered[0]!);
    });
  }, [filtered]);

  useEffect(() => {
    if (loading || autoplayHeroPaused) return;
    const list = filteredRef.current;
    if (list.length < 2) return;
    const t = window.setInterval(() => {
      setSelectedKey((prev) => {
        const cur = filteredRef.current;
        if (cur.length < 2) return prev;
        const idx = cur.findIndex((x) => publicItemKey(x) === prev);
        const i = idx >= 0 ? idx : 0;
        return publicItemKey(cur[(i + 1) % cur.length]!);
      });
    }, HERO_BANNER_AUTOPLAY_MS);
    return () => window.clearInterval(t);
  }, [loading, autoplayHeroPaused, filtered]);

  const selected = filtered.find((x) => publicItemKey(x) === selectedKey) ?? filtered[0] ?? null;
  const hasExploreHeroCover = !!selected?.homePreviewImageUrl?.trim();
  const hasExploreHeroReplica =
    !!selected?.homeFirstSlideReplica && !hasExploreHeroCover;
  const hasExploreHeroVisual = hasExploreHeroCover || hasExploreHeroReplica;

  const category = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];
  const authorsSectionTitle =
    categoryId === "todas" ? "Autores" : `Autores en ${category?.label ?? ""}`;

  const topTendencia = useMemo(() => filtered.slice(0, 5), [filtered]);
  const detailItem = useMemo(
    () => allItems.find((it) => publicItemKey(it) === detailOpenKey) ?? null,
    [allItems, detailOpenKey],
  );
  const detailDate = detailItem
    ? formatPublicDate(
        detailItem.publicationPublishedAt || detailItem.updatedAt || detailItem.savedAt,
      )
    : "";
  const detailCategory = detailItem
    ? detailItem.publicationCategories.length > 0
      ? detailItem.publicationCategories.join(" · ")
      : (categoryDefForPrimaryBucket(detailItem)?.label ?? "—")
    : "—";
  const detailOwnerPublications = useMemo(
    () => (detailItem ? allItems.filter((it) => it.ownerUid === detailItem.ownerUid) : []),
    [allItems, detailItem],
  );
  const detailOwnerPublicationCount = detailOwnerPublications.length;
  const detailOwnerCategoryCount = useMemo(() => {
    const categories = new Set<string>();
    detailOwnerPublications.forEach((item) => {
      categories.add(categoryDefForPrimaryBucket(item)?.label ?? "General");
    });
    return categories.size;
  }, [detailOwnerPublications]);
  const detailOwnerTagCount = useMemo(() => {
    const tags = new Set<string>();
    detailOwnerPublications.forEach((item) => {
      item.publicationTags.forEach((tag) => tags.add(tag));
    });
    return tags.size;
  }, [detailOwnerPublications]);
  const detailOwnerFollowers = detailItem ? pseudoSocialCountFromUid(detailItem.ownerUid) : 0;
  const isFollowingDetailOwner = detailItem ? !!followedOwners[detailItem.ownerUid] : false;

  const destacados = useMemo(() => {
    const m = new Map<string, { ownerUid: string; count: number }>();
    for (const it of filtered) {
      const cur = m.get(it.ownerUid);
      if (cur) cur.count += 1;
      else m.set(it.ownerUid, { ownerUid: it.ownerUid, count: 1 });
    }
    return [...m.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [filtered]);

  const onPickCategory = (id: CategoryId) => {
    setCategoryId(id);
  };

  const openInReadMode = useCallback(
    async (item: PublicPresentationExploreItem) => {
      const key = publicItemKey(item);
      setOpeningCardKey(key);
      try {
        setIsPreviewMode(false);
        navigate(`/public/${item.ownerUid}/${item.cloudId}`);
      } finally {
        setOpeningCardKey(null);
      }
    },
    [navigate, setIsPreviewMode],
  );

  const openDetails = useCallback(async (item: PublicPresentationExploreItem) => {
    const key = publicItemKey(item);
    setDetailOpenKey(key);
    setDetailReadme("");
    setDetailError(null);
    setDetailLoading(true);
    try {
      const pulled = await pullPresentationFromCloud(item.ownerUid, item.cloudId);
      setDetailReadme(pulled.presentation.presentationReadme?.trim() ?? "");
    } catch (error) {
      console.error(error);
      setDetailError("No se pudo cargar el README de esta publicación.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-stone-100 text-stone-900 dark:bg-[#090b10] dark:text-stone-100">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-100/95 px-4 py-3 backdrop-blur-md dark:border-white/5 dark:bg-[#090b10]/95 sm:px-6 sm:py-3.5">
        <h1 className="truncate text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-xl">
          {greetingTitle}
        </h1>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300/80 bg-white text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 dark:border-white/10 dark:bg-white/3 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-200"
            aria-label="Búsqueda (próximamente)"
            disabled
          >
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300/80 bg-white text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 dark:border-white/10 dark:bg-white/3 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-200"
            aria-label="Notificaciones (próximamente)"
            disabled
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <AvatarMenu onOpenConfig={onOpenConfig} variant="home" />
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        {loadError && (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/50 dark:text-red-100"
          >
            {loadError}
          </div>
        )}
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-5">
          {detailItem ? (
            <section className="flex flex-col gap-4 sm:gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDetailOpenKey(null)}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-300/80 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-white/15 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a publicaciones
                </button>
                <button
                  type="button"
                  onClick={() => void openInReadMode(detailItem)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  <Eye className="h-4 w-4" />
                  Ir a la presentación
                </button>
              </div>

              <article className="overflow-hidden rounded-3xl border border-stone-300/70 bg-white dark:border-white/10 dark:bg-[#0f1118]">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="group relative aspect-video w-full overflow-hidden bg-stone-900">
                    <PublicExploreItemPreviewMedia
                      item={detailItem}
                      className="absolute inset-0 h-full w-full"
                      fit="cover"
                      lockReplicaInteraction
                      zoomClassName="scale-100 group-hover:scale-[1.08]"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/82 via-black/32 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-stone-300">
                        Presentación pública
                      </p>
                      <h2 className="mt-2 line-clamp-2 text-2xl font-semibold leading-tight text-white sm:text-4xl">
                        {detailItem.topic}
                      </h2>
                      <p className="mt-2 line-clamp-3 text-sm text-stone-200 sm:text-base">
                        {detailItem.description?.trim()
                          ? detailItem.description
                          : "Sin descripción publicada."}
                      </p>
                    </div>
                  </div>

                  <aside className="border-t border-stone-200/80 bg-stone-50/80 p-4 dark:border-white/10 dark:bg-white/3 lg:border-t-0 lg:border-l">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                      Perfil del autor
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-700 text-sm font-bold text-white">
                        {detailItem.ownerUid.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {shortUid(detailItem.ownerUid, 12)}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Creador de contenido técnico
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-stone-200/80 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-[#0b0d13]">
                        <p className="text-stone-500 dark:text-stone-400">Publicaciones</p>
                        <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {detailOwnerPublicationCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200/80 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-[#0b0d13]">
                        <p className="text-stone-500 dark:text-stone-400">Seguidores</p>
                        <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {detailOwnerFollowers}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200/80 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-[#0b0d13]">
                        <p className="text-stone-500 dark:text-stone-400">Categorías</p>
                        <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {detailOwnerCategoryCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200/80 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-[#0b0d13]">
                        <p className="text-stone-500 dark:text-stone-400">Etiquetas</p>
                        <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {detailOwnerTagCount}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFollowedOwners((prev) => ({
                          ...prev,
                          [detailItem.ownerUid]: !prev[detailItem.ownerUid],
                        }));
                      }}
                      className={cn(
                        "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                        isFollowingDetailOwner
                          ? "border border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                          : "bg-emerald-600 text-white hover:bg-emerald-500",
                      )}
                    >
                      {isFollowingDetailOwner ? (
                        <>
                          <Users className="h-4 w-4" />
                          Siguiendo
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          Seguir usuario
                        </>
                      )}
                    </button>

                    <div className="mt-4 space-y-2 rounded-xl border border-stone-200/80 bg-white p-3 text-xs text-stone-600 dark:border-white/10 dark:bg-[#0b0d13] dark:text-stone-300">
                      <p className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Última publicación: {detailDate}
                      </p>
                      <p className="inline-flex items-center gap-1.5">
                        <Layers3 className="h-3.5 w-3.5" />
                        Nivel predominante: {detailItem.publicationLevel}
                      </p>
                    </div>
                  </aside>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t border-stone-200/80 bg-stone-50/80 p-4 text-sm text-stone-700 dark:border-white/10 dark:bg-white/3 dark:text-stone-200 sm:grid-cols-2 lg:grid-cols-4">
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Autor:</span>{" "}
                    {shortUid(detailItem.ownerUid, 12)}
                  </p>
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Fecha:</span> {detailDate}
                  </p>
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Nivel:</span>{" "}
                    {detailItem.publicationLevel}
                  </p>
                  <p>
                    <span className="text-stone-500 dark:text-stone-400">Categoría:</span>{" "}
                    {detailCategory}
                  </p>
                </div>
              </article>

              <section className="rounded-2xl border border-stone-300/70 bg-white p-4 dark:border-white/10 dark:bg-[#0f1118] sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-stone-400">
                  README de la presentación
                </p>
                {detailLoading ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando README…
                  </div>
                ) : detailError ? (
                  <p className="mt-4 text-sm text-red-600 dark:text-red-300">{detailError}</p>
                ) : detailReadme ? (
                  <SlideMarkdown
                    preprocess="importedFile"
                    className="mt-4 text-sm"
                    importedGithubScheme="dark"
                  >
                    {detailReadme}
                  </SlideMarkdown>
                ) : (
                  <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
                    Esta publicación no tiene README.
                  </p>
                )}
              </section>
            </section>
          ) : loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-stone-400" aria-label="Cargando" />
            </div>
          ) : !selected && filtered.length === 0 ? (
            <div className="rounded-3xl border border-stone-200/80 bg-white/80 px-4 py-16 text-center text-stone-600 dark:border-white/10 dark:bg-white/3 dark:text-stone-300">
              <p className="text-base font-medium text-stone-800 dark:text-stone-100">
                {allItems.length === 0
                  ? "Aún no hay publicaciones públicas en Slaim."
                  : "No hay publicaciones en esta categoría."}
              </p>
              {allItems.length > 0 && (
                <p className="mt-2 text-sm">Prueba otra pestaña de categoría.</p>
              )}
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <button
                  type="button"
                  onClick={() => setSelectedKey(selected ? publicItemKey(selected) : "")}
                  onPointerEnter={() => setPauseAutoplayOnHero(true)}
                  onPointerLeave={() => setPauseAutoplayOnHero(false)}
                  className={cn(
                    "group relative z-0 w-full min-h-0 aspect-video overflow-hidden rounded-3xl border border-stone-300/70 text-left dark:border-white/10",
                    hasExploreHeroVisual
                      ? "bg-stone-900"
                      : "bg-linear-to-br from-stone-300 to-stone-200 dark:from-[#1b1f2a] dark:to-[#11131a]",
                  )}
                >
                  {selected && (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      <AnimatePresence initial={false} mode="sync">
                        <motion.div
                          key={selectedKey}
                          className="absolute inset-0 h-full min-h-0 w-full"
                          initial={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 1.04 }
                          }
                          animate={{ opacity: 1, scale: 1 }}
                          exit={
                            reduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 0.985 }
                          }
                          transition={
                            reduceMotion
                              ? { duration: 0.16, ease: "easeOut" }
                              : {
                                  opacity: { duration: 0.42, ease: BANNER_MEDIA_EASE },
                                  scale: BANNER_MEDIA_SPRING,
                                }
                          }
                        >
                          <PublicExploreItemPreviewMedia
                            item={selected}
                            className="h-full min-h-0 w-full"
                            fit="cover"
                            lockReplicaInteraction={hasExploreHeroReplica}
                            zoomClassName="scale-100 group-hover:scale-[1.06]"
                          />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}
                  {hasExploreHeroVisual ? (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-[52%] bg-linear-to-t from-black/58 via-black/12 to-transparent"
                      aria-hidden
                    />
                  ) : (
                    <div
                      className="pointer-events-none absolute inset-0 z-1 bg-linear-to-t from-black/78 via-black/25 to-transparent"
                      aria-hidden
                    />
                  )}
                  <AnimatePresence initial={false} mode="wait">
                    <motion.div
                      key={selectedKey}
                      className="relative z-2 flex h-full min-h-0 max-w-xl flex-col justify-end p-5 sm:p-7 text-left"
                      initial={
                        reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      exit={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -6 }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0.14, ease: "easeOut" }
                          : {
                              y: {
                                type: "spring",
                                stiffness: 420,
                                damping: 38,
                                mass: 0.85,
                              },
                              opacity: { duration: 0.3, ease: BANNER_MEDIA_EASE },
                            }
                      }
                    >
                      <p className="text-[11px] uppercase tracking-[0.22em] text-stone-200">
                        {category?.label}
                      </p>
                      <h2 className="mt-2 line-clamp-2 text-2xl font-semibold leading-tight text-white sm:text-4xl">
                        {selected?.topic || "—"}
                      </h2>
                      <p className="mt-2 line-clamp-3 text-sm text-stone-200/90 sm:text-base">
                        {selected?.description?.trim()
                          ? selected.description
                          : "Sin descripción. El autor puede añadirla en la configuración de publicación."}
                      </p>
                      {selected && (
                        <p className="mt-2 text-xs text-stone-300/90">
                          Por {shortUid(selected.ownerUid)}
                          {selected.publicationLevel ? ` · Nivel: ${selected.publicationLevel}` : null}
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </button>

                <aside className="flex h-full min-h-0 min-w-0 flex-col rounded-3xl border border-stone-300/70 bg-white p-3 dark:border-white/10 dark:bg-[#0f1118] sm:p-4">
                  <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600 dark:text-stone-500">
                    Tendencias
                  </p>
                  <div
                    className="mt-3 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto"
                    onPointerEnter={() => setPauseAutoplayOnTendencias(true)}
                    onPointerLeave={() => setPauseAutoplayOnTendencias(false)}
                  >
                    {topTendencia.length === 0 ? (
                      <p className="text-xs text-stone-500">Nada en esta categoría aún.</p>
                    ) : (
                      topTendencia.map((it) => {
                        const k = publicItemKey(it);
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setSelectedKey(k)}
                            className={cn(
                              "group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition",
                              k === selectedKey
                                ? "bg-stone-200 dark:bg-white/10"
                                : "hover:bg-stone-100 dark:hover:bg-white/5",
                            )}
                          >
                            <PublicExploreItemPreviewMedia
                              item={it}
                              className="h-12 w-20 shrink-0 overflow-hidden rounded-lg"
                              fit="cover"
                            />
                            <div className="min-w-0">
                              <p className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-100">
                                {it.topic}
                              </p>
                              <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-600 dark:text-stone-500">
                                {shortUid(it.ownerUid)} · {it.publicationTags[0] ?? "público"}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </aside>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-100 sm:text-lg">
                    {authorsSectionTitle}
                  </h3>
                </div>
                {destacados.length === 0 ? (
                  <p className="text-sm text-stone-500">Sin autores con varias publicaciones en esta categoría.</p>
                ) : (
                  <ul className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {destacados.map((u, idx) => (
                      <li
                        key={u.ownerUid}
                        className="flex min-w-[230px] shrink-0 items-center gap-3 rounded-xl border border-stone-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/3"
                      >
                        <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                          {idx + 1}
                        </span>
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-700 text-[11px] font-bold text-white",
                          )}
                        >
                          {u.ownerUid.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-stone-900 dark:text-stone-100">
                            {shortUid(u.ownerUid, 10)}
                          </p>
                          <p className="truncate text-[10px] text-stone-600 dark:text-stone-500">
                            {u.count} pública{u.count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={`${u.ownerUid}-star-${i}`}
                              className={cn(
                                "h-3 w-3",
                                i < Math.min(5, u.count) ? "fill-amber-400 text-amber-400" : "text-stone-400 dark:text-stone-600",
                              )}
                            />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="mb-3 flex flex-col items-start gap-3">
                  <h3 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-100 sm:text-lg">
                    Publicaciones
                  </h3>
                  <div
                    className="flex w-full items-center gap-5 border-b border-stone-200 pb-1 dark:border-white/10 sm:gap-6"
                    role="tablist"
                    aria-label="Categorías"
                  >
                    {CATEGORIES.map((c) => {
                      const active = c.id === categoryId;
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => onPickCategory(c.id)}
                          className={cn(
                            "relative inline-flex items-center gap-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition",
                            active
                              ? "text-stone-900 dark:text-stone-100"
                              : "text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300",
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {c.label}
                          {active ? (
                            <span className="absolute inset-x-0 -bottom-[5px] h-[2px] rounded-full bg-rose-500/90" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {filtered.map((card) => {
                    const k = publicItemKey(card);
                    const cardDate = formatPublicDate(
                      card.publicationPublishedAt || card.updatedAt || card.savedAt,
                    );
                    const cardDescription = card.description?.trim()
                      ? card.description
                      : "Sin descripción publicada.";
                    const cardCategory =
                      card.publicationCategories.length > 0
                        ? card.publicationCategories.join(" · ")
                        : categoryId === "todas"
                          ? (categoryDefForPrimaryBucket(card)?.label ?? "—")
                          : (category?.label ?? "—");
                    const isOpening = openingCardKey === k;
                    return (
                      <article
                        key={k}
                        className="group relative isolate z-0 h-full overflow-visible transition-[z-index] duration-75 hover:z-50 focus-within:z-50"
                        onMouseEnter={() => setPauseAutoplayOnHero(true)}
                        onMouseLeave={() => setPauseAutoplayOnHero(false)}
                      >
                        <button
                          type="button"
                          onClick={() => void openInReadMode(card)}
                          disabled={isOpening}
                          className={cn(
                            "w-full h-full overflow-hidden rounded-2xl border border-stone-300/70 bg-white text-left transition duration-200 dark:border-white/10 dark:bg-[#0f1118]",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60",
                          )}
                        >
                          <div className="relative aspect-video w-full overflow-hidden">
                            <PublicExploreItemPreviewMedia
                              item={card}
                              className="absolute inset-0 h-full w-full"
                              fit="cover"
                              zoomClassName="scale-100 group-hover:scale-[1.08] group-focus-within:scale-[1.08]"
                            />
                            <div className="absolute inset-0 z-1 bg-linear-to-t from-black/68 via-black/28 to-transparent" />
                            <p className="absolute bottom-2 left-2.5 right-2.5 z-2 line-clamp-1 text-sm font-semibold text-white">
                              {card.topic}
                            </p>
                          </div>
                          <div className="space-y-0.5 p-3">
                            <p className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-100">
                              {cardDescription.slice(0, 80) +
                                (cardDescription.length > 80 ? "…" : "")}
                            </p>
                            <p className="line-clamp-1 text-[11px] text-stone-600 dark:text-stone-500">
                              {shortUid(card.ownerUid)} · {card.publicationLevel}
                            </p>
                            <p className="line-clamp-1 text-[11px] text-stone-500">{cardCategory}</p>
                          </div>
                        </button>

                        <div
                          className={cn(
                            "pointer-events-none absolute -inset-x-3 -top-8 z-90 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0d13] shadow-2xl shadow-black/60",
                            "opacity-0 translate-y-3 scale-[0.92] transition duration-220 ease-out",
                            "group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100",
                            "group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => void openInReadMode(card)}
                            disabled={isOpening}
                            className="w-full text-left"
                          >
                            <div className="relative aspect-video w-full">
                              <PublicExploreItemPreviewMedia
                                item={card}
                                className="absolute inset-0 h-full w-full"
                                fit="cover"
                                zoomClassName="scale-[1.02] hover:scale-[1.1]"
                              />
                              <div className="absolute inset-0 z-1 bg-linear-to-t from-black/85 via-black/30 to-black/5" />
                              <p className="absolute bottom-3 left-3 right-3 z-2 line-clamp-2 text-base font-semibold text-white">
                                {card.topic}
                              </p>
                              {isOpening && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                          </button>

                          <div className="space-y-2 p-3.5 text-white">
                            <div className="inline-flex items-center gap-1.5 text-[11px] text-stone-300">
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>{cardDate}</span>
                            </div>
                            <p className="line-clamp-3 text-xs text-stone-200">{cardDescription}</p>
                            <p className="line-clamp-1 text-[11px] text-emerald-300/95">{cardCategory}</p>
                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-[11px] text-stone-300">
                                {shortUid(card.ownerUid)} · {card.publicationLevel}
                              </span>
                              <button
                                type="button"
                                className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-white/20"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  event.preventDefault();
                                  void openDetails(card);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Ver más
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

    </div>
  );
}
