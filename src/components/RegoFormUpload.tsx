"use client";

import { useRef, useState } from "react";

const triggerStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "inherit",
  textDecoration: "underline",
  cursor: "pointer",
  fontSize: "inherit",
  fontFamily: "inherit",
};

// Shared by every place a registration form/photo can be attached to a
// person — Admin People's grid (a real file upload), the Attendance Add
// Info modal, and the general People Edit form (both a mobile-friendly
// "take a photo or pick one" picker, since accept="image/*,application/pdf"
// with no `capture` attribute lets iOS/Android offer Camera, Photo Library,
// and Browse all from the same control). Each caller supplies its own
// permission-gated server action (uploadRegoForm in that surface's own
// actions.ts) — this component only handles the file picker UI and upload
// state, not who's allowed to do it.
export function RegoFormUpload({
  regoFormUrl,
  regoYearFallback,
  isAdmin,
  uploadAction,
  onUploaded,
  style,
  addLabel = "Add Registration Form",
  linkedLabel = "Registration Form on File",
}: {
  regoFormUrl: string | null;
  regoYearFallback?: number | null;
  isAdmin: boolean;
  uploadAction: (formData: FormData) => Promise<string>;
  onUploaded: (url: string) => void;
  style?: React.CSSProperties;
  addLabel?: string;
  linkedLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again (e.g. after an error) still fires onChange.
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      onUploaded(await uploadAction(formData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <span style={style}>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display: "none" }} />
      {uploading ? (
        "Uploading…"
      ) : regoFormUrl ? (
        <>
          {isAdmin ? (
            <a
              href={`/api/admin/rego-form?url=${encodeURIComponent(regoFormUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "underline" }}
            >
              {linkedLabel}
            </a>
          ) : (
            linkedLabel
          )}{" "}
          <button type="button" onClick={() => inputRef.current?.click()} style={triggerStyle}>
            Replace
          </button>
        </>
      ) : regoYearFallback ? (
        <>
          {`Registration: ${regoYearFallback}`}{" "}
          <button type="button" onClick={() => inputRef.current?.click()} style={triggerStyle}>
            Add Form
          </button>
        </>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} style={triggerStyle}>
          {addLabel}
        </button>
      )}
      {error && <span style={{ display: "block", color: "var(--red)", fontSize: "0.7rem", marginTop: 2 }}>{error}</span>}
    </span>
  );
}
