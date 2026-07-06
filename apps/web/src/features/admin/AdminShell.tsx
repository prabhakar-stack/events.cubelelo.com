"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Competitions",
    items: [
      { label: "Competitions", href: "/admin" },
      { label: "Create Competition", href: "/admin/create-competition" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Users", href: "/admin/users" },
      { label: "Staff", href: "/admin/staff" },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Payments", href: "/admin/payments" },
      { label: "Promo Codes", href: "/admin/promo-codes" },
    ],
  },
  {
    label: "Review",
    items: [
      { label: "Verification", href: "/admin/verification" },
      { label: "Appeals", href: "/admin/appeals" },
      { label: "WCA Queue", href: "/admin/wca-queue" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Announcements", href: "/admin/announcements" },
      { label: "Content", href: "/admin/content" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Rank Tiers", href: "/admin/rank-tiers" },
      { label: "Merge Accounts", href: "/admin/merge" },
      { label: "Migration", href: "/admin/migration" },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-7xl">
      <aside className="hidden w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 md:block">
        <nav className="sticky top-14 max-h-[calc(100vh-56px)] space-y-5 overflow-y-auto px-3 py-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-lg px-3 py-1.5 text-sm transition ${isActive(item.href)
                        ? "bg-accent-primary/10 font-semibold text-accent-primary"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                      }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
    </div>
  );
}
