/**
 * Legt einen Demo-Haushalt mit Beispieldaten über die API an.
 *   npx tsx server/scripts/demo-data.ts [http://localhost:3000]
 * Login danach: demo@pfs.local / demo1234
 */
const base = process.argv[2] ?? "http://localhost:3000";
let cookie = "";

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0]!;
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const iso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

try {
  await call("POST", "/api/auth/register", {
    email: "demo@pfs.local",
    password: "demo1234",
    displayName: "Alex",
    householdName: "WG Sonnenweg",
  });
} catch {
  await call("POST", "/api/auth/login", { email: "demo@pfs.local", password: "demo1234" });
}

const kitchen = await call("POST", "/api/appliances", { name: "Küche", location: "Erdgeschoss", type: "fridge" });
const drinks = await call("POST", "/api/appliances", { name: "Getränke", location: "Abstellraum", type: "fridge", compartments: ["Oben", "Unten"] });
const chest = await call("POST", "/api/appliances", { name: "Truhe", location: "Keller", type: "freezer" });

const presets: any[] = await call("GET", "/api/presets");
const p = (name: string) => presets.find((x) => x.name === name)?.id;
const kc = (await call("GET", `/api/appliances/${kitchen.id}`)).compartments;
const cc = (await call("GET", `/api/appliances/${chest.id}`)).compartments;
const dc = (await call("GET", `/api/appliances/${drinks.id}`)).compartments;

const add = (b: any) => call("POST", "/api/items", b);

await add({ applianceId: kitchen.id, compartmentId: kc[0].id, presetId: p("Milch"), quantity: 2, storedAt: ago(2), bestBefore: iso(3) });
await add({ applianceId: kitchen.id, compartmentId: kc[0].id, presetId: p("Joghurt"), storedAt: ago(9), bestBefore: iso(-1) });
await add({ applianceId: kitchen.id, compartmentId: kc[1].id, presetId: p("Käse (Scheiben)"), storedAt: ago(4), bestBefore: iso(10) });
await add({ applianceId: kitchen.id, compartmentId: kc[1].id, presetId: p("Hackfleisch"), storedAt: ago(0), position: "hinten links" });
await add({ applianceId: kitchen.id, compartmentId: kc[1].id, presetId: p("Reste vom Essen"), name: "Curry von Sonntag", storedAt: ago(2), note: "Für Mittwoch" });
await add({ applianceId: kitchen.id, compartmentId: kc[3].id, presetId: p("Paprika"), storedAt: ago(3) });
await add({ applianceId: kitchen.id, compartmentId: kc[3].id, presetId: p("Karotten"), storedAt: ago(6) });
await add({ applianceId: kitchen.id, compartmentId: kc[4].id, presetId: p("Eier"), quantity: 6, storedAt: ago(5) });
await add({ applianceId: kitchen.id, compartmentId: kc[4].id, presetId: p("Senf / Ketchup"), name: "Senf", storedAt: ago(40), bestBefore: null });
await add({ applianceId: drinks.id, compartmentId: dc[0].id, presetId: p("Saft"), name: "Orangensaft", quantity: 3, storedAt: ago(1) });
await add({ applianceId: drinks.id, compartmentId: dc[1].id, name: "Mineralwasser", category: "drinks", icon: "💧", quantity: 6, unit: "Flaschen" });
await add({ applianceId: chest.id, compartmentId: cc[0].id, presetId: p("Bolognese"), quantity: 2, storedAt: ago(20), position: "blaue Dosen" });
await add({ applianceId: chest.id, compartmentId: cc[0].id, presetId: p("Erbsen (TK)"), storedAt: ago(60) });
await add({ applianceId: chest.id, compartmentId: cc[1].id, presetId: p("Pizza (TK)"), quantity: 3, storedAt: ago(14) });
await add({ applianceId: chest.id, compartmentId: cc[1].id, presetId: p("Hähnchenbrust"), storedAt: ago(170), bestBefore: iso(2) });
await add({ applianceId: chest.id, compartmentId: cc[2].id, presetId: p("Speiseeis"), name: "Vanilleeis", storedAt: ago(30) });
await add({ applianceId: chest.id, compartmentId: cc[2].id, presetId: p("Brot"), name: "Roggenbrot (halbes)", storedAt: ago(8) });

// Ein paar Entnahmen für die Statistik
for (const [name, reason] of [
  ["Salat", "discarded"], ["Sahne", "consumed"], ["Mozzarella", "consumed"], ["Beeren", "discarded"],
  ["Quark", "consumed"], ["Brötchen", "given_away"], ["Lachs", "consumed"],
] as const) {
  const it = await add({ applianceId: kitchen.id, presetId: p(name) });
  await call("POST", `/api/items/${it.id}/remove`, { reason });
}
console.log("Demo-Daten angelegt. Login: demo@pfs.local / demo1234");
