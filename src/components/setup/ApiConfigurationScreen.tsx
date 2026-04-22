import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
  FileText,
  Flame,
  Globe2,
  Image as ImageIcon,
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
import { openExternalLink } from "../../utils/openExternalLink";
import { OPENAI_IMAGE_MODEL_DISPLAY } from "../../constants/openaiImageModels";
import {
  MESHY_AI_MODEL_OPTIONS,
  readStoredMeshyAiModelId,
  writeStoredMeshyAiModelId,
} from "../../constants/meshyModels";

const GENERATE_HINT =
  "Pega tu clave abajo y vuelve a generar: Slaim no almacena tus keys en sus servidores.";

/** Precios en soles (PEN). La contratación en app es futura. */
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

const IA_PLAN_MODE_STORAGE_KEY = "slaim_ia_plan_mode_v1";
const SLAI_BILLING_TIER_STORAGE_KEY = "slaim_billing_tier_v1";

function readStoredPlanMode(): PlanMode {
  if (typeof window === "undefined") return "free";
  try {
    const v = localStorage.getItem(IA_PLAN_MODE_STORAGE_KEY);
    if (v === "subscription") return "subscription";
    return "free";
  } catch {
    return "free";
  }
}

function readStoredSlaimBillingTier(): SlaimBillingTier {
  if (typeof window === "undefined") return "year";
  try {
    const v = localStorage.getItem(SLAI_BILLING_TIER_STORAGE_KEY);
    if (v === "day" || v === "week" || v === "month" || v === "year") return v;
  } catch {
    /* ignore */
  }
  return "year";
}

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
    subtitle: "Rápido para texto e imágenes",
    Icon: Sparkles,
    placeholder: "Ej: AIza...",
    docHref: "https://aistudio.google.com/apikey",
    docLabel: "Crear clave en AI Studio",
    hintLine: "Una sola clave para redactar slides y generar visuales con Gemini.",
  },
  openai: {
    title: "OpenAI",
    subtitle: "GPT para texto e imágenes",
    Icon: Bot,
    placeholder: "Ej: sk-...",
    docHref: "https://platform.openai.com/api-keys",
    docLabel: "Obtener clave en OpenAI",
    hintLine: "GPT para contenido y la API de imágenes de OpenAI para gráficos.",
  },
  xai: {
    title: "xAI (Grok)",
    subtitle: "Modelos Grok",
    Icon: Zap,
    placeholder: "Ej: xai-...",
    docHref: "https://console.x.ai/team/default/api-keys",
    docLabel: "Consola xAI",
    hintLine: "Ideal si ya trabajas con Grok.",
  },
  groq: {
    title: "Groq",
    subtitle: "Respuestas muy rápidas",
    Icon: Flame,
    placeholder: "Ej: gsk_...",
    docHref: "https://console.groq.com/keys",
    docLabel: "Consola Groq",
    hintLine: "Inferencia acelerada para iterar en el guion.",
  },
  cerebras: {
    title: "Cerebras",
    subtitle: "Nube Cerebras",
    Icon: Cpu,
    placeholder: "Clave de API",
    docHref: "https://cloud.cerebras.ai/",
    docLabel: "Cerebras Cloud",
    hintLine: "Modelos Cerebras cuando los tengas contratados.",
  },
  openrouter: {
    title: "OpenRouter",
    subtitle: "Varios modelos, una clave",
    Icon: Globe2,
    placeholder: "Ej: sk-or-...",
    docHref: "https://openrouter.ai/keys",
    docLabel: "OpenRouter",
    hintLine: "Centraliza proveedores sin cambiar de cuenta cada vez.",
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
              onClick={(e) => {
                e.preventDefault();
                void openExternalLink(meta.docHref);
              }}
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

const SETTINGS_PATH_HUB = "/configure-ai?mode=settings";
const SETTINGS_PATH_KEYS = "/configure-ai?mode=settings&view=keys";
const SETTINGS_PATH_SUBSCRIBE = "/configure-ai?mode=settings&view=subscribe";

function SlaimPlansFourCardPicker({
  slaimBillingTier,
  setSlaimBillingTier,
}: {
  slaimBillingTier: SlaimBillingTier;
  setSlaimBillingTier: (t: SlaimBillingTier) => void;
}) {
  const plans: {
    id: SlaimBillingTier;
    title: string;
    badge: string;
    price: string;
    detail: string;
    accent: "amber" | "teal";
    extra?: string;
  }[] = [
    {
      id: "day",
      title: "1 día",
      badge: "Pago único",
      price: `S/ ${formatAmount2(SLAI_PRICE_DAY)}`,
      detail:
        "Acceso a funciones premium con IA durante 24 horas. Al terminar el periodo, no se pierden tus documentos creados.",
      accent: "amber",
    },
    {
      id: "week",
      title: "1 semana",
      badge: "Pago único",
      price: `S/ ${formatAmount2(SLAI_PRICE_WEEK_ONE_TIME)}`,
      detail:
        "Si buscas más flexibilidad que un solo día, puedes elegir este plan: acceso premium con IA durante 7 días. Pago único, sin renovación automática.",
      accent: "amber",
    },
    {
      id: "month",
      title: "Mensual",
      badge: "Recurrente",
      price: `S/ ${formatAmount2(SLAI_PRICE_MONTH_RECURRING)}`,
      detail: `Renovación automática cada mes hasta que canceles (S/ ${formatAmount2(SLAI_PRICE_MONTH_RECURRING)} por mes).`,
      accent: "teal",
    },
    {
      id: "year",
      title: "Anual",
      badge: "Recurrente",
      price: `S/ ${formatAmount2(SLAI_PRICE_YEAR)}`,
      detail: `Renovación automática cada año hasta que canceles (S/ ${formatAmount2(SLAI_PRICE_YEAR)} por año).`,
      accent: "teal",
      extra: `≈${SLAI_YEAR_SAVINGS_PERCENT}% menos vs. 12 × mensual (~S/ ${formatAmount2(SLAI_YEAR_EFFECTIVE_MONTHLY)}/mes).`,
    },
  ];

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      role="radiogroup"
      aria-label="Planes Slaim"
    >
      {plans.map((p) => {
        const selected = slaimBillingTier === p.id;
        const isAmber = p.accent === "amber";
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setSlaimBillingTier(p.id)}
            className={cn(
              "relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all sm:p-5",
              isAmber
                ? "border-amber-200/90 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/25"
                : "border-teal-200/80 bg-teal-50/40 dark:border-teal-800/45 dark:bg-teal-950/25",
              selected &&
                (isAmber
                  ? "border-amber-500 ring-2 ring-amber-500/35 shadow-md"
                  : "border-teal-500 ring-2 ring-teal-500/35 shadow-md"),
            )}
          >
            {p.id === "year" && (
              <span className="absolute right-3 top-3 text-[10px] font-bold uppercase tracking-wide rounded-full bg-emerald-600 px-2 py-0.5 text-white shadow-sm">
                Mejor oferta
              </span>
            )}
            <span
              className={cn(
                "mb-2 inline-block w-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isAmber
                  ? "bg-amber-200/90 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100"
                  : "bg-teal-200/90 text-teal-950 dark:bg-teal-900/60 dark:text-teal-100",
              )}
            >
              {p.badge}
            </span>
            <span className="text-base font-semibold text-stone-900 dark:text-foreground">
              {p.title}
            </span>
            <span
              className={cn(
                "mt-2 text-2xl font-bold tabular-nums",
                isAmber
                  ? "text-amber-950 dark:text-amber-200"
                  : "text-teal-900 dark:text-teal-200",
              )}
            >
              {p.price}
            </span>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{p.detail}</p>
            {p.extra ? (
              <p className="mt-2 text-[11px] font-medium leading-snug text-emerald-800 dark:text-emerald-300/95">
                {p.extra}
              </p>
            ) : null}
          </button>
        );
      })}
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
  const reasonGenerate = searchParams.get("reason") === "generate";
  const settingsViewParam = searchParams.get("view");
  const settingsView: "hub" | "keys" | "subscribe" =
    settingsViewParam === "keys"
      ? "keys"
      : settingsViewParam === "subscribe"
        ? "subscribe"
        : "hub";

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

  const [planMode, setPlanMode] = useState<PlanMode>(readStoredPlanMode);
  const [slaimBillingTier, setSlaimBillingTier] =
    useState<SlaimBillingTier>(readStoredSlaimBillingTier);
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

  useEffect(() => {
    try {
      localStorage.setItem(IA_PLAN_MODE_STORAGE_KEY, planMode);
    } catch {
      /* ignore */
    }
  }, [planMode]);

  useEffect(() => {
    try {
      localStorage.setItem(SLAI_BILLING_TIER_STORAGE_KEY, slaimBillingTier);
    } catch {
      /* ignore */
    }
  }, [slaimBillingTier]);

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
    if (settingsView === "keys") return "Claves y proveedores";
    if (settingsView === "subscribe") return "Plan Slaim";
    return "Configura Slaim";
  }, [settingsView]);

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
      navigate(SETTINGS_PATH_HUB);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (settingsView === "keys" || settingsView === "subscribe") {
      navigate(SETTINGS_PATH_HUB);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-dvh font-sans text-stone-900 dark:text-foreground bg-linear-to-b from-teal-50/90 via-white to-stone-50 dark:from-teal-950/40 dark:via-surface dark:to-surface">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-teal-400/20 dark:bg-teal-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-emerald-300/15 dark:bg-emerald-600/10 blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24">
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition-colors"
          >
            <ArrowLeft size={18} aria-hidden />
            Volver
          </button>
        </div>

        <header className="mb-10 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 dark:text-foreground">
            {pageTitle}
          </h1>
          {reasonGenerate && (
            <p
              role="status"
              className="mt-4 text-base text-teal-900 dark:text-teal-100/90 max-w-3xl rounded-xl border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/90 dark:bg-teal-950/40 px-4 py-3"
            >
              {GENERATE_HINT}
            </p>
          )}
          {settingsView === "hub" && (
            <p className="mt-3 text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              Elige cómo quieres usar la IA en Slaim: configúralo en modo gratuito
              con tus propias APIs o adquiere el plan Slaim.
            </p>
          )}
          {settingsView === "keys" && (
            <p className="mt-3 text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              Edita proveedores, imágenes, Meshy y sync. Todo queda en tu
              dispositivo.
            </p>
          )}
          {settingsView === "subscribe" && (
            <p className="mt-3 text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              Precios en soles. El cobro desde la app llegará en una próxima
              versión.
            </p>
          )}
        </header>

        {settingsView === "hub" ? (
          <section
            aria-labelledby="settings-ia-options-heading"
            className="mb-6 sm:mb-8"
          >
            <div className="mb-4 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              <h2
                id="settings-ia-options-heading"
                className="text-center text-sm font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300"
              >
                Elige cómo pagas la IA
              </h2>
              {planMode === "subscription" ? (
                <span className="rounded-full border border-teal-300/60 bg-teal-100/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900 dark:border-teal-700/60 dark:bg-teal-900/50 dark:text-teal-100">
                  Premium
                </span>
              ) : null}
            </div>
            <p className="mx-auto mb-6 max-w-2xl text-center text-base leading-relaxed text-stone-600 dark:text-stone-400">
              <span className="font-medium text-stone-800 dark:text-stone-200">
                Slaim
              </span>{" "}
              se esfuerza por mantener la mayor cantidad de funciones{" "}
              <span className="font-medium text-teal-800 dark:text-teal-300">
                gratis
              </span>
              , para que puedas mostrar al mundo tu idea con la menor fricción
              posible.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:gap-6 lg:items-stretch">
              <div className="flex min-h-full flex-col rounded-2xl border border-stone-200/90 dark:border-border bg-white/90 dark:bg-surface-elevated/90 p-5 sm:p-6 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300">
                    <Sparkles size={20} aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-foreground">
                    Free
                  </h3>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wide rounded-full bg-teal-100 dark:bg-teal-900/60 px-2 py-0.5 text-teal-800 dark:text-teal-200">
                    Gratis
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                  Conecta Gemini, OpenAI u otros. Pagas uso directo al proveedor;
                  Slaim no cobra la generación por tu cuenta.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-stone-600 dark:text-stone-400">
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Generación y edición de slides con el modelo que elijas
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Imágenes para diapositivas con la misma cuenta (Gemini u
                    OpenAI)
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Varios proveedores: xAI, Groq, Cerebras, OpenRouter y más
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 leading-snug text-stone-600 dark:text-stone-400">
                        Conectar modelos locales (p. ej. Ollama o API en tu red).
                      </span>
                      <span className="shrink-0 rounded-full border border-amber-300/70 bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 dark:border-amber-700/50 dark:bg-amber-900/55 dark:text-amber-100">
                        Pronto
                      </span>
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Claves guardadas en tu dispositivo; Slaim no las aloja en sus
                    servidores
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Pagas solo lo que consumas en cada proveedor, a tu ritmo
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setPlanMode("free");
                    navigate(SETTINGS_PATH_KEYS);
                  }}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/15 transition-colors hover:bg-teal-700 dark:hover:bg-teal-500"
                >
                  Configurar claves
                </button>
              </div>

              <div className="relative flex min-h-full flex-col overflow-hidden rounded-2xl border-2 border-teal-400/45 bg-linear-to-br from-teal-50/95 via-white to-emerald-50/80 p-5 shadow-md shadow-teal-900/10 sm:p-6 dark:border-teal-500/45 dark:from-stone-950 dark:via-stone-950 dark:to-teal-950 dark:shadow-lg dark:shadow-teal-900/25">
                <span className="absolute right-4 top-4 text-[10px] font-bold uppercase tracking-wide rounded-full bg-amber-400 px-2.5 py-1 text-amber-950 shadow-sm dark:shadow">
                  Próximamente
                </span>
                <div className="mb-3 flex items-center gap-2 pr-24">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-white/10 dark:text-teal-200">
                    <CreditCard size={20} aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold text-stone-900 dark:text-white">
                    Plan Slaim
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                  Un precio en soles con la IA incluida: sin sumar facturas de
                  Google ni OpenAI. Misma app que con Tu API.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Todo el consumo de IA incluido en tu plan Slaim
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Un solo recibo y cupo claro para el equipo
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Diagramas, imágenes, vídeo y 3D con IA en el plan
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Sin copiar ni rotar claves de Google, OpenAI u otros
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    Pagos a tu medida: día o semana cuando lo necesites, sin
                    mensualidad obligatoria, o suscripción mensual o anual con
                    mejores beneficios
                  </li>
                  <li className="flex gap-2">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 leading-snug text-stone-600 dark:text-stone-300">
                        Enlazar modelos locales (Ollama o API en tu red).
                      </span>
                      <span className="shrink-0 rounded-full border border-amber-300/80 bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 dark:border-amber-400/60 dark:bg-amber-400/25 dark:text-amber-100">
                        Pronto
                      </span>
                    </span>
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setPlanMode("subscription");
                    navigate(SETTINGS_PATH_SUBSCRIBE);
                  }}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal-600/35 bg-white/90 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm transition-colors hover:bg-teal-50/90 dark:border-white/30 dark:bg-white/10 dark:text-white dark:shadow-none dark:backdrop-blur-sm dark:hover:bg-white/20"
                >
                  Suscribirse
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {settingsView === "subscribe" ? (
          <section
            aria-labelledby="subscribe-plans-heading"
            className="mb-8 space-y-6"
          >
            <h2
              id="subscribe-plans-heading"
              className="text-lg font-semibold text-stone-900 dark:text-foreground"
            >
              Opciones de pago (soles)
            </h2>
            <SlaimPlansFourCardPicker
              slaimBillingTier={slaimBillingTier}
              setSlaimBillingTier={setSlaimBillingTier}
            />
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-2xl leading-relaxed">
              El pago con tarjeta o billetera en la app está en camino. Mientras
              tanto usa <strong className="text-stone-800 dark:text-stone-200">Tu API</strong>{" "}
              desde el inicio de esta sección.
            </p>
          </section>
        ) : null}

        {settingsView === "keys" ? (
          <section
            id="proveedores"
            aria-labelledby="claves-heading"
            className="scroll-mt-28 rounded-2xl border border-stone-200/80 dark:border-border bg-white/90 dark:bg-surface-elevated/90 shadow-sm p-5 sm:p-8"
          >
            <div className="flex items-start gap-3 mb-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
                <KeyRound size={20} aria-hidden />
              </div>
              <div>
                <h2
                  id="claves-heading"
                  className="text-lg font-semibold text-stone-900 dark:text-foreground"
                >
                  Claves por tipo de generación
                </h2>
                <p className="text-sm text-stone-600 dark:text-stone-400 mt-1 leading-relaxed max-w-2xl">
                  Necesitas al menos un proveedor de{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    texto
                  </strong>
                  .{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    Gemini
                  </strong>{" "}
                  y{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    OpenAI
                  </strong>{" "}
                  sirven también para{" "}
                  <strong className="text-stone-800 dark:text-stone-200">
                    imágenes
                  </strong>
                  . Las claves quedan en tu dispositivo, no en servidores de Slaim.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                    <FileText size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900 dark:text-foreground">
                      Generación de contenido (texto)
                    </h3>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      Slides, chat, reescritura y más. Con clave de{" "}
                      <strong>Gemini</strong> usamos{" "}
                      <strong>Gemini 2.5 Flash</strong> por defecto; con{" "}
                      <strong>OpenAI</strong> (sin Gemini) usamos{" "}
                      <strong>GPT‑5 mini</strong>. En xAI, Groq, Cerebras u
                      OpenRouter eliges el modelo al generar desde el inicio.
                    </p>
                  </div>
                </div>
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
              </div>

              <div className="border-t border-stone-200 dark:border-border pt-8 space-y-4 max-w-2xl">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200">
                    <ImageIcon size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900 dark:text-foreground">
                      Generación de imágenes
                    </h3>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                      Para imágenes en slides{" "}
                      <strong className="text-stone-700 dark:text-stone-300">
                        necesitas una API key de Google AI (Gemini) o de OpenAI
                      </strong>
                      : se reutilizan las mismas claves que pegaste arriba en
                      texto. Si tienes ambas, indica cuál usar para visuales; en
                      Gemini puedes elegir el modelo de imagen.
                    </p>
                  </div>
                </div>
                <div>
                  {!hasGemini && !hasOpenAI ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200/90 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/90 dark:bg-amber-950/35 px-3 py-2.5">
                      Añade una API key de{" "}
                      <strong>Google AI (Gemini)</strong> o de{" "}
                      <strong>OpenAI</strong> arriba para poder generar imágenes
                      con IA.
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
                            Gemini
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
                            OpenAI
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
                            Modelo de imagen:{" "}
                          </span>
                          {OPENAI_IMAGE_MODEL_DISPLAY}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-stone-200 dark:border-border pt-8 space-y-4 max-w-2xl">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-900/45 dark:text-violet-200">
                    <Box size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-stone-900 dark:text-foreground">
                      Generación de modelos 3D
                    </h3>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                      Opcional: en <strong>Canvas 3D</strong> puedes subir{" "}
                      <code className="text-[11px]">.glb</code>, URL o generar con{" "}
                      <a
                        href="https://www.meshy.ai/api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-violet-700 underline hover:no-underline dark:text-violet-300"
                        onClick={(e) => {
                          e.preventDefault();
                          void openExternalLink("https://www.meshy.ai/api");
                        }}
                      >
                        Meshy
                      </a>
                      . Solo escritorio; hace falta plan API y créditos en Meshy.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-stone-200/90 dark:border-border bg-white/60 dark:bg-surface-elevated/50 px-3 py-3 space-y-3">
                  <label className="flex flex-col gap-1.5 text-xs text-stone-600 dark:text-stone-400">
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      API key Meshy
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
                      Modelo texto / imagen → 3D
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
              </div>

              <div className="max-w-2xl space-y-5">
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
                        Subir a la nube al guardar
                      </span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        Cada guardado sincroniza la deck si iniciaste sesión en
                        escritorio.
                      </span>
                    </span>
                  </label>
                )}
              </div>

              {touched && !canSaveFree && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Abre un proveedor y pega una clave para seguir.
                </p>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 max-w-2xl">
                <button
                  type="button"
                  onClick={handleBack}
                  className="sm:flex-1 py-3 px-4 rounded-xl border border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
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
                    "Guardar"
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
