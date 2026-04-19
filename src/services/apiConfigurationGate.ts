/** Permite que la app (App.tsx) registre un aviso cuando falta API y el usuario intenta generar. */

type ApiConfigurationRequiredListener = () => void;

let listener: ApiConfigurationRequiredListener | null = null;

export function registerApiConfigurationRequiredListener(
  fn: ApiConfigurationRequiredListener | null,
): void {
  listener = fn;
}

export function notifyApiConfigurationRequired(): void {
  listener?.();
}
