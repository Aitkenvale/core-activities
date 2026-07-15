// Adds the signature-style script font used on the Sign & Submit step —
// Next.js hoists <link> tags rendered anywhere in the tree into <head>,
// same lightweight pattern the root layout already uses for its two fonts.
export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap" rel="stylesheet" />
      {children}
    </>
  );
}
