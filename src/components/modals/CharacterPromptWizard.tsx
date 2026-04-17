import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Wand2, Check } from "lucide-react";
import { cn } from "../../utils/cn";

const STEP_COUNT = 5;

const DIMENSION_OPTIONS: { id: string; label: string; hint: string; fragment: string }[] = [
  {
    id: "2d",
    label: "Ilustración 2D plana",
    hint: "Clásico dibujo o pintura digital sin volumen 3D.",
    fragment:
      "Ilustración 2D plana, composición frontal o tres cuartos sin aspecto de modelo 3D.",
  },
  {
    id: "3d",
    label: "3D con volumen",
    hint: "Render o escultura digital con relieve y sombras.",
    fragment:
      "Render 3D con volumen, sombras suaves y materiales definidos; perspectiva tridimensional clara.",
  },
  {
    id: "iso",
    label: "Isométrico",
    hint: "Vista tipo diorama o videojuego isométrico.",
    fragment:
      "Vista isométrica 3D, escena con profundidad y lectura espacial, sin perspectiva forzada frontal.",
  },
  {
    id: "pixel",
    label: "Pixel art",
    hint: "Retro, píxeles visibles, paleta acotada.",
    fragment:
      "Pixel art 2D, píxeles visibles, paleta de colores acotada, estilo retro limpio.",
  },
  {
    id: "pixel3d",
    label: "Pixel art 3D / con relieve",
    hint: "Píxeles pero con sensación de volumen.",
    fragment:
      "Pixel art con volumen y relieve (sprites 3D o estilo octopath), píxeles visibles y profundidad.",
  },
  {
    id: "hd2d",
    label: "HD-2D / pintado",
    hint: "Mezcla de pintura detallada con escenas tipo JRPG moderno.",
    fragment:
      "Estilo HD-2D: pintura detallada con personaje bien definido y sensación escénica.",
  },
];

const ART_OPTIONS: { id: string; label: string; hint: string; fragment: string }[] = [
  {
    id: "cartoon",
    label: "Cartoon",
    hint: "Formas claras, expresivo, amigable.",
    fragment: "Estilo cartoon, líneas limpias, proporciones expresivas y amigables.",
  },
  {
    id: "anime",
    label: "Anime / manga",
    hint: "Ojos expresivos, estética japonesa.",
    fragment: "Estilo anime o manga, diseño de personaje coherente con esa estética.",
  },
  {
    id: "realistic",
    label: "Realista pintado",
    hint: "Pinceladas o acabado casi fotográfico.",
    fragment:
      "Ilustración semi-realista o pintura digital detallada, texturas creíbles sin foto cruda.",
  },
  {
    id: "minimal",
    label: "Minimal / flat",
    hint: "Pocos detalles, colores planos.",
    fragment: "Diseño minimalista y flat, formas simples, pocos elementos decorativos.",
  },
  {
    id: "comic",
    label: "Cómic",
    hint: "Trazo de viñeta, contornos marcados.",
    fragment: "Estilo cómic occidental, contornos definidos y color plano o sombreado clásico.",
  },
  {
    id: "watercolor",
    label: "Acuarela",
    hint: "Bordes suaves, textura de agua y pigmento.",
    fragment: "Estilo acuarela digital, transiciones suaves y toques orgánicos.",
  },
];

const ARCHETYPE_SNIPPETS: { label: string; text: string }[] = [
  {
    label: "Presentador tech",
    text: "Presentador o presentadora tech, auriculares o micrófono, actitud cercana y profesional.",
  },
  {
    label: "Docente",
    text: "Personaje tipo docente amable, gesto explicativo, ropa casual-académica.",
  },
  {
    label: "Robot simpático",
    text: "Robot redondeado y simpático, cara tipo pantalla o sensores, proporciones amistosas.",
  },
  {
    label: "Mascota animal",
    text: "Mascota animal estilizada (zorro, gato u oso), silueta reconocible y expresiva.",
  },
  {
    label: "Fantasía",
    text: "Personaje de fantasía (mago, aventurero o elfo) con atuendo distintivo pero legible.",
  },
  {
    label: "Profesional genérico",
    text: "Personaje adulto en contexto laboral suave, ropa business-casual, postura segura.",
  },
];

export interface CharacterPromptWizardProps {
  open: boolean;
  onClose: () => void;
  onApply: (description: string) => void;
  /** Solo informativo en el último paso (el estilo global del editor ya se aplica al generar). */
  editorStyleName: string;
  disabled?: boolean;
}

function buildDescription(params: {
  dimensionId: string | null;
  artId: string | null;
  characterCore: string;
  extraDetails: string;
}): string | null {
  const dim = DIMENSION_OPTIONS.find((d) => d.id === params.dimensionId);
  const art = ART_OPTIONS.find((a) => a.id === params.artId);
  const core = params.characterCore.trim();
  if (!dim || !art || core.length < 4) return null;
  const extra = params.extraDetails.trim();
  const parts = [
    dim.fragment,
    art.fragment,
    core,
    extra || undefined,
    "Un solo personaje centrado, cuerpo entero o busto según encaje mejor; sin pedir escenario ni rejilla de transparencia (la referencia se genera sobre blanco liso); sin texto, letreros ni interfaz.",
  ];
  return parts.filter(Boolean).join(" ");
}

