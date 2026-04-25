/** Cuentas seguidas (mock) para la barra lateral hasta existir el backend. */
export interface MockFollowedAccount {
  id: string;
  name: string;
  initials: string;
  /** Clases de gradiente Tailwind para el avatar */
  gradient: string;
}

export const MOCK_FOLLOWED_ACCOUNTS: MockFollowedAccount[] = [
  { id: "f1", name: "María V.", initials: "M", gradient: "from-emerald-500 to-green-600" },
  { id: "f2", name: "devops.paula", initials: "P", gradient: "from-teal-500 to-emerald-700" },
  { id: "f3", name: "Samuel", initials: "S", gradient: "from-lime-500 to-emerald-600" },
  { id: "f4", name: "Aula 42", initials: "A", gradient: "from-green-400 to-teal-700" },
  { id: "f5", name: "Lin", initials: "L", gradient: "from-emerald-500 to-cyan-700" },
  { id: "f6", name: "Mika Studio", initials: "K", gradient: "from-teal-500 to-green-700" },
];
