import { useMemo, useState } from "react";
import { Bell, BookOpen, Briefcase, GraduationCap, Palette, Search, Star } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { AvatarMenu } from "../shared/AvatarMenu";
import { cn } from "../../utils/cn";

export interface PublicPresentationsMockProps {
  onOpenConfig?: () => void;
}

type CategoryId = "negocios" | "educacion" | "tecnologia" | "creatividad";

interface CategoryDef {
  id: CategoryId;
  label: string;
  icon: typeof Briefcase;
}

const CATEGORIES: CategoryDef[] = [
  { id: "negocios", label: "Negocios", icon: Briefcase },
  { id: "educacion", label: "Educación", icon: GraduationCap },
  { id: "tecnologia", label: "Tecnología", icon: BookOpen },
  { id: "creatividad", label: "Creatividad", icon: Palette },
];

interface MockTopUser {
  id: string;
  name: string;
  handle: string;
  stars: number;
  rating: number;
  avatar: string;
}

const TOP_USERS_BY_CATEGORY: Record<CategoryId, MockTopUser[]> = {
  negocios: [
    { id: "u1", name: "María V.", handle: "@mvia", stars: 5, rating: 4.9, avatar: "from-fuchsia-500 to-violet-600" },
    { id: "u2", name: "Jonás K.", handle: "@jonas_okr", stars: 5, rating: 4.85, avatar: "from-amber-400 to-orange-600" },
    { id: "u3", name: "Elena Rui", handle: "@elena_pm", stars: 4, rating: 4.7, avatar: "from-sky-400 to-cyan-600" },
    { id: "u4", name: "Team Labs", handle: "@teamlabs", stars: 5, rating: 4.8, avatar: "from-emerald-500 to-teal-700" },
  ],
  educacion: [
    { id: "u5", name: "Profe Díaz", handle: "@profe.diaz", stars: 5, rating: 4.95, avatar: "from-violet-500 to-purple-700" },
    { id: "u6", name: "Aula 42", handle: "@aula42", stars: 4, rating: 4.75, avatar: "from-rose-400 to-rose-700" },
    { id: "u7", name: "Lucía M.", handle: "@lucia.learns", stars: 4, rating: 4.65, avatar: "from-amber-300 to-amber-600" },
  ],
  tecnologia: [
    { id: "u8", name: "devops.paula", handle: "@paula_ops", stars: 5, rating: 4.92, avatar: "from-cyan-500 to-blue-700" },
    { id: "u9", name: "Lin", handle: "@lin_wgpu", stars: 4, rating: 4.88, avatar: "from-emerald-500 to-cyan-600" },
    { id: "u10", name: "CiberPepe", handle: "@ciberpepe", stars: 4, rating: 4.7, avatar: "from-red-500 to-rose-800" },
    { id: "u11", name: "Ana R.", handle: "@ana.r_ci", stars: 4, rating: 4.6, avatar: "from-indigo-500 to-violet-700" },
  ],
  creatividad: [
    { id: "u12", name: "Samuel", handle: "@samuel.slides", stars: 5, rating: 4.9, avatar: "from-amber-500 to-rose-600" },
    { id: "u13", name: "Mika Studio", handle: "@mikastudio", stars: 4, rating: 4.72, avatar: "from-fuchsia-500 to-pink-600" },
    { id: "u14", name: "Nórdico", handle: "@nordico", stars: 4, rating: 4.68, avatar: "from-slate-400 to-slate-700" },
  ],
};

interface MockTopSlide {
  id: string;
  title: string;
  deckTitle: string;
  author: string;
  score: number;
  views: number;
  blurb: string;
}

