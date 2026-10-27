import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  environments,
  environmentTemplates,
  invitationRedemptions,
  invitations,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
  return db;
}

export const inviteRouter = router({
  // ── Create an invitation link ────────────────────────────────────────────
  create: protectedProcedure
    .input(
      z.object({
        environmentId: z.number().int().positive(),
        expiresInHours: z.number().int().min(1).max(168).optional(), // max 1 week
        maxUses: z.number().int().min(1).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      // Verify the requester owns this environment
      const env = await db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.id, input.environmentId),
            ctx.user.role === "admin"
              ? undefined
              : eq(environments.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!env[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Environment not found." });
      }

      const code = nanoid(20);
      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 3_600_000)
        : null;

      await db.insert(invitations).values({
        code,
        environmentId: input.environmentId,
        ownerUserId: ctx.user.id,
        maxUses: input.maxUses ?? null,
        expiresAt,
      });

      return {
        code,
        url: `/invite/${code}`,
        expiresAt,
      };
    }),

  // ── List invitations for an environment ──────────────────────────────────
  list: protectedProcedure
    .input(z.object({ environmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();

      // Verify ownership
      const env = await db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.id, input.environmentId),
            ctx.user.role === "admin"
              ? undefined
              : eq(environments.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!env[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Environment not found." });

      const rows = await db
        .select()
        .from(invitations)
        .where(eq(invitations.environmentId, input.environmentId))
        .orderBy(desc(invitations.createdAt))
        .limit(50);

      return rows;
    }),

  // ── Revoke an invitation ─────────────────────────────────────────────────
  revoke: protectedProcedure
    .input(z.object({ invitationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      const row = await db
        .select({ ownerUserId: invitations.ownerUserId })
        .from(invitations)
        .where(eq(invitations.id, input.invitationId))
        .limit(1);

      if (!row[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
      if (ctx.user.role !== "admin" && row[0].ownerUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized." });
      }

      await db
        .update(invitations)
        .set({ revoked: "true" })
        .where(eq(invitations.id, input.invitationId));

      return { revoked: true };
    }),

  // ── Get info about an invitation (public) ───────────────────────────────
  info: publicProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      const db = await requireDb();

      const rows = await db
        .select({
          invitation: invitations,
          environment: environments,
          template: environmentTemplates,
          owner: users,
        })
        .from(invitations)
        .innerJoin(environments, eq(invitations.environmentId, environments.id))
        .innerJoin(environmentTemplates, eq(environments.templateId, environmentTemplates.id))
        .innerJoin(users, eq(invitations.ownerUserId, users.id))
        .where(eq(invitations.code, input.code))
        .limit(1);

      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });

      const { invitation, environment, template, owner } = row;

      if (invitation.revoked === "true") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has been revoked." });
      }
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has expired." });
      }
      if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has reached its use limit." });
      }

      return {
        code: invitation.code,
        environmentId: environment.id,
        environmentName: environment.name,
        templateName: template.name,
        ownerName: owner.name,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses,
        useCount: invitation.useCount,
      };
    }),

  // ── Redeem an invitation ─────────────────────────────────────────────────
  redeem: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = await requireDb();

      // Re-validate
      const rows = await db
        .select({ invitation: invitations, environment: environments })
        .from(invitations)
        .innerJoin(environments, eq(invitations.environmentId, environments.id))
        .where(eq(invitations.code, input.code))
        .limit(1);

      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });

      const { invitation, environment } = row;

      if (invitation.revoked === "true") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has been revoked." });
      }
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has expired." });
      }
      if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has reached its use limit." });
      }

      // Owner doesn't need to redeem their own environment
      if (environment.userId === ctx.user.id) {
        return { environmentId: environment.id, alreadyOwner: true };
      }

      // Check if already redeemed
      const existing = await db
        .select()
        .from(invitationRedemptions)
        .where(
          and(
            eq(invitationRedemptions.invitationId, invitation.id),
            eq(invitationRedemptions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing[0]) {
        await db.insert(invitationRedemptions).values({
          invitationId: invitation.id,
          userId: ctx.user.id,
        });
        await db
          .update(invitations)
          .set({ useCount: invitation.useCount + 1 })
          .where(eq(invitations.id, invitation.id));
      }

      return { environmentId: environment.id, alreadyOwner: false };
    }),

  // ── List members (users who redeemed access) ─────────────────────────────
  members: protectedProcedure
    .input(z.object({ environmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await requireDb();

      // Verify ownership
      const env = await db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.id, input.environmentId),
            ctx.user.role === "admin"
              ? undefined
              : eq(environments.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!env[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Environment not found." });

      const rows = await db
        .select({
          user: users,
          redeemedAt: invitationRedemptions.redeemedAt,
        })
        .from(invitationRedemptions)
        .innerJoin(invitations, eq(invitationRedemptions.invitationId, invitations.id))
        .innerJoin(users, eq(invitationRedemptions.userId, users.id))
        .where(eq(invitations.environmentId, input.environmentId))
        .orderBy(desc(invitationRedemptions.redeemedAt));

      return rows.map(r => ({
        userId: r.user.id,
        name: r.user.name,
        email: r.user.email,
        redeemedAt: r.redeemedAt,
      }));
    }),
});
