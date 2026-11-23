import { AlertTriangle, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import type { Appliance } from "../types";
import { ApplianceIcon } from "./common";

/**
 * Ein Kühlgerät als Tür mit Griff und Klebeband-Etikett –
 * das wiedererkennbare Element der App.
 */
export function ApplianceDoor({ appliance }: { appliance: Appliance }) {
  const c = appliance.counts ?? { active: 0, expired: 0, expiringSoon: 0 };
  const freezer = appliance.type === "freezer";
  return (
    <Link
      to={`/geraet/${appliance.id}`}
      viewTransition
      className={`lift group relative flex aspect-[4/5] flex-col rounded-[28px] border-2 p-4 pr-8 ${
        freezer ? "border-ice-ink/15 bg-ice" : "border-steel/15 bg-steel-tint"
      }`}
      style={{
        // Tür „fliegt“ beim Öffnen in den Kopf der Geräteansicht
        viewTransitionName: `door-${appliance.id}`,
        ...(appliance.color
          ? { background: `color-mix(in oklab, ${appliance.color} 28%, var(--surface))`, borderColor: `color-mix(in oklab, ${appliance.color} 45%, transparent)` }
          : {}),
      }}
    >
      {/* Griff */}
      <span
        className={`absolute top-1/2 right-3 h-1/3 w-2 -translate-y-1/2 rounded-full transition-[background-color,height] duration-200 group-hover:h-[38%] ${
          freezer ? "bg-ice-ink/25 group-hover:bg-ice-ink/50" : "bg-steel/25 group-hover:bg-steel/50"
        }`}
        aria-hidden
      />
      <span className={`flex items-center gap-1.5 text-sm ${freezer ? "text-ice-ink" : "text-steel-dark"}`}>
        <ApplianceIcon type={appliance.type} className="size-4" />
        {freezer ? "Tiefkühler" : "Kühlschrank"}
      </span>

      <span className="mt-3">
        <span className="tape max-w-full truncate text-[1.65rem]">{appliance.name}</span>
      </span>
      {appliance.location && <span className="mt-1.5 truncate text-sm text-ink-soft">{appliance.location}</span>}

      <span className="mt-auto">
        <span className="block text-3xl font-semibold tabular-nums">{c.active}</span>
        <span className="block text-sm text-ink-soft">Artikel</span>
        {(c.expired > 0 || c.expiringSoon > 0) && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {c.expired > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-expired-tint px-2 py-0.5 text-xs font-medium text-expired">
                <AlertTriangle className="size-3" aria-hidden /> {c.expired} abgelaufen
              </span>
            )}
            {c.expiringSoon > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-soon-tint px-2 py-0.5 text-xs font-medium text-soon">
                <Clock className="size-3" aria-hidden /> {c.expiringSoon} bald fällig
              </span>
            )}
          </span>
        )}
      </span>
    </Link>
  );
}
