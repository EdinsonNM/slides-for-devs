import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bot,
  Box,
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  CreditCard,
  Flame,
  Globe2,
  KeyRound,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
  getGroqApiKey,
  getCerebrasApiKey,
  getOpenRouterApiKey,
  getMeshyApiKey,
  setGeminiApiKey,
  setOpenAIApiKey,
  setXaiApiKey,
  setGroqApiKey,
  setCerebrasApiKey,
  setOpenRouterApiKey,
  setMeshyApiKey,
} from "../../services/apiConfig";
import { usePresentation } from "../../context/PresentationContext";
import { ModelSelect } from "../shared/ModelSelect";
import { cn } from "../../utils/cn";
import { OPENAI_IMAGE_MODEL_DISPLAY } from "../../constants/openaiImageModels";
import {
  MESHY_AI_MODEL_OPTIONS,
  readStoredMeshyAiModelId,
  writeStoredMeshyAiModelId,
} from "../../constants/meshyModels";

const REQUIRED_HEADLINE =
  "Es necesario que configures un servicio de IA para empezar a usar Slaim.";

const GENERATE_HINT =
  "Para generar tu presentación necesitas al menos una clave de API de uno de los proveedores que aparecen abajo.";

/** Precios de referencia en soles (PEN). La contratación en app es futura. */
const SLAI_PRICE_DAY = 3.99;
const SLAI_PRICE_WEEK_ONE_TIME = 10;
const SLAI_PRICE_MONTH_RECURRING = 30;
const SLAI_PRICE_YEAR = 260;

const SLAI_YEAR_VS_12_MONTHS = 12 * SLAI_PRICE_MONTH_RECURRING;
const SLAI_YEAR_SAVINGS_SOLES = SLAI_YEAR_VS_12_MONTHS - SLAI_PRICE_YEAR;
const SLAI_YEAR_SAVINGS_PERCENT = Math.round(
  (SLAI_YEAR_SAVINGS_SOLES / SLAI_YEAR_VS_12_MONTHS) * 100,
);

function roundMoney2(value: number): number {
  return Math.round(value * 100) / 100;
}

const SLAI_YEAR_EFFECTIVE_MONTHLY = roundMoney2(SLAI_PRICE_YEAR / 12);

