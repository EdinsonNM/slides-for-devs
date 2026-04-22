/** HTML enriquecido del bloque descripción (lienzo): sanitizado antes de persistir o de `dangerouslySetInnerHTML`. */

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "span",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "a",
]);

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "font-size",
  "font-weight",
  "text-decoration",
  "font-style",
  "white-space",
]);

function sanitizeCssValue(val: string): string | null {
  const v = val.trim();
  if (!v) return null;
  if (/javascript:/i.test(v) || /@import/i.test(v) || /expression\s*\(/i.test(v)) {
    return null;
  }
  return v;
}

function sanitizeStyleAttr(raw: string): string | null {
  const parts = raw.split(";").map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const valRaw = part.slice(idx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    const safe = sanitizeCssValue(valRaw);
    if (!safe) continue;
    out.push(`${prop}: ${safe}`);
  }
  return out.length ? out.join("; ") : null;
}

function sanitizeHref(href: string): string | null {
  const h = href.trim();
  if (!h) return null;
  const lower = h.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) {
    return h;
  }
  return null;
}

export function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convierte markdown/texto previo en un único bloque HTML editable (sin interpretar MD). */
export function markdownPlainToInitialRichHtml(md: string): string {
  return `<div class="slide-rich-root" style="white-space:pre-wrap">${escapeHtmlText(md)}</div>`;
}

function applyInlineMarkdownToEscaped(line: string): string {
  let t = escapeHtmlText(line);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*])\*([^*\n]+?)\*([^*]|$)/g, "$1<em>$2</em>$3");
  return t;
}

/**
 * Convierte el cuerpo markdown habitual (párrafos, listas con `*` o `-`, **negrita**, *cursiva*)
 * a HTML para el editor WYSIWYG (sin motor markdown completo).
 */
export function markdownBodyToRichHtmlForEditor(md: string): string {
  const raw = md.replace(/\r\n/g, "\n");
  if (!raw.trim()) {
    return `<div class="slide-rich-root"><p><br /></p></div>`;
  }
  const lines = raw.split("\n");
  const chunks: string[] = [];
  let inUl = false;
  const closeUl = () => {
    if (inUl) {
      chunks.push("</ul>");
      inUl = false;
    }
  };
  for (const line of lines) {
    const bullet = /^\s*[*-]\s+(.+)$/.exec(line);
    if (bullet?.[1]) {
      if (!inUl) {
        chunks.push("<ul>");
        inUl = true;
      }
      chunks.push(`<li>${applyInlineMarkdownToEscaped(bullet[1])}</li>`);
      continue;
    }
    closeUl();
    const trimmed = line.trim();
    if (!trimmed) {
      chunks.push("<p><br /></p>");
    } else {
      chunks.push(`<p>${applyInlineMarkdownToEscaped(line.trimEnd())}</p>`);
    }
  }
  closeUl();
  return `<div class="slide-rich-root">${chunks.join("")}</div>`;
}

export function plainTextFromRichHtml(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  const t = tpl.content.textContent ?? "";
  return t.replace(/\u00a0/g, " ").trim();
}

/**
 * Sanitiza HTML generado por `contentEditable` / pegado.
 * En entornos sin `document` devuelve cadena vacía.
 */
export function sanitizeSlideRichHtml(html: string): string {
  if (typeof document === "undefined") return "";
  const trimmed = html.trim();
  if (!trimmed) return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = trimmed;

  const all = tpl.content.querySelectorAll("*");
  const list = Array.from(all).reverse();
  for (const el of list) {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
      continue;
    }

    const attrs = [...el.attributes];
    for (const attr of attrs) {
      const name = attr.name.toLowerCase();
      if (name === "style") {
        const s = sanitizeStyleAttr(attr.value);
        if (s) el.setAttribute("style", s);
        else el.removeAttribute("style");
      } else if (tag === "a" && name === "href") {
        const h = sanitizeHref(attr.value);
        if (h) el.setAttribute("href", h);
        else el.removeAttribute("href");
      } else if (tag === "div" && name === "class" && attr.value.includes("slide-rich-root")) {
        el.setAttribute("class", "slide-rich-root");
      } else {
        el.removeAttribute(attr.name);
      }
    }
  }

  return tpl.innerHTML.trim();
}

type WholeRichExecMode =
  | "bold"
  | "italic"
  | { readonly foreColor: string };

/**
 * Aplica negrita/cursiva/color a **todo** el HTML del bloque sin montar el editor en pantalla
 * (host fuera de vista + `execCommand` + sanitizar de nuevo).
 */
function applyWholeRichHtmlWithExec(
  html: string,
  mode: WholeRichExecMode,
): string {
  if (typeof document === "undefined") return html;
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  const host = document.createElement("div");
  host.setAttribute("contenteditable", "true");
  host.setAttribute("aria-hidden", "true");
  host.tabIndex = -1;
  host.style.cssText =
    "position:fixed;left:-9999px;top:0;width:960px;max-height:320px;overflow:auto;opacity:0;pointer-events:none;";
  host.innerHTML = sanitizeSlideRichHtml(trimmed);
  document.body.appendChild(host);
  const sel = window.getSelection();
  try {
    host.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(host);
    sel?.removeAllRanges();
    sel?.addRange(range);
    if (mode === "bold") {
      document.execCommand("bold", false);
    } else if (mode === "italic") {
      document.execCommand("italic", false);
    } else {
      document.execCommand("foreColor", false, mode.foreColor);
    }
    return sanitizeSlideRichHtml(host.innerHTML);
  } finally {
    host.remove();
    sel?.removeAllRanges();
  }
}

export function applyWholeRichHtmlBold(html: string): string {
  return applyWholeRichHtmlWithExec(html, "bold");
}

export function applyWholeRichHtmlItalic(html: string): string {
  return applyWholeRichHtmlWithExec(html, "italic");
}

export function applyWholeRichHtmlForeColor(html: string, hex: string): string {
  return applyWholeRichHtmlWithExec(html, { foreColor: hex });
}

export function wrapSelectionWithSpanStyle(style: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.setAttribute("style", style);
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const nr = document.createRange();
  nr.selectNodeContents(span);
  nr.collapse(false);
  sel.addRange(nr);
}
