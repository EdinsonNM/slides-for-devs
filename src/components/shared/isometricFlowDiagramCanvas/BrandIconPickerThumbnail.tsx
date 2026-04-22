import type { ReactNode } from "react";
import type { BrandIconCatalogEntry } from "./constants";
import { LUCIDE_BRAND_ICON_FILL, PICKER_MASK_THUMB_STYLE } from "./constants";

export function brandIconPickerThumbnail(
  entry: BrandIconCatalogEntry,
  simpleHexById: Record<string, string>,
): ReactNode {
  const maskUrl = `url("${entry.href.replace(/"/g, "%22")}")`;
  if (entry.pack === "simpleicons") {
    const hex = simpleHexById[entry.id];
    if (hex) {
      return (
        <span
          className="block h-8 w-8 shrink-0"
          style={{
            backgroundColor: hex,
            WebkitMaskImage: maskUrl,
            maskImage: maskUrl,
            ...PICKER_MASK_THUMB_STYLE,
          }}
          aria-hidden
        />
      );
    }
  }
  if (entry.pack === "lucide") {
    return (
      <span
        className="block h-8 w-8 shrink-0"
        style={{
          backgroundColor: LUCIDE_BRAND_ICON_FILL,
          WebkitMaskImage: maskUrl,
          maskImage: maskUrl,
          ...PICKER_MASK_THUMB_STYLE,
        }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={entry.href}
      alt=""
      className="h-8 w-8 object-contain"
      loading="lazy"
      decoding="async"
    />
  );
}
