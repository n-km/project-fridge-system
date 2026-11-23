/**
 * Integrationstests gegen eine echte PostgreSQL-Datenbank.
 * TEST_DATABASE_URL zeigt auf eine leere Test-DB (wird zurückgesetzt!).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "pfs-test-"));
process.env.UPLOAD_DIR = uploadDir;

const { buildApp } = await import("./app.js");
const { createDb, runMigrations } = await import("./db/index.js");
const { seedGlobalPresets } = await import("./db/seed.js");
const { addDays, today } = await import("./dates.js");

const url = process.env.TEST_DATABASE_URL ?? "postgres://pfs:pfs@localhost:5432/pfs_test";
const { db, client } = createDb(url);
let app: Awaited<ReturnType<typeof buildApp>>;

type Res = { statusCode: number; json: () => any; headers: Record<string, unknown> };

/** Kleiner Client, der das Session-Cookie mitführt. */
function agent() {
  let cookie = "";
  const call = async (method: string, url: string, payload?: unknown): Promise<Res> => {
    const res = await app.inject({
      method: method as "GET",
      url,
      payload: payload as object,
      headers: cookie ? { cookie } : {},
    });
    const set = res.headers["set-cookie"];
    if (set) cookie = String(Array.isArray(set) ? set[0] : set).split(";")[0]!;
    return res as unknown as Res;
  };
  return {
    get: (u: string) => call("GET", u),
    post: (u: string, b?: unknown) => call("POST", u, b ?? {}),
    patch: (u: string, b: unknown) => call("PATCH", u, b),
    del: (u: string) => call("DELETE", u),
    get cookie() {
      return cookie;
    },
  };
}

