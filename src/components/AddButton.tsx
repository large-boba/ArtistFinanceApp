"use client";

// The "+ Add" button (T1.14). One tap on it offers two big links: "Add income"
// and "Add expense". Pages put it directly under their heading.
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
// Why `back` is added: the forms send the artist back to the page named in
// ?back= after Save or Cancel, so "+ Add" brings you back to where you were.
// The value goes through safeBackPath, the same check the forms use, so an odd
// path becomes "/" (Home). `event` and `stream` pre-fill the form; the event
// and stream pages will pass them later. Order in the address: event, stream, back.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { safeBackPath } from "@/lib/navigation";

const ring =
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300";
const bigButton = `flex min-h-24 w-full items-center justify-center rounded-2xl bg-indigo-800 text-3xl font-bold text-white active:bg-indigo-900 ${ring}`;
const bigLink = `flex min-h-16 w-full items-center justify-center rounded-2xl border-2 border-indigo-800 bg-white text-2xl font-bold text-indigo-900 active:bg-indigo-100 dark:border-indigo-300 dark:bg-zinc-900 dark:text-indigo-100 dark:active:bg-zinc-800 ${ring}`;

export default function AddButton({ event, stream }: { event?: string; stream?: string }) {
  const [open, setOpen] = useState(false);
  const groupId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // A tap or click anywhere outside this component closes the group.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const query = new URLSearchParams();
  if (event) query.set("event", event);
  if (stream) query.set("stream", stream);
  query.set("back", safeBackPath(pathname));
  const qs = query.toString();

  return (
    <div
      ref={wrapRef}
      className="mt-6"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={bigButton}
        aria-expanded={open}
        aria-controls={groupId}
        onClick={() => setOpen((o) => !o)}
      >
        + Add
      </button>
      <div id={groupId} role="group" aria-label="Add an entry" hidden={!open}>
        <Link href={`/income/new?${qs}`} className={`${bigLink} mt-3`}>
          Add income
        </Link>
        <Link href={`/expenses/new?${qs}`} className={`${bigLink} mt-3`}>
          Add expense
        </Link>
      </div>
    </div>
  );
}
