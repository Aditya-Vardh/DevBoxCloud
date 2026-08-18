import { COOKIE_NAME } from "@shared/const";
import {
  createAuditLog,
  getUserByOpenId,
  updateUserName,
  upsertUser,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { isLocalAuthRequest } from "./_core/localAuth";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { adminRouter } from "./routers/admin";
import { environmentRouter } from "./routers/environments";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    loginMode: publicProcedure.query(({ ctx }) => ({
      mode: isLocalAuthRequest(ctx.req)
        ? ("local" as const)
        : ("manus" as const),
      hostedOAuthConfigured: Boolean(
        ENV.oAuthServerUrl && ENV.oAuthPortalUrl && ENV.appId
      ),
    })),
    localLogin: publicProcedure.mutation(async ({ ctx }) => {
      if (!isLocalAuthRequest(ctx.req)) {
        throw new Error(
          "Local authentication is available only on localhost development servers."
        );
      }
      const openId = "local:operator";
      await upsertUser({
        openId,
        name: ENV.localAuthName,
        loginMethod: "local-development",
        lastSignedIn: new Date(),
      });
      const user = await getUserByOpenId(openId);
      if (!user)
        throw new Error("Unable to create the local development user.");
      const session = await sdk.createSessionToken(openId, {
        name: user.name ?? ENV.localAuthName,
      });
      ctx.res.cookie(COOKIE_NAME, session, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
      await createAuditLog({
        userId: user.id,
        action: "login.local",
        resourceType: "user",
        resourceId: String(user.id),
      });
      return { user };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.user) {
        await createAuditLog({
          userId: ctx.user.id,
          action: "logout",
          resourceType: "user",
          resourceId: String(ctx.user.id),
        }).catch(() => undefined);
      }
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  profile: router({
    updateName: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(96) }))
      .mutation(async ({ ctx, input }) => {
        await updateUserName(ctx.user.id, input.name);
        await createAuditLog({
          userId: ctx.user.id,
          action: "profile.updated",
          resourceType: "user",
          resourceId: String(ctx.user.id),
        });
        return { name: input.name };
      }),
  }),
  environment: environmentRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
