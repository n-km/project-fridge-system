import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Globaler UI-Zustand: Sheets öffnen, Toasts anzeigen                 */
/* ------------------------------------------------------------------ */

export type Toast = {
  id: number;
  message: string;
  action?: { label: string; run: () => void | Promise<void> };
  tone?: "default" | "error";
};

export type ItemMode = "view" | "remove" | "edit";

type UiState = {
  addOpen: { applianceId?: string; compartmentId?: string } | null;
  openAdd: (ctx?: { applianceId?: string; compartmentId?: string }) => void;
  closeAdd: () => void;
  itemId: string | null;
  /** Welche Ansicht des Artikel-Sheets zuerst (z. B. nach Wischgeste). */
  itemMode: ItemMode;
  openItem: (id: string, mode?: ItemMode) => void;
  closeItem: () => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState<UiState["addOpen"]>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [itemMode, setItemMode] = useState<ItemMode>("view");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      // Mit Rückgängig-Knopf länger stehen lassen
      setTimeout(() => dismissToast(id), t.action ? 7000 : 3500);
    },
    [dismissToast],
  );

  return (
    <Ctx.Provider
      value={{
        addOpen,
        openAdd: (c) => setAddOpen(c ?? {}),
        closeAdd: () => setAddOpen(null),
        itemId,
        itemMode,
        openItem: (id, mode = "view") => {
          setItemMode(mode);
          setItemId(id);
        },
        closeItem: () => setItemId(null),
        toasts,
        toast,
        dismissToast,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useUi() {
  const v = useContext(Ctx);
  if (!v) throw new Error("UiProvider fehlt");
  return v;
}
