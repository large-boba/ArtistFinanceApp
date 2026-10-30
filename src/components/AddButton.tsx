"use client";

// The "+" button (T1.14, made into a round floating button by T1.19). One tap
// on it offers two links: "Add income" and "Add expense". Pages put it at the
// END of their content, because that is where it appears on screen (bottom
// right), so reading order and Tab order match what you see.
//
// What this is: a DISCLOSURE. A button with aria-expanded shows or hides a
// block of content (here, two links). We do not use role="menu": a menu promises
// arrow-key movement and special focus rules that we would then have to build,
// and these are just two ordinary links, so Tab works as people expect.
//
// Closing: Escape (focus goes back to the button), a tap outside, or pressing
// the button again. While closed the group has the `hidden` attribute, so the
// links are neither visible nor reachable with Tab.
//
// Where it sits ("position: fixed"): a fixed element is taken out of the page
// flow and stays at the same spot in the WINDOW while the page scrolls, so the
// button is always one tap away. It is 1rem from the right edge (more on a
// phone with a rounded corner, see env(safe-area-inset-right)).
//   - Tabs pinned (normal): the bottom tabs always stay on screen, so the button
//     sits 16px above them, using --nav-h (the tabs' height, written by BottomNav).
//   - Tabs not pinned (very large text): the tabs scroll with the page, so the
//     button sits near the window bottom, and when the tabs scroll into view it
//     lifts by however much of them is visible (--nav-peek, measured below) so it
//     never covers a tab. The CSS for both is `.add-fab` in globals.css.
// Because a fixed button floats ABOVE the page, <main> has extra bottom padding
// (layout.tsx) so the last line of every page can scroll clear of it.
//
// Group order: the group comes AFTER the button in the HTML (so Tab goes button
// then links), but `flex-col-reverse` draws it ABOVE the button.
//
// Why `back` is added: the forms send the artist back to the page named in
// ?back= after Save or Cancel, so "+" brings you back to where you were.
// The value goes through safeBackPath, the same check the forms use, so an odd
// path becomes "/" (Home). `event` and `stream` pre-fill the form; the event
// and stream pages pass them. Order in the address: event, stream, back.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { safeBackPath } from "@/lib/navigation";

const ring =
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300";
// Sizes are in pixels, not rem: 56px across (and links at least 44px tall,
// with 8px and 6px gaps) at any text size. With very large text, rem sizes
// would make the button and the open stack so tall that they no longer fit
// above the tabs on a small screen.
const roundButton = `flex h-[56px] w-[56px] items-center justify-center rounded-full bg-indigo-700 text-[32px] leading-none font-bold text-white shadow-lg shadow-black/30 active:bg-indigo-900 dark:bg-indigo-600 dark:active:bg-indigo-800 ${ring}`;
const smallLink = `flex min-h-[44px] items-center justify-center rounded-full border-2 border-indigo-800 bg-white px-[16px] text-[1.125rem] leading-none font-bold whitespace-nowrap text-indigo-900 shadow-md shadow-black/20 active:bg-indigo-100 dark:border-indigo-300 dark:bg-zinc-900 dark:text-indigo-100 dark:active:bg-zinc-800 ${ring}`;

