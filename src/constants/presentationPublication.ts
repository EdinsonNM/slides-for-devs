export const PRESENTATION_VISIBILITY_OPTIONS = [
  { value: "private", label: "Privada" },
  { value: "unlisted", label: "No listada" },
  { value: "public", label: "Pública" },
] as const;

export const PRESENTATION_LEVEL_OPTIONS = [
  { value: "basic", label: "Básico" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
] as const;

export const PRESENTATION_CATEGORY_OPTIONS = [
  "Frontend",
  "Backend",
  "DevOps",
  "Cloud",
  "Data",
  "AI/ML",
  "Arquitectura",
  "Testing",
  "Seguridad",
  "Productividad",
] as const;
