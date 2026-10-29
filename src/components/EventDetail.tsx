"use client";

// The body of an event's page (T1.15): its dates, then four sections:
//   1. Takings by day      (cash, card and total for each day, then "Takings")
//   2. Event & venue costs (each cost, then "Event costs")
//   3. Result              (takings minus event costs)
//   4. Other costs         (the artist's optional estimate; see OtherCostsEditor)
// and the note that production costs aren't included (guide §12).
//
// NO MONEY MATHS HERE. Every figure comes ready-made from eventSummary
// (src/lib/summaries.ts); this file only chooses what to show and formats it.
//
// Why "Other costs" is not added anywhere else: it is the artist's estimate
// of what the stock sold at the event cost. That stock was already counted
// once, as a production cost on the day it was bought. Adding it to a
// total as well would count the same money twice. So it shows on THIS page
// only, as the extra line "Result after other costs", and the events list,
// Home, the Expenses tab and the Transactions list never include it.
//
// The page waits for useDevice (the device's language and today's date) before
// it draws anything, because the pretend events' dates depend on "today".

import { formatDateForDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { pretendEvents } from "@/lib/pretend-data";
import { eventSummary } from "@/lib/summaries";
import { formatEventDates } from "@/lib/event-dates";
import CostRow from "./CostRow";
import { useEntries } from "./EntriesProvider";
import { LoadingMessage } from "./form-parts";
import OtherCostsEditor from "./OtherCostsEditor";
import { useDevice } from "./useDevice";

const sectionClass = "mt-8";
const h2Class = "text-xl font-bold break-words";
const mutedClass = "mt-2 text-base text-zinc-700 dark:text-zinc-300";
const itemClass = "rounded-xl border-2 border-zinc-300 px-3 py-2 dark:border-zinc-600";
const totalClass = "mt-3 text-lg break-words";

/** One "Label $X" line: the label, a space, then the (bold) amount. */
function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <p className="text-base break-words">
      {label} <span className="font-bold">{amount}</span>
    </p>
  );
}

export default function EventDetail({ eventId }: { eventId: string }) {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and date aren't known yet.
  if (device === null) return <LoadingMessage text="Loading this event…" />;

  const events = pretendEvents(device.today);
  const event = events.find((e) => e.id === eventId);
  // Error state: the address was checked on the server, so this should never
  // happen; say so plainly rather than draw a broken page.
  if (event === undefined) return <p className="mt-6 text-base">This event could not be found.</p>;

  const { locale } = device;
  const money = (cents: number) => formatCents(cents, "AUD", locale);
  const day = (iso: string) => formatDateForDisplay(iso, locale);
  const summary = eventSummary(state, events, eventId);

  return (
    <>
      <p className="mt-4 text-lg break-words">{formatEventDates(event, locale)}</p>

      <section aria-labelledby="event-takings" className={sectionClass}>
        <h2 id="event-takings" className={h2Class}>
          Takings by day
        </h2>
        {summary.days.length === 0 ? (
          <p className={mutedClass}>No takings yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {summary.days.map((d) => (
              <li key={d.date} className={itemClass}>
                <p className="text-lg font-bold break-words">{day(d.date)}</p>
                <Line label="Cash" amount={money(d.cashCents)} />
                <Line label="Card" amount={money(d.cardCents)} />
                {d.otherCents !== 0 && <Line label="Other" amount={money(d.otherCents)} />}
                <Line label="Total" amount={money(d.totalCents)} />
              </li>
            ))}
          </ul>
        )}
        {summary.days.length > 0 && (
          <p className={totalClass}>
            Takings <span className="font-bold">{money(summary.takingsCents)}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="event-costs" className={sectionClass}>
        <h2 id="event-costs" className={h2Class}>
          Event &amp; venue costs
        </h2>
        {summary.costs.length === 0 ? (
          <p className={mutedClass}>No event &amp; venue costs yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {summary.costs.map((cost) => (
              <CostRow key={cost.id} cost={cost} events={events} locale={locale} />
            ))}
          </ul>
        )}
        {summary.costs.length > 0 && (
          <p className={totalClass}>
            Event costs <span className="font-bold">{money(summary.eventCostsCents)}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="event-result" className={sectionClass}>
        <h2 id="event-result" className={h2Class}>
          Result
        </h2>
        <p className="mt-2 text-2xl break-words">
          Result <span className="font-bold">{money(summary.resultCents)}</span>
        </p>
      </section>

      <section aria-labelledby="event-other-costs" className={sectionClass}>
        <h2 id="event-other-costs" className={h2Class}>
          Other costs
        </h2>
        <p className={mutedClass}>
          Optional. An estimate, such as what the stock you sold here cost. It isn&apos;t added to any other totals.
        </p>
        <OtherCostsEditor
          // A different event is a different figure, so start the editor afresh.
          key={eventId}
          eventId={eventId}
          locale={locale}
          figure={summary.otherCosts}
          resultAfterCents={summary.resultAfterOtherCostsCents}
        />
      </section>

      <p className="mt-8 text-base text-zinc-700 dark:text-zinc-300">Production costs aren&apos;t included here.</p>
    </>
  );
}
