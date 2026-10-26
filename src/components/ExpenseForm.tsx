"use client";

// The "Add expense" form (T1.7, T1.13). The artist types; this file checks it and
// shows what it understood. Nothing is saved until Save is pressed, and even
// then it only goes into the pretend in-memory store (EntriesProvider).
//
// Rules this form follows:
//   - The date comes from the phone's own date picker and starts as today on
//     the device. "Today" is taken once, when the form opens.
//   - The amount is typed as text. parseAmountToCents (T1.4) turns it into
//     whole cents, and "Reads as $12.50" shows the result so a typo is obvious.
//   - Mistakes are explained only after Save is pressed. Save is never
//     disabled: pressing it is how you find out what is wrong.
//   - Only event & venue categories can have an event, and only event & venue
//     and operating categories can have an income stream (guide §7).
//     Production costs have neither and show a note saying so.
//   - Event and Income stream keep their value while hidden (so a pre-filled
//     event isn't lost while browsing categories), but only the fields the
//     chosen category allows are saved.
//   - The page address can pre-fill them (?event=, ?stream=), and ?back= says
//     where Save and Cancel go (checked by safeBackPath). Pre-fill never
//     chooses a category.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { isIsoDate } from "@/lib/dates";
import { parseAmountToCents } from "@/lib/money";
import { safeBackPath } from "@/lib/navigation";
import { DRAFT_CATEGORIES, INCOME_STREAMS, pretendEvents } from "@/lib/pretend-data";
import type { ExpenseGroup } from "@/lib/entries";
import { useDevice } from "./useDevice";
import { useEntries } from "./EntriesProvider";
import {
  badBorder,
  cancelClass,
  describe,
  ERROR_AMOUNT_EMPTY,
  ERROR_AMOUNT_INVALID,
  ERROR_DATE,
  errorClass,
  Field,
  fieldClass,
  LoadingMessage,
  okBorder,
  readsAsClass,
  readsAsText,
  saveClass,
  LOADING_FORM,
} from "./form-parts";

const GROUP_LABELS: { group: ExpenseGroup; label: string }[] = [
  { group: "production", label: "Production" },
  { group: "event_venue", label: "Event & venue" },
  { group: "operating", label: "Operating" },
];

const ERROR_CATEGORY = "Choose a category.";

type Errors = { date?: string; amount?: string; category?: string };

const PRODUCTION_NOTE = "Production costs aren't linked to an event or stream.";

/**
 * The starting event and stream from the page address. An id that is not
 * exactly a known one is ignored. A known stream wins; otherwise a known
 * event brings its usual stream.
 */
function startingChoice(
  streamParam: string | null,
  eventParam: string | null,
  today: string,
): { streamId: string; eventId: string } {
  const event = pretendEvents(today).find((e) => e.id === eventParam);
  const stream = INCOME_STREAMS.find((s) => s.id === streamParam);
  return { streamId: stream?.id ?? event?.usualStreamId ?? "", eventId: event?.id ?? "" };
}

/**
 * Reads the page address (this needs a Suspense boundary in the page, or
 * `next build` fails), then shows the form once the device is known.
 */
export default function ExpenseForm() {
  const device = useDevice();
  const params = useSearchParams();

  // Loading state: the device's language and today's date aren't known until
  // the page has woken up in the browser (see useDevice). The form only
  // mounts after that, so its starting date is read at the moment it opens.
  if (device === null) {
    return <LoadingMessage text={LOADING_FORM} />;
  }
  return (
    <FormFields
      // A different page address starts a fresh form (the whole search string,
      // as in the income form, so a replace to the form's own address resets it).
      key={params.toString()}
      locale={device.locale}
      today={device.today}
      start={startingChoice(params.get("stream"), params.get("event"), device.today)}
      back={safeBackPath(params.get("back"))}
    />
  );
}

