import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  hashPassword,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from "../auth.js";
import { config } from "../config.js";
import type { Db } from "../db/index.js";
import { households, users } from "../db/schema.js";
import { HttpError } from "../http.js";

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O/1/I
export function newInviteCode() {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

const registerBody = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, "Mindestens 8 Zeichen").max(200),
  displayName: z.string().trim().min(1).max(60),
  householdName: z.string().trim().min(1).max(80).optional(),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

const loginBody = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
});

async function householdInfo(db: Db, householdId: string) {
  const [h] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId));
  return h;
}

export async function authRoutes(app: FastifyInstance, db: Db) {
  app.post("/api/auth/register", async (req, reply) => {
    const body = registerBody.parse(req.body);

    const [exists] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email));
    if (exists) throw new HttpError(409, "Diese E-Mail ist bereits registriert");

    let householdId: string;
    if (body.inviteCode) {
      const [h] = await db
        .select({ id: households.id })
        .from(households)
        .where(eq(households.inviteCode, body.inviteCode));
      if (!h) throw new HttpError(400, "Einladungscode ungültig");
      householdId = h.id;
    } else {
      if (!config.allowRegistration)
        throw new HttpError(403, "Neue Haushalte sind deaktiviert – bitte Einladungscode nutzen");
      const [h] = await db
        .insert(households)
        .values({
          name: body.householdName ?? `Haushalt von ${body.displayName}`,
          inviteCode: newInviteCode(),
        })
        .returning({ id: households.id });
      householdId = h!.id;
    }

    const [user] = await db
      .insert(users)
      .values({
        email: body.email,
        displayName: body.displayName,
        passwordHash: await hashPassword(body.password),
        householdId,
      })
      .returning({ id: users.id });

    const s = await createSession(db, user!.id);
    setSessionCookie(reply, s.token, s.expiresAt);
    return reply.status(201).send({ ok: true });
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = loginBody.parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, body.email));
    // Immer hashen, damit die Antwortzeit nicht verrät, ob die E-Mail existiert
    const ok = user
      ? await verifyPassword(body.password, user.passwordHash)
      : (await hashPassword(body.password), false);
    if (!user || !ok) throw new HttpError(401, "E-Mail oder Passwort falsch");
    const s = await createSession(db, user.id);
    setSessionCookie(reply, s.token, s.expiresAt);
    return { ok: true };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await deleteSession(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req) => {
    const user = requireUser(req);
    const h = await householdInfo(db, user.householdId);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName },
      household: { id: h!.id, name: h!.name, inviteCode: h!.inviteCode },
    };
  });

  app.get("/api/household/members", async (req) => {
    const user = requireUser(req);
    return db
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.householdId, user.householdId))
      .orderBy(users.displayName);
  });

  app.patch("/api/household", async (req) => {
    const user = requireUser(req);
    const body = z.object({ name: z.string().trim().min(1).max(80) }).parse(req.body);
    await db
      .update(households)
      .set({ name: body.name })
      .where(eq(households.id, user.householdId));
    return { ok: true };
  });

  app.post("/api/household/invite-code", async (req) => {
    const user = requireUser(req);
    const inviteCode = newInviteCode();
    await db
      .update(households)
      .set({ inviteCode })
      .where(eq(households.id, user.householdId));
    return { inviteCode };
  });
}
