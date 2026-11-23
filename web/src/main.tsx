import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ApiError, queryClient, useMe, useUserSettings } from "./api";
import { Spinner } from "./components/common";
import { Layout } from "./components/Layout";
import "./index.css";
import { ApplianceView } from "./pages/ApplianceView";
import { Archive } from "./pages/Archive";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Settings } from "./pages/Settings";
import { Stats } from "./pages/Stats";
import { UiProvider } from "./ui";

/** Setzt Design, Dichte und Bewegung als Attribute auf <html> (CSS reagiert darauf). */
function ThemeApplier() {
  const settings = useUserSettings();
  const theme = settings.data?.theme ?? readStoredTheme();
  const density = settings.data?.density ?? "comfortable";
  const motion = settings.data?.motion ?? "auto";

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "auto" && mq.matches);
      root.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#11181b" : "#2D6A88");
    };
    apply();
    try {
      localStorage.setItem("pfs:theme", theme);
    } catch {
      /* egal */
    }
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.motion = motion;
  }, [density, motion]);

  return null;
}

/** Letztes Design merken, damit die Seite beim Laden nicht hell aufblitzt. */
function readStoredTheme(): "auto" | "light" | "dark" {
  try {
    const v = localStorage.getItem("pfs:theme");
    if (v === "light" || v === "dark") return v;
  } catch {
    /* egal */
  }
  return "auto";
}

function App() {
  const me = useMe();
  if (me.isLoading) return <Spinner />;
  if (me.error instanceof ApiError && me.error.status === 401) return <Login />;
  if (me.error)
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Server nicht erreichbar.</p>
        <button className="btn-primary" onClick={() => me.refetch()}>
          Erneut versuchen
        </button>
      </div>
    );

  return (
    <>
      <ThemeApplier />
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="geraet/:id" element={<ApplianceView />} />
        <Route path="archiv" element={<Archive />} />
        <Route path="statistik" element={<Stats />} />
        <Route path="einstellungen" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
      </Routes>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UiProvider>
          <App />
        </UiProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
