"use client";

// The quick-sale number pad (T1.8, guide §10). Built for a busy stall: one
// hand, a big pad in the bottom half of the screen, and "type the amount, tap
// Save" as the whole job. Everything else is already filled in: the date is
// today on the device, the payment is cash, and the event is today's event.
//
// How it works:
//   - What has been typed is kept as TEXT ("12.50"), exactly as shown. Only at
//     Save does parseAmountToCents turn it into whole cents. No money maths
//     happens in this file; totals come from totalsForDate.
//   - Save adds the sale to the pretend in-memory store, then clears the amount
//     so the pad is ready for the next customer. The pad stays open.
//   - Undo removes the sale saved most recently on this visit. It has no timer:
//     it stays until the next save or until you leave the pad.
//   - A physical keyboard works too: 0-9 . Backspace edit the amount and Enter
//     saves, when nothing else on the page has the keyboard focus.

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { todayOnDevice } from "@/lib/dates";
import { PAYMENT_METHODS, totalsForDate, type PaymentMethod } from "@/lib/entries";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { pretendEvents } from "@/lib/pretend-data";
import { useEntries } from "./EntriesProvider";
import { todaySalesText } from "./TodayTotals";
import { useDevice } from "./useDevice";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  online: "Online",
  bank_transfer: "Bank transfer",
  other: "Other",
};

// The event "running today" in the pretend data (see pretendEvents).
const TODAYS_EVENT_ID = "pretend-event-todays-market";

// Phone-keypad order, row by row. "." and backspace are the two special keys.
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"] as const;
type PadKey = (typeof KEYS)[number];

/**
 * What the typed text becomes after one key. Rules: a digit goes on the end
 * (but replaces a lone "0"); at most 2 digits after the point; a second point
 * is ignored; a point on an empty amount gives "0."; backspace removes the last
 * character. Typing never rounds or guesses.
 */
function applyKey(typed: string, pressed: PadKey): string {
  if (pressed === "backspace") return typed.slice(0, -1);
  if (pressed === ".") {
    if (typed.includes(".")) return typed;
    return typed === "" ? "0." : `${typed}.`;
  }
  if (typed === "0") return pressed;
  const point = typed.indexOf(".");
  if (point !== -1 && typed.length - point - 1 >= 2) return typed;
  return typed + pressed;
}

/** The currency symbol the device's language puts before an AUD amount ("$", or "A$" for en-US). */
function currencySymbol(locale: string): string {
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency: "AUD" }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? "$";
}

function isPadKey(value: string): value is PadKey {
  return (KEYS as readonly string[]).includes(value);
}

// 56px tall (at least the 44px minimum), big text, and a clear focus ring.
// touch-manipulation stops the double-tap-to-zoom delay on fast taps.
const focusRing =
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300";
const keyClass =
  "flex min-h-14 min-w-0 touch-manipulation items-center justify-center rounded-xl border-2 border-zinc-500 bg-white text-3xl font-semibold text-zinc-900 active:bg-zinc-200 dark:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 dark:active:bg-zinc-700 " +
  focusRing;

export default function QuickSale() {
  const device = useDevice();

  // Loading state: the device's language and today's date aren't known until
  // the page has woken up in the browser (see useDevice).
  if (device === null) {
    return (
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300" role="status">
        Loading the pad…
      </p>
    );
  }
  return <Pad locale={device.locale} today={device.today} />;
}

