import { useEffect, useState } from "react";

/** Tailwind `lg` breakpoint (1024px). */
export function useMinWidthLg() {
  const query = "(min-width: 1024px)";
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return matches;
}
