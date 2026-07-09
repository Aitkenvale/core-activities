import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Pre-authorization list for passkey sign-up (Settings > Users) — replaces
// the old SIGNUP_ALLOWED_EMAILS/ADMIN_EMAILS env vars, so admins can invite
// people without asking for a redeploy. A row here is consumed (deleted)
// the moment that email actually signs up, since they then appear in the
// real `user` table with an editable role instead of staying listed twice.
export const allowedSignups = pgTable("allowed_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
