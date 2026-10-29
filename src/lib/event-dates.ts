// How an event's dates are written on screen (T1.15), shared by the events
// list and the event page so the two always agree. Only text is made here;
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
