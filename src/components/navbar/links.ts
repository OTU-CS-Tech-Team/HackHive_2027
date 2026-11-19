export const links = [
  
  
  { href: "/#about", label: "About" },
  { href: "/#sponsors", label: "Sponsors" },
  { href: "/#judges", label: "Judges" },
  { href: "/#faq", label: "FAQs" },
  { href: "/hackhive/archive", label: "HackHive history" }
] as const;

export function getAccountLinks(isSignedIn: boolean) {
  return isSignedIn ? [{ href: "/dashboard", label: "Dashboard" }] : [];
}
