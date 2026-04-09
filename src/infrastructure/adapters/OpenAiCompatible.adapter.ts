import type { PresentationGeneratorPort, SlideOperationsPort } from "../../domain/ports";
import {
  type Slide,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  serializeSlideMatrixForPrompt,
} from "../../domain/entities";
import { buildPrompt } from "../promptEngine";
import {
  slideCountBounds,
  parseSlideCountFromTopic,
  slideCountPrompt,
  generatePresentationPrompt,
  splitSlidePrompt,
  rewriteSlidePrompt,
  generateSlideContentPrompt,
  generateSlideMatrixPrompt,
  imageAlternativesPrompt,
} from "../prompts";
import { parseSlidesFromResponse } from "../schemas";

const { min, max, default: def } = slideCountBounds;

export type OpenAiCompatibleAdapterConfig = {
  providerId: "groq" | "openai" | "cerebras" | "openrouter";
  chatUrl: string;
  getApiKey: () => string | undefined;
  label: string;
  /** Modelo por defecto si `modelId` viene vacío (p. ej. llamadas internas). */
  defaultModel: string;
  extraHeaders?: Record<string, string>;
};

export class OpenAiCompatibleAdapter
  implements PresentationGeneratorPort, SlideOperationsPort
{
  private isTauri(): boolean {
    return (
      typeof window !== "undefined" &&
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
    );
  }

  private async tauriChat(body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
    response_format?: { type: string };
  }): Promise<string> {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ text: string }>("provider_chat_completion", {
      provider: this.config.providerId,
      request: {
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        temperature: body.temperature,
        response_format_json: body.response_format?.type === "json_object",
      },
    });
    return result?.text ?? "";
  }

  private async parseError(res: Response): Promise<string> {
    const data = await res.json().catch(() => null);
    const fromJson =
      (data as { error?: { message?: string }; message?: string } | null)?.error?.message ||
      (data as { error?: { message?: string }; message?: string } | null)?.message;
    if (fromJson) return `${this.config.label}: ${fromJson}`;
    const raw = await res.text().catch(() => "");
    if (raw?.trim()) return `${this.config.label}: ${raw.trim()}`;
    return `${this.config.label} API: ${res.status}`;
  }

  constructor(private readonly config: OpenAiCompatibleAdapterConfig) {}

  private key(): string {
    const k = this.config.getApiKey()?.trim();
    if (!k) throw new Error(`No hay API key de ${this.config.label} configurada.`);
    return k;
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.key()}`,
      ...this.config.extraHeaders,
    };
  }

  private model(modelId: string): string {
    return modelId?.trim() || this.config.defaultModel;
  }

  private async resolveSlideCount(topic: string, model: string): Promise<number> {
    const { system, user } = buildPrompt(slideCountPrompt, { topic });
    const body = {
      model: this.model(model),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 10,
    };
    const text = this.isTauri()
      ? (await this.tauriChat(body)).trim()
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) return `${def}`;
          const data = await res.json().catch(() => ({}));
          return (data?.choices?.[0]?.message?.content ?? "").trim();
        })();
    const n = text.match(/\d+/);
    if (!n) return def;
    return Math.min(max, Math.max(min, parseInt(n[0], 10)));
  }

  async generatePresentation(topic: string, modelId: string): Promise<Slide[]> {
    const model = this.model(modelId);
    const requestedCount =
      parseSlideCountFromTopic(topic) ?? (await this.resolveSlideCount(topic, model));
    const { system, user } = buildPrompt(generatePresentationPrompt, {
      topic,
      slideCount: requestedCount,
      strictCount: requestedCount !== def,
    });
    const body = {
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 16384,
    };
    const content = this.isTauri()
      ? await this.tauriChat(body)
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await this.parseError(res));
          const data = await res.json();
          return data?.choices?.[0]?.message?.content as string | undefined;
        })();
    return content && typeof content === "string" ? parseSlidesFromResponse(content) : [];
  }

  async splitSlide(slide: Slide, prompt: string, modelId: string): Promise<Slide[]> {
    const { system, user } = buildPrompt(splitSlidePrompt, { slide, userPrompt: prompt });
    const body = {
      model: this.model(modelId),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    };
    const content = this.isTauri()
      ? await this.tauriChat(body)
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await this.parseError(res));
          const data = await res.json().catch(() => ({}));
          return data?.choices?.[0]?.message?.content as string | undefined;
        })();
    return content && typeof content === "string" ? parseSlidesFromResponse(content) : [];
  }

  async rewriteSlide(
    slide: Slide,
    prompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const { system, user } = buildPrompt(rewriteSlidePrompt, { slide, userPrompt: prompt });
    const body = {
      model: this.model(modelId),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    };
    const content = this.isTauri()
      ? await this.tauriChat(body)
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await this.parseError(res));
          const data = await res.json().catch(() => ({}));
          return data?.choices?.[0]?.message?.content as string | undefined;
        })();
    if (!content || typeof content !== "string")
      return { title: slide.title, content: slide.content };
    try {
      const p = JSON.parse(content) as { title?: string; content?: string };
      return { title: p.title ?? slide.title, content: p.content ?? slide.content };
    } catch {
      return { title: slide.title, content: slide.content };
    }
  }

  async generateSlideContent(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{ title: string; content: string }> {
    const { system, user } = buildPrompt(generateSlideContentPrompt, {
      presentationTopic,
      slideTitle: slide.title,
      slideContent: slide.content,
      userPrompt,
    });
    const body = {
      model: this.model(modelId),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    };
    const content = this.isTauri()
      ? await this.tauriChat(body)
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await this.parseError(res));
          const data = await res.json().catch(() => ({}));
          return data?.choices?.[0]?.message?.content as string | undefined;
        })();
    if (!content || typeof content !== "string")
      return { title: slide.title, content: slide.content };
    try {
      const p = JSON.parse(content) as { title?: string; content?: string };
      return { title: p.title ?? slide.title, content: p.content ?? slide.content };
    } catch {
      return { title: slide.title, content: slide.content };
    }
  }

  async generateSlideMatrix(
    presentationTopic: string,
    slide: Slide,
    userPrompt: string,
    modelId: string
  ): Promise<{
    title: string;
    subtitle: string;
    content: string;
    columnHeaders: string[];
    rows: string[][];
  }> {
    const baseMatrix = normalizeSlideMatrixData(slide.matrixData ?? createEmptySlideMatrixData());
    const fallback = {
      title: slide.title,
      subtitle: slide.subtitle ?? "",
      content: slide.content,
      columnHeaders: baseMatrix.columnHeaders,
      rows: baseMatrix.rows,
    };
    const { system, user } = buildPrompt(generateSlideMatrixPrompt, {
      presentationTopic,
      slideTitle: slide.title,
      slideSubtitle: slide.subtitle ?? "",
      matrixJson: serializeSlideMatrixForPrompt(baseMatrix),
      userPrompt,
    });
    const body = {
      model: this.model(modelId),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      max_tokens: 8192,
    };
    const content = this.isTauri()
      ? await this.tauriChat(body)
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await this.parseError(res));
          const data = await res.json().catch(() => ({}));
          return data?.choices?.[0]?.message?.content as string | undefined;
        })();
    if (!content || typeof content !== "string") return fallback;
    try {
      const parsed = JSON.parse(content) as {
        title?: string;
        subtitle?: string;
        content?: string;
        columnHeaders?: unknown;
        rows?: unknown;
      };
      const matrix = normalizeSlideMatrixData({
        columnHeaders: parsed.columnHeaders,
        rows: parsed.rows,
      });
      return {
        title: (parsed.title ?? slide.title).trim() || slide.title,
        subtitle: String(parsed.subtitle ?? "").trim(),
        content: String(parsed.content ?? "").trim(),
        columnHeaders: matrix.columnHeaders,
        rows: matrix.rows,
      };
    } catch {
      return fallback;
    }
  }

  async generateImagePromptAlternatives(
    slideContext: string,
    currentPrompt: string,
    styleName: string,
    _stylePrompt: string,
    modelId: string,
    characterPrompt?: string,
    includeBackground: boolean = true
  ): Promise<string> {
    const hasCharacter = !!characterPrompt?.trim();
    const { system, user } = buildPrompt(imageAlternativesPrompt, {
      slideContext,
      styleName,
      currentPrompt,
      hasCharacter,
      includeBackground,
    });
    const body = {
      model: this.model(modelId),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 500,
      ...(currentPrompt.trim().length > 0 ? { temperature: 0.95 } : {}),
    };
    const content = this.isTauri()
      ? await this.tauriChat(body)
      : await (async () => {
          const res = await fetch(this.config.chatUrl, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
          });
          if (!res.ok) throw new Error(await this.parseError(res));
          const data = await res.json().catch(() => ({}));
          return (data?.choices?.[0]?.message?.content ?? "") as string;
        })();
    return content.trim();
  }
}
