"use client";

// Home's "This month" summary (T1.18): income, expenses and net for the
// calendar month that today falls in. "Today" is the date on the device
// (guide §6).
//
// Why a month and not a day: artists record how events went after the fact
// (DECISIONS.md "What the app is for"), so one day's total is often empty
// while the month shows the real picture.
//
// No money maths here: monthRange picks the first and last day, rangeTotals
// adds everything up, and this file only formats the answers for display.

import { formatCents } from "@/lib/money";
import { formatMonthForDisplay, monthRange } from "@/lib/dates";
import { rangeTotals } from "@/lib/summaries";
import { LoadingMessage } from "./form-parts";
import { useDevice } from "./useDevice";
import { useEntries } from "./EntriesProvider";

export default function MonthSummary() {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and date aren't known until the page
  // has woken up in the browser (see useDevice).
  if (device === null) return <LoadingMessage text="Loading this month's totals…" />;

  const { from, to } = monthRange(device.today);
  const totals = rangeTotals(state, from, to);
  const money = (cents: number) => formatCents(cents, "AUD", device.locale);

  // Each line is a label plus its figure in its own span. break-words lets a
  // huge figure wrap instead of pushing the page sideways at 320 px / 200% text.
  const line = (label: string, cents: number, isNet = false) => (
    <p className={`break-words ${isNet ? "text-xl font-semibold" : "text-lg text-zinc-800 dark:text-zinc-200"}`}>
      {label} <span className="font-semibold">{money(cents)}</span>
    </p>
  );

  return (
    // aria-live="polite" sits on the section itself (not role="status", which
    // would replace its region role). When an entry is added, a screen reader
    // announces the changed figures when it is next free, without interrupting.
    <section aria-labelledby="month-summary-heading" aria-live="polite" className="mt-6 flex flex-col gap-1">
      <h2 id="month-summary-heading" className="text-lg font-bold break-words">
        This month
      </h2>
      <p className="text-base break-words text-zinc-700 dark:text-zinc-300">
        {formatMonthForDisplay(from, device.locale)}
      </p>
      {line("Income", totals.incomeCents)}
      {line("Expenses", totals.expensesCents)}
      {line("Net", totals.netCents, true)}
    </section>
  );
}
