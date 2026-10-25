"use client";

// The Transactions screen's content: every pretend entry, newest first, or a
// friendly empty message. Each row says "Sale" or "Expense" in words (colour
// alone would not help someone who can't tell the colours apart), and shows
// the date, a short description and the amount. Amounts are shown as stored,
// without a minus sign: the word says which kind it is.

import { DRAFT_CATEGORIES, pretendEvents } from "@/lib/pretend-data";
import { formatDateForDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { entriesNewestFirst, type Entry, type PaymentMethod } from "@/lib/entries";
import { useDevice } from "./useDevice";
import { useEntries } from "./EntriesProvider";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  online: "Online",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export default function EntriesList() {
  const device = useDevice();
  const { state } = useEntries();

  // Nothing to format, and nothing that depends on the device: say so at once.
  if (state.entries.length === 0) {
    return <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">No entries yet.</p>;
  }

  // Loading state: dates and amounts need the device's language (see useDevice).
  if (device === null) {
    return (
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300" role="status">
        Loading entries…
      </p>
    );
  }

  const events = pretendEvents(device.today);

  // What the row says about the entry: who you paid or what you sold at.
  function describe(entry: Entry): string {
    if (entry.kind === "expense") {
      if (entry.supplier !== "") return entry.supplier;
      return DRAFT_CATEGORIES.find((c) => c.id === entry.categoryId)?.name ?? "Expense";
    }
    const event = entry.eventId === null ? undefined : events.find((e) => e.id === entry.eventId);
    return event?.name ?? PAYMENT_LABELS[entry.paymentMethod];
  }

  return (
    <ul className="mt-4 flex flex-col divide-y divide-zinc-300 dark:divide-zinc-700">
      {entriesNewestFirst(state.entries).map((entry) => (
        <li key={entry.id} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              <span
                className={
                  entry.kind === "sale"
                    ? "rounded-md bg-emerald-800 px-2 py-0.5 font-semibold text-white"
                    : "rounded-md bg-indigo-800 px-2 py-0.5 font-semibold text-white"
                }
              >
                {entry.kind === "sale" ? "Sale" : "Expense"}
              </span>
              <time dateTime={entry.date}>{formatDateForDisplay(entry.date, device.locale)}</time>
            </p>
            <p className="mt-1 text-base break-words">{describe(entry)}</p>
          </div>
          <span className="shrink-0 text-lg font-semibold tabular-nums">
            {formatCents(entry.amountCents, "AUD", device.locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
