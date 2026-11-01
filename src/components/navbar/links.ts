export const links = [
  
  
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#judges", label: "Judges" },
  { href: "/#hackhive-2025", label: "Archive" },
  { href: "/#faq", label: "FAQs" },
  {href: "/#team", label: "Team" },
] as const;

export function getAccountLinks(isSignedIn: boolean) {
  return isSignedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [];
}