export default function AddButton({ event, stream }: { event?: string; stream?: string }) {
  // We remember WHICH page the group was opened on. It counts as open only
  // while we are still on that page, so moving to another page (even one that
  // reuses this same component, like /events/a to /events/b) starts it closed.
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const groupId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // A tap or click anywhere outside this component closes the group.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenAt(null);
    }
    // Escape closes the group wherever focus is. (Safari does not focus a
    // button that was clicked with the mouse, so focus may be on <body>, and a
    // key handler on the wrapper alone would never hear the key.) Focus goes
    // back to the button only when it was inside the group or nowhere (<body>),
    // so Escape in some other control never steals focus.
    function onKeyDown(e: KeyboardEvent) {
      // If something else on the page already handled this Escape (say, a
      // dialog closing), leave the group alone: one key press, one close.
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const active = document.activeElement;
      const insideOrNowhere = active === null || active === document.body || !!wrapRef.current?.contains(active);
      setOpenAt(null);
      if (insideOrNowhere) buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Un-pinned tabs (very large text) sit after the page content. Measure how
  // much of them is on screen and write it as --nav-peek on our wrapper; the
  // CSS lifts the button to sit just above that. It is re-measured on scroll, on
  // window resize, when the page or the tabs change size, and whenever BottomNav
  // switches <html data-nav-pinned> (that switch happens a render after the
  // text grows or the phone turns, so the other triggers alone can be too early).
  // All listeners are removed when the button goes away.
  useEffect(() => {
    const wrap = wrapRef.current;
    // This label must match the aria-label on the <nav> in BottomNav.tsx.
    const nav = document.querySelector("nav[aria-label='Main']");
    if (!wrap || !nav) return;
    const root = document.documentElement;
    const measure = () => {
      // Pinned tabs never scroll away, so the CSS does not use --nav-peek then.
      if (root.dataset.navPinned !== "false") return;
      const { top, height } = nav.getBoundingClientRect();
      const visible = Math.min(height, Math.max(0, window.innerHeight - top));
      wrap.style.setProperty("--nav-peek", `${visible}px`);
    };
    let frame = 0;
    const measureNextFrame = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    observer.observe(document.body);
    const attrs = new MutationObserver(measureNextFrame);
    attrs.observe(root, { attributes: true, attributeFilter: ["data-nav-pinned"] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer.disconnect();
      attrs.disconnect();
    };
  }, []);

  // Keeping a tabbed-to element out from under the button. When Tab focuses
  // something, the browser scrolls it into view, leaving a margin
  // (scroll-padding-bottom in globals.css). That margin is a fixed guess and
  // cannot know where the button really is (the lift, the home-bar inset, the
  // text size). So we check the real positions: if the element overlaps the
  // button and is short enough to fit above it, we scroll the page a little
  // more so it sits just above. If it is too tall to fit, we leave it alone:
  // being fully on screen matters more than avoiding the button.
  // Two details:
  //  - The check runs one animation frame AFTER focus, because browsers differ
  //    on whether they scroll to the focused element before or after the focus
  //    event fires (Safari may do it after). Waiting a frame means we measure
  //    after the browser's own scroll, and only if that element is still focused.
  //  - It runs only for keyboard focus (:focus-visible). A mouse or finger press
  //    also focuses a link; scrolling the page between the press and the release
  //    would slide the link away and lose the tap.
  // It also runs while the tabs are pinned, where it normally does nothing, but
  // it covers odd cases such as a large home-bar inset.
  useEffect(() => {
    let frame = 0;
    function check(el: HTMLElement) {
      const wrap = wrapRef.current;
      if (!wrap || document.activeElement !== el || !el.matches(":focus-visible")) return;
      const f = el.getBoundingClientRect();
      const b = buttonRef.current?.getBoundingClientRect();
      if (!b || f.right <= b.left || f.left >= b.right || f.bottom <= b.top || f.top >= b.bottom) return;
      const move = f.bottom - (b.top - 8);
      if (move > 0 && f.top - move >= 0) window.scrollBy({ top: move });
    }
    function onFocusIn(e: FocusEvent) {
      const el = e.target;
      cancelAnimationFrame(frame);
      if (!(el instanceof HTMLElement) || wrapRef.current?.contains(el)) return;
      frame = requestAnimationFrame(() => check(el));
    }
    document.addEventListener("focusin", onFocusIn);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  const query = new URLSearchParams();
  if (event) query.set("event", event);
  if (stream) query.set("stream", stream);
  query.set("back", safeBackPath(pathname));
  const qs = query.toString();

  return (
    <div
      ref={wrapRef}
      className="add-fab fixed right-[max(1rem,env(safe-area-inset-right))] z-20 flex flex-col-reverse items-end gap-[8px]"
    >
      <button
        ref={buttonRef}
        type="button"
        className={roundButton}
        aria-label="Add"
        aria-expanded={open}
        aria-controls={groupId}
        onClick={() => setOpenAt(open ? null : pathname)}
      >
        <span aria-hidden="true">{open ? "\u00d7" : "+"}</span>
      </button>
      <div id={groupId} role="group" aria-label="Add an entry" hidden={!open} className="flex flex-col items-end gap-[6px]">
        <Link href={`/income/new?${qs}`} className={smallLink}>
          Add income
        </Link>
        <Link href={`/expenses/new?${qs}`} className={smallLink}>
          Add expense
        </Link>
      </div>
    </div>
  );
}
