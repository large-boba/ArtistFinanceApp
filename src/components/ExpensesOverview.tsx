"use client";

// The body of the Expenses tab (T1.17): the three group totals plus the grand
// total, then every expense, newest first.
//
// NO MONEY MATHS HERE. Every figure comes ready-made from expensesSummary
// (src/lib/summaries.ts); this file only chooses what to show and formats it.
// Each row is the shared CostRow, so a cost reads the same on the event and
// stream pages. Income and an event's "Other costs" estimate never appear.

import { formatCents } from "@/lib/money";
import { pretendEvents } from "@/lib/pretend-data";
import { expensesSummary } from "@/lib/summaries";
import CostRow from "./CostRow";
import { useEntries } from "./EntriesProvider";
import { LoadingMessage } from "./form-parts";
import { useDevice } from "./useDevice";

const h2Class = "text-xl font-bold break-words";

export default function ExpensesOverview() {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and today's date aren't known yet.
  if (device === null) return <LoadingMessage text="Loading your expenses…" />;

  const { locale } = device;
  const events = pretendEvents(device.today);
  const money = (cents: number) => formatCents(cents, "AUD", locale);
  const summary = expensesSummary(state);

  return (
    <>
      <section aria-labelledby="expenses-totals" className="mt-8">
        <h2 id="expenses-totals" className={h2Class}>
          Totals
        </h2>
        <div className="mt-2 flex flex-col gap-1">
          <p className="text-base break-words">
            Production <span className="font-bold">{money(summary.productionCents)}</span>
          </p>
          <p className="text-base break-words">
            Event &amp; venue <span className="font-bold">{money(summary.eventVenueCents)}</span>
          </p>
          <p className="text-base break-words">
            Operating <span className="font-bold">{money(summary.operatingCents)}</span>
          </p>
          <p className="mt-1 text-lg break-words">
            Total expenses <span className="font-bold">{money(summary.totalCents)}</span>
          </p>
        </div>
      </section>

      <section aria-labelledby="expenses-all" className="mt-8">
        <h2 id="expenses-all" className={h2Class}>
          All expenses
        </h2>
        {summary.expenses.length === 0 ? (
          <p className="mt-2 text-base text-zinc-700 dark:text-zinc-300">No expenses yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {summary.expenses.map((cost) => (
              <CostRow key={cost.id} cost={cost} events={events} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
