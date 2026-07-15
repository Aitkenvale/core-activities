"use client";

import { useRef, useState } from "react";
import { submitRegistration } from "./actions";

// Fixed brand palette, not the app's dark-mode-adaptive --card-bg/--text
// tokens — this is a public page a parent fills out on their own phone,
// and should look the same regardless of their device's light/dark
// setting, matching the org's existing printed/QR-code branding rather
// than the internal admin app's theme.
const C = {
  gold: "#C9974A",
  deep: "#2C1F0E",
  warm: "#6B4C2A",
  cream: "#FAF6EF",
  cream2: "#F3EDE1",
  border: "#D9C9A8",
  text: "#2C1F0E",
  muted: "#8B7355",
  green: "#3D6B4A",
  red: "#8B3A2A",
};

type Lang = "en" | "fr";

// Copy carried over verbatim from the old Registration/registration-form.html.
const T: Record<Lang, Record<string, string>> = {
  en: {
    hero_h1a: "Junior Youth Spiritual",
    hero_h1b: "Empowerment Programme",
    hero_h2: "Children's Classes",
    hero_initiative: "An initiative of the Bahá'í Community",
    hero_desc: "Register your children for our weekly programme and school holiday camps. The form takes just a few minutes to complete.",
    hero_btn: "Begin Registration",
    p1_title: "Children's Details",
    p1_sub: "Add each child you are registering",
    p1_add: "+ Add Another Child",
    child_label: "Child",
    field_name: "Full name *",
    field_dob: "Date of birth *",
    field_health_check: "This child has health concerns or allergies",
    field_health_detail: "Please describe briefly…",
    p2_title: "Parent / Guardian Details",
    p2_sub: "Add all parents or guardians for this registration",
    p2_add: "+ Add Another Parent / Guardian",
    parent_label: "Parent / Guardian",
    field_address: "Address *",
    field_mobile: "Mobile *",
    field_email: "Email",
    field_email_note: "Optional — provided if a confirmation is ever needed",
    p3_title: "Permissions",
    p3_sub: "These permissions must be accepted in full",
    perm_1: "It is ok for my children to attend the weekly programme and school holiday camps.",
    perm_2: "It is ok for the facilitator to seek medical attention for my children in times of emergency.",
    perm_3: "It is ok for occasional photos and videos to be taken of class activities which may be posted in channels connected with promoting and learning about the programme.",
    perm_4: "It is ok for my children to travel with facilitators for events where transport is provided.",
    perm_5: "I understand that it is my responsibility to collect my children after the class / camp.",
    p3_consent_text: "I give permission for all of the above",
    p3_consent_note: "All permissions must be accepted to proceed",
    p4_title: "Sign & Submit",
    p4_sub: "Confirm your details below and submit",
    p4_sig_hint: "Your name, mobile and email will appear above as entered",
    p4_guardian: "I confirm that I am the parent or legal guardian of the child/children named in this form, and that all information provided is accurate to the best of my knowledge.",
    p4_submit: "Submit Registration",
    p4_sending: "Sending your registration…",
    success_title: "Registration Complete",
    success_p1: "Thank you for registering your children. Your registration has been received.",
    success_p2: "We look forward to seeing your family at the programme soon.",
    nav_back: "← Back",
    nav_continue: "Continue →",
    page_labels: "Children's details,Parent details,Permissions,Sign & submit",
    err_name: "Please enter a name for each child.",
    err_dob: "Please enter a date of birth for each child.",
    err_parents: "Please complete all required fields.",
    err_email: "Please enter a valid email address.",
    err_consent: "Please confirm all permissions to continue.",
    err_guardian: "Please confirm your parent / guardian status.",
    err_send: "There was a problem sending your registration. Please try again or contact us directly.",
  },
  fr: {
    hero_h1a: "Programme d'autonomisation",
    hero_h1b: "spirituelle des jeunes",
    hero_h2: "Classes pour enfants",
    hero_initiative: "Une initiative de la communauté bahá'íe",
    hero_desc: "Inscrivez vos enfants à notre programme hebdomadaire et aux camps de vacances scolaires. Le formulaire ne prend que quelques minutes.",
    hero_btn: "Commencer l'inscription",
    p1_title: "Détails des enfants",
    p1_sub: "Ajoutez chaque enfant que vous inscrivez",
    p1_add: "+ Ajouter un autre enfant",
    child_label: "Enfant",
    field_name: "Nom complet *",
    field_dob: "Date de naissance *",
    field_health_check: "Cet enfant a des problèmes de santé ou des allergies",
    field_health_detail: "Veuillez décrire brièvement…",
    p2_title: "Détails du parent / tuteur",
    p2_sub: "Ajoutez tous les parents ou tuteurs pour cette inscription",
    p2_add: "+ Ajouter un autre parent / tuteur",
    parent_label: "Parent / Tuteur",
    field_address: "Adresse *",
    field_mobile: "Mobile *",
    field_email: "Courriel",
    field_email_note: "Facultatif — fourni si jamais une confirmation est nécessaire",
    p3_title: "Autorisations",
    p3_sub: "Ces autorisations doivent être acceptées en totalité",
    perm_1: "C'est ok pour mes enfants d'assister au programme hebdomadaire et aux camps de vacances scolaires.",
    perm_2: "C'est ok pour l'animateur de demander des soins médicaux pour mes enfants en cas d'urgence.",
    perm_3: "C'est ok de prendre des photos et vidéos occasionnelles des activités de classe qui peuvent être publiées dans des canaux liés à la promotion du programme.",
    perm_4: "C'est ok pour mes enfants de voyager avec des animateurs pour les événements où le transport est fourni.",
    perm_5: "Je comprends qu'il est de ma responsabilité de récupérer mes enfants après le cours / camp.",
    p3_consent_text: "Je donne la permission pour tout ce qui précède",
    p3_consent_note: "Toutes les autorisations doivent être acceptées pour continuer",
    p4_title: "Signer et soumettre",
    p4_sub: "Confirmez vos détails ci-dessous et soumettez",
    p4_sig_hint: "Votre nom, mobile et courriel apparaîtront ci-dessus tels que saisis",
    p4_guardian: "Je confirme que je suis le parent ou le tuteur légal de l'enfant/des enfants nommés dans ce formulaire, et que toutes les informations fournies sont exactes.",
    p4_submit: "Soumettre l'inscription",
    p4_sending: "Envoi de votre inscription…",
    success_title: "Inscription complète",
    success_p1: "Merci d'avoir inscrit vos enfants. Votre inscription a été reçue.",
    success_p2: "Nous attendons avec impatience de voir votre famille au programme bientôt.",
    nav_back: "← Retour",
    nav_continue: "Continuer →",
    page_labels: "Détails des enfants,Détails du parent,Autorisations,Signer et soumettre",
    err_name: "Veuillez entrer un nom pour chaque enfant.",
    err_dob: "Veuillez entrer une date de naissance pour chaque enfant.",
    err_parents: "Veuillez compléter tous les champs obligatoires.",
    err_email: "Veuillez entrer une adresse courriel valide.",
    err_consent: "Veuillez confirmer toutes les autorisations pour continuer.",
    err_guardian: "Veuillez confirmer votre statut de parent / tuteur.",
    err_send: "Un problème est survenu lors de l'envoi. Veuillez réessayer ou nous contacter directement.",
  },
};

