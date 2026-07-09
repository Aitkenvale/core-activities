import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { allowedSignups } from "@/db/schema/allowedSignups";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "facilitator",
        input: false,
      },
    },
  },
  plugins: [
    passkey({
      rpName: "Aitkenvale Program Tracker",
      registration: {
        requireSession: false,
        // Who's allowed to sign up (and whether they land as admin or
        // facilitator) is admin-editable at Settings > Users rather than a
        // Vercel env var — see allowed_signups.
        resolveUser: async ({ ctx, context }) => {
          if (!context) {
            throw new Error("Missing sign-up details.");
          }
          const { name, email } = JSON.parse(context) as { name: string; email: string };
          const normalizedEmail = email.trim().toLowerCase();

          const existing = await ctx.context.internalAdapter.findUserByEmail(normalizedEmail);
          if (existing) {
            return { id: existing.user.id, name: existing.user.name };
          }

          const invite = await db.query.allowedSignups.findFirst({ where: eq(allowedSignups.email, normalizedEmail) });
          if (!invite) {
            throw new Error("This email is not authorized to create an account. Contact an admin.");
          }

          const created = await ctx.context.internalAdapter.createUser({
            email: normalizedEmail,
            name,
            emailVerified: false,
            role: invite.isAdmin ? "admin" : "facilitator",
          });
          // Consumed — they now appear in the real Users list with an
          // editable role, so leaving this row around would just be a
          // second, stale-looking listing of the same person.
          await db.delete(allowedSignups).where(eq(allowedSignups.id, invite.id));
          return { id: created.id, name: created.name };
        },
      },
    }),
    nextCookies(),
  ],
});
