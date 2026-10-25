"use client";
// A "client component": the "use client" line above means this file also runs
// in the browser, which it needs because it asks the browser which page we are
// on (usePathname) to highlight the current tab. Everything else in the shell
// stays a server component.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

// The nav is pinned only while it is no taller than this share of the window.
const NAV_MAX_SHARE = 0.25;

export default function BottomNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  // Is the nav pinned (sticky) to the bottom of the screen? The server and the
  // first paint say "yes", because most phones at normal text size have room.
  // Right after the page loads the effect below measures the nav and corrects
  // this if the nav turns out to be too tall. Starting from the same value on
  // the server and in the browser also means React sees no mismatch.
  const [pinned, setPinned] = useState(true);

  // The rule: let H be the nav's own height (border box) and V the height of
  // the window (window.innerHeight, not visualViewport, so pinching to zoom
  // never un-pins the nav). If H is at most 25% of V the nav is pinned. If it
  // is taller than that, it would cover too much of the screen, so it sits
  // in the normal page flow after <main> instead and scrolls with the page.
  // The nav's height changes with text size, and the window's height changes
  // with rotation or a browser toolbar, so we re-decide on both.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const root = document.documentElement;
    const decide = () => {
      const height = nav.getBoundingClientRect().height;
      // --nav-h is the nav's real height. globals.css uses it as
      // scroll-padding-bottom while the nav is pinned.
      root.style.setProperty("--nav-h", `${height}px`);
      const isPinned = height <= NAV_MAX_SHARE * window.innerHeight;
      // globals.css only adds the scroll padding unless this says "false".
      root.dataset.navPinned = String(isPinned);
      setPinned(isPinned);
    };
    // The observer calls decide() once as soon as it starts watching, and again
    // whenever the nav's border box changes size (padding counts, too).
    const observer = new ResizeObserver(decide);
    observer.observe(nav, { box: "border-box" });
    window.addEventListener("resize", decide);
    // Clean up when the nav goes away: stop listening and tidy <html>.
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", decide);
      root.style.removeProperty("--nav-h");
      delete root.dataset.navPinned;
    };
  }, []);

  return (
    // Pinned: "sticky bottom-0" keeps the nav on the bottom edge of the screen
    // while the page scrolls. It is still part of the page flow (not floating
    // on top), so the page always leaves room for its real height. Not pinned:
    // "static" puts it after the page content. The bottom padding keeps the
    // tabs clear of the iPhone home bar.
    <nav
      ref={navRef}
      aria-label="Main"
      className={
        (pinned ? "sticky bottom-0 " : "static ") +
        "z-10 border-t border-zinc-300 bg-white pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] dark:border-zinc-700 dark:bg-zinc-900"
      }
    >
      {/* flex-wrap: with normal text all five tabs share one row. With very
          large text (WCAG 1.4.4) they wrap onto a second row instead of
          running off the side of the screen. */}
      {/* role="list": Safari/VoiceOver drops list meaning when bullets are hidden. */}
      <ul role="list" className="mx-auto flex max-w-2xl flex-wrap">
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
