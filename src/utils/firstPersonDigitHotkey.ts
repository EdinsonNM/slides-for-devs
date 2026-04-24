import type { FirstPersonLayout } from "../constants/firstPersonLayout";

const DIGIT_KEY_CODE_TO_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Digit7: 6,
  Digit8: 7,
  Digit9: 8,
  Digit0: 9,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad7: 6,
  Numpad8: 7,
  Numpad9: 8,
  Numpad0: 9,
};

/**
 * Mapea `e.code` (fila de números o teclado numérico) al índice en `firstPersonKeyOrder` (0 = tecla 1).
 * @returns `undefined` si no es un dígito de cambio de vista.
 */
export function firstPersonLayoutForDigitKey(
  code: string,
  keyOrder: FirstPersonLayout[],
): FirstPersonLayout | undefined {
  const idx = DIGIT_KEY_CODE_TO_INDEX[code];
  if (idx === undefined) return;
  return keyOrder[idx];
}
