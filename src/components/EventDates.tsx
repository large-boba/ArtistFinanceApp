// An event's dates with each date in a <time> element (T1.17c).
//
// It reads exactly like formatEventDates (src/lib/event-dates.ts) and must stay
// in step with it:
//   one day:  "01/07/2026"
//   several:  "22/06/2026 to 24/06/2026"
//   ongoing:  "From 02/05/2026, ongoing"   (only the "From" date is a <time>)
// <time dateTime> carries the stored YYYY-MM-DD date for assistive technology;
// the visible text is the person's locale format. It draws no wrapper, so the
// caller chooses the element around it.

import { formatDateForDisplay } from "@/lib/dates";
import type { PretendEvent } from "@/lib/pretend-data";

export default function EventDates({ event, locale }: { event: PretendEvent; locale: string }) {
  const start = <time dateTime={event.startDate}>{formatDateForDisplay(event.startDate, locale)}</time>;
  if (event.endDate === null) return <>From {start}, ongoing</>;
  if (event.endDate === event.startDate) return start;
  return (
    <>
      {start} to <time dateTime={event.endDate}>{formatDateForDisplay(event.endDate, locale)}</time>
    </>
  );
}
