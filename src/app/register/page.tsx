import { RegistrationWizard } from "./RegistrationWizard";

// Deliberately no session check — the app's only public page, since a
// parent filling this out has no account at all.
export default function RegisterPage() {
  return <RegistrationWizard />;
}
