// One cost, drawn as a list item (T1.17).
//
// WHY ONE SHARED ROW: a cost appears on three screens (the Expenses tab, an
// event's page and an income stream's page). If each screen drew its own row,
// they would slowly drift apart: one would show the notes, another wouldn't.
// So all three use this component and a cost always reads the same way.
// It renders the <li> itself, so the three lists share one class string.
//
// The lines, in order (each its own block): the date, the category, the
// supplier (if set), "<event> · <stream>" (or whichever is set), the notes
// (if set), and the amount.
//
// NO MONEY MATHS: the amount is only formatted here, never added up.

import type { ExpenseEntry } from "@/lib/entries";
import { formatDateForDisplay } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { DRAFT_CATEGORIES, INCOME_STREAMS, type PretendEvent } from "@/lib/pretend-data";

const rowClass = "rounded-xl border-2 border-zinc-300 px-3 py-2 dark:border-zinc-600";

export default function CostRow({
  cost,
  events,
  locale,
}: {
  cost: ExpenseEntry;
  events: readonly PretendEvent[]; // from pretendEvents(today)
  locale: string;
}) {
  const category = DRAFT_CATEGORIES.find((c) => c.id === cost.categoryId)?.name ?? "Unknown category";
  const eventName =
    cost.eventId === null ? null : (events.find((e) => e.id === cost.eventId)?.name ?? "Unknown event");
  const streamName =
    cost.streamId === null ? null : (INCOME_STREAMS.find((s) => s.id === cost.streamId)?.name ?? "Unknown stream");
  // "<event> · <stream>", or whichever one is set.
  const link = [eventName, streamName].filter((p) => p !== null).join(" · ");

  return (
    <li className={rowClass}>
      <p className="text-base break-words">
        <time dateTime={cost.date}>{formatDateForDisplay(cost.date, locale)}</time>
      </p>
      <p className="text-lg font-bold break-words">{category}</p>
      {cost.supplier !== "" && <p className="text-base break-words">{cost.supplier}</p>}
      {link !== "" && <p className="text-base break-words">{link}</p>}
      {cost.notes !== "" && <p className="text-base break-words">{cost.notes}</p>}
      <p className="text-base font-bold break-words">{formatCents(cost.amountCents, "AUD", locale)}</p>
    </li>
  );
}
