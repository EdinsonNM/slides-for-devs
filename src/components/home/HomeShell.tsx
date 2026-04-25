import {
  Bookmark,
  Home,
  MessageCircle,
  MoreHorizontal,
  Settings,
  User,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { MOCK_FOLLOWED_ACCOUNTS } from "./homeFollowedMock";
import type { HomeMainTab } from "./homeMainTab";

export interface HomeShellProps {
  activeTab: HomeMainTab;
  onTabChange: (tab: HomeMainTab) => void;
  onOpenConfig?: () => void;
  children: React.ReactNode;
}

const railBtnClass =
  "flex h-11 w-11 items-center justify-center rounded-2xl text-stone-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/60 dark:text-stone-400 dark:hover:bg-emerald-500/12 dark:hover:text-emerald-300";

const railBtnActiveClass =
  "bg-linear-to-br from-emerald-300/55 to-green-300/45 text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ring-1 ring-emerald-500/45 hover:from-emerald-300/65 dark:from-emerald-500/30 dark:to-green-500/20 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:ring-emerald-500/50 dark:hover:from-emerald-500/40";

export function HomeShell({
  activeTab,
  onTabChange,
  onOpenConfig,
  children,
}: HomeShellProps) {
  const visibleFollowedAccounts = MOCK_FOLLOWED_ACCOUNTS.slice(0, 5);
  const hasMoreFollowedAccounts = MOCK_FOLLOWED_ACCOUNTS.length > 5;

  return (
    <div className="flex h-dvh min-h-0 w-full min-w-0 overflow-hidden bg-stone-100 text-stone-900 dark:bg-[#0a0a0c] dark:text-stone-100">
      <aside
        className="flex w-[72px] shrink-0 flex-col border-r border-stone-200/80 bg-stone-50/95 py-3 dark:border-white/5 dark:bg-stone-950/95"
        aria-label="Navegación principal"
      >
        <div className="mb-2 flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200 dark:bg-white/5 dark:ring-white/10">
            <img
              src="./logo.png"
              alt="Slaim"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              draggable={false}
            />
          </div>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-1.5 px-2 pt-1">
          <button
            type="button"
            onClick={() => onTabChange("inicio")}
            className={cn(
              railBtnClass,
              activeTab === "inicio" && railBtnActiveClass,
            )}
            title="Inicio — presentaciones públicas (vista previa)"
            aria-current={activeTab === "inicio" ? "page" : undefined}
            aria-pressed={activeTab === "inicio"}
          >
            <Home className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => onTabChange("proyectos")}
            className={cn(
              railBtnClass,
              activeTab === "proyectos" && railBtnActiveClass,
            )}
            title="Mis proyectos"
            aria-current={activeTab === "proyectos" ? "page" : undefined}
            aria-pressed={activeTab === "proyectos"}
          >
            <Bookmark className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>

          <div
            className="my-1.5 h-px w-8 shrink-0 self-center bg-stone-300/80 dark:bg-white/10"
            role="separator"
            aria-hidden
          />
          <div
            className="flex w-full flex-col items-center gap-1.5 px-1"
            role="list"
            aria-label="Cuentas que sigues (demostración)"
            title="Cuentas que sigues (demostración)"
          >
            {visibleFollowedAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                role="listitem"
                title={acc.name}
                aria-label={acc.name}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-300/80 bg-stone-100 text-xs font-semibold text-stone-700 ring-1 ring-stone-200 transition hover:border-stone-400 hover:bg-stone-200 dark:border-white/12 dark:bg-white/6 dark:text-stone-200 dark:ring-white/10 dark:hover:border-white/25 dark:hover:bg-white/10"
              >
                {acc.initials}
              </button>
            ))}
            {hasMoreFollowedAccounts ? (
              <button
                type="button"
                disabled
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-500 ring-1 ring-stone-300 dark:ring-white/10"
                aria-label="Hay más cuentas seguidas"
                title="Hay más cuentas seguidas"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="min-h-2 flex-1" aria-hidden />

          <button
            type="button"
            disabled
            className={cn(railBtnClass, "cursor-not-allowed opacity-40")}
            title="Mensajes (próximamente)"
            aria-disabled
          >
            <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            disabled
            className={cn(railBtnClass, "cursor-not-allowed opacity-40")}
            title="Perfil (próximamente)"
            aria-disabled
          >
            <User className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
        </nav>

        <div className="flex justify-center px-2 pb-1">
          <button
            type="button"
            onClick={onOpenConfig}
            disabled={!onOpenConfig}
            className={cn(
              railBtnClass,
              "text-stone-500 hover:text-emerald-700 dark:hover:text-emerald-300",
              !onOpenConfig && "cursor-not-allowed opacity-40",
            )}
            title="Ajustes de IA e integración"
            aria-label="Ajustes de IA e integración"
          >
            <Settings className="h-[22px] w-[22px]" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