function FormFields({
  locale,
  today,
  start,
  back,
}: {
  locale: string;
  today: string;
  start: { streamId: string; eventId: string };
  back: string;
}) {
  const router = useRouter();
  const { dispatch } = useEntries();

  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [eventId, setEventId] = useState(start.eventId);
  const [streamId, setStreamId] = useState(start.streamId);
  const [notes, setNotes] = useState("");
  // Set by the first press of Save with a mistake in the form. From then on
  // the messages follow what is typed (and disappear as soon as it is fixed).
  const [tried, setTried] = useState(false);
  // True once a valid Save has gone through, so a double tap adds only one.
  const savedRef = useRef(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  const category = DRAFT_CATEGORIES.find((c) => c.id === categoryId);
  const asksForEvent = category?.group === "event_venue";
  const asksForStream = category?.group === "event_venue" || category?.group === "operating";
  const isProduction = category?.group === "production";
  const cents = parseAmountToCents(amount);

  // What is wrong right now. Shown only after Save has been pressed.
  const found: Errors = {};
  if (!isIsoDate(date)) found.date = ERROR_DATE;
  if (amount.trim() === "") found.amount = ERROR_AMOUNT_EMPTY;
  else if (cents === null) found.amount = ERROR_AMOUNT_INVALID;
  if (category === undefined) found.category = ERROR_CATEGORY;
  const shown: Errors = tried ? found : {};

  const readsAs = readsAsText(cents, locale);
  const events = pretendEvents(today);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savedRef.current) return;

    if (found.date || found.amount || found.category || cents === null || category === undefined) {
      setTried(true);
      // Focus the first field with a mistake, in form order, so a screen
      // reader reads its label, value and message.
      if (found.date) dateRef.current?.focus();
      else if (found.amount) amountRef.current?.focus();
      else categoryRef.current?.focus();
      return;
    }

    // Make the id first: if it fails (crypto.randomUUID needs HTTPS or
    // localhost), Save must not be left blocked by the double-tap guard.
    const id = crypto.randomUUID();
    savedRef.current = true;
    dispatch({
      type: "add-expense",
      id,
      expense: {
        date,
        supplier,
        amountCents: cents,
        categoryId: category.id,
        // The store refuses an event on production and operating costs, and a
        // stream on production, so each is only sent when the category allows
        // it (hidden fields keep their value but are not saved). "" means none.
        ...(asksForEvent && eventId !== "" ? { eventId } : {}),
        ...(asksForStream && streamId !== "" ? { streamId } : {}),
        notes,
      },
    });
    // replace, not push: Back afterwards shouldn't reopen an empty form.
    router.replace(back);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-5">
      <Field id="expense-date" label="Date">
        <input
          ref={dateRef}
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={shown.date ? true : undefined}
          aria-describedby={describe(shown.date && "expense-date-error")}
          className={fieldClass + (shown.date ? badBorder : okBorder)}
        />
        {shown.date && <p id="expense-date-error" className={errorClass}>{shown.date}</p>}
      </Field>

      <Field id="expense-supplier" label="Supplier (optional)">
        <input
          id="expense-supplier"
          type="text"
          autoComplete="off"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className={fieldClass + okBorder}
        />
      </Field>

      <Field id="expense-amount" label="Amount">
        <input
          ref={amountRef}
          id="expense-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={shown.amount ? true : undefined}
          aria-describedby={describe(readsAs !== "" && "expense-amount-reads", shown.amount && "expense-amount-error")}
          className={fieldClass + (shown.amount ? badBorder : okBorder)}
        />
        {/* Not a live region on purpose: a screen reader reads this line when
            the field is focused (aria-describedby above), so announcing it on
            every keystroke would only be noise. Always on the page, empty
            unless the amount is valid. */}
        <p id="expense-amount-reads" className={readsAsClass}>
          {readsAs}
        </p>
        {shown.amount && <p id="expense-amount-error" className={errorClass}>{shown.amount}</p>}
      </Field>

      <Field id="expense-category" label="Category">
        <select
          ref={categoryRef}
          id="expense-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-invalid={shown.category ? true : undefined}
          aria-describedby={describe(isProduction && "expense-production-note", shown.category && "expense-category-error")}
          className={fieldClass + (shown.category ? badBorder : okBorder)}
        >
          <option value="">Choose a category</option>
          {GROUP_LABELS.map(({ group, label }) => (
            <optgroup key={group} label={label}>
              {DRAFT_CATEGORIES.filter((c) => c.group === group).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {isProduction && (
          <p id="expense-production-note" className="text-base break-words">
            {PRODUCTION_NOTE}
          </p>
        )}
        {shown.category && <p id="expense-category-error" className={errorClass}>{shown.category}</p>}
      </Field>

      {asksForEvent && (
        <Field id="expense-event" label="Event">
          <select
            id="expense-event"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={fieldClass + okBorder}
          >
            <option value="">Not assigned yet</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {asksForStream && (
        <Field id="expense-stream" label="Income stream (optional)">
          <select
            id="expense-stream"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            className={fieldClass + okBorder}
          >
            <option value="">No stream</option>
            {INCOME_STREAMS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field id="expense-notes" label="Notes (optional)">
        <textarea
          id="expense-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          // With the extra field the form is taller. On a small screen at large
          // text, Chromium may then scroll only the caret into view, leaving the
          // textarea half hidden. Scroll the whole box on screen when it gets focus.
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: "nearest" })}
          className={fieldClass + okBorder + " min-h-24"}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          className={saveClass}
        >
          Save
        </button>
        <Link
          href={back}
          className={cancelClass}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
