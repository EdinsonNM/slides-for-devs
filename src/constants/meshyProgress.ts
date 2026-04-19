/** Debe coincidir con `MESHY_TASK_PROGRESS_EVENT` en `src-tauri/src/meshy.rs`. */
export const MESHY_TASK_PROGRESS_EVENT = "meshy-task-progress";

export type MeshyTaskProgressPayload = {
  phase: string;
  status: string;
  progress: number;
};

export function meshyPhaseLabelEs(phase: string): string {
  switch (phase) {
    case "preview":
      return "Preview (geometría base)";
    case "refine":
      return "Textura (refine)";
    case "image":
      return "Imagen → modelo";
    case "download":
      return "Descargando modelo";
    default:
      return phase || "Generación";
  }
}

export function meshyStatusLabelEs(status: string): string {
  switch (status) {
    case "CREATING":
      return "Creando tarea en Meshy…";
    case "POLLING":
      return "Consultando estado…";
    case "CREATING_REFINE":
      return "Iniciando textura (refine)…";
    case "DOWNLOADING":
      return "Descargando archivo .glb…";
    case "READY":
      return "Listo para el visor";
    case "PENDING":
      return "En cola";
    case "IN_PROGRESS":
      return "En progreso";
    case "SUCCEEDED":
      return "Completado";
    case "FAILED":
      return "Fallido";
    case "CANCELED":
      return "Cancelado";
    default:
      return status || "—";
  }
}
