import { desc } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, environments } from "../../drizzle/schema";
import { getDb } from "../db";
import { kubernetesProvider } from "../kubernetes";
import { adminProcedure, router } from "../_core/trpc";

export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable.");
    const [environmentRows, audits, kubernetes] = await Promise.all([
      db.select({ status: environments.status }).from(environments),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(20),
      kubernetesProvider.health(),
    ]);
    const summary = environmentRows.reduce(
      (total, environment) => ({
        ...total,
        total: total.total + 1,
        [environment.status]: total[environment.status] + 1,
      }),
      {
        total: 0,
        provisioning: 0,
        running: 0,
        stopped: 0,
        deleted: 0,
        failed: 0,
      }
    );
    return { summary, audits, kubernetes };
  }),

  setUserRole: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async () => {
      throw new Error(
        "Role changes are not exposed in this deployment. Use the database administration interface with an approved change record."
      );
    }),
});
