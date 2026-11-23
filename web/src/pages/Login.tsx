import { useState } from "react";
import { api, queryClient, useMeta } from "../api";
import { ErrorNote } from "../components/common";

export function Login() {
  const meta = useMeta();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [joining, setJoining] = useState(false);
  const [f, setF] = useState({ email: "", password: "", displayName: "", householdName: "", inviteCode: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await api.post("/api/auth/login", { email: f.email, password: f.password });
      } else {
        await api.post("/api/auth/register", {
          email: f.email,
          password: f.password,
          displayName: f.displayName,
          ...(joining ? { inviteCode: f.inviteCode } : { householdName: f.householdName || undefined }),
        });
      }
      // Alle Daten neu laden – useMe liefert jetzt den Benutzer
      await queryClient.resetQueries();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const canCreate = meta.data?.allowRegistration !== false;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-4 size-16" />
          <h1 className="text-2xl font-semibold">Project Fridge System</h1>
          <p className="mt-1 text-ink-soft">Was liegt wo – und was muss bald weg?</p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-frost-deep p-1" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-lg py-2 font-medium transition-colors ${mode === m ? "bg-surface shadow-sm" : "text-ink-soft"}`}
            >
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-surface p-5 shadow-sm">
          {mode === "register" && (
            <label className="block">
              <span className="field-label">Dein Name</span>
              <input className="input" required value={f.displayName} onChange={set("displayName")} autoComplete="given-name" />
            </label>
          )}
          <label className="block">
            <span className="field-label">E-Mail</span>
            <input className="input" type="email" required value={f.email} onChange={set("email")} autoComplete="email" />
          </label>
          <label className="block">
            <span className="field-label">Passwort</span>
            <input
              className="input"
              type="password"
              required
              minLength={mode === "register" ? 8 : 1}
              value={f.password}
              onChange={set("password")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            {mode === "register" && <span className="mt-1 block text-xs text-ink-soft">Mindestens 8 Zeichen</span>}
          </label>

          {mode === "register" && (
            <fieldset className="space-y-3 rounded-2xl bg-frost p-3">
              <legend className="sr-only">Haushalt</legend>
              {canCreate && (
                <div className="flex gap-2">
                  <button type="button" className="chip flex-1 justify-center" aria-pressed={!joining} onClick={() => setJoining(false)}>
                    Neuer Haushalt
                  </button>
                  <button type="button" className="chip flex-1 justify-center" aria-pressed={joining} onClick={() => setJoining(true)}>
                    Code einlösen
                  </button>
                </div>
              )}
              {joining || !canCreate ? (
                <label className="block">
                  <span className="field-label">Einladungscode</span>
                  <input className="input uppercase tracking-widest" required value={f.inviteCode} onChange={set("inviteCode")} placeholder="z. B. K7QM2XPA" />
                </label>
              ) : (
                <label className="block">
                  <span className="field-label">Name des Haushalts</span>
                  <input className="input" value={f.householdName} onChange={set("householdName")} placeholder="z. B. WG Sonnenweg" />
                </label>
              )}
            </fieldset>
          )}

          <ErrorNote error={error} />
          <button className="btn-primary w-full" disabled={busy}>
            {mode === "login" ? "Anmelden" : "Konto anlegen"}
          </button>
        </form>
      </div>
    </div>
  );
}
