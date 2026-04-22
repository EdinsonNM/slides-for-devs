import { useLayoutEffect, useRef } from "react";
import type { MutableRefObject } from "react";

/**
 * `ref.current` apunta siempre al último `value` tras el layout del commit
 * (equivalente a asignar en render, sin efecto colateral durante el render).
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
