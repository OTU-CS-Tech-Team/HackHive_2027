// "#top" is the homepage's <main>, so Home lands at the very top from any page.
export const links = [
  { href: "/#top", label: "Home" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#judges", label: "Judges" },
  { href: "/#faq", label: "FAQs" }
] as const;

export function getAccountLinks(isSignedIn: boolean) {
  return isSignedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [];
}
