import fs from "node:fs";
import path from "node:path";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { loadUser } from "./auth.js";
import { config } from "./config.js";
import type { Db } from "./db/index.js";
import { registerErrorHandler } from "./http.js";
import { photoRoutes } from "./photos.js";
import { applianceRoutes } from "./routes/appliances.js";
import { authRoutes } from "./routes/auth.js";
import { itemRoutes } from "./routes/items.js";
import { presetRoutes } from "./routes/presets.js";
import { statsRoutes } from "./routes/stats.js";
import { settingsRoutes } from "./settings.js";

export async function buildApp(db: Db, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, trustProxy: true });

  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 1 },
  });
  registerErrorHandler(app);

  // Benutzer aus Session-Cookie laden (für alle /api-Routen)
  app.addHook("preHandler", async (req) => {
    if (req.url.startsWith("/api/")) req.user = await loadUser(db, req);
  });

  // Einfacher CSRF-Schutz: schreibende API-Aufrufe müssen JSON/Multipart sein
  // und vom selben Origin kommen. Zusammen mit SameSite=Lax-Cookies ausreichend.
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/api/") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
    const origin = req.headers.origin;
    if (origin && req.headers.host && new URL(origin).host !== req.headers.host) {
      return reply.status(403).send({ error: "Fremder Ursprung nicht erlaubt" });
    }
  });

  app.get("/api/health", async () => ({ ok: true, version: config.version }));

  await authRoutes(app, db);
  await applianceRoutes(app, db);
  await presetRoutes(app, db);
  await itemRoutes(app, db);
  await photoRoutes(app, db);
  await statsRoutes(app, db);
  await settingsRoutes(app, db);

  // Gebautes Frontend ausliefern (Produktivbetrieb)
  if (config.webDist && fs.existsSync(config.webDist)) {
    await app.register(fastifyStatic, { root: config.webDist, wildcard: false });
    const indexHtml = fs.readFileSync(path.join(config.webDist, "index.html"));
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply.status(404).send({ error: "Route nicht gefunden" });
      }
      // Single-Page-App: alle anderen Pfade → index.html
      return reply.type("text/html").send(indexHtml);
    });
  }

  return app;
}
