import { isTauriRuntime } from "./apiConfig";

export async function meshyTextTo3dGlbUrl(params: {
  prompt: string;
  ai_model: string;
  with_texture: boolean;
}): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Meshy solo se puede usar en la app de escritorio: su API no permite llamadas directas desde el navegador (CORS).",
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  /** Tauri espera camelCase en el payload del invoke. */
  return invoke<string>("meshy_text_to_3d_glb", {
    prompt: params.prompt,
    aiModel: params.ai_model,
    withTexture: params.with_texture,
  });
}

export async function meshyImageTo3dGlbUrl(params: {
  image_url: string;
  ai_model: string;
  should_texture: boolean;
}): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error(
      "Meshy solo se puede usar en la app de escritorio: su API no permite llamadas directas desde el navegador (CORS).",
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("meshy_image_to_3d_glb", {
    imageUrl: params.image_url,
    aiModel: params.ai_model,
    shouldTexture: params.should_texture,
  });
}
