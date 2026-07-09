import type { CSSProperties } from "react";

export const cardStyle: CSSProperties = {
  background: "var(--card-bg)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
  marginBottom: "var(--space-4)",
};

export const cardTitleStyle: CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "1.15rem",
  color: "var(--heading)",
  margin: "0 0 var(--space-3)",
};
