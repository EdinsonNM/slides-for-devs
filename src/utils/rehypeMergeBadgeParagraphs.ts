import type { Content, Element, ElementContent, Root, Text } from "hast";

/**
 * Badges (shields) en el MD: (1) varios `p` seguidos con un `a>img` → un `p` con varios `a`.
 * (2) Si en un mismo `p` hay `a, br, a` (p. ej. remark-breaks), se quitan los `br` entre ellos
 *    para dejar fila al estilo GitHub.
 */
function isWhitespaceText(n: Content): boolean {
  return n.type === "text" && /^[\s\uFEFF]*$/u.test((n as Text).value);
}

function isElement(n: Content): n is Element {
  return n.type === "element";
}

function isLinkToSingleImg(a: Content): a is Element {
  if (!isElement(a) || a.tagName !== "a") return false;
  const inner = a.children.filter((c) => !isWhitespaceText(c));
  return (
    inner.length === 1 &&
    isElement(inner[0]!) &&
    inner[0].tagName === "img"
  );
}

function isElementBr(n: Content): boolean {
  return isElement(n) && n.tagName === "br";
}

/** Un solo badge por párrafo: lo que al fusionar con vecinos pasa a una fila. */
function isOneBadgeLineParagraph(el: Content): el is Element {
  if (!isElement(el) || el.tagName !== "p") return false;
  const significant = el.children.filter((c) => !isWhitespaceText(c));
  if (significant.length !== 1) return false;
  return isLinkToSingleImg(significant[0]!);
}

/**
 * Sustituye `a, br, a, br, a` (badges) por solo `a, a, a` en un mismo `p` para alinear
 * con la fila al estilo GitHub aunque existan `<br>` (p. ej. remark-breaks u HTML).
 */
function collapseBrBetweenShieldsInParagraph(p: Element): void {
  if (p.tagName !== "p") return;
  const significant = p.children.filter((c) => !isWhitespaceText(c));
  if (significant.length < 2) return;
  for (let k = 0; k < significant.length; k++) {
    if (k % 2 === 0) {
      if (!isLinkToSingleImg(significant[k]!)) return;
    } else if (!isElementBr(significant[k]!)) {
      return;
    }
  }
  p.children = significant.filter(
    (_, i) => i % 2 === 0,
  ) as ElementContent[];
}

function mergeRuns(children: Content[]): Content[] {
  const out: Content[] = [];
  let i = 0;
  while (i < children.length) {
    const c = children[i]!;
    if (!isOneBadgeLineParagraph(c)) {
      out.push(c);
      i++;
      continue;
    }
    const run: Element[] = [c];
    let j = i + 1;
    while (j < children.length && isOneBadgeLineParagraph(children[j]!)) {
      run.push(children[j] as Element);
      j++;
    }
    if (run.length === 1) {
      out.push(run[0]!);
      i++;
      continue;
    }
    const anchors: Element[] = [];
    for (const p of run) {
      const sig = p.children.filter((ch) => !isWhitespaceText(ch));
      if (
        sig.length === 1 &&
        isElement(sig[0]!) &&
        sig[0]!.tagName === "a"
      ) {
        anchors.push(sig[0]!);
      }
    }
    if (anchors.length === 0) {
      out.push(c);
      i++;
      continue;
    }
    const merged: Element = {
      type: "element",
      tagName: "p",
      properties: {},
      children: anchors as ElementContent[],
    };
    out.push(merged);
    i = j;
  }
  return out;
}

function walk(node: Root | Element): void {
  if (!("children" in node) || !Array.isArray(node.children)) return;
  for (const ch of node.children) {
    if (isElement(ch) && ch.tagName === "p") {
      collapseBrBetweenShieldsInParagraph(ch);
    }
  }
  node.children = mergeRuns(node.children as Content[]) as typeof node.children;
  for (const ch of node.children) {
    if (isElement(ch)) walk(ch);
  }
}

export function rehypeMergeBadgeParagraphs() {
  return (tree: Root) => {
    walk(tree);
  };
}
