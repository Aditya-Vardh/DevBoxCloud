import { and, desc, eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  auditLogs,
  environmentEvents,
  environments,
  environmentTemplates,
  type InsertEnvironment,
  type InsertUser,
  users,
} from "../drizzle/schema";
import type { EnvironmentStatus } from "../shared/cnad";
import { ENV } from "./_core/env";
import { builtinTemplateSeeds } from "./templates";

let database: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!database && process.env.DATABASE_URL) {
    database = drizzle(process.env.DATABASE_URL);
  }
  return database;
}

function requireDb<T>(db: T | null): T {
  if (!db) {
    throw new Error(
      "Database is unavailable. Configure DATABASE_URL before using CNAD32."
    );
  }
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert.");
  }

  const db = requireDb(await getDb());
  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
  };

  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn,
        ...(user.openId === ENV.ownerOpenId ? { role: "admin" } : {}),
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = requireDb(await getDb());
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function updateUserName(userId: number, name: string) {
  const db = requireDb(await getDb());
  await db.update(users).set({ name }).where(eq(users.id, userId));
}

export async function ensureBuiltinTemplates() {
  const db = requireDb(await getDb());
  for (const template of builtinTemplateSeeds) {
    await db
      .insert(environmentTemplates)
      .values(template)
      .onDuplicateKeyUpdate({
        set: {
          name: template.name,
          description: template.description,
          image: template.image,
          defaultCpu: template.defaultCpu,
          maxCpu: template.maxCpu,
          defaultMemory: template.defaultMemory,
          maxMemory: template.maxMemory,
          defaultStorage: template.defaultStorage,
          maxStorage: template.maxStorage,
          allowedPorts: template.allowedPorts,
          configurationSchema: template.configurationSchema,
          active: template.active,
        },
      });
  }
}

export async function listActiveTemplates() {
  const db = requireDb(await getDb());
  await ensureBuiltinTemplates();
  return db
    .select()
    .from(environmentTemplates)
    .where(eq(environmentTemplates.active, "true"))
    .orderBy(environmentTemplates.name);
}

export async function getActiveTemplateById(id: number) {
  const db = requireDb(await getDb());
  await ensureBuiltinTemplates();
  const results = await db
    .select()
    .from(environmentTemplates)
    .where(
      and(
        eq(environmentTemplates.id, id),
        eq(environmentTemplates.active, "true")
      )
    )
    .limit(1);
  return results[0];
}

export async function createEnvironmentRecord(values: InsertEnvironment) {
  const db = requireDb(await getDb());
  const result = await db.insert(environments).values(values);
  return Number(result[0].insertId);
}

export async function getEnvironmentByNameForUser(
  userId: number,
  name: string
) {
  const db = requireDb(await getDb());
  const rows = await db
    .select()
    .from(environments)
    .where(and(eq(environments.userId, userId), eq(environments.name, name)))
    .limit(1);
  return rows[0];
}

export async function getEnvironmentWithTemplate(environmentId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select({ environment: environments, template: environmentTemplates })
    .from(environments)
    .innerJoin(
      environmentTemplates,
      eq(environments.templateId, environmentTemplates.id)
    )
    .where(eq(environments.id, environmentId))
    .limit(1);
  return rows[0];
}

export async function getEnvironmentForUser(
  environmentId: number,
  userId: number
) {
  const db = requireDb(await getDb());
  const rows = await db
    .select({ environment: environments, template: environmentTemplates })
    .from(environments)
    .innerJoin(
      environmentTemplates,
      eq(environments.templateId, environmentTemplates.id)
    )
    .where(
      and(eq(environments.id, environmentId), eq(environments.userId, userId))
    )
    .limit(1);
  return rows[0];
}

export async function listEnvironmentsForUser(input: {
  userId: number;
  status?: EnvironmentStatus;
  runtime?: "node" | "python" | "go" | "ubuntu" | "java";
  query?: string;
  limit: number;
}) {
  const db = requireDb(await getDb());
  const conditions = [eq(environments.userId, input.userId)];
  if (input.status) conditions.push(eq(environments.status, input.status));
  if (input.runtime) conditions.push(eq(environments.runtime, input.runtime));
  if (input.query) conditions.push(like(environments.name, `%${input.query}%`));

  return db
    .select({ environment: environments, template: environmentTemplates })
    .from(environments)
    .innerJoin(
      environmentTemplates,
      eq(environments.templateId, environmentTemplates.id)
    )
    .where(and(...conditions))
    .orderBy(desc(environments.updatedAt))
    .limit(input.limit);
}

export async function setEnvironmentStatus(input: {
  environmentId: number;
  status: EnvironmentStatus;
  failureReason?: string | null;
  accessUrl?: string | null;
}) {
  const db = requireDb(await getDb());
  const now = new Date();
  const timestamps =
    input.status === "running"
      ? { startedAt: now, stoppedAt: null, deletedAt: null }
      : input.status === "stopped"
        ? { stoppedAt: now }
        : input.status === "deleted"
          ? { deletedAt: now, accessUrl: null }
          : {};
  await db
    .update(environments)
    .set({
      status: input.status,
      failureReason: input.failureReason ?? null,
      accessUrl: input.accessUrl ?? null,
      ...timestamps,
    })
    .where(eq(environments.id, input.environmentId));
}

export async function createEnvironmentEvent(input: {
  environmentId: number;
  eventType:
    | "created"
    | "started"
    | "stopped"
    | "restarted"
    | "deleted"
    | "error"
    | "status_changed";
  status: EnvironmentStatus;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const db = requireDb(await getDb());
  await db.insert(environmentEvents).values(input);
}

export async function listEnvironmentEvents(environmentId: number, limit = 50) {
  const db = requireDb(await getDb());
  return db
    .select()
    .from(environmentEvents)
    .where(eq(environmentEvents.environmentId, environmentId))
    .orderBy(desc(environmentEvents.createdAt))
    .limit(limit);
}

export async function createAuditLog(input: {
  userId?: number | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = requireDb(await getDb());
  await db.insert(auditLogs).values(input);
}

export async function getDashboardSummary(userId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select({ status: environments.status })
    .from(environments)
    .where(eq(environments.userId, userId));
  return rows.reduce(
    (summary, row) => ({
      ...summary,
      total: summary.total + 1,
      [row.status]: summary[row.status] + 1,
    }),
    { total: 0, provisioning: 0, running: 0, stopped: 0, deleted: 0, failed: 0 }
  );
}

export async function listRecentAuditActivity(userId: number, limit = 8) {
  const db = requireDb(await getDb());
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function listAuditLogsForResource(
  resourceType: string,
  resourceId: string,
  limit = 100
) {
  const db = requireDb(await getDb());
  return db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.resourceType, resourceType),
        eq(auditLogs.resourceId, resourceId)
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
