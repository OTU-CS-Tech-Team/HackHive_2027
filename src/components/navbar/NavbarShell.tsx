import styles from "./NavbarShell.module.css";

export default function NavbarShell({ children }: { children: React.ReactNode }) {
  return (
    <header
      data-navbar-shell
      data-hidden="false"
      className={`fixed inset-x-0 top-0 z-[70] flex h-16 items-center justify-between px-4 sm:px-6 ${styles.header}`}
    >
      {children}
    </header>
  );
}
