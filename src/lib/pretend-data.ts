// PRETEND DATA for Stage 1. The real expense category list is STILL TO DECIDE
// (DECISIONS.md "Still to decide": "Exact expense category list. Draft with
// real artists", guide §7). Nothing here is a decision.
//
// DRAFT_CATEGORIES is a draft only: the example categories from guide §7's
// "Expense groups" table, word for word (first letter capitalised), so the
// screens have something to show. The pretend events below are made up too.
// From Stage 3 both come from the database instead of this file.

import type { ExpenseGroup } from "@/lib/entries";
import { isIsoDate } from "@/lib/dates";

export type ExpenseCategory = { id: string; name: string; group: ExpenseGroup };

/**
 * DRAFT category list (pretend data; the real list is still to decide).
 * Every category belongs to exactly one group (guide §7). The `id` is a stable
 * slug that entries point at; the `name` is what people see.
 */
const draftCategories: ExpenseCategory[] = [
  // Production: making things. Not linked to an event.
  { id: "printing", name: "Printing", group: "production" },
  { id: "merch-manufacturing", name: "Merch manufacturing", group: "production" },
  { id: "art-materials", name: "Art materials", group: "production" },
  { id: "packaging", name: "Packaging", group: "production" },
  { id: "shipping-of-stock", name: "Shipping of stock to you", group: "production" },

  // Event & venue: selling at an event or venue. The app prompts for an
  // event but allows "not assigned yet".
  { id: "stall-table-fees", name: "Stall or table fees", group: "event_venue" },
  { id: "vendor-shelf-rent", name: "Vendor shelf rent", group: "event_venue" },
  { id: "flights", name: "Flights", group: "event_venue" },
  { id: "accommodation", name: "Accommodation", group: "event_venue" },
  { id: "meals", name: "Meals", group: "event_venue" },
  { id: "local-transport", name: "Local transport", group: "event_venue" },
  { id: "display-equipment-hire", name: "Display equipment hire", group: "event_venue" },
  { id: "parking", name: "Parking", group: "event_venue" },

  // Operating: running the business. Not linked to an event.
  { id: "software", name: "Software", group: "operating" },
  { id: "website", name: "Website", group: "operating" },
  { id: "equipment", name: "Equipment", group: "operating" },
  { id: "marketing", name: "Marketing", group: "operating" },
  { id: "payment-fees", name: "Payment fees", group: "operating" },
  { id: "insurance", name: "Insurance", group: "operating" },
  { id: "phone", name: "Phone", group: "operating" },
];

// Frozen (the list and each category) so no screen can change the draft by accident.
export const DRAFT_CATEGORIES: readonly ExpenseCategory[] = Object.freeze(
  draftCategories.map((c) => Object.freeze(c)),
);

/** The event types from guide §7's `events` table. */
export type EventType = "market" | "convention" | "exhibition" | "workshop" | "shelf_rental" | "other";

export type PretendEvent = {
  id: string;
  name: string;
  type: EventType;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD, or null for an ongoing shelf
};

/**
 * Three PRETEND events. One is a market on `today` (so the quick-sale screen
 * has a "today's event" to default to); the other two have fixed dates in the
 * first half of 2026, before this app existed, so for any real `today` exactly
 * one event is running. The ids never change, so entries that point at an
 * event stay valid whatever day it is.
 * Throws RangeError when `today` isn't a real "YYYY-MM-DD" date.
 */
export function pretendEvents(today: string): PretendEvent[] {
  if (!isIsoDate(today)) throw new RangeError("pretendEvents needs today as a real YYYY-MM-DD date");
  return [
    {
      id: "pretend-event-todays-market",
      name: "Pretend weekend market (today)",
      type: "market",
      startDate: today,
      endDate: today,
    },
    {
      id: "pretend-event-comic-con",
      name: "Pretend comic convention",
      type: "convention",
      startDate: "2026-05-16",
      endDate: "2026-05-17",
    },
    {
      id: "pretend-event-zine-workshop",
      name: "Pretend zine workshop",
      type: "workshop",
      startDate: "2026-06-13",
      endDate: "2026-06-13",
    },
  ];
}
