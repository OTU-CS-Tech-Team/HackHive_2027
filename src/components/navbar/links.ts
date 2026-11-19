export const links = [
  
  
  { href: "/#about", label: "About" },
  { href: "/hackhive/archive", label: "HackHive history" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#judges", label: "Judges" },
  { href: "/#faq", label: "FAQs" },
] as const;

export function getAccountLinks(isSignedIn: boolean) {
  return isSignedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [];
}
