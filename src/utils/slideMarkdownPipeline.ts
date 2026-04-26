import type { Pluggable } from "unified";
import type { Schema } from "hast-util-sanitize";
import { defaultSchema } from "hast-util-sanitize";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { rehypeMergeBadgeParagraphs } from "./rehypeMergeBadgeParagraphs";

/**
 * Esquema de saneamiento alineado con GitHub + extras para readmes reales
 * (HTML embebido, `data:` en imágenes, `<center>` heredado).
 * Debe usarse **siempre** después de `rehype-raw` en el pipeline.
 */
export const slideMarkdownSanitizeSchema: Schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    /** Shields, imágenes remotas, y data URLs en el propio .md. */
    src: [...(defaultSchema.protocols?.src ?? ["http", "https"]), "data"],
  },
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), "center"])],
};

/**
 * `rehype-raw` parsea bloques HTML dentro del Markdown; `rehype-sanitize`
 * evita XSS (mismo criterio que aprox. GitHub).
 * Orden: raw → sanitize → fusionar párrafos de badges (shields en fila).
 */
export const slideMarkdownRehypePlugins: Pluggable[] = [
  rehypeRaw,
  [rehypeSanitize, slideMarkdownSanitizeSchema],
  rehypeMergeBadgeParagraphs,
];