function Pad({ locale, today }: { locale: string; today: string }) {
  const { state, dispatch } = useEntries();
  const events = pretendEvents(today);

  // The text typed so far. The ref copy is updated at the same moment, so even
  // two taps on Save in the same instant read the same, already-cleared value.
  const [typed, setTyped] = useState("");
  const typedRef = useRef("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  // "" means "No event". Starts as today's event when there is one.
  const [eventId, setEventId] = useState(events.some((e) => e.id === TODAYS_EVENT_ID) ? TODAYS_EVENT_ID : "");
  // The sale Undo would remove (and its amount as shown), or null.
  const [last, setLast] = useState<{ id: string; amount: string } | null>(null);
  const [message, setMessage] = useState("");

  const cents = parseAmountToCents(typed);
  const { salesCents, salesCount } = totalsForDate(state.entries, today);

  function setTypedText(next: string) {
    typedRef.current = next;
    setTyped(next);
  }

  function press(pressed: PadKey) {
    setTypedText(applyKey(typedRef.current, pressed));
  }

  function save() {
    const saleCents = parseAmountToCents(typedRef.current);
    if (saleCents === null) return;
    // Make the id first: if it fails (crypto.randomUUID needs HTTPS or
    // localhost), nothing has been cleared yet.
    const id = crypto.randomUUID();
    const amount = formatCents(saleCents, "AUD", locale);
    setTypedText("");
    dispatch({
      type: "add-sale",
      id,
      sale: {
        // The date is read now, at the moment of saving, not when the pad was
        // opened: a pad left open past midnight saves the new day.
        date: todayOnDevice(),
        amountCents: saleCents,
        paymentMethod,
        eventId: eventId === "" ? null : eventId,
      },
    });
    setLast({ id, amount });
    setMessage(`Sale of ${amount} saved.`);
    // Most stall sales are cash, so a leftover "Card" must not stick. The event stays.
    setPaymentMethod("cash");
  }

  function undo() {
    if (last === null) return;
    dispatch({ type: "delete", id: last.id });
    setMessage(`Sale of ${last.amount} removed.`);
    setLast(null);
  }

  // Physical keyboard. It only acts when the keys would otherwise do nothing:
  // not in the Event menu, not with a pad key or button focused (then Enter and
  // Space press that button, and only that one).
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const onPage = target === document.body || target.closest("main") !== null;
    const isRadio = target instanceof HTMLInputElement && target.type === "radio";
    const isDisabledButton = target instanceof HTMLButtonElement && target.disabled;
    const idle = target === document.body || isRadio || isDisabledButton;
    if (!onPage) return;

    const pressed = e.key === "Backspace" ? "backspace" : e.key;
    if (isPadKey(pressed) && (idle || target instanceof HTMLButtonElement)) {
      e.preventDefault();
      press(pressed);
    } else if (e.key === "Enter" && idle) {
      e.preventDefault();
      save();
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  return (
    // The pad is pushed to the bottom of the screen (mt-auto below), so it sits
    // under the thumb. min-h makes this block as tall as the space between the
    // heading and the bottom navigation: 100dvh minus the nav's real height
    // (BottomNav writes --nav-h) minus <main>'s padding (3rem), the heading
    // (2rem) and this block's top margin (1rem).
    <div className="mx-auto mt-4 flex min-h-[calc(100dvh_-_var(--nav-h,4.0625rem)_-_6rem)] max-w-sm flex-col gap-3 md:mx-0">
      {/* The amount, as typed. <output> is a polite live region, so a screen
          reader says each change. Nothing typed shows just the currency symbol. */}
      <output
        aria-label="Amount"
        className="block rounded-xl border-2 border-zinc-500 px-4 py-2 text-right text-5xl font-bold tabular-nums [overflow-wrap:anywhere] dark:border-zinc-400"
      >
        {currencySymbol(locale)}
        {typed}
      </output>

      <p className="text-xl font-semibold break-words">{todaySalesText(salesCents, salesCount, locale)}</p>

      {/* The message is always on the page (empty at first) so a screen reader
          notices when it fills in. Undo stays as long as there is a sale to undo. */}
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p role="status" className="min-w-0 text-lg font-semibold break-words text-emerald-900 dark:text-emerald-300">
          {message}
        </p>
        {last !== null && (
          <button
            type="button"
            onClick={undo}
            className={
              "min-h-11 min-w-11 touch-manipulation rounded-lg border-2 border-indigo-800 px-4 text-lg font-bold text-indigo-900 active:bg-indigo-100 dark:border-indigo-300 dark:text-indigo-100 dark:active:bg-indigo-950 " +
              focusRing
            }
          >
            Undo
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor="sale-event" className="text-base font-semibold">
          Event
        </label>
        <select
          id="sale-event"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className={
            "min-h-12 min-w-0 flex-1 rounded-lg border-2 border-zinc-500 bg-white px-3 py-2 text-base text-zinc-900 dark:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-100 " +
            focusRing
          }
        >
          <option value="">No event</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      {/* Big segmented buttons that are really native radio buttons: each radio
          is stretched invisibly over its label, so a tap lands on the radio and
          arrow keys, focus and screen readers all work as normal. */}
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Payment method</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((method) => (
            <label key={method} className="relative min-w-0 grow">
              <input
                type="radio"
                name="payment-method"
                value={method}
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
                className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
              />
              <span className="flex min-h-11 items-center justify-center rounded-lg border-2 border-zinc-500 px-3 text-center text-base font-semibold text-zinc-900 peer-checked:border-indigo-800 peer-checked:bg-indigo-800 peer-checked:text-white peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600 dark:border-zinc-400 dark:text-zinc-100 dark:peer-checked:border-indigo-300 dark:peer-checked:bg-indigo-300 dark:peer-checked:text-zinc-900 dark:peer-focus-visible:outline-indigo-300">
                {PAYMENT_LABELS[method]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* mt-auto pushes the pad and Save to the bottom of the block. */}
      <div role="group" aria-label="Number pad" className="mt-auto grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "." ? "Decimal point" : k === "backspace" ? "Backspace" : undefined}
            className={keyClass}
          >
            {k === "backspace" ? <span aria-hidden="true">⌫</span> : k}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={cents === null}
        className={
          "min-h-16 w-full touch-manipulation rounded-xl bg-emerald-800 text-2xl font-bold text-white active:bg-emerald-900 disabled:bg-zinc-300 disabled:text-zinc-600 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400 " +
          focusRing
        }
      >
        Save
      </button>
    </div>
  );
}