function t(lang: Lang, key: string): string {
  return T[lang][key] ?? key;
}

type ChildForm = { id: number; name: string; dob: string; hasHealth: boolean; health: string };
type ParentForm = { id: number; name: string; address: string; mobile: string; email: string };

let idCounter = 1;
function nextId() {
  return idCounter++;
}

export function RegistrationWizard() {
  const [lang, setLang] = useState<Lang>("en");
  const [phase, setPhase] = useState<"landing" | "form" | "success">("landing");
  const [step, setStep] = useState(1);
  const [children, setChildren] = useState<ChildForm[]>([{ id: nextId(), name: "", dob: "", hasHealth: false, health: "" }]);
  const [parents, setParents] = useState<ParentForm[]>([{ id: nextId(), name: "", address: "", mobile: "", email: "" }]);
  const [consentGiven, setConsentGiven] = useState(false);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fieldRefs = useRef<Map<string, HTMLElement>>(new Map());

  function registerRef(key: string) {
    return (el: HTMLElement | null) => {
      if (el) fieldRefs.current.set(key, el);
      else fieldRefs.current.delete(key);
    };
  }

  function scrollToFirst(keys: string[]) {
    const el = keys.map((k) => fieldRefs.current.get(k)).find(Boolean);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
    setTimeout(() => {
      try {
        (el as HTMLInputElement).focus?.();
      } catch {}
    }, 350);
  }

  function addChild() {
    setChildren((cs) => [...cs, { id: nextId(), name: "", dob: "", hasHealth: false, health: "" }]);
  }
  function removeChild(id: number) {
    setChildren((cs) => cs.filter((c) => c.id !== id));
  }
  function updateChild(id: number, patch: Partial<ChildForm>) {
    setChildren((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function addParent() {
    setParents((ps) => [...ps, { id: nextId(), name: "", address: "", mobile: "", email: "" }]);
  }
  function removeParent(id: number) {
    setParents((ps) => ps.filter((p) => p.id !== id));
  }
  function updateParent(id: number, patch: Partial<ParentForm>) {
    setParents((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function validateStep(n: number): boolean {
    const invalid = new Set<string>();
    const order: string[] = [];
    function flag(key: string) {
      invalid.add(key);
      order.push(key);
    }

    if (n === 1) {
      for (const c of children) {
        if (!c.name.trim()) flag(`child-${c.id}-name`);
        if (!c.dob) flag(`child-${c.id}-dob`);
      }
    }
    if (n === 2) {
      for (const p of parents) {
        if (!p.name.trim()) flag(`parent-${p.id}-name`);
        if (!p.address.trim()) flag(`parent-${p.id}-address`);
        if (!p.mobile.trim()) flag(`parent-${p.id}-mobile`);
        if (p.email.trim() && !/\S+@\S+\.\S+/.test(p.email)) flag(`parent-${p.id}-email`);
      }
    }
    if (n === 3 && !consentGiven) flag("consent");
    if (n === 4 && !guardianConfirmed) flag("guardian");

    setInvalidKeys(invalid);
    if (order.length > 0) {
      scrollToFirst(order);
      return false;
    }
    return true;
  }

  function goNext(from: number) {
    if (validateStep(from)) {
      setStep(from + 1);
      setInvalidKeys(new Set());
      window.scrollTo(0, 0);
    }
  }
  function goBack(from: number) {
    setInvalidKeys(new Set());
    setStep(from - 1);
    window.scrollTo(0, 0);
  }

  async function handleSubmit() {
    if (!validateStep(4)) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitRegistration({
        language: lang,
        children: children.map((c) => ({ name: c.name, dob: c.dob, hasHealth: c.hasHealth, health: c.health })),
        parents: parents.map((p) => ({ name: p.name, address: p.address, mobile: p.mobile, email: p.email })),
        consentGiven,
        guardianConfirmed,
      });
      setPhase("success");
      window.scrollTo(0, 0);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t(lang, "err_send"));
    } finally {
      setSubmitting(false);
    }
  }

  const pageLabels = t(lang, "page_labels").split(",");

  return (
    <div style={{ fontFamily: "'Jost', sans-serif", background: C.cream, color: C.text, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", height: 4, background: `linear-gradient(90deg, ${C.deep} 0%, ${C.gold} 50%, ${C.deep} 100%)`, flexShrink: 0 }} />

      <LangToggle lang={lang} onChange={setLang} />

      {phase === "landing" && (
        <div style={{ width: "100%", maxWidth: 520, padding: "40px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 20, color: C.gold, letterSpacing: 6, marginBottom: 24, opacity: 0.8 }}>✦ ✦ ✦</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 600, lineHeight: 1.2, color: C.deep, marginBottom: 10 }}>
            {t(lang, "hero_h1a")}
            <br />
            {t(lang, "hero_h1b")}
          </h1>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.4rem", fontStyle: "italic", color: C.gold, margin: "6px 0" }}>&amp;</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 600, lineHeight: 1.2, color: C.deep, marginBottom: 14 }}>{t(lang, "hero_h2")}</h2>
          <p style={{ fontSize: "0.78rem", fontWeight: 300, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 32 }}>{t(lang, "hero_initiative")}</p>
          <div style={{ width: 60, height: 1, background: C.gold, margin: "0 auto 28px" }} />
          <p style={{ fontSize: "0.95rem", color: C.muted, lineHeight: 1.7, maxWidth: 380, marginBottom: 36 }}>{t(lang, "hero_desc")}</p>
          <button
            onClick={() => {
              setPhase("form");
              setStep(1);
            }}
            style={primaryButtonStyle}
          >
            {t(lang, "hero_btn")}
          </button>
        </div>
      )}

      {phase === "form" && (
        <div style={{ width: "100%", maxWidth: 520, padding: "0 16px 60px", display: "flex", flexDirection: "column" }}>
          <Progress step={step} labels={pageLabels} />

          {step === 1 && (
            <section>
              <SectionHeader title={t(lang, "p1_title")} sub={t(lang, "p1_sub")} />
              {children.map((c, i) => (
                <ChildCard
                  key={c.id}
                  index={i}
                  child={c}
                  lang={lang}
                  removable={i > 0}
                  invalidKeys={invalidKeys}
                  registerRef={registerRef}
                  onChange={(patch) => updateChild(c.id, patch)}
                  onRemove={() => removeChild(c.id)}
                />
              ))}
              <button onClick={addChild} style={addButtonStyle}>
                {t(lang, "p1_add")}
              </button>
              <NavRow backLabel={t(lang, "nav_back")} continueLabel={t(lang, "nav_continue")} onBack={() => setPhase("landing")} onContinue={() => goNext(1)} />
            </section>
          )}

          {step === 2 && (
            <section>
              <SectionHeader title={t(lang, "p2_title")} sub={t(lang, "p2_sub")} />
              {parents.map((p, i) => (
                <ParentCard
                  key={p.id}
                  index={i}
                  parent={p}
                  lang={lang}
                  removable={i > 0}
                  invalidKeys={invalidKeys}
                  registerRef={registerRef}
                  onChange={(patch) => updateParent(p.id, patch)}
                  onRemove={() => removeParent(p.id)}
                />
              ))}
              <button onClick={addParent} style={addButtonStyle}>
                {t(lang, "p2_add")}
              </button>
              <NavRow backLabel={t(lang, "nav_back")} continueLabel={t(lang, "nav_continue")} onBack={() => goBack(2)} onContinue={() => goNext(2)} />
            </section>
          )}

          {step === 3 && (
            <section>
              <SectionHeader title={t(lang, "p3_title")} sub={t(lang, "p3_sub")} />
              <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 0", marginBottom: 20 }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {["perm_1", "perm_2", "perm_3", "perm_4", "perm_5"].map((key) => (
                    <li key={key} style={{ padding: "14px 20px", borderBottom: `1px solid ${C.cream2}`, fontSize: "0.88rem", lineHeight: 1.6, color: C.text, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ color: C.gold, flexShrink: 0, marginTop: 2, fontSize: "1rem" }}>•</span>
                      <span>{t(lang, key)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                ref={registerRef("consent")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  background: C.cream2,
                  border: `1px solid ${invalidKeys.has("consent") ? C.red : C.border}`,
                  borderRadius: 4,
                  padding: 16,
                  marginBottom: 24,
                }}
              >
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  style={{ width: 22, height: 22, flexShrink: 0, marginTop: 2, accentColor: C.green, cursor: "pointer" }}
                />
                <div style={{ cursor: "pointer" }} onClick={() => setConsentGiven((v) => !v)}>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.55, color: C.deep, fontWeight: 500, margin: 0 }}>{t(lang, "p3_consent_text")}</p>
                  <p style={{ fontSize: "0.78rem", color: C.muted, margin: "3px 0 0" }}>{t(lang, "p3_consent_note")}</p>
                </div>
              </div>
              <NavRow backLabel={t(lang, "nav_back")} continueLabel={t(lang, "nav_continue")} onBack={() => goBack(3)} onContinue={() => goNext(3)} />
            </section>
          )}

          {step === 4 && (
            <section>
              <SectionHeader title={t(lang, "p4_title")} sub={t(lang, "p4_sub")} />
              <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 4, padding: "24px 20px", marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: "2rem", color: C.deep, minHeight: 48, marginBottom: 6, wordBreak: "break-word" }}>
                  {parents[0]?.name.trim() || "—"}
                </div>
                <div style={{ fontSize: "0.78rem", color: C.muted, letterSpacing: "0.04em", lineHeight: 1.6 }}>
                  {[parents[0]?.mobile.trim(), parents[0]?.email.trim()].filter(Boolean).join("   ·   ")}
                </div>
                <p style={{ fontSize: "0.75rem", color: C.muted, fontStyle: "italic", marginTop: 12 }}>{t(lang, "p4_sig_hint")}</p>
              </div>

              <div
                ref={registerRef("guardian")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  background: C.cream2,
                  border: `1px solid ${invalidKeys.has("guardian") ? C.red : C.border}`,
                  borderRadius: 4,
                  padding: 16,
                  marginBottom: 24,
                }}
              >
                <input
                  type="checkbox"
                  id="guardian-check"
                  checked={guardianConfirmed}
                  onChange={(e) => setGuardianConfirmed(e.target.checked)}
                  style={{ width: 22, height: 22, flexShrink: 0, marginTop: 2, accentColor: C.green, cursor: "pointer" }}
                />
                <label htmlFor="guardian-check" style={{ fontSize: "0.85rem", lineHeight: 1.55, color: C.text, cursor: "pointer", display: "block" }}>
                  {t(lang, "p4_guardian")}
                </label>
              </div>

              <NavRow
                backLabel={t(lang, "nav_back")}
                continueLabel={submitting ? "…" : t(lang, "p4_submit")}
                onBack={() => goBack(4)}
                onContinue={handleSubmit}
                continueDisabled={submitting}
                backDisabled={submitting}
              />
              {submitting && <p style={{ textAlign: "center", padding: 12, fontSize: "0.85rem", color: C.muted }}>{t(lang, "p4_sending")}</p>}
              {submitError && <p style={{ fontSize: "0.8rem", color: C.red, textAlign: "center", marginTop: 10 }}>{submitError}</p>}
            </section>
          )}
        </div>
      )}

      {phase === "success" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "60px 20px", maxWidth: 440, margin: "0 auto" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", marginBottom: 24 }}>✓</div>
          <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 600, color: C.deep, marginBottom: 12 }}>{t(lang, "success_title")}</h3>
          <p style={{ fontSize: "0.9rem", color: C.muted, lineHeight: 1.7, marginBottom: 8 }}>{t(lang, "success_p1")}</p>
          <p style={{ fontSize: "0.9rem", color: C.muted, lineHeight: 1.7, marginBottom: 8 }}>{t(lang, "success_p2")}</p>
        </div>
      )}
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 3, overflow: "hidden", background: C.cream, margin: "12px auto 0" }}>
      <button onClick={() => onChange("en")} style={langBtnStyle(lang === "en")}>
        EN
      </button>
      <div style={{ width: 1, background: C.border, height: 28 }} />
      <button onClick={() => onChange("fr")} style={langBtnStyle(lang === "fr")}>
        FR
      </button>
    </div>
  );
}

function langBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px",
    fontFamily: "'Jost', sans-serif",
    fontSize: "0.72rem",
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    border: "none",
    background: active ? C.deep : "none",
    color: active ? C.cream : C.muted,
    cursor: "pointer",
  };
}

function Progress({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div style={{ padding: "20px 0 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: `1.5px solid ${n === step ? C.gold : n < step ? C.green : C.border}`,
                background: n === step ? C.gold : n < step ? C.green : C.cream,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.72rem",
                fontWeight: 500,
                color: n === step ? C.deep : n < step ? "#fff" : C.muted,
                flexShrink: 0,
              }}
            >
              {n}
            </div>
            {n < 4 && <div style={{ width: 36, height: 1, background: n < step ? C.green : C.border, flexShrink: 0 }} />}
          </div>
        ))}
      </div>
      <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>{labels[step - 1]}</div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.7rem", fontWeight: 600, color: C.deep, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: "0.85rem", color: C.muted }}>{sub}</p>
    </div>
  );
}

const primaryButtonStyle: React.CSSProperties = {
  background: C.deep,
  color: C.cream,
  border: "none",
  padding: "14px 40px",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.85rem",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 2,
};

const addButtonStyle: React.CSSProperties = {
  width: "100%",
  background: "none",
  border: `1px dashed ${C.border}`,
  borderRadius: 3,
  padding: 12,
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.82rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.warm,
  cursor: "pointer",
  marginBottom: 28,
};

