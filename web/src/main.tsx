import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ApiError, queryClient, useMe } from "./api";
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
