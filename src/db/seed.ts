import { db } from "./client";
import { activityCategories } from "./schema/activityCategories";

async function seed() {
  await db
    .insert(activityCategories)
    .values([
      { id: "psec", label: "PSEC", defaultAgeMin: null, defaultAgeMax: 11, sortOrder: 1 },
      { id: "jysep", label: "JYSEP", defaultAgeMin: 12, defaultAgeMax: null, sortOrder: 2 },
      { id: "sc", label: "Study Circles", defaultAgeMin: null, defaultAgeMax: null, sortOrder: 3 },
      { id: "camp", label: "Camp", defaultAgeMin: null, defaultAgeMax: null, sortOrder: 4 },
    ])
    .onConflictDoNothing();
  console.log("Seeded activity_categories");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
