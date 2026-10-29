"use client";

// The body of an income stream's page (T1.16): Income, Costs, Result, and (for
// the two streams that come from events) Events.
//
// NO MONEY MATHS HERE. Every figure comes ready-made from streamSummary
// (src/lib/summaries.ts); this file only chooses what to show and formats it.
//
// Which costs count toward a stream, and why: a cost counts toward the stream
// it was tagged with. If it has no tag but is linked to an event, it counts
// toward that event's usual stream (a convention's table fee reduces "Sales at
// events"). Anything else, such as production costs, counts toward no stream.
// Each cost counts toward at most one stream, so adding up all the streams
// never counts a cost twice. "Other costs" estimates never count at all.
//
// The page waits for useDevice (the device's language and today's date) before
// it draws anything, because the pretend events' dates depend on "today".

import Link from "next/link";
import { STREAMS_WITH_EVENTS } from "@/lib/entries";
import { formatDateForDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { INCOME_STREAMS, pretendEvents } from "@/lib/pretend-data";
import { streamSummary } from "@/lib/summaries";
import CostRow from "./CostRow";
import { useEntries } from "./EntriesProvider";
import { LoadingMessage, PAYMENT_LABELS } from "./form-parts";
import { useDevice } from "./useDevice";

const sectionClass = "mt-8";
const h2Class = "text-xl font-bold break-words";
const mutedClass = "mt-2 text-base text-zinc-700 dark:text-zinc-300";
const itemClass = "rounded-xl border-2 border-zinc-300 px-3 py-2 dark:border-zinc-600";
const totalClass = "mt-3 text-lg break-words";
const linkClass =
  "block min-h-16 rounded-2xl border-2 border-zinc-500 px-4 py-3 text-lg font-bold break-words active:bg-indigo-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-400 dark:active:bg-zinc-800 dark:focus-visible:outline-indigo-300";

export default function StreamDetail({ streamId }: { streamId: string }) {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and date aren't known yet.
  if (device === null) return <LoadingMessage text="Loading this stream…" />;

  // Error state: the address was checked on the server, so this should never happen.
  if (!INCOME_STREAMS.some((s) => s.id === streamId)) {
    return <p className="mt-6 text-base">This income stream could not be found.</p>;
  }

  const { locale } = device;
  const events = pretendEvents(device.today);
  const money = (cents: number) => formatCents(cents, "AUD", locale);
  const day = (iso: string) => formatDateForDisplay(iso, locale);
  const eventName = (id: string) => events.find((e) => e.id === id)?.name ?? "Unknown event";
  const summary = streamSummary(state, events, streamId);
  const streamEvents = events.filter((e) => e.usualStreamId === streamId);

  return (
    <>
      <section aria-labelledby="stream-income" className={sectionClass}>
        <h2 id="stream-income" className={h2Class}>
          Income
        </h2>
        {summary.income.length === 0 ? (
          <p className={mutedClass}>No income yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {summary.income.map((row) => (
              <li key={row.id} className={itemClass}>
                <p className="text-base break-words">{day(row.date)}</p>
                <p className="text-lg font-bold break-words">
                  {row.eventId === null
                    ? PAYMENT_LABELS[row.paymentMethod]
                    : `${eventName(row.eventId)} · ${PAYMENT_LABELS[row.paymentMethod]}`}
                </p>
                {row.notes !== "" && <p className="text-base break-words">{row.notes}</p>}
                <p className="text-base font-bold break-words">{money(row.amountCents)}</p>
              </li>
            ))}
          </ul>
        )}
        {summary.income.length > 0 && (
          <p className={totalClass}>
            Income <span className="font-bold">{money(summary.incomeCents)}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="stream-costs" className={sectionClass}>
        <h2 id="stream-costs" className={h2Class}>
          Costs
        </h2>
        <p className={mutedClass}>
          Costs count here when they&apos;re tagged with this stream, or, with no stream tag, linked to an event that usually earns from it.
        </p>
        {summary.costs.length === 0 ? (
          <p className={mutedClass}>No costs yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {summary.costs.map((cost) => (
              <CostRow key={cost.id} cost={cost} events={events} locale={locale} />
            ))}
          </ul>
        )}
        {summary.costs.length > 0 && (
          <p className={totalClass}>
            Costs <span className="font-bold">{money(summary.costsCents)}</span>
          </p>
        )}
      </section>

      <section aria-labelledby="stream-result" className={sectionClass}>
        <h2 id="stream-result" className={h2Class}>
          Result
        </h2>
        <p className="mt-2 text-2xl break-words">
          Result <span className="font-bold">{money(summary.resultCents)}</span>
        </p>
      </section>

      {STREAMS_WITH_EVENTS.includes(streamId) && (
        <section aria-labelledby="stream-events" className={sectionClass}>
          <h2 id="stream-events" className={h2Class}>
            Events
          </h2>
          {streamEvents.length === 0 ? (
            <p className={mutedClass}>No events yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {streamEvents.map((event) => (
                <li key={event.id}>
                  <Link href={`/events/${event.id}`} className={linkClass}>
                    {event.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
