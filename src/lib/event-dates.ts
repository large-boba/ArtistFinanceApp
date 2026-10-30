// How an event's dates are written (T1.15), as plain text. The screens use
// src/components/EventDates.tsx, which writes the same words but wraps each
// date in a <time> element (T1.17c); keep the two in step. Only text is made here;
// the dates are formatted with formatDateForDisplay, never with `new Date(...)`.
//   one day:  "01/07/2026"
//   several:  "22/06/2026 to 24/06/2026"
//   ongoing:  "From 02/05/2026, ongoing"

import { formatDateForDisplay } from "./dates";
import type { PretendEvent } from "./pretend-data";

export function formatEventDates(event: PretendEvent, locale: string): string {
  const start = formatDateForDisplay(event.startDate, locale);
  if (event.endDate === null) return `From ${start}, ongoing`;
  if (event.endDate === event.startDate) return start;
  return `${start} to ${formatDateForDisplay(event.endDate, locale)}`;
}
