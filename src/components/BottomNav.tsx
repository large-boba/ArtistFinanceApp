"use client";
// A "client component": the "use client" line above means this file also runs
// in the browser, which it needs because it asks the browser which page we are
// on (usePathname) to highlight the current tab. Everything else in the shell
// stays a server component.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

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
  const navRef = useRef<HTMLElement>(null);

  // Measure the nav's real height (it grows when the text is enlarged) and
  // publish it as the CSS variable --nav-h on <html>. globals.css uses it as
  // scroll-padding-bottom, so when a keyboard user tabs to a control the page
  // scrolls it clear of the sticky nav instead of leaving it hidden behind.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty("--nav-h", `${nav.getBoundingClientRect().height}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    // Clean up when the nav goes away: stop watching and remove the variable.
    return () => {
      observer.disconnect();
      root.style.removeProperty("--nav-h");
    };
  }, []);

  return (
    // "sticky bottom-0": the nav is the last thing in the page, and it sticks
    // to the bottom edge of the screen while the page scrolls. Because it is
    // part of the page flow (not floating on top), the page always leaves room
    // for its real height, even when big text makes it taller. The bottom
    // padding keeps the tabs clear of the iPhone home bar.
    // On a screen 700px tall or less (small phones, or any phone on its side)
    // a sticky nav would cover too much, so there it is not sticky: it sits
    // after the page content and scrolls with it.
    <nav
      ref={navRef}
      aria-label="Main"
      className="sticky bottom-0 z-10 border-t border-zinc-300 bg-white pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] [@media(max-height:700px)]:static dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* flex-wrap: with normal text all five tabs share one row. With very
          large text (WCAG 1.4.4) they wrap onto a second row instead of
          running off the side of the screen. */}
      <ul className="mx-auto flex max-w-2xl flex-wrap">
        {TABS.map((tab) => {
          const isCurrent = pathname === tab.href;
          return (
            <li key={tab.href} className="min-w-[44px] grow">
              <Link
                href={tab.href}
                // Only the current tab gets aria-current; the others get none.
                aria-current={isCurrent ? "page" : undefined}
                className={
                  "flex min-h-16 min-w-[44px] flex-col items-center justify-center gap-0.5 border-t-4 px-2 text-xs focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300 sm:text-sm " +
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
                <span className="text-center [overflow-wrap:anywhere]">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
