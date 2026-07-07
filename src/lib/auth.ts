import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { db } from "@/db/client";

function parseEmailList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Anyone on this list may create an account at all (facilitators + admins).
const SIGNUP_ALLOWED_EMAILS = parseEmailList(process.env.SIGNUP_ALLOWED_EMAILS);
// Subset of the above that gets the admin role; everyone else defaults to facilitator.
const ADMIN_EMAILS = parseEmailList(process.env.ADMIN_EMAILS);

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
        resolveUser: async ({ ctx, context }) => {
          if (!context) {
            throw new Error("Missing sign-up details.");
          }
          const { name, email } = JSON.parse(context) as { name: string; email: string };
          const normalizedEmail = email.trim().toLowerCase();

          if (!SIGNUP_ALLOWED_EMAILS.includes(normalizedEmail)) {
            throw new Error("This email is not authorized to create an account. Contact an admin.");
          }

          const existing = await ctx.context.internalAdapter.findUserByEmail(normalizedEmail);
          if (existing) {
            return { id: existing.user.id, name: existing.user.name };
          }

          const created = await ctx.context.internalAdapter.createUser({
            email: normalizedEmail,
            name,
            emailVerified: false,
            role: ADMIN_EMAILS.includes(normalizedEmail) ? "admin" : "facilitator",
          });
          return { id: created.id, name: created.name };
        },
      },
    }),
    nextCookies(),
  ],
});
