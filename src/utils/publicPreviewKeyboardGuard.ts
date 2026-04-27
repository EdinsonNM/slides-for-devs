/**
 * Cuando la vista previa pública (mazo de solo lectura) está activa, el listener
 * global de teclado del editor no debe mezclar flechas/escape con el mazo de la sesión.
 * `PreviewOverlay` registra la propia navegación y fija el guard.
 */
let publicPreviewKeyboardActive = false;

export function setPublicPreviewKeyboardActive(v: boolean): void {
  publicPreviewKeyboardActive = v;
}

export function isPublicPreviewKeyboardActive(): boolean {
  return publicPreviewKeyboardActive;
}
