import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Box, Image, Loader2, Type } from "lucide-react";
import {
  DEFAULT_MESHY_AI_MODEL_ID,
  MESHY_AI_MODEL_OPTIONS,
  readStoredMeshyAiModelId,
  writeStoredMeshyAiModelId,
} from "../../constants/meshyModels";
import { getMeshyApiKey, isTauriRuntime } from "../../services/apiConfig";
import {
  meshyImageTo3dGlbUrl,
  meshyTextTo3dGlbUrl,
} from "../../services/meshyInvoke";
import {
  MESHY_TASK_PROGRESS_EVENT,
  meshyPhaseLabelEs,
  meshyStatusLabelEs,
  type MeshyTaskProgressPayload,
} from "../../constants/meshyProgress";
import { ModelSelect } from "../shared/ModelSelect";
import { BaseModal } from "../modals/BaseModal";

const IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

export interface Canvas3dMeshyAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAppliedGlbUrl: (httpGlbUrl: string) => void;
}

type TabId = "text" | "image";

export function Canvas3dMeshyAiModal({
  isOpen,
  onClose,
  onAppliedGlbUrl,
}: Canvas3dMeshyAiModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabId>("text");
  const [prompt, setPrompt] = useState("");
  const [aiModelId, setAiModelId] = useState(DEFAULT_MESHY_AI_MODEL_ID);
  const [withTexture, setWithTexture] = useState(true);
  const [busy, setBusy] = useState(false);
  const [meshyProgress, setMeshyProgress] =
    useState<MeshyTaskProgressPayload | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setBusy(false);
    setMeshyProgress(null);
    setElapsedSec(0);
    setAiModelId(readStoredMeshyAiModelId());
  }, [isOpen]);

  const onPickImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setImageDataUri(dataUrl || null);
    };
    reader.readAsDataURL(file);
  }, []);

  const persistModel = (id: string) => {
    setAiModelId(id);
    writeStoredMeshyAiModelId(id);
  };

  const modelSelectOptions = MESHY_AI_MODEL_OPTIONS.map((m) => ({
    id: m.id,
    label: m.label,
  }));

  const run = async () => {
    setError(null);
    if (!getMeshyApiKey()?.trim()) {
      setError("Configura tu API key de Meshy en Configuración de IA.");
      return;
    }
    if (!isTauriRuntime()) {
      setError(
        "La generación con Meshy requiere la app de escritorio (Slaim con Tauri). El navegador no puede llamar a la API de Meshy por restricciones CORS.",
      );
      return;
    }
    flushSync(() => {
      setBusy(true);
      setMeshyProgress(null);
      setElapsedSec(0);
    });

    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<MeshyTaskProgressPayload>(
      MESHY_TASK_PROGRESS_EVENT,
      (ev) => {
        setMeshyProgress(ev.payload);
      },
    );

    const elapsedTimer = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    try {
      if (tab === "text") {
        const p = prompt.trim();
        if (!p) {
          setError("Escribe una descripción del modelo.");
          return;
        }
        const url = await meshyTextTo3dGlbUrl({
          prompt: p,
          ai_model: aiModelId,
          with_texture: withTexture,
        });
        onAppliedGlbUrl(url);
        onClose();
        setPrompt("");
      } else {
        if (!imageDataUri?.trim()) {
          setError("Selecciona una imagen (.png o .jpeg).");
          return;
        }
        const url = await meshyImageTo3dGlbUrl({
          image_url: imageDataUri,
          ai_model: aiModelId,
          should_texture: withTexture,
        });
        onAppliedGlbUrl(url);
        onClose();
        setImageDataUri(null);
        setImageName(null);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo generar el modelo.";
      setError(msg);
    } finally {
      window.clearInterval(elapsedTimer);
      unlisten();
      setBusy(false);
      setMeshyProgress(null);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      disabledBackdropClose={busy}
      title="Modelo 3D con IA (Meshy)"
      subtitle="Texto → 3D o imagen → 3D. Consume créditos según tu plan en meshy.ai."
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
          <Box size={20} />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("text")}
            className={
              tab === "text"
                ? "inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                : "inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 dark:border-border dark:bg-surface dark:text-stone-200"
            }
          >
            <Type size={14} aria-hidden />
            Texto → modelo
          </button>
          <button
            type="button"
            onClick={() => setTab("image")}
            className={
              tab === "image"
                ? "inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
                : "inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 dark:border-border dark:bg-surface dark:text-stone-200"
            }
          >
            <Image size={14} aria-hidden />
            Imagen → modelo
          </button>
        </div>

        <div className="w-full [&_button]:max-w-none">
          <ModelSelect
            value={aiModelId}
            options={modelSelectOptions}
            onChange={persistModel}
            size="sm"
            title="Modelo de generación Meshy"
            aria-label="Modelo Meshy"
            className="w-full"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2 text-xs text-stone-600 dark:text-stone-400">
          <input
            type="checkbox"
            checked={withTexture}
            onChange={(e) => setWithTexture(e.target.checked)}
            className="mt-0.5 rounded border-stone-300 dark:border-stone-600"
          />
          <span>
            <span className="font-medium text-stone-800 dark:text-stone-200">
              Generar con textura
            </span>
            <span className="block text-[11px] leading-snug opacity-90">
              En texto a 3D implica preview + refine (más tiempo y créditos). En
              imagen a 3D equivale a{" "}
              <code className="text-[10px]">should_texture</code> en la API.
            </span>
          </span>
        </label>

        {tab === "text" ? (
          <label className="flex flex-col gap-1.5 text-xs text-stone-600 dark:text-stone-400">
            <span className="font-medium text-stone-800 dark:text-stone-200">
              Descripción (máx. 600 caracteres)
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
              rows={4}
              placeholder="Ej: robot isométrico estilo low-poly, colores pastel"
              className="w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-border dark:bg-surface dark:text-foreground"
            />
            <span className="text-[10px] text-stone-400 tabular-nums">
              {prompt.length}/600
            </span>
          </label>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={onPickImage}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-left text-sm text-stone-700 transition-colors hover:border-violet-400 hover:bg-violet-50/40 dark:border-stone-600 dark:bg-stone-900/40 dark:text-stone-200 dark:hover:border-violet-700"
            >
              {imageName
                ? `Imagen: ${imageName}`
                : "Pulsa para elegir .png o .jpeg"}
            </button>
          </div>
        )}

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {busy ? (
          <div
            className="rounded-lg border border-violet-200 bg-violet-50/95 px-3 py-3 dark:border-violet-800/60 dark:bg-violet-950/50"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-start gap-2.5">
              <Loader2
                className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-700 dark:text-violet-300"
                aria-hidden
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium text-violet-950 dark:text-violet-100">
                  Generando modelo… (suele tardar varios minutos con textura:
                  preview + refine)
                </p>
                <p className="text-[11px] leading-snug text-violet-900/85 dark:text-violet-200/90">
                  Tiempo transcurrido:{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {elapsedSec}s
                  </span>
                  . La ventana sigue respondiendo; espera a que termine la
                  petición a Meshy.
                </p>
                {meshyProgress ? (
                  <div className="space-y-1.5 pt-0.5">
                    <p className="text-[11px] text-violet-900 dark:text-violet-200">
                      <span className="font-medium">
                        {meshyPhaseLabelEs(meshyProgress.phase)}
                      </span>
                      {" · "}
                      {meshyStatusLabelEs(meshyProgress.status)}
                      {meshyProgress.progress > 0 ? (
                        <span className="tabular-nums">
                          {" "}
                          — {meshyProgress.progress}%
                        </span>
                      ) : null}
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-violet-200/80 dark:bg-violet-900/80">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-[width] duration-300 dark:bg-violet-400"
                        style={{
                          width: `${Math.min(100, Math.max(0, meshyProgress.progress))}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-violet-800/90 dark:text-violet-200/85">
                    Conectando con Meshy…
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
          Documentación:{" "}
          <a
            href="https://www.meshy.ai/api"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-violet-700 underline hover:no-underline dark:text-violet-300"
          >
            meshy.ai/api
          </a>
          .
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-border dark:text-stone-200 dark:hover:bg-white/5"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Generando…
              </>
            ) : (
              "Generar y cargar"
            )}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
