"use client";
// A "client component": the "use client" line above means this file also runs
// in the browser, which it needs because it asks the browser which page we are
// on (usePathname) to highlight the current tab. Everything else in the shell
// stays a server component.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Each tab: where it goes, its label, and a small picture. The pictures are
// aria-hidden so a screen reader says just "Home", not "Home, icon".
const TABS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/",
    label: "Home",
    icon: <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10" />,
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: <path d="M4 7h16M4 12h16M4 17h10" />,
  },
  {
    href: "/events",
    label: "Events",
    icon: <path d="M4 6.5h16V20H4zM4 11h16M8 3.5v5M16 3.5v5" />,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: <path d="M5 20V11M12 20V5M19 20v-7" />,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5" />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    // Fixed to the bottom edge of the screen, so it stays put while the page
    // scrolls. The bottom padding keeps the tabs clear of the iPhone home bar.
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-300 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-700 dark:bg-zinc-900"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const isCurrent = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                // Only the current tab gets aria-current; the others get none.
                aria-current={isCurrent ? "page" : undefined}
                className={
                  "flex h-16 min-w-11 flex-col items-center justify-center gap-0.5 border-t-4 text-xs focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300 sm:text-sm " +
                  (isCurrent
                    ? "border-indigo-700 bg-indigo-100 font-bold text-indigo-900 dark:border-indigo-300 dark:bg-indigo-950 dark:text-indigo-100"
                    : "border-transparent font-normal text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800")
                }
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {tab.icon}
                </svg>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