const TOP_SLIDES_BY_CATEGORY: Record<CategoryId, MockTopSlide[]> = {
  negocios: [
    { id: "s1", title: "Matriz de priorización", deckTitle: "Q4 sin caos", author: "María V.", score: 9.4, views: 4200, blurb: "Cómo ordenar iniciativas cuando todo es urgente: impacto, esfuerzo y acuerdo." },
    { id: "s2", title: "North Star y métricas", deckTitle: "Producto 101", author: "Jonás K.", score: 9.1, views: 8900, blurb: "Diagrama para alinear métricas de negocio y producto en una sola historia." },
    { id: "s3", title: "Stakeholders map", deckTitle: "Comunicar en escala", author: "Elena Rui", score: 8.8, views: 2100, blurb: "Cómo mapear poder e interés para priorizar comunicación de estado." },
  ],
  educacion: [
    { id: "s4", title: "Objetivos de aprendizaje", deckTitle: "Diseñar un módulo", author: "Profe Díaz", score: 9.6, views: 15000, blurb: "Plantilla clara: verbo, evidencia y criterio de logro alineado a Bloom." },
    { id: "s5", title: "Ritmo y pausas", deckTitle: "Clases 60 min", author: "Aula 42", score: 9.0, views: 6200, blurb: "Distribución de bloques para mantener atención sin sobrecargar." },
  ],
  tecnologia: [
    { id: "s6", title: "Pipeline CI en 6 pasos", deckTitle: "Entrega continua", author: "devops.paula", score: 9.5, views: 11200, blurb: "De commit a release con calidad y rollback seguro." },
    { id: "s7", title: "WebGPU vs WebGL", deckTitle: "Gráficos en el navegador", author: "Lin", score: 9.2, views: 7800, blurb: "Comparativa directa de capacidades, límites y casos de uso." },
    { id: "s8", title: "Rate limiting por IP", deckTitle: "APIs en producción", author: "CiberPepe", score: 8.9, views: 5400, blurb: "Estrategia token bucket y controles defensivos mínimos." },
    { id: "s9", title: "Script de build reutilizable", deckTitle: "Python en el CI", author: "Ana R.", score: 8.6, views: 3300, blurb: "Base reusable para versionar, empaquetar y reportar resultados." },
  ],
  creatividad: [
    { id: "s10", title: "Grid y ritmo", deckTitle: "Slides que respiran", author: "Samuel", score: 9.3, views: 18500, blurb: "Alineación y márgenes para una narrativa visual más clara." },
    { id: "s11", title: "Paleta y contraste", deckTitle: "Accesible por defecto", author: "Mika Studio", score: 9.0, views: 9200, blurb: "Cómo elegir paleta legible sin perder identidad visual." },
  ],
};

interface StreamGridCard {
  id: string;
  title: string;
  subtitle: string;
  streamer: string;
}

function buildGridCards(categoryId: CategoryId): StreamGridCard[] {
  const source = TOP_SLIDES_BY_CATEGORY[categoryId];
  const cards: StreamGridCard[] = [];
  for (let i = 0; i < 8; i += 1) {
    const base = source[i % source.length]!;
    cards.push({
      id: `${base.id}-${i}`,
      title: base.title,
      subtitle: base.deckTitle,
      streamer: base.author,
    });
  }
  return cards;
}

