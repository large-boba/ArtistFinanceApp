"use client";

// The device's language and today's date, for text that depends on them.
//
// The server has no idea what language or time zone the visitor's device uses,
// so it can't print a date like "01/07/2026" or "$1,234.56" the right way.
// If the server guessed and the browser then printed something different,
// React would report a "hydration mismatch" error. useSyncExternalStore solves
// this: while the page wakes up it uses the server answer (null, "not known
// yet"), then switches to the real device values straight after.
// Callers show a loading message while this is null.

import { useSyncExternalStore } from "react";
import { todayOnDevice } from "@/lib/dates";

export type Device = { locale: string; today: string };

// The snapshot is one plain string, so React can compare it by value and only
// re-render when the language or the date really changes.
function getSnapshot(): string {
  return `${navigator.language}|${todayOnDevice()}`;
}

function getServerSnapshot(): null {
  return null;
}

// Re-check when the person comes back to the app (the day may have changed
// overnight) or changes the device language.
function subscribe(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("languagechange", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("languagechange", onChange);
  };
}

export function useDevice(): Device | null {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (snapshot === null) return null;
  const [locale, today] = snapshot.split("|");
  return { locale, today };
}
