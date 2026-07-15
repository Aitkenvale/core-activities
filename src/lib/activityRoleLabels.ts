// What "Facilitator"/"Assistant" are actually called varies by class type —
// PSEC calls them Teachers/Co-Teachers, JYSEP calls them Animators/
// Co-Animators, and Study Circles don't split the role at all (facilitating
// a study circle doesn't carry the same child-protection-training
// requirement, so there's nothing to split off). Keyed by
// activityCategories.id (see src/db/seed.ts) — "psec" | "jysep" | "sc" |
// "camp" today.
export type RoleLabels = {
  facilitator: string;
  assistant: string;
  // Whether this category's Attendee list shows a separate Assistants
  // section at all — false collapses everyone into the plain Facilitators
  // section, same as before the split.
  showAssistants: boolean;
};

const DEFAULT_ROLE_LABELS: RoleLabels = { facilitator: "Facilitators", assistant: "Assistants", showAssistants: true };

const CATEGORY_ROLE_LABELS: Record<string, RoleLabels> = {
  psec: { facilitator: "Teachers", assistant: "Co-Teachers", showAssistants: true },
  jysep: { facilitator: "Animators", assistant: "Co-Animators", showAssistants: true },
  sc: { facilitator: "Facilitators", assistant: "Assistants", showAssistants: false },
};

export function getRoleLabels(categoryId: string): RoleLabels {
  return CATEGORY_ROLE_LABELS[categoryId] ?? DEFAULT_ROLE_LABELS;
}
