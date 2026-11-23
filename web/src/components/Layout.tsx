import { Archive, BarChart3, Home, Plus, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useMe } from "../api";
import { useUi } from "../ui";
import { AddItemSheet } from "./AddItemSheet";
import { Toasts } from "./common";
import { ItemSheet } from "./ItemSheet";

const NAV = [
  { to: "/", label: "Übersicht", Icon: Home, end: true },
  { to: "/archiv", label: "Archiv", Icon: Archive },
  { to: "/statistik", label: "Statistik", Icon: BarChart3 },
  { to: "/einstellungen", label: "Einstellungen", Icon: Settings },
];

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <img src="/icon.svg" alt="" className="size-9" />
      <span className="text-lg font-semibold tracking-tight">PFS</span>
    </span>
  );
}

export function Layout() {
  const me = useMe();
  const { openAdd } = useUi();

  return (
    <div className="min-h-dvh md:flex">
      {/* Seitenleiste ab Tablet */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-5 md:flex">
        <div>
          <Logo />
          <p className="mt-1 truncate pl-11 text-sm text-ink-soft">{me.data?.household.name}</p>
        </div>
        <button className="btn-primary w-full" onClick={() => openAdd()}>
          <Plus className="size-5" /> Einlegen
        </button>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  isActive ? "bg-steel-tint font-medium text-steel-dark" : "text-ink-soft hover:bg-frost hover:text-ink"
                }`
              }
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Kopfzeile auf dem Handy */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-frost/90 px-4 py-2 backdrop-blur md:hidden">
        <Logo />
        <span className="truncate pl-4 text-sm text-ink-soft">{me.data?.household.name}</span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
        <Outlet />
      </main>

      {/* Untere Navigation auf dem Handy */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Hauptnavigation">
        {NAV.slice(0, 2).map((n) => (
          <TabLink key={n.to} {...n} />
        ))}
        <div className="flex justify-center">
          <button
            onClick={() => openAdd()}
            className="-mt-6 mb-1 grid size-16 place-items-center rounded-full bg-steel text-on-steel shadow-lg ring-4 ring-frost transition-transform hover:scale-105 active:scale-95"
            aria-label="Artikel einlegen"
          >
            <Plus className="size-8" />
          </button>
        </div>
        {NAV.slice(2).map((n) => (
          <TabLink key={n.to} {...n} />
        ))}
      </nav>

      <AddItemSheet />
      <ItemSheet />
      <Toasts />
    </div>
  );
}

function TabLink({ to, label, Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors active:scale-95 ${isActive ? "text-steel" : "text-ink-soft hover:text-ink"}`}
    >
      {({ isActive }) => (
        <>
          <Icon className="size-6" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
          {label === "Einstellungen" ? "Mehr" : label}
        </>
      )}
    </NavLink>
  );
}
