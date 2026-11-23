import { QueryClient, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Appliance, Category, HouseholdSettings, Item, Me, Meta, Preset, Stats, UserSettings } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Fehler ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error ?? msg;
      if (data.details?.length) msg += `: ${data.details.map((d: { message: string }) => d.message).join(", ")}`;
    } catch {
      /* keine JSON-Antwort */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

/** Nach Änderungen an Artikeln alles Abhängige neu laden. */
export const invalidateInventory = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["items"] }),
    queryClient.invalidateQueries({ queryKey: ["item"] }),
    queryClient.invalidateQueries({ queryKey: ["appliances"] }),
    queryClient.invalidateQueries({ queryKey: ["stats"] }),
  ]);

/* ---------------- Hooks ---------------- */

export const useMe = () =>
  useQuery({ queryKey: ["me"], queryFn: () => api.get<Me>("/api/auth/me"), retry: false });

export const useMeta = () =>
  useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/api/meta"), staleTime: Infinity });

export const useAppliances = () =>
  useQuery({ queryKey: ["appliances"], queryFn: () => api.get<Appliance[]>("/api/appliances") });

export const usePresets = () =>
  useQuery({ queryKey: ["presets"], queryFn: () => api.get<Preset[]>("/api/presets") });

export const useItems = (params: Record<string, string | undefined>) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => !!e[1]),
  ).toString();
  return useQuery({
    queryKey: ["items", qs],
    queryFn: () => api.get<Item[]>(`/api/items?${qs}`),
  });
};

export const useItem = (id: string | undefined) =>
  useQuery({
    queryKey: ["item", id],
    queryFn: () => api.get<Item>(`/api/items/${id}`),
    enabled: !!id,
  });

export const useStats = () =>
  useQuery({ queryKey: ["stats"], queryFn: () => api.get<Stats>("/api/stats") });

export const photoUrl = (id: string, size: "thumb" | "full" = "thumb") =>
  `/api/photos/${id}?size=${size}`;

/**
 * Verkleinert ein Foto im Browser vor dem Hochladen (spart mobile Daten),
 * der Server verkleinert und bereinigt es zusätzlich.
 */
export async function uploadPhoto(file: File): Promise<string> {
  let blob: Blob = file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
    );
  } catch {
    /* Fallback: Original hochladen */
  }
  const form = new FormData();
  form.append("file", blob, "foto.jpg");
  const { id } = await api.post<{ id: string }>("/api/photos", form);
  return id;
}

/* ---------------- Einstellungen ---------------- */

export const useUserSettings = () =>
  useQuery({ queryKey: ["settings", "me"], queryFn: () => api.get<UserSettings>("/api/settings/me"), staleTime: 60_000 });

export const useHouseholdSettings = () =>
  useQuery({
    queryKey: ["settings", "household"],
    queryFn: () => api.get<HouseholdSettings>("/api/settings/household"),
    staleTime: 60_000,
  });

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

/** Speichert Benutzereinstellungen sofort sichtbar (optimistisch) und dann auf dem Server. */
export async function saveUserSettings(patch: DeepPartial<UserSettings>) {
  const key = ["settings", "me"];
  const prev = queryClient.getQueryData<UserSettings>(key);
  if (prev) {
    const next = { ...prev, ...patch, extended: { ...prev.extended, ...(patch.extended ?? {}) } } as UserSettings;
    queryClient.setQueryData(key, next);
  }
  try {
    const saved = await api.patch<UserSettings>("/api/settings/me", patch);
    queryClient.setQueryData(key, saved);
    return saved;
  } catch (e) {
    if (prev) queryClient.setQueryData(key, prev);
    throw e;
  }
}

export async function saveHouseholdSettings(patch: Partial<HouseholdSettings>) {
  const saved = await api.patch<HouseholdSettings>("/api/settings/household", patch);
  queryClient.setQueryData(["settings", "household"], saved);
  await queryClient.invalidateQueries({ queryKey: ["stats"] });
  await queryClient.invalidateQueries({ queryKey: ["appliances"] });
  return saved;
}

/**
 * Alle Kategorien des Haushalts: Standardkategorien (mit eigenen Symbolen/Farben,
 * ohne ausgeblendete) plus eigene Kategorien.
 */
export function useCategories(opts: { includeHidden?: boolean } = {}) {
  const meta = useMeta();
  const hs = useHouseholdSettings();
  return useMemo<Category[]>(() => {
    const s = hs.data;
    const base = (meta.data?.categories ?? [])
      .filter((c) => opts.includeHidden || !s?.hiddenCategories.includes(c.id))
      .map((c) => ({ ...c, ...(s?.categoryOverrides[c.id] ?? {}) }));
    const custom = (s?.customCategories ?? []).map((c) => ({ ...c, custom: true }));
    // "Sonstiges" immer ans Ende
    const other = base.filter((c) => c.id === "other");
    return [...base.filter((c) => c.id !== "other"), ...custom, ...other];
  }, [meta.data, hs.data, opts.includeHidden]);
}

/** Einheiten: Standard + eigene. */
export function useUnits() {
  const meta = useMeta();
  const hs = useHouseholdSettings();
  return useMemo(() => [...(meta.data?.units ?? []), ...(hs.data?.extraUnits ?? [])], [meta.data, hs.data]);
}

/** Schwelle für „bald fällig“ (Haushaltseinstellung). */
export function useSoonDays() {
  const hs = useHouseholdSettings();
  const meta = useMeta();
  return hs.data?.expiringSoonDays ?? meta.data?.expiringSoonDays ?? 3;
}

/* ---------------- Platzieren ---------------- */

export type Placement = { compartmentId: string; gridX: number; gridY: number; gridW: number; gridH: number };

export async function placeItem(id: string, p: Placement | { unplace: true }) {
  const item = await api.patch<Item>(`/api/items/${id}/placement`, p);
  await invalidateInventory();
  return item;
}
