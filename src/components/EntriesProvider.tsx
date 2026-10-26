"use client";

// The pretend-entries store as React state (T1.6). It sits in the root layout,
// so every page can read the same entries, and it keeps them while you move
// between tabs. The entries live ONLY in memory: refresh the page and they are
// gone. That is on purpose for Stage 1 (real saving arrives with the database).
//
// The rules for the entries (what is allowed, how to add, edit, delete) are in
// src/lib/entries.ts. This file only holds the state with useReducer and shares
// it through a React "context" so screens can call useEntries().

import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import { todayOnDevice } from "@/lib/dates";
import {
  createEntriesState,
  entriesReducer,
  type EntriesAction,
  type EntriesState,
} from "@/lib/entries";
import { pretendEvents } from "@/lib/pretend-data";

type EntriesContextValue = { state: EntriesState; dispatch: Dispatch<EntriesAction> };

const EntriesContext = createContext<EntriesContextValue | null>(null);

export default function EntriesProvider({ children }: { children: ReactNode }) {
  // The ids of the pretend events are fixed, so the server and the browser
  // start with the same state (no mismatch while the page wakes up).
  const [state, dispatch] = useReducer(
    entriesReducer,
    pretendEvents(todayOnDevice()).map((e) => e.id),
    createEntriesState,
  );

  // ─── TEST-ONLY BACK DOOR. IT MUST NEVER SHIP. ─────────────────────────────
  // The browser tests have no form to add entries with yet, so in a special
  // test build they use window.__bentoTest to add pretend entries. It can't
  // reach the live site because of two locks:
  //   1. Build lock: the code exists only when the build is made with
  //      NEXT_PUBLIC_E2E=1 (next.config.ts pins the value, so in every normal
  //      build this whole `if` is removed from the shipped JavaScript).
  //   2. Run-time lock: even in the test build, it is only set up on
  //      localhost or 127.0.0.1.
  // It does exactly what a real "add" would: one dispatch with a fresh id.
  // No edit, delete, reset or reading of entries.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        const w = window as unknown as Record<string, unknown>;
        w.__bentoTest = {
          addIncome: (income: Extract<EntriesAction, { type: "add-income" }>["income"]) =>
            dispatch({ type: "add-income", id: crypto.randomUUID(), income }),
          addExpense: (expense: Extract<EntriesAction, { type: "add-expense" }>["expense"]) =>
            dispatch({ type: "add-expense", id: crypto.randomUUID(), expense }),
        };
        return () => {
          delete w.__bentoTest;
        };
      }
    }
  }, []);

  return <EntriesContext.Provider value={{ state, dispatch }}>{children}</EntriesContext.Provider>;
}

/** The entries and the dispatch function. Only works inside EntriesProvider. */
export function useEntries(): EntriesContextValue {
  const value = useContext(EntriesContext);
  if (value === null) throw new Error("useEntries must be used inside EntriesProvider");
  return value;
}