export function CharacterPromptWizard({
  open,
  onClose,
  onApply,
  editorStyleName,
  disabled = false,
}: CharacterPromptWizardProps) {
  const [step, setStep] = useState(0);
  const [dimensionId, setDimensionId] = useState<string | null>(null);
  const [artId, setArtId] = useState<string | null>(null);
  const [characterCore, setCharacterCore] = useState("");
  const [extraDetails, setExtraDetails] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDimensionId(null);
    setArtId(null);
    setCharacterCore("");
    setExtraDetails("");
  }, [open]);

  const preview = useMemo(
    () => buildDescription({ dimensionId, artId, characterCore, extraDetails }),
    [dimensionId, artId, characterCore, extraDetails],
  );

  const canNext = () => {
    if (step === 0) return dimensionId !== null;
    if (step === 1) return artId !== null;
    if (step === 2) return characterCore.trim().length >= 4;
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    if (step < STEP_COUNT - 1) setStep((s) => s + 1);
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleApply = () => {
    if (!preview) return;
    onApply(preview);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-wizard-title"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-stone-950/55 backdrop-blur-sm"
          onClick={() => !disabled && onClose()}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-lg max-h-[min(90vh,640px)] bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl border border-stone-200/80 dark:border-border flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-stone-100 dark:border-border flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Wand2 size={20} aria-hidden />
              </div>
              <div className="min-w-0">
                <h3
                  id="character-wizard-title"
                  className="font-medium text-stone-900 dark:text-foreground text-sm sm:text-base"
                >
                  Asistente de descripción
                </h3>
                <p className="text-[11px] sm:text-xs text-stone-500 dark:text-muted-foreground">
                  Paso {step + 1} de {STEP_COUNT} · Sin escribir un prompt desde cero
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="p-2 shrink-0 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500 disabled:opacity-50"
              aria-label="Cerrar asistente"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 space-y-4">
            <div className="flex gap-1">
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i <= step ? "bg-violet-500" : "bg-stone-200 dark:bg-stone-600",
                  )}
                  aria-hidden
                />
              ))}
            </div>

            {step === 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-800 dark:text-foreground">
                  ¿Cómo quieres el aspecto técnico del personaje?
                </p>
                <p className="text-xs text-stone-500 dark:text-muted-foreground">
                  Esto ayuda a la IA a respetar 2D, 3D, isométrico o pixel art.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIMENSION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setDimensionId(opt.id)}
                      className={cn(
                        "text-left rounded-xl border px-3 py-2.5 transition-colors text-sm",
                        dimensionId === opt.id
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-stone-900 dark:text-foreground ring-1 ring-violet-500/30"
                          : "border-stone-200 dark:border-border hover:bg-stone-50 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200",
                      )}
                    >
                      <span className="font-medium block">{opt.label}</span>
                      <span className="text-[11px] text-stone-500 dark:text-muted-foreground block mt-0.5">
                        {opt.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-800 dark:text-foreground">
                  ¿Qué estilo artístico prefieres?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ART_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setArtId(opt.id)}
                      className={cn(
                        "text-left rounded-xl border px-3 py-2.5 transition-colors text-sm",
                        artId === opt.id
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-stone-900 dark:text-foreground ring-1 ring-violet-500/30"
                          : "border-stone-200 dark:border-border hover:bg-stone-50 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-200",
                      )}
                    >
                      <span className="font-medium block">{opt.label}</span>
                      <span className="text-[11px] text-stone-500 dark:text-muted-foreground block mt-0.5">
                        {opt.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-800 dark:text-foreground">
                  ¿Quién es tu personaje?
                </p>
                <p className="text-xs text-stone-500 dark:text-muted-foreground">
                  Escribe una frase o pulsa una plantilla para rellenar la idea base.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ARCHETYPE_SNIPPETS.map((snip) => (
                    <button
                      key={snip.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => setCharacterCore(snip.text)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-transparent hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
                    >
                      {snip.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={characterCore}
                  onChange={(e) => setCharacterCore(e.target.value)}
                  disabled={disabled}
                  rows={4}
                  placeholder="Ej.: Ingeniera joven con pelo corto, jersey verde y gesto animado al explicar."
                  className="w-full text-sm text-stone-700 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-800 dark:text-foreground">
                  Detalles opcionales
                </p>
                <p className="text-xs text-stone-500 dark:text-muted-foreground">
                  Colores, ropa, accesorios, edad aproximada o rasgos que quieras fijar.
                </p>
                <textarea
                  value={extraDetails}
                  onChange={(e) => setExtraDetails(e.target.value)}
                  disabled={disabled}
                  rows={4}
                  placeholder="Ej.: Tonos pastel, mochila, zapatillas rojas, sin gafas."
                  className="w-full text-sm text-stone-700 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
                />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-800 dark:text-foreground">
                  Revisa el texto generado
                </p>
                <p className="text-xs text-stone-500 dark:text-muted-foreground">
                  Se copiará al campo de descripción. Al generar la imagen también se usará el estilo del
                  editor ({editorStyleName}) como referencia suave.
                </p>
                <div
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs leading-relaxed max-h-48 overflow-y-auto",
                    preview
                      ? "border-stone-200 dark:border-border bg-stone-50 dark:bg-surface text-stone-700 dark:text-stone-200"
                      : "border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100",
                  )}
                >
                  {preview ?? "Faltan datos: vuelve atrás y completa dimensión, estilo e idea del personaje."}
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 sm:px-5 border-t border-stone-100 dark:border-border flex flex-wrap items-center justify-between gap-2 shrink-0 bg-stone-50/80 dark:bg-black/20">
            <button
              type="button"
              onClick={goBack}
              disabled={disabled || step === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-200/80 dark:hover:bg-stone-700 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft size={18} aria-hidden />
              Atrás
            </button>
            <div className="flex gap-2">
              {step < STEP_COUNT - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={disabled || !canNext()}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 dark:hover:bg-violet-500 disabled:opacity-45 disabled:pointer-events-none"
                >
                  Siguiente
                  <ChevronRight size={18} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={disabled || !preview}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 dark:hover:bg-violet-500 disabled:opacity-45 disabled:pointer-events-none"
                >
                  <Check size={18} aria-hidden />
                  Usar esta descripción
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
