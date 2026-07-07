import { pgTable, uuid, text } from "drizzle-orm/pg-core";
import { people } from "./people";

export const guardianRelationships = pgTable("guardian_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  childPersonId: uuid("child_person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  guardianPersonId: uuid("guardian_person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  relationshipLabel: text("relationship_label"),
});