beforeAll(async () => {
  await db.execute(sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`);
  await runMigrations(db);
  await seedGlobalPresets(db);
  app = await buildApp(db);
});

afterAll(async () => {
  await app.close();
  await client.end();
  await fs.rm(uploadDir, { recursive: true, force: true });
});

describe("PFS API", () => {
  const alice = agent();
  const bob = agent(); // anderer Haushalt
  let fridgeId = "";
  let freezerId = "";
  let compartmentId = "";

  it("registriert Benutzer und liefert /me", async () => {
    let r = await alice.post("/api/auth/register", {
      email: "Alice@Example.org",
      password: "geheim123",
      displayName: "Alice",
      householdName: "WG Sonnenweg",
    });
    expect(r.statusCode).toBe(201);
    r = await alice.get("/api/auth/me");
    expect(r.json().household.name).toBe("WG Sonnenweg");
    expect(r.json().user.email).toBe("alice@example.org");

    r = await bob.post("/api/auth/register", { email: "bob@example.org", password: "geheim123", displayName: "Bob" });
    expect(r.statusCode).toBe(201);
  });

  it("lehnt falsches Passwort und fehlende Session ab", async () => {
    const x = agent();
    expect((await x.post("/api/auth/login", { email: "alice@example.org", password: "falsch!!" })).statusCode).toBe(401);
    expect((await x.get("/api/appliances")).statusCode).toBe(401);
    expect((await x.post("/api/auth/login", { email: "alice@example.org", password: "geheim123" })).statusCode).toBe(200);
    expect((await x.get("/api/appliances")).statusCode).toBe(200);
  });

  it("Beitritt per Einladungscode", async () => {
    const code = (await alice.get("/api/auth/me")).json().household.inviteCode;
    const carol = agent();
    const r = await carol.post("/api/auth/register", { email: "carol@example.org", password: "geheim123", displayName: "Carol", inviteCode: code.toLowerCase() });
    expect(r.statusCode).toBe(201);
    const members = (await alice.get("/api/household/members")).json();
    expect(members.map((m: any) => m.displayName)).toEqual(["Alice", "Carol"]);
  });

  it("legt Kühlgeräte mit Standard-Fächern an", async () => {
    let r = await alice.post("/api/appliances", { name: "Küche", location: "Küche", type: "fridge" });
    expect(r.statusCode).toBe(201);
    fridgeId = r.json().id;
    r = await alice.post("/api/appliances", { name: "Truhe", location: "Keller", type: "freezer" });
    freezerId = r.json().id;
    const list = (await alice.get("/api/appliances")).json();
    expect(list).toHaveLength(2);
    expect(list[0].compartments.map((c: any) => c.name)).toContain("Gemüsefach");
    compartmentId = list.find((a: any) => a.id === fridgeId).compartments[0].id;
    // Fremder Haushalt sieht nichts
    expect((await bob.get("/api/appliances")).json()).toHaveLength(0);
    expect((await bob.get(`/api/appliances/${fridgeId}`)).statusCode).toBe(404);
  });

  it("schlägt MHD aus Preset je nach Gerätetyp vor", async () => {
    const presets = (await alice.get("/api/presets?q=hack")).json();
    expect(presets[0].name).toBe("Hackfleisch");
    const hack = presets[0];

    let r = await alice.post("/api/items", { applianceId: fridgeId, compartmentId, presetId: hack.id });
    expect(r.statusCode).toBe(201);
    expect(r.json().bestBefore).toBe(addDays(today(), 1));
    expect(r.json().quantity).toBe(500);
    expect(r.json().compartmentName).toBe("Oberes Fach");

    r = await alice.post("/api/items", { applianceId: freezerId, presetId: hack.id });
    expect(r.json().bestBefore).toBe(addDays(today(), 90));

    // explizit kein MHD
    r = await alice.post("/api/items", { applianceId: fridgeId, presetId: hack.id, bestBefore: null });
    expect(r.json().bestBefore).toBeNull();
  });

  it("verhindert fremde Fächer und fehlenden Namen", async () => {
    const other = (await bob.post("/api/appliances", { name: "Bobs", type: "fridge" })).json();
    const r = await alice.post("/api/items", { applianceId: fridgeId, compartmentId: other.id, name: "X", category: "other" });
    expect(r.statusCode).toBe(404);
    expect((await alice.post("/api/items", { applianceId: fridgeId })).statusCode).toBe(400);
  });

  it("filtert abgelaufene und bald fällige Artikel", async () => {
    await alice.post("/api/items", { applianceId: fridgeId, name: "Alter Joghurt", category: "dairy", bestBefore: addDays(today(), -2) });
    const expired = (await alice.get("/api/items?expiry=expired")).json();
    expect(expired.map((i: any) => i.name)).toEqual(["Alter Joghurt"]);
    const due = (await alice.get("/api/items?expiry=due")).json();
    expect(due.length).toBe(2); // Joghurt + Hack im Kühlschrank (1 Tag)
    const stats = (await alice.get("/api/stats")).json();
    expect(stats.totals.expired).toBe(1);
    expect(stats.totals.expiringSoon).toBe(1);
  });

  it("Teilentnahme + Rückgängig (Merge)", async () => {
    const item = (await alice.post("/api/items", { applianceId: fridgeId, name: "Milch", category: "dairy", quantity: 3, unit: "l" })).json();
    let r = await alice.post(`/api/items/${item.id}/remove`, { reason: "consumed", quantity: 1 });
    expect(r.json()).toMatchObject({ partial: true, remainingQuantity: 2 });
    const archivedId = r.json().archivedId;
    expect((await alice.get(`/api/items/${item.id}`)).json().quantity).toBe(2);
    expect((await alice.get(`/api/items/${archivedId}`)).json()).toMatchObject({ status: "archived", quantity: 1 });

    r = await alice.post(`/api/items/${archivedId}/restore`, { mergeIntoId: item.id });
    expect(r.json().quantity).toBe(3);
    expect((await alice.get(`/api/items/${archivedId}`)).statusCode).toBe(404);
  });

  it("Entnehmen → Archiv → Wiederherstellen → endgültig löschen", async () => {
    const item = (await alice.post("/api/items", { applianceId: fridgeId, compartmentId, name: "Käse", category: "cheese" })).json();
    // Löschen aktiver Artikel nicht erlaubt
    expect((await alice.del(`/api/items/${item.id}`)).statusCode).toBe(409);

    await alice.post(`/api/items/${item.id}/remove`, { reason: "discarded" });
    expect((await alice.post(`/api/items/${item.id}/remove`, {})).statusCode).toBe(409);
    let archive = (await alice.get("/api/items?status=archived")).json();
    expect(archive.find((i: any) => i.id === item.id).removalReason).toBe("discarded");

    let r = await alice.post(`/api/items/${item.id}/restore`);
    expect(r.json()).toMatchObject({ status: "active", compartmentId, removalReason: null });

    await alice.post(`/api/items/${item.id}/remove`, { reason: "discarded" });
    expect((await alice.del(`/api/items/${item.id}`)).statusCode).toBe(200);
    archive = (await alice.get("/api/items?status=archived")).json();
    expect(archive.find((i: any) => i.id === item.id)).toBeUndefined();

    // Statistik: 1 weggeworfen, 1 verbraucht → Quote 50 %
    const [yog] = (await alice.get("/api/items?q=Joghurt")).json();
    await alice.post(`/api/items/${yog.id}/remove`, { reason: "discarded" });
    const milk = (await alice.get("/api/items?q=Milch")).json()[0];
    await alice.post(`/api/items/${milk.id}/remove`, { reason: "consumed" });
    const stats = (await alice.get("/api/stats")).json();
    expect(stats.waste90d).toEqual({ total: 2, discarded: 1, rate: 0.5 });
    expect(stats.topDiscarded[0].name).toBe("Alter Joghurt");
    const month = stats.removalsByMonth.at(-1);
    expect(month).toMatchObject({ discarded: 1, consumed: 1 });
  });

  it("Gerät mit Inhalt kann nicht gelöscht werden; Wiederherstellen braucht dann neues Gerät", async () => {
    expect((await alice.del(`/api/appliances/${freezerId}`)).statusCode).toBe(409);
    const items = (await alice.get(`/api/items?applianceId=${freezerId}`)).json();
    for (const i of items) await alice.post(`/api/items/${i.id}/remove`, { reason: "consumed" });
    expect((await alice.del(`/api/appliances/${freezerId}`)).statusCode).toBe(200);
    let r = await alice.post(`/api/items/${items[0].id}/restore`);
    expect(r.statusCode).toBe(400);
    r = await alice.post(`/api/items/${items[0].id}/restore`, { applianceId: fridgeId });
    expect(r.json()).toMatchObject({ status: "active", applianceId: fridgeId, compartmentId: null });
  });

  it("Foto hochladen: verkleinert, EXIF entfernt, nur eigener Haushalt", async () => {
    const big = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#4a8" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "geheim" } } })
      .toBuffer();
    const boundary = "----pfs";
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      big,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({
      method: "POST",
      url: "/api/photos",
      payload,
      headers: { cookie: alice.cookie, "content-type": `multipart/form-data; boundary=${boundary}` },
    });
    expect(res.statusCode).toBe(201);
    const photoId = res.json().id;

    const full = await app.inject({ method: "GET", url: `/api/photos/${photoId}`, headers: { cookie: alice.cookie } });
    expect(full.headers["content-type"]).toBe("image/webp");
    const meta = await sharp(full.rawPayload).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1200);
    expect(meta.exif).toBeUndefined();

    const thumb = await app.inject({ method: "GET", url: `/api/photos/${photoId}?size=thumb`, headers: { cookie: alice.cookie } });
    expect((await sharp(thumb.rawPayload).metadata()).width).toBe(320);

    expect((await bob.get(`/api/photos/${photoId}`)).statusCode).toBe(404);

    // Foto an Artikel, Artikel löschen → Foto weg
    const item = (await alice.post("/api/items", { applianceId: fridgeId, name: "Bolognese", category: "leftovers", photoId })).json();
    expect((await bob.post("/api/items", { applianceId: fridgeId, name: "x", category: "other", photoId })).statusCode).toBe(404);
    await alice.post(`/api/items/${item.id}/remove`, {});
    await alice.del(`/api/items/${item.id}`);
    expect((await alice.get(`/api/photos/${photoId}`)).statusCode).toBe(404);
    const files = await fs.readdir(uploadDir, { recursive: true });
    expect(files.filter((f) => String(f).endsWith(".webp"))).toHaveLength(0);
  });

  it("eigene Presets; globale sind schreibgeschützt", async () => {
    let r = await alice.post("/api/presets", { name: "Omas Gulasch", category: "leftovers", icon: "🍲", shelfLifeFridgeDays: 3, shelfLifeFreezerDays: 120 });
    expect(r.statusCode).toBe(201);
    expect((await bob.get("/api/presets?q=Gulasch")).json()).toHaveLength(0);
    const global = (await alice.get("/api/presets?q=Milch")).json()[0];
    expect(global.global).toBe(true);
    expect((await alice.patch(`/api/presets/${global.id}`, { name: "x" })).statusCode).toBe(403);
  });

  it("blockiert schreibende Anfragen von fremdem Origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/appliances",
      payload: { name: "evil", type: "fridge" },
      headers: { cookie: alice.cookie, origin: "https://evil.example", host: "pfs.local" },
    });
    expect(res.statusCode).toBe(403);
  });
});
