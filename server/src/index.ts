import fs from "node:fs/promises";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { createDb, runMigrations } from "./db/index.js";
import { seedGlobalPresets } from "./db/seed.js";
import { cleanupOrphanPhotos } from "./photos.js";

const { db, client } = createDb(config.databaseUrl);

await fs.mkdir(config.uploadDir, { recursive: true });
await runMigrations(db);
const seeded = await seedGlobalPresets(db);

const app = await buildApp(db, { logger: true });
if (seeded) app.log.info(`${seeded} Standard-Presets angelegt`);

// Verwaiste Fotos regelmäßig aufräumen
const cleanup = () =>
  cleanupOrphanPhotos(db)
    .then((n) => n && app.log.info(`${n} verwaiste Fotos gelöscht`))
    .catch((e) => app.log.error(e));
void cleanup();
const timer = setInterval(cleanup, 6 * 3_600_000);

await app.listen({ port: config.port, host: config.host });

const shutdown = async () => {
  clearInterval(timer);
  await app.close();
  await client.end();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
