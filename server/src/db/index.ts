import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(url: string) {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Db = ReturnType<typeof createDb>["db"];

const here = path.dirname(fileURLToPath(import.meta.url));
/** Funktioniert aus src/ (tsx) und dist/ (kompiliert). */
export const migrationsFolder = path.resolve(here, "../../drizzle");

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
}