/** Muestra cantidades monetarias con siempre 2 decimales (es-PE). */
function formatAmount2(value: number): string {
  return value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type PlanMode = "free" | "subscription";

type SlaimBillingTier = "day" | "week" | "month" | "year";

type ProviderId =
  | "gemini"
  | "openai"
  | "xai"
  | "groq"
  | "cerebras"
  | "openrouter";

const PROVIDER_ORDER: ProviderId[] = [
  "gemini",
  "openai",
  "xai",
  "groq",
  "cerebras",
  "openrouter",
];

const PROVIDER_META: Record<
  ProviderId,
  {
    title: string;
    subtitle: string;
    Icon: LucideIcon;
    placeholder: string;
    docHref: string;
    docLabel: string;
    hintLine: string;
  }
> = {
  gemini: {
    title: "Google Gemini",
    subtitle: "Texto e imágenes (misma clave)",
    Icon: Sparkles,
    placeholder: "Ej: AIza...",
    docHref: "https://aistudio.google.com/apikey",
    docLabel: "Google AI Studio",
    hintLine: "Texto, imágenes y operaciones que usan el modelo Gemini.",
  },
  openai: {
    title: "OpenAI",
    subtitle: "Texto e imágenes GPT (misma clave)",
    Icon: Bot,
    placeholder: "Ej: sk-...",
    docHref: "https://platform.openai.com/api-keys",
    docLabel: "Claves en OpenAI",
    hintLine: "Texto con GPT e imágenes con la API de imágenes de OpenAI.",
  },
  xai: {
    title: "xAI (Grok)",
    subtitle: "Modelos Grok",
    Icon: Zap,
    placeholder: "Ej: xai-...",
    docHref: "https://console.x.ai/team/default/api-keys",
    docLabel: "xAI Console",
    hintLine: "Presentaciones con Grok.",
  },
  groq: {
    title: "Groq",
    subtitle: "Inferencia muy rápida",
    Icon: Flame,
    placeholder: "Ej: gsk_...",
    docHref: "https://console.groq.com/keys",
    docLabel: "Consola Groq",
    hintLine: "Modelos vía API Groq.",
  },
  cerebras: {
    title: "Cerebras",
    subtitle: "Cloud Cerebras",
    Icon: Cpu,
    placeholder: "Clave de API",
    docHref: "https://cloud.cerebras.ai/",
    docLabel: "Cerebras Cloud",
    hintLine: "Acceso a modelos Cerebras.",
  },
  openrouter: {
    title: "OpenRouter",
    subtitle: "Muchos modelos, una clave",
    Icon: Globe2,
    placeholder: "Ej: sk-or-...",
    docHref: "https://openrouter.ai/keys",
    docLabel: "OpenRouter",
    hintLine: "Unifica acceso a varios proveedores.",
  },
};

function ProviderCredentialCard({
  id,
  expanded,
  onToggle,
  value,
  onChange,
}: {
  id: ProviderId;
  expanded: boolean;
  onToggle: () => void;
  value: string;
  onChange: (v: string) => void;
}) {
  const meta = PROVIDER_META[id];
  const Icon = meta.Icon;
  const filled = value.trim().length > 0;
  const inputId = `provider-key-${id}`;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white/90 dark:bg-stone-900/40 transition-shadow",
        expanded
          ? "border-teal-400/70 dark:border-teal-600/50 shadow-md shadow-teal-900/10"
          : "border-stone-200/90 dark:border-border hover:border-teal-300/50 dark:hover:border-teal-800/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`${inputId}-panel`}
        id={`${inputId}-header`}
        className="flex w-full items-center gap-3 p-3 sm:p-3.5 text-left"
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            filled
              ? "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200"
              : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
          )}
        >
          <Icon size={22} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-stone-900 dark:text-foreground">
              {meta.title}
            </span>
            {filled && (
              <Check
                size={16}
                className="shrink-0 text-teal-600 dark:text-teal-400"
                aria-label="Clave configurada"
              />
            )}
          </span>
          <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            {meta.subtitle}
          </span>
        </span>
        <ChevronDown
          size={20}
          className={cn(
            "shrink-0 text-stone-400 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          id={`${inputId}-panel`}
          role="region"
          aria-labelledby={`${inputId}-header`}
          className="border-t border-stone-200/80 dark:border-border px-3 pb-3 sm:px-3.5 sm:pb-3.5 pt-3"
        >
          <label htmlFor={inputId} className="sr-only">
            API key {meta.title}
          </label>
          <div className="relative">
            <input
              id={inputId}
              type="password"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={meta.placeholder}
              autoComplete="off"
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border text-sm",
                "bg-white dark:bg-surface text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500",
                "focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:border-teal-500",
                "border-stone-200 dark:border-border",
              )}
            />
            {filled && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600 dark:text-teal-400">
                <Check size={16} aria-hidden />
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
            {meta.hintLine}{" "}
            <a
              href={meta.docHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-700 dark:text-teal-400 font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {meta.docLabel}
            </a>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}

export interface ApiConfigurationScreenProps {
  /** Tras guardar claves válidas. */
  onSaved: () => void;
}

export function ApiConfigurationScreen({ onSaved }: ApiConfigurationScreenProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "settings" ? "settings" : "onboarding";
  const reasonGenerate = searchParams.get("reason") === "generate";

  const {
    setPresentationModelId,
    geminiImageModelId,
    setGeminiImageModelId,
    geminiImageModels,
    imageProvider,
    setImageProvider,
    cloudSyncAvailable,
    autoCloudSyncOnSave,
    setAutoCloudSyncOnSave,
  } = usePresentation();

  const [planMode, setPlanMode] = useState<PlanMode>("free");
  const [slaimBillingTier, setSlaimBillingTier] =
    useState<SlaimBillingTier>("year");
  const [openProviders, setOpenProviders] = useState<Set<ProviderId>>(() => new Set());

  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [cerebrasKey, setCerebrasKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [meshyKey, setMeshyKey] = useState("");
  const [meshyAiModelId, setMeshyAiModelId] = useState(readStoredMeshyAiModelId);
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setGeminiKey(getGeminiApiKey() ?? "");
    setOpenaiKey(getOpenAIApiKey() ?? "");
    setXaiKey(getXaiApiKey() ?? "");
    setGroqKey(getGroqApiKey() ?? "");
    setCerebrasKey(getCerebrasApiKey() ?? "");
    setOpenrouterKey(getOpenRouterApiKey() ?? "");
    setMeshyKey(getMeshyApiKey() ?? "");
    setMeshyAiModelId(readStoredMeshyAiModelId());
    setTouched(false);
  }, []);

  const valueById: Record<ProviderId, string> = {
    gemini: geminiKey,
    openai: openaiKey,
    xai: xaiKey,
    groq: groqKey,
    cerebras: cerebrasKey,
    openrouter: openrouterKey,
  };

  const setValueById = (id: ProviderId, v: string) => {
    switch (id) {
      case "gemini":
        setGeminiKey(v);
        break;
      case "openai":
        setOpenaiKey(v);
        break;
      case "xai":
        setXaiKey(v);
        break;
      case "groq":
        setGroqKey(v);
        break;
      case "cerebras":
        setCerebrasKey(v);
        break;
      case "openrouter":
        setOpenrouterKey(v);
        break;
    }
  };

  const hasGemini = geminiKey.trim().length > 0;
  const hasOpenAI = openaiKey.trim().length > 0;
  const hasXai = xaiKey.trim().length > 0;
  const hasGroq = groqKey.trim().length > 0;
  const hasCerebras = cerebrasKey.trim().length > 0;
  const hasOpenRouter = openrouterKey.trim().length > 0;
  const canSaveFree =
    hasGemini || hasOpenAI || hasXai || hasGroq || hasCerebras || hasOpenRouter;

  /** En plan Gratis, priorizar Gemini y OpenAI (texto + imágenes con la misma clave). */
  const providerOrderForUi = useMemo(
    () =>
      planMode === "free"
        ? ([
            "gemini",
            "openai",
            ...PROVIDER_ORDER.filter((id) => id !== "gemini" && id !== "openai"),
          ] as ProviderId[])
        : PROVIDER_ORDER,
    [planMode],
  );

  const geminiImageModelSelectOptions = useMemo(
    () =>
      geminiImageModels.map((m) => ({
        id: m.id,
        label: m.label,
        provider: "gemini" as const,
      })),
    [geminiImageModels],
  );

  /** Evita un frame sin UI si `imageProvider` en contexto aún no coincide con las claves del formulario. */
  const effectiveImageProvider = useMemo<"gemini" | "openai">(() => {
    if (!hasGemini && hasOpenAI) return "openai";
    if (hasGemini && !hasOpenAI) return "gemini";
    return imageProvider;
  }, [hasGemini, hasOpenAI, imageProvider]);

  const toggleProvider = (id: ProviderId) => {
    setOpenProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageTitle = useMemo(() => {
    if (mode === "settings") return "Configuración de IA";
    return "Bienvenido a Slaim";
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (planMode !== "free") return;
    if (!canSaveFree) return;

    const g = geminiKey.trim().length > 0;
    const o = openaiKey.trim().length > 0;
    if (g) setPresentationModelId("gemini-2.5-flash");
    else if (o) setPresentationModelId("gpt-5-mini");
    if (g && !o) setImageProvider("gemini");
    else if (o && !g) setImageProvider("openai");

    setIsSaving(true);
    try {
      await setGeminiApiKey(geminiKey);
      await setOpenAIApiKey(openaiKey);
      await setXaiApiKey(xaiKey);
      await setGroqApiKey(groqKey);
      await setCerebrasApiKey(cerebrasKey);
      await setOpenRouterApiKey(openrouterKey);
      await setMeshyApiKey(meshyKey);
      onSaved();
      if (mode === "settings") {
        navigate(-1);
      } else {
        navigate("/", { replace: true });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (mode === "settings") {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-dvh font-sans text-stone-900 dark:text-foreground bg-linear-to-b from-teal-50/90 via-white to-stone-50 dark:from-teal-950/40 dark:via-surface dark:to-surface">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-teal-400/20 dark:bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-emerald-300/15 dark:bg-emerald-600/10 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24">
        <div className="flex items-center gap-3 mb-8">
          {mode === "settings" ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
            >
              <ArrowLeft size={18} aria-hidden />
              Volver
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-surface-elevated/80 px-3 py-1 text-xs font-medium text-teal-800 dark:text-teal-200 border border-teal-200/60 dark:border-teal-800/50 shadow-sm">
              <KeyRound size={14} className="shrink-0" aria-hidden />
              Configuración inicial
            </span>
          )}
        </div>

        <header className="mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 dark:text-foreground">
            {pageTitle}
          </h1>
          {mode === "onboarding" && (
            <div className="mt-6 space-y-4">
              <p className="text-lg sm:text-xl text-stone-700 dark:text-stone-200 leading-relaxed max-w-3xl">
                {REQUIRED_HEADLINE}
              </p>
              {reasonGenerate && (
                <p
                  role="status"
                  className="text-base text-teal-900 dark:text-teal-100/90 max-w-3xl rounded-xl border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/90 dark:bg-teal-950/40 px-4 py-3"
                >
                  {GENERATE_HINT}
                </p>
              )}
            </div>
          )}
          {mode === "settings" && (
            <p className="mt-3 text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              Actualiza tus claves de API, el modelo de imágenes (Gemini/OpenAI)
              y la sincronización con la nube.
            </p>
          )}
        </header>

        <section aria-labelledby="planes-heading" className="mb-8 sm:mb-10">
          <h2
            id="planes-heading"
            className="text-sm font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300 mb-4"
          >
            Elige cómo quieres usar la IA
          </h2>
          <div
            className="grid gap-4 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Modo de uso de la IA"
          >
            <button
              type="button"
              role="radio"
              aria-checked={planMode === "free"}
              onClick={() => setPlanMode("free")}
              className={cn(
                "relative text-left rounded-2xl border-2 p-5 sm:p-6 transition-all flex flex-col gap-3",
                planMode === "free"
                  ? "border-teal-500 bg-white/95 dark:bg-surface-elevated/95 shadow-lg shadow-teal-900/10 ring-2 ring-teal-500/20"
                  : "border-stone-200/90 dark:border-border bg-white/60 dark:bg-surface-elevated/50 hover:border-teal-300/60",
              )}
            >
              {planMode === "free" && (
                <span className="absolute top-4 right-4 text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-full">
                  Seleccionado
                </span>
              )}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 shrink-0">
                <Sparkles size={22} aria-hidden />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-stone-900 dark:text-foreground">
                  Gratis
                </h3>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-snug">
                  Conecta{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    tus cuentas
                  </strong>{" "}
                  (Google, OpenAI…).{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    Slaim no te cobra
                  </strong>
                  : solo pagas lo que consumas en cada proveedor, a tu ritmo.
                </p>
              </div>
              <div className="rounded-xl bg-teal-50/80 dark:bg-teal-950/35 border border-teal-200/60 dark:border-teal-900/50 px-3 py-3">
                <p className="text-xs font-semibold text-teal-900 dark:text-teal-200 mb-2">
                  Misma magia de IA que en suscripción — con tu presupuesto
                </p>
                <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Diagramas que se dibujan solos con IA
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Imágenes para slides, creadas con IA
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Vídeo de toda tu presentación, con IA
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Lienzo 3D: archivo .glb o URL (sin API de generación 3D)
                  </li>
                </ul>
              </div>
              <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
                <li className="flex gap-2">
                  <Check
                    size={16}
                    className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  De una idea a una presentación lista: la IA hace el trabajo pesado
                </li>
                <li className="flex gap-2">
                  <Check
                    size={16}
                    className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  Slides con texto y código que se leen bien, sin pelearte con el formato
                </li>
                <li className="flex gap-2">
                  <Check
                    size={16}
                    className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  Modo presentador + guion sugerido por IA para sonar convincente
                </li>
                <li className="flex gap-2">
                  <Check
                    size={16}
                    className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                    aria-hidden
                  />
                  Llévalo a PowerPoint, a vídeo o a la nube cuando quieras compartir
                </li>
              </ul>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={planMode === "subscription"}
              onClick={() => setPlanMode("subscription")}
              className={cn(
                "relative text-left rounded-2xl border-2 p-5 sm:p-6 transition-all flex flex-col gap-3",
                planMode === "subscription"
                  ? "border-teal-500 bg-white/95 dark:bg-surface-elevated/95 shadow-lg shadow-teal-900/10 ring-2 ring-teal-500/20"
                  : "border-stone-200/90 dark:border-border bg-white/60 dark:bg-surface-elevated/50 hover:border-teal-300/60",
              )}
            >
              {planMode === "subscription" && (
                <span className="absolute top-4 right-4 text-[11px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 rounded-full">
                  Seleccionado
                </span>
              )}
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                  <CreditCard size={22} aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-stone-900 dark:text-foreground">
                      Suscripción Slaim
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200">
                      Próximamente
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-snug">
                <strong className="text-stone-800 dark:text-stone-200">
                  Todo el uso de IA va dentro del precio.
                </strong>{" "}
                Tú eliges el plan; nosotros conectamos los modelos. Sin copiar
                llaves ni leer facturas de terceros.
              </p>
              <div className="rounded-xl bg-stone-100/90 dark:bg-stone-900/50 border border-stone-200/80 dark:border-border px-3 py-3">
                <p className="text-xs font-semibold text-stone-800 dark:text-stone-200 mb-2">
                  Incluye lo mismo que Gratis — sin tocar APIs
                </p>
                <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Diagramas, imágenes, vídeo y 3D con IA, con tu cupo Slaim
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Un solo recibo: el consumo va a tu plan Slaim, no a tu cuenta de Google
                  </li>
                </ul>
              </div>
              <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
                <li className="flex gap-2">
                  <Check
                    size={16}
                    className="shrink-0 mt-0.5 text-stone-500 dark:text-stone-400"
                    aria-hidden
                  />
                  Misma app, mismos resultados: tú eliges cómo pagar el “combustible” de IA
                </li>
                <li className="flex gap-2">
                  <Check
                    size={16}
                    className="shrink-0 mt-0.5 text-stone-500 dark:text-stone-400"
                    aria-hidden
                  />
                  Pago único (día o semana) o suscripción recurrente (mes o año) en soles
                </li>
              </ul>
            </button>
          </div>
        </section>

        {planMode === "subscription" ? (
          <section
            aria-labelledby="sub-detail-heading"
            className="rounded-2xl border border-stone-200/80 dark:border-border bg-white/90 dark:bg-surface-elevated/90 shadow-sm p-5 sm:p-8 mb-8"
          >
            <h2
              id="sub-detail-heading"
              className="text-lg font-semibold text-stone-900 dark:text-foreground mb-2"
            >
              Planes Slaim (soles · referencia)
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 max-w-2xl">
              La compra en la app llegará pronto. Hoy puedes empezar en{" "}
              <strong className="text-stone-800 dark:text-stone-200">Gratis</strong>{" "}
              con tus propias cuentas de IA.
            </p>
            <ul className="space-y-2.5 text-sm text-stone-700 dark:text-stone-300 mb-6">
              <li className="flex gap-2">
                <Check
                  size={16}
                  className="shrink-0 mt-0.5 text-stone-500 dark:text-stone-400"
                  aria-hidden
                />
                Mismas funciones creativas que en Gratis; aquí pagas un pack y
                listo
              </li>
              <li className="flex gap-2">
                <Check
                  size={16}
                  className="shrink-0 mt-0.5 text-stone-500 dark:text-stone-400"
                  aria-hidden
                />
                Ideal si quieres una factura clara y cero papeleo con APIs
              </li>
            </ul>
            <p className="text-xs font-medium text-stone-600 dark:text-stone-400 mb-3">
              Elige un plan (solo referencia; aún no se cobra en la app):
            </p>
            <div
              className="max-w-4xl space-y-5"
              role="radiogroup"
              aria-label="Periodicidad del plan Slaim"
            >
              <div
                className="rounded-2xl border-2 border-dashed border-amber-300/70 dark:border-amber-700/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 sm:p-5"
                aria-labelledby="slaim-one-time-heading"
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3
                    id="slaim-one-time-heading"
                    className="text-xs font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200"
                  >
                    Pago único
                  </h3>
                  <span className="text-[11px] text-amber-900/80 dark:text-amber-200/80">
                    Un solo cobro. No se renueva solo al terminar el periodo.
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={slaimBillingTier === "day"}
                    onClick={() => setSlaimBillingTier("day")}
                    className={cn(
                      "relative rounded-xl border-2 px-3 py-3 text-left transition-all bg-white/90 dark:bg-stone-950/40",
                      slaimBillingTier === "day"
                        ? "border-amber-500 bg-amber-50/90 dark:bg-amber-950/35 ring-1 ring-amber-500/30"
                        : "border-amber-200/80 dark:border-amber-800/40 hover:border-amber-400/70",
                    )}
                  >
                    <span className="inline-block rounded-md bg-amber-100/90 dark:bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100 mb-1.5">
                      Pago único
                    </span>
                    <span className="block text-sm font-medium text-stone-800 dark:text-stone-200">
                      1 día
                    </span>
                    <span className="mt-1 block text-lg font-semibold text-amber-950 dark:text-amber-200 tabular-nums">
                      S/ {formatAmount2(SLAI_PRICE_DAY)}
                    </span>
                    <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
                      Acceso por 24 horas
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={slaimBillingTier === "week"}
                    onClick={() => setSlaimBillingTier("week")}
                    className={cn(
                      "relative rounded-xl border-2 px-3 py-3 text-left transition-all bg-white/90 dark:bg-stone-950/40",
                      slaimBillingTier === "week"
                        ? "border-amber-500 bg-amber-50/90 dark:bg-amber-950/35 ring-1 ring-amber-500/30"
                        : "border-amber-200/80 dark:border-amber-800/40 hover:border-amber-400/70",
                    )}
                  >
                    <span className="inline-block rounded-md bg-amber-100/90 dark:bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100 mb-1.5">
                      Pago único
                    </span>
                    <span className="block text-sm font-medium text-stone-800 dark:text-stone-200">
                      1 semana
                    </span>
                    <span className="mt-1 block text-lg font-semibold text-amber-950 dark:text-amber-200 tabular-nums">
                      S/ {formatAmount2(SLAI_PRICE_WEEK_ONE_TIME)}
                    </span>
                    <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
                      Acceso por 7 días
                    </p>
                  </button>
                </div>
              </div>

              <div
                className="rounded-2xl border-2 border-teal-400/45 dark:border-teal-600/40 bg-teal-50/35 dark:bg-teal-950/25 p-4 sm:p-5"
                aria-labelledby="slaim-recurring-heading"
              >
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3
                    id="slaim-recurring-heading"
                    className="text-xs font-bold uppercase tracking-wide text-teal-900 dark:text-teal-200"
                  >
                    Suscripción recurrente
                  </h3>
                  <span className="text-[11px] text-teal-900/85 dark:text-teal-200/80">
                    Cobro automático cada periodo hasta que canceles.
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={slaimBillingTier === "month"}
                    onClick={() => setSlaimBillingTier("month")}
                    className={cn(
                      "relative rounded-xl border-2 px-3 py-3 text-left transition-all bg-white/90 dark:bg-stone-950/40",
                      slaimBillingTier === "month"
                        ? "border-teal-500 bg-teal-50/80 dark:bg-teal-950/40 ring-1 ring-teal-500/25"
                        : "border-teal-200/70 dark:border-teal-800/45 hover:border-teal-400/70",
                    )}
                  >
                    <span className="inline-block rounded-md bg-teal-100/90 dark:bg-teal-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100 mb-1.5">
                      Recurrente
                    </span>
                    <span className="block text-sm font-medium text-stone-800 dark:text-stone-200">
                      Mensual
                    </span>
                    <span className="mt-1 block text-lg font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                      S/ {formatAmount2(SLAI_PRICE_MONTH_RECURRING)}
                    </span>
                    <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
                      / mes · se renueva cada mes
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={slaimBillingTier === "year"}
                    onClick={() => setSlaimBillingTier("year")}
                    className={cn(
                      "relative rounded-xl border-2 px-3 py-3 text-left transition-all bg-white/90 dark:bg-stone-950/40",
                      slaimBillingTier === "year"
                        ? "border-teal-500 bg-teal-50/80 dark:bg-teal-950/40 ring-1 ring-teal-500/25"
                        : "border-teal-200/70 dark:border-teal-800/45 hover:border-teal-400/70",
                    )}
                  >
                    <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wide rounded-full bg-emerald-600 text-white px-2 py-0.5 shadow-sm">
                      Mejor oferta
                    </span>
                    <span className="inline-block rounded-md bg-teal-100/90 dark:bg-teal-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-100 mb-1.5">
                      Recurrente
                    </span>
                    <span className="block text-sm font-medium text-stone-800 dark:text-stone-200 pr-16">
                      Anual
                    </span>
                    <span className="mt-1 block text-lg font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                      S/ {formatAmount2(SLAI_PRICE_YEAR)}
                    </span>
                    <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-400 leading-snug">
                      / año · un cobro al año, se renueva
                    </p>
                    <p className="mt-1.5 text-[11px] text-emerald-800 dark:text-emerald-300/95 font-medium leading-snug">
                      Ahorras S/ {formatAmount2(SLAI_YEAR_SAVINGS_SOLES)} frente a
                      12 × S/ {formatAmount2(SLAI_PRICE_MONTH_RECURRING)} (≈{" "}
                      {SLAI_YEAR_SAVINGS_PERCENT}% menos).
                    </p>
                    <p className="mt-0.5 text-[10px] text-stone-500 dark:text-stone-500 tabular-nums">
                      Equivale a ~S/ {formatAmount2(SLAI_YEAR_EFFECTIVE_MONTHLY)}{" "}
                      al mes.
                    </p>
                  </button>
                </div>
              </div>
            </div>
            <p className="mt-6 text-sm text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/35 px-3 py-2.5">
              Para continuar hoy, pulsa arriba en <strong>Gratis</strong> y abre
              el proveedor que quieras usar para pegar tu clave.
            </p>
          </section>
        ) : null}

        {planMode === "free" ? (
          <section
            aria-labelledby="claves-heading"
            className="rounded-2xl border border-stone-200/80 dark:border-border bg-white/90 dark:bg-surface-elevated/90 shadow-sm p-5 sm:p-8"
          >
            <div className="flex items-start gap-3 mb-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                <KeyRound size={20} aria-hidden />
              </div>
              <div>
                <h2
                  id="claves-heading"
                  className="text-lg font-semibold text-stone-900 dark:text-foreground"
                >
                  Conecta tus proveedores
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed max-w-2xl">
                  Pulsa un proveedor para desplegar su campo de clave. Solo
                  necesitas uno como mínimo; puedes combinar varios. Las
                  imágenes con IA usan la misma clave de{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    Google Gemini
                  </strong>{" "}
                  u{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    OpenAI
                  </strong>
                  . Tus claves se guardan en el dispositivo (llavero del sistema
                  en escritorio; almacenamiento local en el navegador) y no las
                  enviamos a los servidores de Slaim.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {providerOrderForUi.map((id) => (
                  <ProviderCredentialCard
                    key={id}
                    id={id}
                    expanded={openProviders.has(id)}
                    onToggle={() => toggleProvider(id)}
                    value={valueById[id]}
                    onChange={(v) => setValueById(id, v)}
                  />
                ))}
              </div>

              <div className="border-t border-stone-200 dark:border-border pt-6 space-y-5 max-w-2xl">
                <div className="rounded-xl border border-stone-200/90 dark:border-border bg-stone-50/80 dark:bg-stone-900/30 px-3 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400 mb-1.5">
                    Texto (presentación, reescribir, código, notas, chat)
                  </h3>
                  <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
                    Con clave de{" "}
                    <strong className="text-stone-900 dark:text-stone-100">
                      Gemini
                    </strong>{" "}
                    usamos <strong>Gemini 2.5 Flash</strong> por defecto. Con
                    clave de{" "}
                    <strong className="text-stone-900 dark:text-stone-100">
                      OpenAI
                    </strong>{" "}
                    (sin Gemini) usamos <strong>GPT‑5 mini</strong>. Si solo
                    usas otros proveedores (xAI, Groq…), aquí no cambia el modelo
                    de texto: elige el modelo en el generador de la pantalla de
                    inicio.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-stone-800 dark:text-foreground mb-1">
                    Modelo para generación de imágenes
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-3 leading-relaxed">
                    Misma API que para texto en Gemini y OpenAI. Aquí eliges el
                    proveedor (si tienes ambas claves) y, para Gemini, el modelo
                    de imagen.
                  </p>
                  {!hasGemini && !hasOpenAI ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/35 px-3 py-2.5">
                      Añade una clave de{" "}
                      <strong>Google Gemini</strong> u{" "}
                      <strong>OpenAI</strong> para poder generar imágenes con IA
                      y elegir el modelo.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {hasGemini && hasOpenAI ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setImageProvider("gemini")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              effectiveImageProvider === "gemini"
                                ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                                : "bg-white dark:bg-surface border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:border-teal-400/70",
                            )}
                          >
                            Imágenes con Gemini
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageProvider("openai")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              effectiveImageProvider === "openai"
                                ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                                : "bg-white dark:bg-surface border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:border-teal-400/70",
                            )}
                          >
                            Imágenes con OpenAI
                          </button>
                        </div>
                      ) : null}
                      {effectiveImageProvider === "gemini" && hasGemini ? (
                        <div className="w-full [&_button]:max-w-none">
                          <ModelSelect
                            value={geminiImageModelId}
                            options={geminiImageModelSelectOptions}
                            onChange={setGeminiImageModelId}
                            size="sm"
                            title="Modelo de imagen Gemini (Nano Banana)"
                            aria-label="Modelo de imagen Gemini"
                            className="w-full"
                          />
                        </div>
                      ) : null}
                      {effectiveImageProvider === "openai" && hasOpenAI ? (
                        <p className="text-sm text-stone-700 dark:text-stone-300 rounded-lg border border-stone-200 dark:border-border bg-white/80 dark:bg-surface-elevated/80 px-3 py-2.5">
                          <span className="font-medium text-stone-900 dark:text-foreground">
                            Modelo fijo:{" "}
                          </span>
                          {OPENAI_IMAGE_MODEL_DISPLAY}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-stone-200/90 dark:border-border bg-white/60 dark:bg-surface-elevated/50 px-3 py-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                      <Box size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400 mb-1">
                        Modelos 3D en el lienzo (Meshy)
                      </h3>
                      <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                        En <strong>Canvas 3D</strong> puedes subir un{" "}
                        <code className="text-xs">.glb</code>, pegar una URL o
                        generar con IA vía{" "}
                        <a
                          href="https://www.meshy.ai/api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-violet-700 underline hover:no-underline dark:text-violet-300"
                        >
                          Meshy
                        </a>{" "}
                        (texto o imagen → modelo). La llamada a la API se hace
                        desde la app de escritorio; requiere plan con acceso API
                        y créditos en Meshy.
                      </p>
                    </div>
                  </div>
                  <label className="flex flex-col gap-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      API key de Meshy
                    </span>
                    <input
                      type="password"
                      value={meshyKey}
                      onChange={(e) => setMeshyKey(e.target.value)}
                      placeholder="Ej: msy_…"
                      autoComplete="off"
                      className="w-full px-3 py-2.5 rounded-lg border text-sm bg-white dark:bg-surface text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:border-teal-500 border-stone-200 dark:border-border"
                    />
                  </label>
                  <div className="w-full max-w-md [&_button]:max-w-none">
                    <p className="text-xs text-stone-500 dark:text-stone-400 mb-1.5">
                      Modelo de generación (texto / imagen → 3D)
                    </p>
                    <ModelSelect
                      value={meshyAiModelId}
                      options={MESHY_AI_MODEL_OPTIONS.map((m) => ({
                        id: m.id,
                        label: m.label,
                      }))}
                      onChange={(id) => {
                        setMeshyAiModelId(id);
                        writeStoredMeshyAiModelId(id);
                      }}
                      size="sm"
                      title="Modelo Meshy"
                      aria-label="Modelo Meshy"
                      className="w-full"
                    />
                  </div>
                </div>
                {cloudSyncAvailable && (
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-stone-200 dark:border-border p-3 hover:bg-stone-50 dark:hover:bg-stone-800/40">
                    <input
                      type="checkbox"
                      checked={autoCloudSyncOnSave}
                      onChange={(e) => setAutoCloudSyncOnSave(e.target.checked)}
                      className="rounded border-stone-300 dark:border-stone-600 shrink-0 mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-foreground">
                        <Cloud
                          size={16}
                          className="shrink-0 opacity-80"
                          aria-hidden
                        />
                        Auto-sync con la nube al guardar
                      </span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        Tras cada guardado se sube la presentación (escritorio
                        con sesión).
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {touched && !canSaveFree && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Despliega al menos un proveedor e introduce una clave para
                  continuar.
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 max-w-2xl">
                {mode === "settings" ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="sm:flex-1 py-3 px-4 rounded-xl border border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                ) : (
                  <p className="sm:flex-1 text-xs text-stone-500 dark:text-stone-500 self-center">
                    Al guardar podrás crear y generar presentaciones desde el
                    inicio.{" "}
                    <Link
                      to="/"
                      className="text-teal-700 dark:text-teal-400 hover:underline font-medium"
                    >
                      Ir al inicio
                    </Link>{" "}
                    (seguirás necesitando una clave para usar la IA).
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!canSaveFree || isSaving}
                  className="sm:flex-1 py-3 px-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 dark:hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-900/15"
                >
                  {isSaving ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    "Guardar y continuar"
                  )}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