function fieldInputStyle(invalid: boolean): React.CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: `1px solid ${invalid ? C.red : C.border}`,
    borderRadius: 2,
    background: invalid ? "#FDF4F3" : C.cream,
    fontFamily: "'Jost', sans-serif",
    fontSize: "0.92rem",
    color: C.text,
    outline: "none",
    height: 42,
    lineHeight: "normal",
  };
}

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: C.muted,
  marginBottom: 5,
};

function ChildCard({
  index,
  child,
  lang,
  removable,
  invalidKeys,
  registerRef,
  onChange,
  onRemove,
}: {
  index: number;
  child: ChildForm;
  lang: Lang;
  removable: boolean;
  invalidKeys: Set<string>;
  registerRef: (key: string) => (el: HTMLElement | null) => void;
  onChange: (patch: Partial<ChildForm>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 4, padding: 20, marginBottom: 16, position: "relative" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, marginBottom: 14 }}>
        {t(lang, "child_label")} {index + 1}
      </p>
      {removable && (
        <button onClick={onRemove} aria-label="Remove" style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: C.muted, fontSize: "1.2rem", cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>
          ×
        </button>
      )}
      <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{t(lang, "field_name")}</label>
        <input
          ref={registerRef(`child-${child.id}-name`)}
          type="text"
          value={child.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Jamie Smith"
          style={fieldInputStyle(invalidKeys.has(`child-${child.id}-name`))}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{t(lang, "field_dob")}</label>
        <input
          ref={registerRef(`child-${child.id}-dob`)}
          type="date"
          value={child.dob}
          onChange={(e) => onChange({ dob: e.target.value })}
          style={{ ...fieldInputStyle(invalidKeys.has(`child-${child.id}-dob`)), minWidth: 0 }}
        />
      </div>
      <div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", fontSize: "0.88rem", color: C.text, lineHeight: 1.4, padding: "2px 0" }}>
          <input
            type="checkbox"
            checked={child.hasHealth}
            onChange={(e) => onChange({ hasHealth: e.target.checked })}
            style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, accentColor: C.gold, cursor: "pointer" }}
          />
          <span>{t(lang, "field_health_check")}</span>
        </label>
        {child.hasHealth && (
          <div style={{ marginTop: 10 }}>
            <input
              type="text"
              value={child.health}
              onChange={(e) => onChange({ health: e.target.value })}
              placeholder={t(lang, "field_health_detail")}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 2, background: C.cream, fontFamily: "'Jost', sans-serif", fontSize: "0.92rem", color: C.text, outline: "none" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ParentCard({
  index,
  parent,
  lang,
  removable,
  invalidKeys,
  registerRef,
  onChange,
  onRemove,
}: {
  index: number;
  parent: ParentForm;
  lang: Lang;
  removable: boolean;
  invalidKeys: Set<string>;
  registerRef: (key: string) => (el: HTMLElement | null) => void;
  onChange: (patch: Partial<ParentForm>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 4, padding: 20, marginBottom: 16, position: "relative" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, marginBottom: 14 }}>
        {t(lang, "parent_label")} {index + 1}
      </p>
      {removable && (
        <button onClick={onRemove} aria-label="Remove" style={{ position: "absolute", top: 14, right: 16, background: "none", border: "none", color: C.muted, fontSize: "1.2rem", cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>
          ×
        </button>
      )}
      <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{t(lang, "field_name")}</label>
        <input
          ref={registerRef(`parent-${parent.id}-name`)}
          type="text"
          value={parent.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Alex Smith"
          style={fieldInputStyle(invalidKeys.has(`parent-${parent.id}-name`))}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={fieldLabelStyle}>{t(lang, "field_address")}</label>
        <input
          ref={registerRef(`parent-${parent.id}-address`)}
          type="text"
          value={parent.address}
          onChange={(e) => onChange({ address: e.target.value })}
          style={fieldInputStyle(invalidKeys.has(`parent-${parent.id}-address`))}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={fieldLabelStyle}>{t(lang, "field_mobile")}</label>
          <input
            ref={registerRef(`parent-${parent.id}-mobile`)}
            type="tel"
            value={parent.mobile}
            onChange={(e) => onChange({ mobile: e.target.value })}
            placeholder="04xx xxx xxx"
            style={fieldInputStyle(invalidKeys.has(`parent-${parent.id}-mobile`))}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>{t(lang, "field_email")}</label>
          <input
            ref={registerRef(`parent-${parent.id}-email`)}
            type="email"
            value={parent.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="you@email.com"
            style={fieldInputStyle(invalidKeys.has(`parent-${parent.id}-email`))}
          />
          <p style={{ fontSize: "0.72rem", color: C.muted, marginTop: 4, fontStyle: "italic" }}>{t(lang, "field_email_note")}</p>
        </div>
      </div>
    </div>
  );
}

function NavRow({
  backLabel,
  continueLabel,
  onBack,
  onContinue,
  continueDisabled,
  backDisabled,
}: {
  backLabel: string;
  continueLabel: string;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  backDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 12 }}>
      <button
        onClick={onBack}
        disabled={backDisabled}
        style={{
          background: "none",
          border: `1px solid ${C.border}`,
          borderRadius: 2,
          padding: "12px 24px",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.82rem",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: C.muted,
          cursor: backDisabled ? "default" : "pointer",
          opacity: backDisabled ? 0.4 : 1,
        }}
      >
        {backLabel}
      </button>
      <button
        onClick={onContinue}
        disabled={continueDisabled}
        style={{
          flex: 1,
          background: continueDisabled ? C.border : C.deep,
          color: continueDisabled ? C.muted : C.cream,
          border: "none",
          borderRadius: 2,
          padding: "14px 24px",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.82rem",
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: continueDisabled ? "default" : "pointer",
        }}
      >
        {continueLabel}
      </button>
    </div>
  );
}
