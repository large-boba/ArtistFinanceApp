// Summaries for Stage 1 (T1.10c): how one event went, how one income stream
// is doing, and the totals for a date range. Guide §12 "By event or venue" and
// "By income stream"; DECISIONS.md "Event 'Other costs'" and "Linking costs to
// events and streams". The detailed decisions are written at the top of
// src/lib/summaries.test.ts.
//
// All new adding up of money goes here: screens show what these functions
// return and never add amounts themselves, so every screen agrees. (Since
// T1.18, Home's summary is rangeTotals for this month: monthRange in dates.ts
// gives the first and last day, and rangeTotals adds up everything between.)
//
// Everything here is "pure": no clock, no saving or loading, and the state and
// event list passed in are never changed. Money is whole cents, added up
// exactly with addCents/subtractCents (src/lib/entries.ts), which refuse with a
// RangeError rather than give an inexact answer. Results may be negative (a
// loss is shown as it is).
//
// Why "Other costs" are left out of stream and range totals: an event's "Other
// costs" figure is the artist's estimate of what the stock sold there cost.
// That stock was already counted once, as a production cost on the day it was
// bought. Adding the figure to a stream or a month as well would count the
// same money twice. So it only appears in that one event's own summary, as an
// extra line: "this is what the event made once you allow for the stock".

import { isIsoDate } from "@/lib/dates";
import {
  addCents,
  entriesNewestFirst,
  subtractCents,
  type EntriesState,
  type ExpenseEntry,
  type IncomeEntry,
  type OtherCosts,
} from "@/lib/entries";
import { INCOME_STREAMS, type PretendEvent } from "@/lib/pretend-data";

// ─── By event ────────────────────────────────────────────────────────────────

/** One day's takings at an event, split by how the money was paid. */
export type EventDay = {
  date: string; // YYYY-MM-DD
  cashCents: number;
  cardCents: number;
  otherCents: number; // paid any other way: online, bank transfer or "other"
  totalCents: number; // cash + card + other
};

export type EventSummary = {
  days: EventDay[]; // oldest date first
  takingsCents: number; // all the days' totals added up
  costs: readonly ExpenseEntry[]; // event & venue costs linked to the event, oldest date first
  eventCostsCents: number; // those costs added up
  resultCents: number; // takings − event costs
  otherCosts: Readonly<OtherCosts> | null; // the event's "Other costs" figure, if it has one
  resultAfterOtherCostsCents: number | null; // result − other costs; null when there's no figure
};

/**
 * How one event went: its takings day by day, its costs, and what's left.
 *
 * - The takings are every income entry linked to the event (any stream, $0
 *   rows included), grouped into one line per date.
 * - The event costs are the event & venue expenses linked to the event.
 *   (Production costs can never be linked to an event, so they never appear.)
 *   A cost's stream tag doesn't matter here: it still belongs to its event.
 * - The result is takings minus event costs.
 * - If the artist entered an "Other costs" figure, the result after other
 *   costs is the result minus that figure. With no figure it is null, not 0,
 *   so a screen can tell "no figure entered" from "a figure of $0".
 *
 * Throws RangeError if the event isn't in `events`, or if a total would go
 * past ±Number.MAX_SAFE_INTEGER cents.
 */
