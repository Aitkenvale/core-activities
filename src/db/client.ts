import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as authSchema from "./schema/auth";
import * as households from "./schema/households";
import * as neighbourhoods from "./schema/neighbourhoods";
import * as people from "./schema/people";
import * as guardianRelationships from "./schema/guardianRelationships";
import * as activityCategories from "./schema/activityCategories";
import * as termDates from "./schema/termDates";
import * as activityInstances from "./schema/activityInstances";
import * as activityFacilitators from "./schema/activityFacilitators";
import * as activityEnrollments from "./schema/activityEnrollments";
import * as activityEnrollmentRoleHistory from "./schema/activityEnrollmentRoleHistory";
import * as attendanceEvents from "./schema/attendanceEvents";
import * as attendanceRecords from "./schema/attendanceRecords";
import * as appSettings from "./schema/appSettings";
import * as allowedSignups from "./schema/allowedSignups";
import * as registrationSubmissions from "./schema/registrationSubmissions";

const schema = {
  ...authSchema,
  ...households,
  ...neighbourhoods,
  ...people,
  ...guardianRelationships,
  ...activityCategories,
  ...termDates,
  ...activityInstances,
  ...activityFacilitators,
  ...activityEnrollments,
  ...activityEnrollmentRoleHistory,
  ...attendanceEvents,
  ...attendanceRecords,
  ...appSettings,
  ...allowedSignups,
  ...registrationSubmissions,
};

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
