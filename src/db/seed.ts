import { sql } from "drizzle-orm";
import { db } from "./client";
import { activityCategories } from "./schema/activityCategories";
import { neighbourhoods } from "./schema/neighbourhoods";

async function seed() {
  await db
    .insert(activityCategories)
    .values([
      { id: "psec", label: "Children's Class", defaultAgeMin: null, defaultAgeMax: 11, sortOrder: 1, enabled: true },
      { id: "jysep", label: "Junior Youth Group", defaultAgeMin: 12, defaultAgeMax: null, sortOrder: 2, enabled: true },
      { id: "sc", label: "Study Circle", defaultAgeMin: null, defaultAgeMax: null, sortOrder: 3, enabled: true },
      { id: "camp", label: "Camp", defaultAgeMin: null, defaultAgeMax: null, sortOrder: 4, enabled: false },
    ])
    .onConflictDoUpdate({
      target: activityCategories.id,
      set: {
        label: sql`excluded.label`,
        defaultAgeMin: sql`excluded.default_age_min`,
        defaultAgeMax: sql`excluded.default_age_max`,
        sortOrder: sql`excluded.sort_order`,
        enabled: sql`excluded.enabled`,
      },
    });
  console.log("Seeded activity_categories");

  await db.insert(neighbourhoods).values([{ name: "Aitkenvale" }]).onConflictDoNothing();
  console.log("Seeded neighbourhoods");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
