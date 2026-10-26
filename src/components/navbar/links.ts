export const links = [
  
  { href: "/#judges", label: "Speakers & Judges" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#hackhive-2025", label: "Archive" },
  { href: "/#faq", label: "FAQs" },
  {href: "/#team", label: "Team" },
] as const;

export function getAccountLinks(isSignedIn: boolean) {
  return isSignedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [];
}