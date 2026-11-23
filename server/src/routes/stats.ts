import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth.js";
import { APPLIANCE_TEMPLATES, CATEGORIES, COMPARTMENT_KINDS, REMOVAL_REASONS, UNITS } from "../categories.js";
import { config } from "../config.js";
import { addDays, today } from "../dates.js";
import type { Db } from "../db/index.js";
import { items } from "../db/schema.js";
import { getHouseholdSettings } from "../settings.js";

export async function statsRoutes(app: FastifyInstance, db: Db) {
  /** Stammdaten für das Frontend. */
  app.get("/api/meta", async () => ({
    version: config.version,
    categories: CATEGORIES,
    units: UNITS,
    removalReasons: REMOVAL_REASONS,
    expiringSoonDays: config.expiringSoonDays,
    allowRegistration: config.allowRegistration,
    compartmentKinds: COMPARTMENT_KINDS,
    applianceTemplates: APPLIANCE_TEMPLATES,
  }));

  app.get("/api/stats", async (req) => {
    const user = requireUser(req);
    const hh = eq(items.householdId, user.householdId);
    const t = today();
    const { expiringSoonDays } = await getHouseholdSettings(db, user.householdId);
    const soon = addDays(t, expiringSoonDays);

    const [totals] = await db
      .select({
        active: sql<number>`count(*) filter (where ${items.status} = 'active')::int`,
        expired: sql<number>`count(*) filter (where ${items.status} = 'active' and ${items.bestBefore} < ${t})::int`,
        expiringSoon: sql<number>`count(*) filter (where ${items.status} = 'active' and ${items.bestBefore} >= ${t} and ${items.bestBefore} <= ${soon})::int`,
        archived: sql<number>`count(*) filter (where ${items.status} = 'archived')::int`,
      })
      .from(items)
      .where(hh);

    const byCategory = await db
      .select({ category: items.category, count: sql<number>`count(*)::int` })
      .from(items)
      .where(and(hh, eq(items.status, "active")))
      .groupBy(items.category)
      .orderBy(desc(sql`count(*)`));

    // Entnahmen der letzten 6 Monate nach Grund
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const monthExpr = sql<string>`to_char(date_trunc('month', ${items.removedAt} at time zone ${config.timeZone}), 'YYYY-MM')`;
    const removalRows = await db
      .select({
        month: monthExpr,
        reason: items.removalReason,
        count: sql<number>`count(*)::int`,
      })
      .from(items)
      .where(and(hh, eq(items.status, "archived"), gte(items.removedAt, sixMonthsAgo)))
      // nach Spaltenposition gruppieren – der Zeitzonen-Parameter würde sonst
      // als zweiter, „anderer“ Ausdruck gelten
      .groupBy(sql`1`, items.removalReason);

    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(d.toLocaleDateString("sv-SE", { timeZone: config.timeZone }).slice(0, 7));
    }
    const removalsByMonth = months.map((month) => {
      const entry: Record<string, number | string> = { month };
      for (const r of REMOVAL_REASONS) entry[r.id] = 0;
      for (const row of removalRows.filter((r) => r.month === month))
        entry[row.reason ?? "other"] = row.count;
      return entry;
    });

    const topDiscarded = await db
      .select({ name: items.name, icon: items.icon, count: sql<number>`count(*)::int` })
      .from(items)
      .where(and(hh, eq(items.status, "archived"), eq(items.removalReason, "discarded")))
      .groupBy(items.name, items.icon)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Wegwerfquote der letzten 90 Tage
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
    const [waste] = await db
      .select({
        total: sql<number>`count(*)::int`,
        discarded: sql<number>`count(*) filter (where ${items.removalReason} = 'discarded')::int`,
      })
      .from(items)
      .where(and(hh, eq(items.status, "archived"), gte(items.removedAt, ninetyDaysAgo)));

    return {
      totals,
      byCategory,
      removalsByMonth,
      topDiscarded,
      waste90d: {
        total: waste?.total ?? 0,
        discarded: waste?.discarded ?? 0,
        rate: waste && waste.total > 0 ? waste.discarded / waste.total : null,
      },
    };
  });
}