export function eventSummary(state: EntriesState, events: readonly PretendEvent[], eventId: string): EventSummary {
  if (!events.some((e) => e.id === eventId)) throw new RangeError("unknown event");

  // Takings, one running line per date. A Map keeps one line per date while
  // we go through the entries; the lines are sorted by date afterwards.
  const byDate = new Map<string, EventDay>();
  for (const entry of state.entries) {
    if (entry.kind !== "income" || entry.eventId !== eventId) continue;
    const day = byDate.get(entry.date) ?? { date: entry.date, cashCents: 0, cardCents: 0, otherCents: 0, totalCents: 0 };
    if (entry.paymentMethod === "cash") day.cashCents = addCents(day.cashCents, entry.amountCents);
    else if (entry.paymentMethod === "card") day.cardCents = addCents(day.cardCents, entry.amountCents);
    else day.otherCents = addCents(day.otherCents, entry.amountCents);
    byDate.set(entry.date, day);
  }
  // "YYYY-MM-DD" strings sort correctly as plain text, so no Date is needed.
  const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let takingsCents = 0;
  for (const day of days) {
    day.totalCents = addCents(addCents(day.cashCents, day.cardCents), day.otherCents);
    takingsCents = addCents(takingsCents, day.totalCents);
  }

  // Event costs: oldest date first; on the same date, in the order added.
  const costs = state.entries
    .map((entry, addedAt) => ({ entry, addedAt }))
    .filter(
      (item): item is { entry: ExpenseEntry; addedAt: number } =>
        item.entry.kind === "expense" && item.entry.group === "event_venue" && item.entry.eventId === eventId,
    )
    .sort((a, b) => {
      if (a.entry.date !== b.entry.date) return a.entry.date < b.entry.date ? -1 : 1;
      return a.addedAt - b.addedAt;
    })
    .map(({ entry }) => entry);
  let eventCostsCents = 0;
  for (const cost of costs) eventCostsCents = addCents(eventCostsCents, cost.amountCents);

  const resultCents = subtractCents(takingsCents, eventCostsCents);

  // The "Other costs" figure is looked up only for this event, and only here.
  const otherCosts = Object.hasOwn(state.otherCosts, eventId) ? state.otherCosts[eventId] : null;
  const resultAfterOtherCostsCents = otherCosts === null ? null : subtractCents(resultCents, otherCosts.amountCents);

  return { days, takingsCents, costs, eventCostsCents, resultCents, otherCosts, resultAfterOtherCostsCents };
}

// ─── By income stream ────────────────────────────────────────────────────────

export type StreamSummary = {
  income: readonly IncomeEntry[]; // this stream's income, newest first
  incomeCents: number; // that income added up
  costs: readonly ExpenseEntry[]; // the costs counted toward this stream, newest first
  costsCents: number; // those costs added up
  resultCents: number; // income − costs
};

/**
 * Which income stream a cost counts toward, if any. Each cost counts toward
 * one stream at most, so no cost is ever counted twice across streams:
 *   1. its own stream tag, if the artist gave it one;
 *   2. otherwise, if it's linked to an event, that event's usual stream
 *      (e.g. a convention's table fee counts toward "Sales at events");
 *   3. otherwise no stream (e.g. production costs, or software with no tag).
 * Throws RangeError for an untagged cost linked to an event that isn't in the
 * event list: it can't be placed, and quietly dropping it would hide a cost.
 */
function streamOfCost(cost: ExpenseEntry, usualStreams: ReadonlyMap<string, string>): string | null {
  if (cost.streamId !== null) return cost.streamId;
  if (cost.eventId === null) return null;
  const usual = usualStreams.get(cost.eventId);
  if (usual === undefined) throw new RangeError("a cost is linked to an event that isn't in the event list");
  return usual;
}

/**
 * How one income stream is doing: its income, the costs counted toward it
 * (see streamOfCost above), and income minus costs.
 * "Other costs" figures are never part of this (see the top of this file).
 * Throws RangeError for an unknown stream id, for a cost that can't be placed,
 * or if a total would go past ±Number.MAX_SAFE_INTEGER cents.
 */
export function streamSummary(state: EntriesState, events: readonly PretendEvent[], streamId: string): StreamSummary {
  if (!INCOME_STREAMS.some((s) => s.id === streamId)) throw new RangeError("unknown income stream");

  // event id → that event's usual stream, from the event list we were given.
  const usualStreams = new Map(events.map((e) => [e.id, e.usualStreamId]));

  const income: IncomeEntry[] = [];
  const costs: ExpenseEntry[] = [];
  // entriesNewestFirst gives both lists their order: later date first, and on
  // the same date the entry added later first.
  for (const entry of entriesNewestFirst(state.entries)) {
    if (entry.kind === "income") {
      if (entry.streamId === streamId) income.push(entry);
    } else if (streamOfCost(entry, usualStreams) === streamId) {
      // streamOfCost runs for EVERY cost, so a cost that can't be placed is
      // reported whichever stream was asked for.
      costs.push(entry);
    }
  }

  let incomeCents = 0;
  for (const entry of income) incomeCents = addCents(incomeCents, entry.amountCents);
  let costsCents = 0;
  for (const entry of costs) costsCents = addCents(costsCents, entry.amountCents);

  return { income, incomeCents, costs, costsCents, resultCents: subtractCents(incomeCents, costsCents) };
}

