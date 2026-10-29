// Pieces the expense form and the income form share (T1.13a), so the two can't
// drift apart: the same field look, the same labels, the same amount messages.
// Nothing in here holds state or needs the browser, so it works in both server
// and client components.

import type { ReactNode } from "react";
import type { PaymentMethod } from "@/lib/entries";
import { amountProblem, formatCents } from "@/lib/money";

// ─── Words ───────────────────────────────────────────────────────────────────

// What a form shows while the device's language and date are still unknown.
export const LOADING_FORM = "Loading the form…";

export const ERROR_DATE = "Choose a date.";
export const ERROR_AMOUNT_EMPTY = "Enter an amount.";
export const ERROR_AMOUNT_INVALID =
  "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places.";
// Change this together with MAX_AMOUNT_CENTS in src/lib/money.ts (the owner's cap).
export const ERROR_AMOUNT_TOO_LARGE = "Enter an amount up to $9,999,999.99.";

/**
 * The message for a typed amount, or undefined when it is fine. Empty gets the
 * field's own message; a format mistake beats size; too large gets its own.
 */
export function amountError(text: string, emptyMessage: string = ERROR_AMOUNT_EMPTY): string | undefined {
  const problem = amountProblem(text);
  if (problem === null) return undefined;
  if (problem === "empty") return emptyMessage;
  return problem === "too-large" ? ERROR_AMOUNT_TOO_LARGE : ERROR_AMOUNT_INVALID;
}

/** How each way of being paid is written on screen (forms and the entries list). */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  online: "Online",
  bank_transfer: "Bank transfer",
  other: "Other",
};

// ─── Looks ───────────────────────────────────────────────────────────────────

// 48px tall (at least the 44px minimum), 16px text so iPhones don't zoom in,
// and a clear focus ring. min-w-0 lets a field shrink inside a narrow screen.
export const fieldClass =
  "block min-h-12 w-full min-w-0 rounded-lg border-2 bg-white px-3 py-2 text-base text-zinc-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:outline-indigo-300 ";
export const okBorder = "border-zinc-500 dark:border-zinc-400";
export const badBorder = "border-red-700 dark:border-red-400";
export const labelClass = "block text-base font-semibold break-words";
export const errorClass = "mt-1 text-base font-semibold break-words text-red-800 dark:text-red-300";
export const readsAsClass = "mt-1 text-base font-semibold break-words";

export const saveClass =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-indigo-800 px-4 text-xl font-bold text-white active:bg-indigo-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300";
export const cancelClass =
  "flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-lg font-semibold text-indigo-900 underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-200 dark:focus-visible:outline-indigo-300";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Joins the ids of the messages that apply to a field into its
 * `aria-describedby`. Falsy entries are skipped; nothing at all gives
 * `undefined`, so the attribute is left off.
 */
export const describe = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

/**
 * The "Reads as $12.50" text for a valid amount, or "" while there is none.
 * It is NOT a live region: a screen reader reads it when the field is focused
 * (each field's `aria-describedby` points at it), so announcing it on every
 * keystroke would only be noise.
 */
export function readsAsText(cents: number | null, locale: string): string {
  return cents === null ? "" : `Reads as ${formatCents(cents, "AUD", locale)}`;
}

// ─── Parts ───────────────────────────────────────────────────────────────────

/** One labelled field: the label is tied to its control by `id`. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass + " mb-1"}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** The loading state: shown until the device's language and date are known (see useDevice). */
export function LoadingMessage({ text }: { text: string }) {
  return (
    <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300" role="status">
      {text}
    </p>
  );
}
