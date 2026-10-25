"use client";

// Home's two running totals: today's sales and today's expenses. "Today" is the
// date on the device (guide §6). The figures come from totalsForDate; money is
// only formatted here, never added up in this file.

import { formatCents } from "@/lib/money";
import { totalsForDate } from "@/lib/entries";
import { useDevice } from "./useDevice";
import { useEntries } from "./EntriesProvider";

export default function TodayTotals() {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and date aren't known until the page
  // has woken up in the browser (see useDevice).
  if (device === null) {
    return (
      <p className="mt-6 text-lg text-zinc-700 dark:text-zinc-300" role="status">
        Loading today&apos;s totals…
      </p>
    );
  }

  const { salesCents, salesCount, expensesCents } = totalsForDate(state.entries, device.today);
  const money = (cents: number) => formatCents(cents, "AUD", device.locale);

  return (
    <div className="mt-6 flex flex-col gap-1">
      <p className="text-xl font-semibold break-words">
        {`Today: ${money(salesCents)} from ${salesCount} ${salesCount === 1 ? "sale" : "sales"}`}
      </p>
      <p className="text-lg break-words text-zinc-800 dark:text-zinc-200">
        {`Today's expenses: ${money(expensesCents)}`}
      </p>
    </div>
  );
}
