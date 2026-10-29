"use client";

// The list of events on the Events tab (T1.15). Each row is ONE link to the
// event's page and shows its name, its dates and its Result.
//
// The Result is the plain one from eventSummary (takings minus event costs).
// An event's "Other costs" figure is NOT in it: that figure is an estimate
// that only appears on the event's own page (see EventDetail.tsx).
//
// Nothing is added up in this file: eventSummary does the money, we only
// format it. Dates are shown the way the device's language writes them, and
// "today" (which the pretend events' dates are worked out from) is the
// device's, so the list waits for useDevice before it draws anything.

import Link from "next/link";
import { formatCents } from "@/lib/money";
import { pretendEvents } from "@/lib/pretend-data";
import { eventSummary } from "@/lib/summaries";
import EventDates from "./EventDates";
import { useEntries } from "./EntriesProvider";
import { LoadingMessage } from "./form-parts";
import { useDevice } from "./useDevice";

export default function EventsList() {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and date aren't known yet.
  if (device === null) return <LoadingMessage text="Loading your events…" />;

  const events = pretendEvents(device.today);
  // Empty state (the list is fixed for now, but Stage 4 lets artists add events).
  if (events.length === 0) return <p className="mt-6 text-base">No events yet.</p>;

  // role="list": Safari and VoiceOver drop list meaning when bullets are hidden by CSS.
  return (
    <ul role="list" className="mt-6 flex flex-col gap-3">
      {events.map((event) => {
        const { resultCents } = eventSummary(state, events, event.id);
        return (
          <li key={event.id}>
            <Link
              href={`/events/${event.id}`}
              className="block min-h-16 rounded-2xl border-2 border-zinc-500 px-4 py-3 active:bg-indigo-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-400 dark:active:bg-zinc-800 dark:focus-visible:outline-indigo-300"
            >
              <span className="block text-xl font-bold break-words">{event.name}</span>
              <span className="mt-1 block text-base break-words text-zinc-700 dark:text-zinc-300">
                <EventDates event={event} locale={device.locale} />
              </span>
              <span className="mt-1 block text-lg break-words">
                Result <span className="font-bold">{formatCents(resultCents, "AUD", device.locale)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
