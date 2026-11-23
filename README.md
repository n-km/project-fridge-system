# PFS – Project Fridge System

Behalte den Überblick, was in welchem Kühlschrank und Tiefkühler liegt – und was bald weg muss.

- **Mehrere Kühlgeräte** (Kühlschrank / Tiefkühler) mit Standort und frei benennbaren Fächern
- **Artikel einlegen** mit Vorlage, Foto (Handykamera), Fach, genauem Platz, Menge, Einlege- bzw. Einfrierdatum und MHD
- **Vorlagen** mit Standard-Haltbarkeit je Gerätetyp – das MHD wird automatisch vorgeschlagen
- **Haltbarkeits-Ampel** (frisch / bald fällig / abgelaufen) und Liste „Muss bald weg“
- **Entnehmen** mit Grund (verbraucht, weggeworfen, verschenkt, sonstiges) und **Teilentnahme** – mit „Rückgängig“
- **Archiv**: nichts wird beim Entnehmen gelöscht; zurücklegen oder dort endgültig löschen
- **Statistik**: Bestand, Entnahmen pro Monat, Wegwerfquote, was am häufigsten weggeworfen wird
- **Haushalte** mit mehreren Mitgliedern per Einladungscode
- Responsiv für Handy, Tablet und Desktop, als App installierbar (PWA-Manifest)

## Schnellstart mit Docker

```bash
cp .env.example .env        # Passwort anpassen
docker compose up -d --build
```

Dann <http://localhost:3000> öffnen und ein Konto anlegen. Beim ersten Start werden die Datenbanktabellen und 30 Standard-Vorlagen automatisch angelegt.

Läuft auf jedem Linux-Server, NAS oder Raspberry Pi (arm64) mit Docker.
Hinter HTTPS (z. B. Caddy, Traefik, Nginx Proxy Manager) bitte `COOKIE_SECURE=true` setzen.

**Daten sichern:** Datenbank (`docker compose exec db pg_dump -U pfs pfs > backup.sql`) und das Volume `uploads` (Fotos).

## Entwicklung

Voraussetzungen: Node.js 22+, PostgreSQL 16 (oder `docker compose -f docker-compose.dev.yml up -d`).

```bash
npm install
cp .env.example .env
npm run dev                 # Backend :3000 + Frontend :5173 (mit Hot Reload)
```

Frontend: <http://localhost:5173> – API-Aufrufe werden an das Backend weitergeleitet.
Zum Testen von Handy aus im selben WLAN: `http://<IP-des-PCs>:5173`.

Beispieldaten anlegen (Login danach `demo@pfs.local` / `demo1234`):

```bash
npx tsx server/scripts/demo-data.ts
```

### Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Backend und Frontend im Entwicklungsmodus |
| `npm test` | API-Tests gegen echte Postgres (`TEST_DATABASE_URL`, Standard `…/pfs_test` – wird zurückgesetzt!) |
| `npm run typecheck` | TypeScript prüfen |
| `npm run build` | Produktions-Build |
| `npm run db:generate` | nach Änderungen an `server/src/db/schema.ts` eine neue Migration erzeugen |

## Aufbau

```
server/                     Node.js + Fastify + Drizzle ORM (TypeScript)
  src/db/schema.ts          Datenbankschema – hier neue Tabellen/Spalten ergänzen
  drizzle/                  SQL-Migrationen (werden beim Start automatisch ausgeführt)
  src/routes/               API: auth, appliances, items, presets, stats
  src/photos.ts             Foto-Upload: verkleinern, Vorschaubild, EXIF/GPS entfernen
  src/categories.ts         Kategorien, Einheiten, Entnahmegründe
  src/api.test.ts           Integrationstests
web/                        React + Vite + Tailwind (TypeScript)
  src/pages/                Übersicht, Gerät, Archiv, Statistik, Einstellungen, Login
  src/components/           Einlegen, Artikeldetails, Kühlgerät-Tür, Layout
  src/api.ts                API-Client und Daten-Hooks
```

### Datenmodell

```
Haushalt ─┬─ Benutzer ── Sessions
          ├─ Kühlgerät (Name, Standort, Typ) ── Fach
          ├─ Artikel (Gerät, Fach, Vorlage, Menge, eingelegt, MHD, Foto,
          │           status: active|archived, Entnahmegrund, entnommen am)
          ├─ Vorlage (eigene; globale Vorlagen haben keinen Haushalt)
          └─ Foto
```

### API (Auszug)

| Methode | Pfad | |
|---|---|---|
| `POST` | `/api/auth/register` · `/login` · `/logout` | Konto / Session (Cookie) |
| `GET` | `/api/appliances` | Geräte inkl. Fächer und Zähler |
| `GET` | `/api/items?status=&applianceId=&expiry=soon\|expired\|due&q=` | Artikel filtern |
| `POST` | `/api/items` | Einlegen (MHD-Vorschlag aus Vorlage) |
| `POST` | `/api/items/:id/remove` | Entnehmen `{ reason, quantity? }` |
| `POST` | `/api/items/:id/restore` | Aus dem Archiv zurücklegen |
| `DELETE` | `/api/items/:id` | Endgültig löschen (nur aus dem Archiv) |
| `POST` | `/api/photos` | Foto hochladen (multipart) |
| `GET` | `/api/stats` | Statistik |

### Erweitern – Beispiel: neues Feld „Besitzer“

1. Spalte in `server/src/db/schema.ts` ergänzen → `npm run db:generate`
2. Feld in `server/src/routes/items.ts` (zod-Schema + `itemColumns`) aufnehmen
3. Typ in `web/src/types.ts` und Formular in `web/src/components/AddItemSheet.tsx` ergänzen
4. Test in `server/src/api.test.ts` schreiben

## Ideen für später

- Push-Benachrichtigungen bei bald fälligen Artikeln (Service Worker + Web Push)
- Barcode-Scan mit Open Food Facts
- QR-Etiketten für Gefrierdosen
- MHD per Texterkennung vom Foto lesen
- Einkaufsliste und Rezeptideen aus bald fälligen Artikeln
- Mehrsprachigkeit (Texte stehen aktuell direkt auf Deutsch in den Komponenten)
- Dunkles Design
