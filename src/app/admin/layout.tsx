import { AdminNav } from "./AdminNav";

// Each page still checks for an admin itself; the sidebar only holds links.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin-shell className="min-h-dvh bg-white pt-16 md:flex md:pt-0">
      <AdminNav />
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-10">{children}</div>
    </div>
  );
}
