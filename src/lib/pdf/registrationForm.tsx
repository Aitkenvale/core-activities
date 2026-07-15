import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

// Structurally matches RegistrationChild/RegistrationParent from
// src/app/register/actions.ts — not imported directly, since that file
// imports this one to generate the PDF and a circular import isn't worth
// avoiding by threading the types through a third file.
type Child = { name: string; dob: string; hasHealth: boolean; health: string };
type Parent = { name: string; address: string; mobile: string; email: string };

const PERMISSIONS: Record<"en" | "fr", string[]> = {
  en: [
    "It is ok for my children to attend the weekly programme and school holiday camps.",
    "It is ok for the facilitator to seek medical attention for my children in times of emergency.",
    "It is ok for occasional photos and videos to be taken of class activities which may be posted in channels connected with promoting and learning about the programme.",
    "It is ok for my children to travel with facilitators for events where transport is provided.",
    "I understand that it is my responsibility to collect my children after the class / camp.",
  ],
  fr: [
    "C'est ok pour mes enfants d'assister au programme hebdomadaire et aux camps de vacances scolaires.",
    "C'est ok pour l'animateur de demander des soins médicaux pour mes enfants en cas d'urgence.",
    "C'est ok de prendre des photos et vidéos occasionnelles des activités de classe qui peuvent être publiées dans des canaux liés à la promotion du programme.",
    "C'est ok pour mes enfants de voyager avec des animateurs pour les événements où le transport est fourni.",
    "Je comprends qu'il est de ma responsabilité de récupérer mes enfants après le cours / camp.",
  ],
};

const GUARDIAN_STATEMENT: Record<"en" | "fr", string> = {
  en: "I confirm that I am the parent or legal guardian of the child/children named in this form, and that all information provided is accurate to the best of my knowledge.",
  fr: "Je confirme que je suis le parent ou le tuteur légal de l'enfant/des enfants nommés dans ce formulaire, et que toutes les informations fournies sont exactes.",
};

export type RegistrationPdfInput = {
  language: "en" | "fr";
  submittedAt: Date;
  children: Child[];
  parents: Parent[];
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#2C1F0E" },
  title: { fontSize: 16, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#6B4C2A", marginBottom: 20 },
  sectionLabel: { fontSize: 9, marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, color: "#6B4C2A" },
  table: { borderTop: "1pt solid #D9C9A8", borderLeft: "1pt solid #D9C9A8" },
  row: { flexDirection: "row" },
  headerCell: { flex: 1, minWidth: 0, padding: "4pt 6pt", borderRight: "1pt solid #D9C9A8", borderBottom: "1pt solid #D9C9A8", fontSize: 8, backgroundColor: "#F3EDE1" },
  cell: { flex: 1, minWidth: 0, padding: "4pt 6pt", borderRight: "1pt solid #D9C9A8", borderBottom: "1pt solid #D9C9A8" },
  permItem: { flexDirection: "row", marginBottom: 5 },
  permBullet: { width: 10, color: "#C9974A" },
  permText: { flex: 1, lineHeight: 1.4 },
  guardianBox: { marginTop: 14, padding: 10, backgroundColor: "#F3EDE1", borderRadius: 2 },
  signatureBox: { marginTop: 20, paddingTop: 14, borderTop: "1pt solid #D9C9A8" },
  signatureName: { fontFamily: "Helvetica-BoldOblique", fontSize: 20, marginBottom: 4 },
  signatureMeta: { fontSize: 8, color: "#6B4C2A" },
  footnote: { fontSize: 7, color: "#8B7355", marginTop: 24 },
});

function formatDateTime(d: Date): string {
  return d.toLocaleString("en-AU", { dateStyle: "long", timeStyle: "short" });
}

// One PDF per /register submission (not per child) — a physical paper form
// covering several siblings would've been scanned once, so this generated
// stand-in follows the same shape, and gets linked identically on every
// child's regoFormUrl.
export async function generateRegistrationFormPdf(input: RegistrationPdfInput): Promise<Buffer> {
  const lang = input.language === "fr" ? "fr" : "en";
  const parent = input.parents[0];

  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Registration Form</Text>
        <Text style={styles.subtitle}>
          Junior Youth Spiritual Empowerment Programme &amp; Children&rsquo;s Classes — submitted online {formatDateTime(input.submittedAt)}
        </Text>

        <Text style={styles.sectionLabel}>Children</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={{ ...styles.headerCell, flex: 1.4 }}>Name</Text>
            <Text style={styles.headerCell}>Date of birth</Text>
            <Text style={{ ...styles.headerCell, flex: 1.6 }}>Health / allergies</Text>
          </View>
          {input.children.map((c, i) => (
            <View key={i} style={styles.row}>
              <Text style={{ ...styles.cell, flex: 1.4 }}>{c.name}</Text>
              <Text style={styles.cell}>{c.dob}</Text>
              <Text style={{ ...styles.cell, flex: 1.6 }}>{c.hasHealth ? c.health?.trim() || "Yes" : "—"}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Parents / Guardians</Text>
        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.headerCell}>Name</Text>
            <Text style={{ ...styles.headerCell, flex: 1.6 }}>Address</Text>
            <Text style={styles.headerCell}>Mobile</Text>
            <Text style={styles.headerCell}>Email</Text>
          </View>
          {input.parents.map((p, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.cell}>{p.name}</Text>
              <Text style={{ ...styles.cell, flex: 1.6 }}>{p.address}</Text>
              <Text style={styles.cell}>{p.mobile}</Text>
              <Text style={styles.cell}>{p.email || "—"}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Permissions accepted</Text>
        {PERMISSIONS[lang].map((p, i) => (
          <View key={i} style={styles.permItem}>
            <Text style={styles.permBullet}>✓</Text>
            <Text style={styles.permText}>{p}</Text>
          </View>
        ))}

        <View style={styles.guardianBox}>
          <Text style={{ lineHeight: 1.4 }}>{GUARDIAN_STATEMENT[lang]}</Text>
        </View>

        <View style={styles.signatureBox}>
          <Text style={styles.signatureName}>{parent?.name || "—"}</Text>
          <Text style={styles.signatureMeta}>
            {[parent?.mobile, parent?.email].filter(Boolean).join("   ·   ")}
          </Text>
          <Text style={styles.signatureMeta}>Digitally signed and submitted {formatDateTime(input.submittedAt)}</Text>
        </View>

        <Text style={styles.footnote}>
          Generated automatically from an online submission at /register — this document is the digital equivalent of a signed paper
          registration form, not a scan of a handwritten signature.
        </Text>
      </Page>
    </Document>,
  );
}
