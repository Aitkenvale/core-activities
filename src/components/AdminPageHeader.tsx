"use client";

import { useRouter } from "next/navigation";
import { CloseButton } from "@/components/CloseButton";

// The title row of an Admin screen, with the X that closes it: the same round X
// the User screens have in the app header (which is switched off on Admin pages
// to leave the room to the grids), so every screen can be left the same way,
// back to Admin Functions.
//
// A screen that saves as you go can also pass `onCancel`, which puts a Cancel
// beside the X exactly as the Attendance study screen has one. Such a screen
// usually passes `onClose` too, to tidy up before it leaves.
export function AdminPageHeader({
  title,
  marginBottom = 12,
  onClose,
  onCancel,
  busy = false,
}: {
  title: string;
  // The space under the row: each screen's title sat its own distance from
  // what follows it, and keeps doing so.
  marginBottom?: number | string;
  // Replaces going back to Admin Functions.
  onClose?: () => void;
  onCancel?: () => void;
  // Changes are being put back: Cancel waits.
  busy?: boolean;
}) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", marginBottom }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", color: "var(--heading)", margin: 0, minWidth: 0 }}>{title}</h2>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {onCancel && (
          <button type="button" className="page-cancel" onClick={onCancel} disabled={busy} title="Undo everything changed since this was opened">
            Cancel
          </button>
        )}
        <CloseButton onClick={onClose ?? (() => router.push("/app/admin"))} />
      </div>
    </div>
  );
}
