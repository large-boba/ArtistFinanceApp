// PRETEND DATA for Stage 1. The real expense category list is STILL TO DECIDE
// (DECISIONS.md "Still to decide": "Exact expense category list. Draft with
// real artists", guide §7). Nothing in DRAFT_CATEGORIES is a decision.
//
// DRAFT_CATEGORIES is a draft only: the example categories from guide §7's
// "Expense groups" table, word for word (first letter capitalised), so the
// screens have something to show.
//
// INCOME_STREAMS is different: the seven starting streams ARE decided
// (DECISIONS.md "Income streams", guide §10). Only their ids are new (the
// lead's choice for T1.10). Renaming, adding and archiving streams come later.
//
// The pretend events are made up. Their dates are worked out from "today", so
// there is always a finished convention, a market today and an ongoing shelf.
// From Stage 3 categories, streams and events come from the database instead
// of this file.

import type { ExpenseGroup } from "@/lib/entries";
import { addDays, isIsoDate } from "@/lib/dates";

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

export type IncomeStream = { id: string; name: string };

/**
 * The seven default income streams, in the guide's order (§10). The `id` is a
 * stable slug that income entries point at; the `name` is what people see.
 * To show a stream's name: INCOME_STREAMS.find((s) => s.id === entry.streamId)?.name.
 */
const incomeStreams: IncomeStream[] = [
  { id: "sales-at-events", name: "Sales at events" },
  { id: "online-sales", name: "Online sales" },
  { id: "wholesale", name: "Wholesale" },
  { id: "commissions", name: "Commissions" },
  { id: "vendor-shelf-rental", name: "Vendor shelf rental" },
  { id: "social-media", name: "Social media" },
  { id: "subscription-income", name: "Subscription income" },
];

// Frozen (the list and each stream) so no screen can change them by accident.
export const INCOME_STREAMS: readonly IncomeStream[] = Object.freeze(
  incomeStreams.map((s) => Object.freeze(s)),
);

/** The event types from guide §7's `events` table. */
export type EventType = "market" | "convention" | "exhibition" | "workshop" | "shelf_rental" | "other";

export type PretendEvent = {
  id: string;
  name: string;
  type: EventType;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD, or null for an ongoing shelf
  usualStreamId: string; // an INCOME_STREAMS id: the smart default for this event's income
};

/**
 * Three PRETEND events, with dates worked out from `today`:
 *   1. a comic convention that finished last week: 3 days, from 9 days ago to 7 days ago;
 *   2. a market on `today` (so there is always an event running today);
 *   3. a gallery shelf rental that started 60 days ago and is still going (no end date).
 * Each has a usual income stream (guide §10): a shelf rental's is "Vendor shelf
 * rental", every other event's is "Sales at events". It's only a smart default
 * for new income, not a rule. The ids, names and order never change, so entries
 * that point at an event stay valid whatever day it is.
 * Throws RangeError when `today` isn't a real "YYYY-MM-DD" date.
 */
export function pretendEvents(today: string): PretendEvent[] {
  if (!isIsoDate(today)) throw new RangeError("pretendEvents needs today as a real YYYY-MM-DD date");
  return [
    {
      id: "pretend-event-comic-con",
      name: "Pretend comic convention",
      type: "convention",
      startDate: addDays(today, -9),
      endDate: addDays(today, -7),
      usualStreamId: "sales-at-events",
    },
    {
      id: "pretend-event-todays-market",
      name: "Pretend weekend market (today)",
      type: "market",
      startDate: today,
      endDate: today,
      usualStreamId: "sales-at-events",
    },
    {
      id: "pretend-event-shelf",
      name: "Pretend gallery shelf",
      type: "shelf_rental",
      startDate: addDays(today, -60),
      endDate: null,
      usualStreamId: "vendor-shelf-rental",
    },
  ];
}
