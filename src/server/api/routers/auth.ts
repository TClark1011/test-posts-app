import { TRPCError } from "@trpc/server";
import { env } from "~/env.mjs";
import { userSignInFormSchema, userSignUpFormSchema } from "~/schemas";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { sendConfirmationEmail, sendSignInEmail } from "~/auth/email";
import {
  composeTokenLink,
  getEmailVerificationTokenForUserWithId,
} from "~/auth/token";
import { isWithinExpiration } from "lucia/utils";
import { type EmailVerificationClaim } from "@prisma/client";
import isFuture from "date-fns/isFuture";

const emailClaimIsValid = (claim: EmailVerificationClaim) =>
  isFuture(claim.expires);

export const authRouter = createTRPCRouter({
  signUp: publicProcedure
    .input(userSignUpFormSchema)
    .mutation(async ({ ctx, input }) => {
      const existingUser = await ctx.db.user.findUnique({
        where: {
          email: input.email,
        },
        include: {
          email_verification_claims: true,
        },
      });

      const userHasAlreadySignedUp =
        !!existingUser && existingUser.email_verified;

      const weAreWaitingForUserToVerifyEmail =
        !!existingUser &&
        existingUser.email_verification_claims.some(emailClaimIsValid);

      if (userHasAlreadySignedUp || weAreWaitingForUserToVerifyEmail) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      return ctx.db.$transaction(async (transactionalDb) => {
        const now = new Date();
        if (!!existingUser) {
          await transactionalDb.emailVerificationClaim.deleteMany({
            where: {
              user_id: existingUser.id,
              expires: {
                gte: now,
              },
            },
          });
        }

        const user =
          existingUser ??
          (await transactionalDb.user.create({
            data: input,
          }));

        const newToken = await getEmailVerificationTokenForUserWithId(
          user.id,
          transactionalDb,
        );
        const verificationLink = `${env.URL}/auth/verify?token=${newToken}`;

        await sendConfirmationEmail({
          to: user.email,
          verificationLink,
          username: user.username,
        });

        return "ok";
      });
    }),

  resendSignUpEmail: publicProcedure
    .input(userSignUpFormSchema)
    .mutation(async ({ input, ctx }) => {
      const fullUser = await ctx.db.user.findUnique({
        where: {
          email: input.email,
        },
        select: {
          email_verified: true,
          username: true,
          id: true,
        },
      });

      if (!fullUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
        });
      }

      const userVerificationClaims =
        await ctx.db.emailVerificationClaim.findMany({
          where: {
            user_id: fullUser.id,
          },
        });

      const validClaim = userVerificationClaims.find((claim) => {
        const tokenExpiresAtMs = claim.expires.getTime();
        const tokenHasExpired = !isWithinExpiration(tokenExpiresAtMs);
        return !tokenHasExpired;
      });

      if (fullUser.email_verified || !validClaim) {
        throw new TRPCError({
          code: "BAD_REQUEST",
        });
      }

      await sendConfirmationEmail({
        to: input.email,
        verificationLink: composeTokenLink(validClaim.token),
        username: fullUser.username,
      });

      return "ok";
    }),

  signIn: publicProcedure
    .input(userSignInFormSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: {
          email: input.email,
        },
        select: {
          email: true,
          id: true,
          username: true,
          email_verified: true,
        },
      });

      if (!user || !user.email_verified) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const newToken = await getEmailVerificationTokenForUserWithId(user.id);
      const signInLink = `${env.URL}/auth/verify?token=${newToken}`;

      await sendSignInEmail({
        to: user.email,
        signInLink,
        username: user.username,
      });

      return {
        status: "ok",
      };
    }),
});
