import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const environmentTemplates = mysqlTable(
  "environment_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 96 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    description: text("description").notNull(),
    runtime: mysqlEnum("runtime", [
      "node",
      "python",
      "go",
      "ubuntu",
      "java",
    ]).notNull(),
    image: varchar("image", { length: 255 }).notNull(),
    defaultCpu: varchar("defaultCpu", { length: 24 }).notNull(),
    maxCpu: varchar("maxCpu", { length: 24 }).notNull(),
    defaultMemory: varchar("defaultMemory", { length: 24 }).notNull(),
    maxMemory: varchar("maxMemory", { length: 24 }).notNull(),
    defaultStorage: varchar("defaultStorage", { length: 24 }).notNull(),
    maxStorage: varchar("maxStorage", { length: 24 }).notNull(),
    allowedPorts: json("allowedPorts").$type<number[]>().notNull(),
    configurationSchema: json("configurationSchema")
      .$type<Record<string, unknown>>()
      .notNull(),
    active: mysqlEnum("active", ["true", "false"]).default("true").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("environment_templates_slug_unique").on(table.slug)]
);

export const environments = mysqlTable(
  "environments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 64 }).notNull(),
    description: varchar("description", { length: 512 }),
    templateId: int("templateId")
      .notNull()
      .references(() => environmentTemplates.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", [
      "provisioning",
      "running",
      "stopped",
      "deleted",
      "failed",
    ])
      .default("provisioning")
      .notNull(),
    runtime: mysqlEnum("runtime", [
      "node",
      "python",
      "go",
      "ubuntu",
      "java",
    ]).notNull(),
    cpuLimit: varchar("cpuLimit", { length: 24 }).notNull(),
    memoryLimit: varchar("memoryLimit", { length: 24 }).notNull(),
    storageLimit: varchar("storageLimit", { length: 24 }).notNull(),
    port: int("port").notNull(),
    repositoryUrl: varchar("repositoryUrl", { length: 2048 }),
    branch: varchar("branch", { length: 255 }),
    namespace: varchar("namespace", { length: 63 }).notNull(),
    deploymentName: varchar("deploymentName", { length: 63 }).notNull(),
    serviceName: varchar("serviceName", { length: 63 }).notNull(),
    persistentVolumeClaimName: varchar("persistentVolumeClaimName", {
      length: 63,
    }).notNull(),
    accessUrl: varchar("accessUrl", { length: 2048 }),
    failureReason: varchar("failureReason", { length: 1024 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    startedAt: timestamp("startedAt"),
    stoppedAt: timestamp("stoppedAt"),
    deletedAt: timestamp("deletedAt"),
  },
  table => [
    uniqueIndex("environments_user_name_unique").on(table.userId, table.name),
    index("environments_user_status_idx").on(table.userId, table.status),
    index("environments_template_idx").on(table.templateId),
  ]
);

export const environmentEvents = mysqlTable(
  "environment_events",
  {
    id: int("id").autoincrement().primaryKey(),
    environmentId: int("environmentId")
      .notNull()
      .references(() => environments.id, { onDelete: "cascade" }),
    eventType: mysqlEnum("eventType", [
      "created",
      "started",
      "stopped",
      "restarted",
      "deleted",
      "error",
      "status_changed",
    ]).notNull(),
    status: mysqlEnum("status", [
      "provisioning",
      "running",
      "stopped",
      "deleted",
      "failed",
    ]).notNull(),
    message: varchar("message", { length: 1024 }).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("environment_events_environment_created_idx").on(
      table.environmentId,
      table.createdAt
    ),
  ]
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 96 }).notNull(),
    resourceType: varchar("resourceType", { length: 64 }).notNull(),
    resourceId: varchar("resourceId", { length: 96 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_logs_user_created_idx").on(table.userId, table.createdAt),
    index("audit_logs_resource_created_idx").on(
      table.resourceType,
      table.resourceId,
      table.createdAt
    ),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type EnvironmentTemplate = typeof environmentTemplates.$inferSelect;
export type InsertEnvironmentTemplate =
  typeof environmentTemplates.$inferInsert;
export type Environment = typeof environments.$inferSelect;
export type InsertEnvironment = typeof environments.$inferInsert;
export type EnvironmentEvent = typeof environmentEvents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
