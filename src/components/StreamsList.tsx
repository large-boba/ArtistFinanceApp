"use client";

// The list of income streams on the Income tab (T1.16). Each row is ONE link
// to the stream's page and shows its name, its Income and its Result.
//
// The figures come from streamSummary (src/lib/summaries.ts). Nothing is added
// up here: we only format. The summary needs the event list (a cost linked to
// an event counts toward that event's usual stream), and the pretend events'
// dates depend on today's date, so we wait for useDevice before drawing.

import Link from "next/link";
import { formatCents } from "@/lib/money";
import { INCOME_STREAMS, pretendEvents } from "@/lib/pretend-data";
import { streamSummary } from "@/lib/summaries";
import { useEntries } from "./EntriesProvider";
import { LoadingMessage } from "./form-parts";
import { useDevice } from "./useDevice";

export default function StreamsList() {
  const device = useDevice();
  const { state } = useEntries();

  // Loading state: the device's language and date aren't known yet.
  if (device === null) return <LoadingMessage text="Loading your income…" />;

  // Empty state (the seven streams are fixed, but say so rather than draw nothing).
  if (INCOME_STREAMS.length === 0) return <p className="mt-6 text-base">No income streams yet.</p>;

  const events = pretendEvents(device.today);

  // role="list": Safari and VoiceOver drop list meaning when bullets are hidden by CSS.
  return (
    <ul role="list" className="mt-6 flex flex-col gap-3">
      {INCOME_STREAMS.map((stream) => {
        const { incomeCents, resultCents } = streamSummary(state, events, stream.id);
        return (
          <li key={stream.id}>
            <Link
              href={`/income/${stream.id}`}
              className="block min-h-16 rounded-2xl border-2 border-zinc-500 px-4 py-3 active:bg-indigo-50 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-400 dark:active:bg-zinc-800 dark:focus-visible:outline-indigo-300"
            >
              <span className="block text-xl font-bold break-words">{stream.name}</span>
              <span className="mt-1 block text-lg break-words">
                Income <span className="font-bold">{formatCents(incomeCents, "AUD", device.locale)}</span>
              </span>
              <span className="block text-lg break-words">
                Result <span className="font-bold">{formatCents(resultCents, "AUD", device.locale)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