// ─── By date range ───────────────────────────────────────────────────────────

export type RangeTotals = {
  incomeCents: number; // all income dated in the range
  expensesCents: number; // all expenses dated in the range (every group)
  netCents: number; // income − expenses
};

/**
 * The totals for every entry dated from `from` to `to`, both days included
 * (e.g. "2026-06-01" to "2026-06-30" is all of June). Every stream and every
 * expense group counts; "Other costs" figures never do (see the top of this
 * file). Throws RangeError for a date that isn't a real "YYYY-MM-DD" date,
 * for `from` after `to`, or if a total would go past ±Number.MAX_SAFE_INTEGER
 * cents.
 */
export function rangeTotals(state: EntriesState, from: string, to: string): RangeTotals {
  if (!isIsoDate(from) || !isIsoDate(to)) throw new RangeError("dates must be real YYYY-MM-DD dates");
  // "YYYY-MM-DD" strings compare correctly as plain text.
  if (from > to) throw new RangeError("the range must not start after it ends");

  let incomeCents = 0;
  let expensesCents = 0;
  for (const entry of state.entries) {
    if (entry.date < from || entry.date > to) continue;
    if (entry.kind === "income") incomeCents = addCents(incomeCents, entry.amountCents);
    else expensesCents = addCents(expensesCents, entry.amountCents);
  }
  return { incomeCents, expensesCents, netCents: subtractCents(incomeCents, expensesCents) };
}

// ─── The Expenses tab ────────────────────────────────────────────────────────

export type ExpensesSummary = {
  expenses: readonly ExpenseEntry[]; // every expense, newest first
  productionCents: number; // the production expenses added up
  eventVenueCents: number; // the event & venue expenses added up
  operatingCents: number; // the operating expenses added up
  totalCents: number; // production + event & venue + operating
};

/**
 * Everything the Expenses tab shows: every expense, newest first, and a total
 * for each of the three groups plus a grand total.
 *
 * - The list holds the store's own entry objects (each once), so a screen can
 *   open one to edit it. Income is never in it.
 * - Each cost is added to the group stored on the entry itself.
 * - "Other costs" figures never count (see the top of this file).
 * - The totals aren't limited by the $9,999,999.99 per-entry cap: many big
 *   costs can add up to more than that.
 *
 * Throws RangeError if a group total or the grand total would go past
 * Number.MAX_SAFE_INTEGER cents.
 */
export function expensesSummary(state: EntriesState): ExpensesSummary {
  const expenses: ExpenseEntry[] = [];
  let productionCents = 0;
  let eventVenueCents = 0;
  let operatingCents = 0;
  // entriesNewestFirst gives the list its order: later date first, and on the
  // same date the entry added later first. It returns a new list, so the
  // state's own list is left as it was.
  for (const entry of entriesNewestFirst(state.entries)) {
    if (entry.kind !== "expense") continue;
    expenses.push(entry);
    switch (entry.group) {
      case "production":
        productionCents = addCents(productionCents, entry.amountCents);
        break;
      case "event_venue":
        eventVenueCents = addCents(eventVenueCents, entry.amountCents);
        break;
      case "operating":
        operatingCents = addCents(operatingCents, entry.amountCents);
        break;
      default: {
        // If a fourth group is ever added, TypeScript stops the build here
        // instead of quietly counting its costs as one of the three above.
        const unknownGroup: never = entry.group;
        throw new RangeError(`unknown expense group: ${String(unknownGroup)}`);
      }
    }
  }

  const totalCents = addCents(addCents(productionCents, eventVenueCents), operatingCents);
  return { expenses, productionCents, eventVenueCents, operatingCents, totalCents };
}