export function PublicPresentationsMock({ onOpenConfig }: PublicPresentationsMockProps) {
  const { user } = useAuth();
  const greetingTitle = useMemo(() => {
    const d = user?.displayName?.trim();
    if (!d) return "Hola de nuevo";
    return `Hola, ${d.split(/\s+/)[0] ?? d}`;
  }, [user?.displayName]);

  const [categoryId, setCategoryId] = useState<CategoryId>(CATEGORIES[0]!.id);
  const topUsers = TOP_USERS_BY_CATEGORY[categoryId];
  const topSlides = TOP_SLIDES_BY_CATEGORY[categoryId];
  const [selectedSlideId, setSelectedSlideId] = useState(() => topSlides[0]?.id ?? "");
  const selectedSlide = topSlides.find((s) => s.id === selectedSlideId) ?? topSlides[0] ?? null;
  const category = CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0];
  const gridCards = useMemo(() => buildGridCards(categoryId), [categoryId]);

  const onPickCategory = (id: CategoryId) => {
    setCategoryId(id);
    const next = TOP_SLIDES_BY_CATEGORY[id];
    setSelectedSlideId(next[0]?.id ?? "");
  };

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
            aria-label="Búsqueda (no disponible aún)"
            disabled
          >
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300/80 bg-white text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 dark:border-white/10 dark:bg-white/3 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-200"
            aria-label="Notificaciones (no disponible aún)"
            disabled
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <AvatarMenu onOpenConfig={onOpenConfig} variant="home" />
        </div>
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-5">
          <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <button
              type="button"
              onClick={() => setSelectedSlideId(selectedSlide?.id ?? "")}
              className="group relative min-h-[460px] overflow-hidden rounded-3xl border border-stone-300/70 bg-linear-to-br from-stone-300 to-stone-200 text-left dark:border-white/10 dark:from-[#1b1f2a] dark:to-[#11131a]"
            >
              <img
                src="/home-banner-architecture.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                aria-hidden
              />
              <div className="absolute inset-0 bg-linear-to-r from-black/70 via-black/35 to-black/15" />
              <div className="relative flex h-full max-w-xl flex-col justify-end p-5 sm:p-7">
                <p className="text-[11px] uppercase tracking-[0.22em] text-stone-200">{category.label}</p>
                <h2 className="mt-2 line-clamp-2 text-2xl font-semibold leading-tight text-white sm:text-4xl">
                  {selectedSlide?.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-stone-200/90 sm:text-base">{selectedSlide?.blurb}</p>
              </div>
            </button>

            <aside className="rounded-3xl border border-stone-300/70 bg-white p-3 dark:border-white/10 dark:bg-[#0f1118] sm:p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-600 dark:text-stone-500">
                Tendencias
              </p>
              <div className="mt-3 space-y-2.5">
                {topSlides.slice(0, 5).map((slide) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => setSelectedSlideId(slide.id)}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition",
                      slide.id === selectedSlideId
                        ? "bg-stone-200 dark:bg-white/10"
                        : "hover:bg-stone-100 dark:hover:bg-white/5",
                    )}
                  >
                    <div className="h-12 w-20 shrink-0 rounded-lg bg-linear-to-br from-stone-300 to-stone-200 dark:from-stone-700 dark:to-stone-800" />
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-100">{slide.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-600 dark:text-stone-500">{slide.author}</p>
                    </div>
                  </button>
                ))}
              </div>
            </aside>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-100 sm:text-lg">
                Usuarios destacados en {category.label}
              </h3>
            </div>
            <ul className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topUsers.map((u, idx) => (
                <li
                  key={u.id}
                  className="flex min-w-[230px] shrink-0 items-center gap-3 rounded-xl border border-stone-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/3"
                >
                  <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {idx + 1}
                  </span>
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-[11px] font-bold text-white",
                      u.avatar,
                    )}
                  >
                    {u.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-stone-900 dark:text-stone-100">{u.name}</p>
                    <p className="truncate text-[10px] text-stone-600 dark:text-stone-500">{u.handle}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={`${u.id}-${i}`}
                        className={cn(
                          "h-3 w-3",
                          i < u.stars ? "fill-amber-400 text-amber-400" : "text-stone-400 dark:text-stone-600",
                        )}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-3 flex flex-col items-start gap-3">
              <h3 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-100 sm:text-lg">
                Top streams
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
              {gridCards.map((card) => (
                <article
                  key={card.id}
                  className="overflow-hidden rounded-2xl border border-stone-300/70 bg-white dark:border-white/10 dark:bg-[#0f1118]"
                >
                  <div className="relative h-32 bg-linear-to-br from-stone-300 to-stone-200 dark:from-stone-700 dark:to-stone-800">
                    <div className="absolute inset-0 bg-linear-to-t from-black/65 via-black/25 to-transparent" />
                    <p className="absolute bottom-2 left-2.5 right-2.5 line-clamp-1 text-sm font-semibold text-white">
                      {card.title}
                    </p>
                  </div>
                  <div className="space-y-0.5 p-3">
                    <p className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-100">{card.subtitle}</p>
                    <p className="line-clamp-1 text-[11px] text-stone-600 dark:text-stone-500">{card.streamer}</p>
                    <p className="text-[11px] text-stone-500">{category.label}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
